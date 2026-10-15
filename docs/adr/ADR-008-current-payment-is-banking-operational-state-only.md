# ADR-008 — `currentPayment` is banking operational state only

- **Estado:** ACEPTADA (definitiva)
- **Fecha:** 2026-10-14
- **Feature:** Pagamentos Recorrentes (PR #146)
- **Documento principal:** [`../recurring-payments.md`](../recurring-payments.md) §21, §22, §24, §29

---

## Contexto

La ejecución bancaria es **asíncrona y con estado externo**:

```text
Glória ordena el pago
    ↓
church-banking lo crea en Asaas
    ↓
la operación vive en el banco durante horas o días
    ↓
un webhook confirma (o falla, o queda bloqueada)
```

Entre el momento de la orden y el webhook, Glória **debe** recordar:

- qué competencia se está pagando;
- qué intento es;
- con qué `externalReference` (para correlacionar el webhook);
- qué monto se autorizó;
- desde qué cuenta;
- en qué estado está la operación;
- el `identificationField` si es boleto (para poder reintentar un `CREATION_UNKNOWN` con payload idéntico).

Sin ese recuerdo, un webhook entrante no se puede correlacionar, y no se puede evitar un segundo pago mientras el primero está en vuelo.

### Cómo lo resuelve `CURRENT`

`CurrentRecurringPayment` (`src/Financial/domain/RecurringPayments.ts:38-52`):

```ts
export type CurrentRecurringPayment = {
  competence: string
  attempt: number
  externalReference: string
  amount: number
  bankId: string
  availabilityAccountId: string
  status: RecurringPaymentExecutionStatus   // PROCESSING | BLOCKED | FAILED
  providerStatus: string
  failureCode?: string
  identificationField?: string
  paymentDate?: string
  transactionReceiptUrl?: string
  updatedAt: Date
}
```

Embebido en el documento de la recurrencia como `currentPayment?`.

### Las defensas que habilita (verificadas)

**1. Invariancia de dominio** — `reserveCurrentPayment` falla si ya hay un `currentPayment` no-`FAILED` (`:140-149`).

**2. Compare-and-swap atómico** — `saveIfCurrentPaymentMatches` hace un `replaceOne` cuyo filtro incluye el estado esperado completo (`RecurringPaymentsMongoRepository.ts:22-45`):

```ts
collection.replaceOne(
  {
    recurringPaymentsId, churchId,
    "currentPayment.competence": expected.competence,
    "currentPayment.attempt": expected.attempt,
    "currentPayment.externalReference": expected.externalReference,
    "currentPayment.status": expected.status,
    "currentPayment.updatedAt": expected.updatedAt,
  },
  recurringPayment.toPrimitives()
)
```

Solo un ganador obtiene `matchedCount === 1`. Los demás reciben `RECURRING_PAYMENT_IN_PROGRESS` o releen al ganador (`ExecuteRecurringPayment.ts:151-165`).

**3. Índice único de referencia activa** (`RecurringPaymentsMongoRepository.ts:56-63`):

```text
idx_recurring_payments_active_reference_unique
  { "currentPayment.externalReference": 1 }   unique, sparse
```

Impide que existan dos referencias bancarias activas simultáneamente.

**4. Verificación de referencia en las transiciones** — `updateCurrentPayment` y `closeCurrentPayment` fallan si el `externalReference` no coincide (`:151-173`), evitando que un webhook tardío de un intento viejo sobrescriba uno nuevo.

**Esta es una defensa seria y correcta contra el doble pago bancario y debe preservarse.**

### El riesgo que este ADR evita

Al añadir el flujo manual (ADR-003), aparece la tentación de **simetría**: "el bancario tiene `currentPayment`, entonces el manual también debería tenerlo". Se crearía un `currentPayment` manual con estados como `REGISTERING` → `REGISTERED` → `PAID`, y una máquina de limpieza.

**Pero el flujo manual no tiene estado externo.** La operación es una escritura local síncrona. No hay nada que correlacionar, nada que esperar, ningún webhook pendiente.

Un `currentPayment` manual añadiría:

- una **segunda fuente de verdad** sobre si el pago ocurrió (el `currentPayment` y el `FinancialRecord`);
- **estados intermedios artificiales** que solo existen porque el código los creó;
- una **máquina de limpieza** para registros que quedan a medias (¿qué pasa si el usuario cierra el navegador después de subir el comprobante?);
- **cero invariancias nuevas**: la protección real contra doble registro manual ya la da el índice único `recurringPaymentId + recurringCompetence` (ADR-004).

---

## Decisión

> **`currentPayment` es exclusivamente estado operativo bancario en vuelo. No es historial. No se introduce en el flujo manual.**

### Responsabilidades (exhaustivas)

`currentPayment` existe **solamente** para:

- evitar doble pago;
- guardar competencia;
- guardar intento (`attempt`);
- guardar `externalReference`;
- correlacionar webhook;
- representar `PROCESSING` / `BLOCKED` / `FAILED`;
- conservar información necesaria para completar el `FinancialRecord`.

### Lo que `currentPayment` NO es

| No es | Es |
|---|---|
| Historial de pagos | Estado transitorio de una operación |
| Fuente de verdad de `PAID` | Insumo para crear el `FinancialRecord` |
| Registro de competencias pagadas | Registro de **una** competencia en vuelo |
| Aplicable al flujo manual | Exclusivo del flujo bancario |

`currentPayment` se **cierra** (se elimina) en cuanto existe el `FinancialRecord` (`closeCurrentPayment`, `:163-173`).

### `currentPayment` es de un solo uso y de una sola competencia

Solo puede existir **un** `currentPayment` a la vez. Si el usuario intenta pagar una competencia distinta mientras hay una en vuelo, se rechaza con `RECURRING_PAYMENT_IN_PROGRESS` (`ExecuteRecurringPayment.ts:103-105`).

Consecuencia: **la recurrencia es una unidad de serialización.** No se puede pagar octubre y noviembre en paralelo para la misma recurrencia. Es correcto: evita la carrera por la misma cuenta y el mismo compromiso.

---

## Consecuencias — Estrategia de doble registro manual

**La pregunta obligatoria de §22:** ¿cómo se evita el doble registro manual?

### Decisión: el índice único es la protección principal

```text
recurringPaymentId + recurringCompetence
  → idx_financial_record_recurring_competence_unique  (unique, partial)
```

Esta invariancia es **dura, atómica y persistente**. Sobrevive a reinicios, reintentos, carreras entre procesos y múltiples instancias. Es la única que no depende de lógica de aplicación.

**Análisis de cobertura:**

| Escenario | ¿Basta el índice único? |
|---|---|
| Dos requests concurrentes de registro manual | **Sí.** Una inserta; la otra recibe duplicate-key. |
| Usuario hace doble clic | **Sí.** Igual. |
| Reintento del cliente tras timeout de red | **Sí.** La segunda inserción falla; se responde idempotente. |
| Upload del comprobante ya subido y luego falla el insert | **No cubierto.** Queda el archivo huérfano (ADR-005, P-07). |
| Corregir un registro manual ya creado (monto/fecha erróneos) | **No cubierto.** El índice **prohíbe** un segundo registro. Requiere edición o `VOID`+nuevo (P-08). |

### Conclusión explícita

```text
NO introducir currentPayment manual solo por simetría.
No aporta ninguna invariancia real que el índice único no dé ya.
```

### Si se necesita un estado intermedio

Usar el **propio** `FinancialRecord`:

```text
FinancialRecord.status = PENDING   →   FinancialRecord.status = CLEARED
```

Mantiene **una sola fuente de verdad** y **una sola máquina de estados**. Es la forma correcta de modelar "registrado pero pendiente de validación" sin `currentPayment`.

### Si se necesita una reserva temporal por concurrencia

**No es necesaria.** El índice único ya resuelve la carrera en el punto de inserción. Una reserva previa solo añadiría un estado que hay que limpiar si el proceso muere entre la reserva y el insert.

Si en el futuro se demuestra una necesidad real (p. ej. uploads muy costosos que conviene serializar antes de subir), debe documentarse como **excepción explícita**, con:

- la invariancia concreta que aporta (que el índice único no dé);
- su política de expiración;
- la tarea de limpieza.

No como simetría con el flujo bancario.

---

## Alternativas consideradas y rechazadas

| Alternativa | Por qué se rechaza |
|---|---|
| `currentPayment` también para el flujo manual | No hay estado externo que correlacionar. Crea una segunda fuente de verdad y una máquina de limpieza sin invariancia nueva. |
| Guardar el histórico de `currentPayment` (lista de intentos pasados) | Es exactamente `RecurringPaymentHistory`, prohibido por ADR-004. El histórico es `FinancialRecord`; los intentos fallidos que no produjeron pago no son hechos contables. |
| Usar `currentPayment` para marcar `PAID` | `PAID` es la existencia del `FinancialRecord` (ADR-004). `currentPayment` se cierra precisamente cuando el registro existe. |
| Eliminar `currentPayment` y derivar todo del `FinancialRecord` | **Imposible en el flujo bancario.** Antes del webhook no existe `FinancialRecord`, pero sí hay una operación viva en el banco que hay que correlacionar y proteger. Sin `currentPayment` se perdería la competencia, el intento, la referencia y la protección contra doble pago. |
| Guardar `currentPayment` en una colección separada | Fragmentaría el agregado y rompería la atomicidad del CAS. El `replaceOne` con filtro de estado esperado funciona precisamente porque el estado operativo vive en el mismo documento que la configuración. **Mantener embebido.** |
| Mantener el `currentPayment` después de crear el `FinancialRecord` | Retendría información duplicada y bloquearía la siguiente competencia. `closeCurrentPayment` lo elimina correctamente. |

---

## Verificación de cumplimiento

- [ ] `currentPayment` está embebido en el documento de la recurrencia.
- [ ] `currentPayment` **no** existe en recurrencias ejecutadas por el flujo manual.
- [ ] `currentPayment` se elimina cuando existe el `FinancialRecord` de esa competencia.
- [ ] `reserveCurrentPayment` rechaza reservar si hay un `currentPayment` no-`FAILED`.
- [ ] `saveIfCurrentPaymentMatches` usa el filtro de estado esperado completo (CAS real).
- [ ] `idx_recurring_payments_active_reference_unique` existe y es `unique, sparse`.
- [ ] `updateCurrentPayment` y `closeCurrentPayment` validan el `externalReference`.
- [ ] Solo puede existir un `currentPayment` a la vez; una competencia distinta en vuelo se rechaza.
- [ ] **No** existe ningún campo de estado operativo manual equivalente en `RecurringPayment`.
- [ ] Un test de concurrencia verifica que dos reservas simultáneas producen **un** ganador.
- [ ] Un test verifica que un webhook con `externalReference` incorrecto no modifica el `currentPayment` (`RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH`).
- [ ] Un test verifica que el flujo manual **no** crea `currentPayment`.

---

## Referencias

- `src/Financial/domain/RecurringPayments.ts:10-11,38-52,121-181`
- `src/Financial/infrastructure/persistence/RecurringPaymentsMongoRepository.ts:22-45,56-63`
- `src/Financial/applications/recurringPayments/ExecuteRecurringPayment.ts:101-168,353-366`
- `src/Webhook/infrastructure/services/ProcessRecurringPaymentBankingUpdate.service.ts`
- ADR-003, ADR-004, ADR-005
- Gap analysis: GAP-11

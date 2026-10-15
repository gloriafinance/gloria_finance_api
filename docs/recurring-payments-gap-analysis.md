# Pagamentos Recorrentes — Análisis de gaps y tabla de casos funcionales

> Comparación **TARGET** contra **CURRENT**, verificada contra el código.
> Base: `gloria_finance_api` rama `chore/recurring-payments`, commit `8f415387` (PR #146) y `church-banking` `main`, commit `0f2089d`.
> Documento principal: [`recurring-payments.md`](./recurring-payments.md)

---

## 1. Tabla de casos funcionales (obligatoria)

| Asaas | Tipo | PIX guardado | Acción UI | Datos solicitados |
|---|---|---|---|---|
| No | FIXED | N/A | Registrar pagamento | fecha, cuenta, comprobante |
| No | VARIABLE | N/A | Registrar pagamento | **valor**, fecha, cuenta, comprobante |
| Sí | FIXED | Sí | Pagar | confirmación |
| Sí | FIXED | No | Pagar | PIX o boleto + datos destino |
| Sí | VARIABLE | No/Sí | Pagar | valor + PIX o boleto |

### 1.1 Desglose detallado por caso

| # | Asaas | Tipo | `pixDestination` | Método efectivo | `amount` en el comando | Datos de destino | Endpoint | Estado final de éxito |
|---|---|---|---|---|---|---|---|---|
| 1 | No | FIXED | N/A | No aplica | **Prohibido** | — | `POST .../register-payment` | `PAID` directo |
| 2 | No | VARIABLE | N/A | No aplica | **Obligatorio** | — | `POST .../register-payment` | `PAID` directo |
| 3 | Sí | FIXED | Sí | PIX | **Prohibido** | ninguno (de `pixDestination`) | `POST .../pay` | `PROCESSING` → `PAID` |
| 4a | Sí | FIXED | No | PIX | **Prohibido** | `pixKey` + `pixKeyType` | `POST .../pay` | `PROCESSING` → `PAID` |
| 4b | Sí | FIXED | No | BILL | **Prohibido** | `identificationField` | `POST .../pay` | `PROCESSING` → `PAID` |
| 5a | Sí | VARIABLE | No | PIX | **Obligatorio** | `pixKey` + `pixKeyType` | `POST .../pay` | `PROCESSING` → `PAID` |
| 5b | Sí | VARIABLE | No | BILL | **Obligatorio** | `identificationField` | `POST .../pay` | `PROCESSING` → `PAID` |
| 5c | Sí | VARIABLE | Sí | PIX | **Obligatorio** | ninguno (de `pixDestination`) | `POST .../pay` | `PROCESSING` → `PAID` |
| 5d | Sí | VARIABLE | Sí | BILL (override) | **Obligatorio** | `identificationField` | `POST .../pay` | `PROCESSING` → `PAID` |

### 1.2 ¿Puede un `pixDestination` guardado reutilizarse para `VARIABLE`?

**Recomendación: sí.**

Razón: el destino PIX es una propiedad del **acreedor** ("a quién se le paga"), no del tipo de monto ("cuánto se paga"). Que el monto sea fijo o variable no cambia a quién se le paga.

```text
Energia elétrica — VARIABLE — pixDestination = { CNPJ, 98765432000110 }

Ejecución:
  Valor                → el usuario lo informa (VARIABLE)
  Como deseja pagar?   → PIX (ya conocido, se puede preseleccionar)
  Chave PIX            → no se pregunta
```

**Pero debe permitirse cambiar el destino para una ejecución concreta** si el producto lo requiere (§39 del pedido original). Un cambio puntual:

- se usa para **esa** ejecución;
- **no** modifica `pixDestination` (salvo el flag explícito "Salvar esta chave" — `PENDING` P-03).

**Estado:** recomendación documentada, **no cerrada**. Si no existe definición suficiente, queda registrada como **decisión pendiente P-11**.

| # | Decisión pendiente | Recomendación | Bloquea |
|---|---|---|---|
| P-11 | Reutilizar `pixDestination` para `VARIABLE` | **Sí**, permitiendo override puntual | Caso 5c/5d, ADR-007 |

---

## 2. Matriz de gaps verificados

Leyenda de severidad:

| Nivel | Significado |
|---|---|
| **BLOQUEANTE** | Impide un caso de uso completo de la feature |
| **ALTO** | Viola una decisión arquitectónica aceptada |
| **MEDIO** | Correcto pero incompleto o frágil |
| **BAJO** | Deuda menor, contrato o robustez |

---

### GAP-01 — `payment.method` obligatorio dentro de `RecurringPayment` — **ALTO**

> **GAP: Payment method incorrectly belongs to permanent recurring configuration.**

**Requerido por el pedido (§38) y confirmado.**

**CURRENT** (`src/Financial/domain/RecurringPayments.ts:8,22-24`):

```ts
export type RecurringPaymentMethod = "PIX" | "BILL"

export type RecurringPaymentConfigurationData = {
  ...
  payment:
    | { method: "PIX"; pixKey: string; pixKeyType: PixKeyType }
    | { method: "BILL" }
  ...
}
```

**Validator** (`RecurringPayment.validator.ts`):

```ts
"payment.method": "required|string|in:PIX,BILL",
```

**Uso en ejecución** (`ExecuteRecurringPayment.ts:228,243-261`): el método se resuelve desde la configuración, nunca desde el comando.

**Violación:** ADR-001.

**Impacto:**
- Una recurrencia no puede cambiar de método entre meses sin editar el compromiso.
- El comando de ejecución no puede elegir método.

**Requerido (TARGET):** eliminar `payment` de la configuración; añadir `payment` al comando de ejecución.

---

### GAP-01b — No existe flujo de registro manual — **BLOQUEANTE**

El gap más severo. Una iglesia **sin Asaas no puede usar pagamentos recorrentes en absoluto**.

**Verificado:**
- Único endpoint de ejecución: `POST /api/v1/recurring-payments/:recurringPaymentId/pay` (`RecurringPayment.controller.ts:113-138`) → siempre bancario.
- `ExecuteRecurringPayment` siempre llama a `findConnectedAccount` y falla con `RECURRING_PAYMENT_BANK_ACCOUNT_UNAVAILABLE` si no hay cuenta (`:131,196,210,216`).
- `RegisterRecurringPaymentFinancialRecord` **no tiene entrypoint HTTP**; solo lo invocan `ExecuteRecurringPayment` y el webhook.
- **No existe `multipart/form-data`** en ningún punto del repositorio.

**Violación:** ADR-003.

**Requerido (TARGET):** `POST /api/v1/recurring-payments/:id/register-payment` con `multipart/form-data`.

---

### GAP-02 — `costCenterId` ausente en `RecurringPayment` — **ALTO**

**CURRENT:** `costCenter` no aparece en ninguna ruta de recurrencia (agregado, request, validator, casos de uso). Verificado por búsqueda exhaustiva.

Consecuencias:
- El validator lo **rechaza**: `hasOnlyKeys(body, ["name","financialConceptId","type","amount","dayOfMonth","payment","status"])` → 422 `RECURRING_PAYMENT_PAYLOAD_INVALID`.
- `RegisterRecurringPaymentFinancialRecord` **no** propaga `costCenter` (`:66-89`), aunque `CreateFinanceRecord.costCenter` y `FinanceRecord.costCenter` sí lo soportan.
- **Resultado: todo `FinancialRecord` de recurrencia se crea sin centro de costo**, degradando los reportes de centros de costo (`idx_cost_centers`).

**Violación:** ADR-002 y la invariancia contable.

**Requerido (TARGET):** `costCenterId` obligatorio en la configuración; propagado al `FinancialRecord` en ambos caminos. Sin migración: la feature no tiene datos productivos.

---

### GAP-03 — Comprobante (voucher) no obligatorio; sin upload en flujo manual — **ALTO**

**CURRENT:** el voucher es opcional y solo existe en el camino bancario, derivado del recibo de Asaas:

```ts
// RegisterRecurringPaymentFinancialRecord.ts:57-62
const voucher = transactionReceiptUrl
  ? await this.receiptStorage.save(payment.externalReference, transactionReceiptUrl)
  : undefined
```

No existe ningún endpoint que reciba archivos.

**Violación:** ADR-005.

**Requerido (TARGET):** `voucher` obligatorio en el registro manual, vía `multipart/form-data` y `StorageProviderService`.

---

### GAP-04 — PIX no puede informarse en la ejecución; método no elegible — **ALTO**

**CURRENT:** el validator de ejecución solo acepta tres campos:

```ts
hasOnlyKeys(body, ["competence", "amount", "identificationField"])
```

No acepta `pixKey` ni `pixKeyType`. Y `ExecuteRecurringPayment` exige coherencia con la configuración:

```ts
// :79-90
if (recurring.getPayment().method === "BILL" && !request.identificationField?.trim())
  throw new PaymentError("RECURRING_PAYMENT_BILL_CODE_REQUIRED")
if (recurring.getPayment().method === "PIX" && request.identificationField !== undefined)
  throw new PaymentError("RECURRING_PAYMENT_INVALID")
```

**Impacto:**
- Casos 4a, 5a (PIX informado en ejecución) son **imposibles**.
- Una recurrencia `BILL` nunca puede pagarse por PIX; una `PIX` nunca puede pagarse por boleto.
- Caso 4b funciona, pero solo si la configuración ya es `BILL` — es decir, la elección no es del usuario en la ejecución sino del compromiso.

**Violación:** ADR-001, ADR-007.

**Requerido (TARGET):** `payment: { type, ... }` en el comando de ejecución; validación cruzada contra `pixDestination`.

---

### GAP-05 — `BILL` prohíbe tener `pixDestination` — **MEDIO**

**CURRENT:** el validator impone claves exactas según el método:

```ts
const paymentKeys = payment.method === "PIX"
  ? ["method", "pixKey", "pixKeyType"]
  : ["method"]
hasOnlyKeys(payment, paymentKeys)
```

Una recurrencia `BILL` **no puede** guardar una chave PIX como alternativa.

**Violación:** ADR-007.

**Requerido (TARGET):** `pixDestination` es un campo independiente y opcional, compatible con cualquier método de ejecución.

---

### GAP-06 — `HAS_CONNECTED_BANK_ACCOUNT` requiere **exactamente una** cuenta activa — **ALTO**

**CURRENT** (`ExecuteRecurringPayment.ts:191-219`):

```ts
const [match, ...otherMatches] = matches
if (!match || otherMatches.length > 0) {
  throw new PaymentError("RECURRING_PAYMENT_BANK_ACCOUNT_UNAVAILABLE")
}
```

**Impacto:** una iglesia con **dos o más** cuentas activas y conectadas **no puede ejecutar ningún pago recurrente**. El sistema interpreta "tiene banca" como "tiene exactamente una cuenta no ambigua".

Esto contradice:
- el principio de §6 (la capacidad bancaria pertenece a la iglesia);
- la realidad de §11 (una iglesia puede pagar desde Itaú un mes y Caixa el siguiente);
- la asimetría con el flujo manual, que sí soporta N cuentas vía selección.

**Requerido (TARGET):** separar `HAS_CONNECTED_BANK_ACCOUNT` (booleano de la iglesia) de la cuenta concreta de la ejecución; exponer el booleano al frontend. Ver `PENDING` P-01.

---

### GAP-07 — No existe registro manual del `FinancialRecord` (mismo que GAP-01b, detalle de datos)

Se documenta por separado porque el pedido (§38) exige revisar "creación del FinancialRecord con CostCenter".

**CURRENT:** el único camino de creación de `FinancialRecord` de recurrencia es `RegisterRecurringPaymentFinancialRecord`, invocado solo desde `ExecuteRecurringPayment` y el webhook. Este caso de uso:

| Aspecto | CURRENT | TARGET manual |
|---|---|---|
| `source` | `FinancialRecordSource.AUTO` (hardcoded, `:74`) | `MANUAL` |
| `status` | `FinancialRecordStatus.RECONCILED` (bancario) | `CLEARED`; concilia a `RECONCILED` |
| `createdBy` | `"system"` (hardcoded, `:78`) | usuario autenticado |
| `costCenter` | **no propagado** | de la recurrencia (ADR-002) |
| `voucher` | de `transactionReceiptUrl` | archivo obligatorio |
| `availabilityAccountId` | de `currentPayment` | del request |
| `bankingExternalReference` | URN | ausente |

**Es el punto de convergencia** donde debe extenderse la lógica, no duplicarse (ADR-003).

---

### GAP-08 — `financialRecordId` determinístico por `externalReference` — **BAJO** (verificar en manual)

**CURRENT** (`RegisterRecurringPaymentFinancialRecord.ts:63-68`):

```ts
const digest = createHash("sha256").update(payment.externalReference).digest("hex")
// ...
financialRecordId: `urn:financialRecord:${digest}`
```

Es **idempotente para el camino bancario** (mismo `externalReference` → mismo id).

**Riesgo en el camino manual (TARGET):** un registro manual **no** tiene `externalReference`. Debe definirse el esquema de id determinístico para el manual — candidato natural:

```text
urn:financialRecord:{sha256(recurringPaymentId + ":" + recurringCompetence)}
```

Esto refuerza la idempotencia a nivel de `financialRecordId` (que ya tiene índice único, `idx_financialRecordId`).

**Requerido (TARGET):** definir y documentar el esquema de `financialRecordId` para el flujo manual.

---

### GAP-09 — `church-banking` no acepta `value` en bill payment — **ALTO** (`PENDING` P-02)

**Verificado en `church-banking`:**

```ts
// apps/api/src/http/validations/bill-payment.validation.ts:5-11
export type CreateBillPaymentHttpPayload = {
  readonly externalAccountId: string
  readonly identificationField: string
  readonly description: string
  readonly externalReference: string
  readonly context: Record<string, unknown>
}
```

Reglas con `exactKeys` — no se aceptan campos extra. **No hay `value` ni `dueDate`.**

Asaas deriva el valor del boleto, y `church-banking` **no lo devuelve** al integrador (el snapshot público expone solo `providerBillId, paymentDate, transactionReceiptUrl, failureCode|errorCode` — `apps/api/src/services/bill-payment.service.ts:45-74`).

**Impacto:** en una ejecución `BILL`, el `amount` que Glória registra es el **informado por el usuario**, no verificable contra lo que Asaas debitó. El webhook **no** puede validar el monto para BILL (a diferencia de PIX, donde sí se valida `amountInCents`).

**Requerido:** decisión de producto (`PENDING` P-02) antes de implementar el caso 4b/5b definitivamente.

---

### GAP-10 — Fan-out de webhooks de `church-banking` — **MEDIO**

`church-banking` hace fan-out a **todos** los bindings activos de la cuenta (`create-banking-outgoing-money-outbound-events.use-case.ts:32-35`). Glória puede recibir un evento cuyo `externalAccountId` provenga de un binding distinto del que originó la operación.

**CURRENT:** la correlación ya es defensiva:

- `findOperation(externalAccountId, accountId, externalReference, context)`;
- `assertDuplicateContext(churchId, recurringPaymentId, externalReference, context, externalAccountId)`.

**Riesgo residual:** el tipo del webhook en Glória **no declara** `clientId` ni `requestId`, que `church-banking` **sí envía** (`banking-webhook-event.ts:96-115`). `clientId` es justamente el campo que permitiría defender el fan-out.

**Requerido (TARGET):** declarar `clientId` y `requestId` en el tipo del webhook y usarlos en la correlación.

---

### GAP-11 — Ningún mecanismo manual para evitar doble registro — **MEDIO**

**CURRENT:** la protección bancaria (`currentPayment` + CAS + índice único) existe y es sólida. Para el flujo manual **no existe nada**, porque el flujo manual no existe.

**TARGET:** el índice único `idx_financial_record_recurring_competence_unique` **ya existe** y es suficiente. **No** introducir `currentPayment` manual (ADR-008).

**Requerido (TARGET):** implementar el registro manual apoyándose en el índice existente; añadir tests de duplicate-key.

---

### GAP-12 — `REFUNDED` no revierte contabilidad — **MEDIO** (`PENDING` P-04)

**CURRENT** (`ProcessRecurringPaymentBankingUpdate.processPix`, `:113-119`): solo registra un log:

> `"Recognized recurring PIX refund; accounting reversal requires a business rule"`

`FinancialRecordType.REVERSAL` existe y no se usa para esto.

**Requerido:** decisión contable (`PENDING` P-04).

---

### GAP-13 — Nomenclatura `recurringPaymentsId` (plural) vs `recurringPaymentId` (singular) — **BAJO**

**CURRENT:** inconsistencia de nomenclatura verificada:

| Ubicación | Nombre |
|---|---|
| `RecurringPayment` (agregado, PK) | `recurringPaymentsId` (plural) |
| `FinancialRecord.recurringPaymentId` | singular |
| `FinancialRecord` `reference.entityId` | contiene un id plural |
| `ListRecurringPayments` | usa `getRecurringPaymentsId()` |
| URL del endpoint | `/api/v1/recurring-payments/:recurringPaymentId/pay` |
| `context.recurringPaymentId` (hacia `church-banking`) | singular |

**Impacto:** confusión para implementadores y frontend; riesgo de errores en la correlación.

**Requerido (TARGET):** unificar a **singular** (`recurringPaymentId`). Sin migración: la feature no tiene datos productivos.

Se marca **BAJO** porque es cosmético, pero debe resolverse junto con GAP-01/GAP-02, ya que ambos tocan los mismos documentos.

---

### GAP-14 — Despacho de webhook no exhaustivo — **BAJO**

**CURRENT** (`ChurchBanking.controller.ts:85-103`):

```ts
if (body.type === "BANKING_PAYMENT_UPDATED") { ... }
else if (body.type === "BANKING_PIX_TRANSFER_UPDATED") { ... }
else { await this.recurringPaymentWebhook.processBill(body) }
```

El `else` final asume BILL. Funciona porque el validador restringe el tipo, pero un cuarto evento caería silenciosamente en `processBill`, violando *No hidden transitions*.

**Requerido (TARGET):** `else if (body.type === "BANKING_BILL_PAYMENT_UPDATED")` + caso por defecto que rechace explícitamente.

---

### GAP-15 — Patrón de inyección inconsistente en el router de webhooks — **BAJO**

**CURRENT:** `ProcessAsaasTransactionService` se instancia inline por request; `recurringPaymentWebhook` parece ser un campo del controller.

**Requerido (TARGET):** unificar el patrón (preferible: inyectado por constructor, por testabilidad y consistencia).

---

## 3. Checklist de verificación del PR #146 (pedido §38)

Revisión explícita de cada punto solicitado:

| # | Punto a revisar | Resultado | Gap |
|---|---|---|---|
| 1 | ¿Existe `payment: PIX \| BILL` obligatorio dentro de `RecurringPayment`? | **SÍ** — `RecurringPayments.ts:22-24` + `"payment.method": "required\|string\|in:PIX,BILL"` | **GAP-01** |
| 2 | `costCenterId` | **AUSENTE** en todo el flujo de recurrencias; el `FinancialRecord` se crea sin centro de costo | **GAP-02** |
| 3 | Registro manual | **NO EXISTE** endpoint; `RegisterRecurringPaymentFinancialRecord` sin entrypoint HTTP | **GAP-01b** |
| 4 | Voucher manual | **NO EXISTE** upload; voucher opcional y solo desde recibo de Asaas | **GAP-03** |
| 5 | Ejecución variable | **SÍ FUNCIONA** — `resolveAmount` exige `amount` y valida centavos (`:170-189`) | Sin gap |
| 6 | PIX informado al momento del pago | **IMPOSIBLE** — el validator de ejecución no acepta `pixKey`/`pixKeyType` | **GAP-04** |
| 7 | Boleto informado al momento del pago | **PARCIAL** — solo si la configuración ya es `BILL`; no elegible por el usuario | **GAP-04** |
| 8 | Creación del `FinancialRecord` con `CostCenter` | **NO** — no se propaga `costCenter` | **GAP-02**, **GAP-07** |

### Lo que el PR #146 **sí** implementa correctamente (y debe preservarse)

| Aspecto | Verificado en | Valor |
|---|---|---|
| Enum de estados por competencia | `ListRecurringPayments.ts:15-22` | Los 7 estados exactos, con la precedencia correcta |
| `PAID` derivado de la existencia del `FinancialRecord` | `ListRecurringPayments.ts:69-80` | Correcto (ADR-004) |
| Competencia explícita `YYYY-MM` | `RecurringPaymentCompetence.ts:3-7`, `ExecuteRecurringPayment.ts:59` | Correcto (§16) |
| Ajuste al último día del mes | `dueDateForCompetence`, `:9-17` | Correcto |
| Zona horaria `America/Sao_Paulo` | `saoPauloDate`, `:19-31` | Correcto |
| `amount` prohibido en FIXED | `ExecuteRecurringPayment.ts:174-179` | `RECURRING_PAYMENT_AMOUNT_FORBIDDEN` |
| `amount` requerido en VARIABLE + precisión de centavos | `:180-188` | Correcto |
| Índice único `recurringPaymentId + recurringCompetence` | `FinanceRecordMongoRepository.ts:258-267` | **La base de la idempotencia** |
| `currentPayment` con CAS real | `RecurringPaymentsMongoRepository.ts:22-45` | Correcto (ADR-008) |
| Índice único de referencia bancaria activa | `RecurringPaymentsMongoRepository.ts:56-63` | Correcto |
| `attempt` en el `externalReference` | `ExecuteRecurringPayment.ts:134` | `urn:recurringPayment:{id}:{competence}:{attempt}` |
| `BLOCKED` no incrementa `attempt` ni reintenta | `ExecuteRecurringPayment.ts:106-108` | Correcto (§24) |
| `CREATION_UNKNOWN` reutiliza intento y exige payload idéntico | `:124-128,353-366` | **La invariante crítica de no-doble-pago** |
| Distinción rechazo confirmado vs duda | `:262-286` | Correcto (§25) |
| Idempotencia del webhook (dos capas) | `ProcessRecurringPaymentBankingUpdate`, `RegisterRecurringPaymentFinancialRecord.ts:42-46` | Correcto |
| Encolado idempotente por `jobId` determinista | `RegisterRecurringPaymentFinancialRecord.ts:88` | Correcto |
| Validación de monto en webhook PIX | `ProcessRecurringPaymentBankingUpdate` (`amountInCents`) | Correcto |
| Separación de handlers de entrada/salida | `ChurchBanking.controller.ts:85-103` | Correcto (§28) |
| Validación de concepto `OUTGO` activo | `CreateOrUpdateRecurringPayment.ts:57-72`, `ExecuteRecurringPayment.ts:91-99` | Correcto |
| Notificación de vencimiento | `NotifyRecurringPaymentDue.job.ts`, `NotificationsTopic.RECURRING_PAYMENT_DUE` | Implementado (offsets 5, 2, 0 días) |
| Contrato de `church-banking` (PIX/BILL) tipado y validado | `ChurchBankingClient.interface.ts:47-92` | Coincide con la unión real de `church-banking` |

**Conclusión:** el PR #146 implementa con solidez **el camino bancario**. Su deuda está en (a) el acoplamiento del método a la configuración, (b) la ausencia total del camino manual, y (c) la omisión del centro de costo.

---

## 4. Orden de implementación recomendado

Los gaps están acoplados. Este orden minimiza estados intermedios incoherentes.

### Fase 1 — Desacoplar el método y añadir el centro de costo (GAP-01, GAP-02, GAP-05, GAP-13)

Ambos tocan el payload de creación y los mismos documentos → **un solo cambio**.

1. Añadir `costCenterId` obligatorio y `pixDestination?` a `RecurringPayment`.
2. Eliminar `payment`/`method` de la configuración.
3. Añadir `payment: { type, ... }` al comando de ejecución.
4. Extender `assertSameRetryPayload` para comparar `payment` completo.
5. Validar `CostCenter` (pertenencia a la iglesia, activo).
6. Unificar nomenclatura a `recurringPaymentId`.
7. Sin migración: la feature no tiene datos productivos (ver ADR-001 y ADR-002).

**Riesgo:** alto — cambia el contrato de creación y ejecución. Requiere coordinación con frontend.

### Fase 2 — Registro manual (GAP-01b, GAP-03, GAP-07, GAP-11, GAP-08)

1. `POST /api/v1/recurring-payments/:id/register-payment` con `multipart/form-data`.
2. Extender `RegisterRecurringPaymentFinancialRecord` con el modo manual (`source = MANUAL`, `createdBy` del usuario, `costCenter`, voucher de archivo, `bankingExternalReference` ausente).
3. Definir `financialRecordId` determinístico para manual (GAP-08).
4. Sin `currentPayment` (ADR-008).
5. Manejo de duplicate-key → respuesta idempotente.
6. Política de comprobantes huérfanos (P-07).

**Bloqueado por:** P-07 (huérfanos), P-08 (corrección).
**Riesgo:** medio — camino nuevo, sin tocar el bancario.

### Fase 3 — Capacidad bancaria (GAP-06)

1. Separar `HAS_CONNECTED_BANK_ACCOUNT` de la cuenta de la ejecución.
2. Exponer el booleano al frontend.
3. Soportar múltiples cuentas activas.

**Bloqueado por:** P-01 (cómo se elige la cuenta).
**Riesgo:** medio — afecta al flujo bancario, que hoy funciona con una sola cuenta.

### Fase 4 — Robustez de webhooks y boleto (GAP-09, GAP-10, GAP-12, GAP-14, GAP-15)

1. `clientId`/`requestId` en el tipo del webhook.
2. Despacho exhaustivo de eventos.
3. Patrón de inyección consistente.
4. Política de `REFUNDED` (P-04).
5. Validación / conciliación del valor del boleto (P-02, P-05).

**Bloqueado por:** P-02, P-04, P-05.
**Riesgo:** bajo — mejoras incrementales.

---

## 5. Criterios de aceptación finales

La feature se considera correctamente implementada cuando:

### Funcional

- [ ] Una iglesia **sin** Asaas completa el ciclo: crear recurrencia → registrar 12 competencias → 12 `FinancialRecord` con comprobante.
- [ ] Una iglesia **con** Asaas paga por PIX con `pixDestination` en **una** confirmación.
- [ ] Una iglesia **con** Asaas paga el **mismo** compromiso por PIX un mes y por BILL el siguiente, **sin editar la recurrencia**.
- [ ] Una recurrencia `VARIABLE` exige el monto en cada ejecución.
- [ ] Una recurrencia `FIXED` **rechaza** un `amount` en el comando.
- [ ] Toda ejecución (manual o bancaria) produce un `FinancialRecord` con el `costCenterId` de la recurrencia.

### Contable

- [ ] Ningún `FinancialRecord` originado en una recurrencia carece de `costCenter`.
- [ ] `PAID` se deriva de la existencia del `FinancialRecord`; no hay campo persistido.

### Idempotencia

- [ ] Un segundo registro manual para la misma competencia es rechazado por **duplicate-key** (no solo por validación en aplicación).
- [ ] Un reintento de webhook no crea un segundo `FinancialRecord`.
- [ ] Un reintento tras `CREATION_UNKNOWN` **reutiliza** el `attempt` y **no** genera un segundo débito.
- [ ] Un reintento tras `FAILED` genera un `attempt` nuevo.
- [ ] `BLOCKED` no incrementa `attempt` ni permite un segundo pago.

### Contrato

- [ ] El payload de creación **no** contiene `payment` ni `method`.
- [ ] El payload de creación contiene `costCenterId` obligatorio y `pixDestination` opcional.
- [ ] El comando de ejecución contiene `payment` con unión discriminada por `type`.
- [ ] El comando de creación/ejecución **no** contiene `costCenterId` (permanente) ni `financialConceptId` en el registro manual.
- [ ] No existe compatibilidad dual ni fallback silencioso para el formato antiguo (`payment.method`).

### Migración

- [x] No aplica: la feature está en construcción y no tiene datos productivos.

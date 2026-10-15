# Pagamentos Recorrentes — Flujo funcional y arquitectónico definitivo

> **Estado del documento:** fuente de verdad (source of truth) para backend, frontend, integración con `church-banking`, QA y evoluciones futuras.
> **Alcance:** `gloriafinance/gloria_finance_api` (PR #146, rama `chore/recurring-payments`, commit `8f415387`) y `gloriafinance/church-banking` (`main`, `0f2089d`).
> **Naturaleza:** documentación de diseño. **No** describe código implementado salvo donde se marca explícitamente como `CURRENT`.

## 0. Convención CURRENT / TARGET

Todo el documento distingue dos planos. **Nunca leas una sección TARGET como si ya estuviera implementada.**

| Etiqueta | Significado |
|---|---|
| `CURRENT` | Comportamiento real del código en el PR #146 / `church-banking@main`. Verificado con archivo:línea. |
| `TARGET` | Decisión arquitectónica definitiva a implementar. Puede no existir todavía. |
| `GAP` | Diferencia explícita entre CURRENT y TARGET. Ver [`recurring-payments-gap-analysis.md`](./recurring-payments-gap-analysis.md). |
| `PENDING` | Decisión de producto aún no cerrada. Requiere definición antes de implementar. |

### Índice de documentos

| Documento | Contenido |
|---|---|
| [`recurring-payments.md`](./recurring-payments.md) | Este documento. Flujo funcional y arquitectónico, casos, contratos de API, estados. |
| [`recurring-payments-diagrams.md`](./recurring-payments-diagrams.md) | Diagrama de decisión, 10 diagramas de secuencia, diagrama de estados. |
| [`recurring-payments-gap-analysis.md`](./recurring-payments-gap-analysis.md) | Tabla de casos funcionales, gaps verificados y checklist de implementación. |
| [`recurring-payments-audit.md`](./recurring-payments-audit.md) | Auditoría de la implementación real contra esta documentación: matriz de cobertura, hallazgos A-01…A-08, estado de la suite de tests. |
| [`adr/`](./adr/README.md) | Architecture Decision Records (8 decisiones). |

---

## 1. Principio principal

Un `RecurringPayment` representa un **compromiso financiero mensual permanente**.

**Se configura UNA SOLA VEZ.**

```text
Aluguel do templo
  Conceito:       Aluguel
  Centro de custo: Templo
  Tipo:           FIXED
  Valor:          R$ 3.500
  Dia de vencimento: 10
  Status:         ACTIVE
```

### Lo que NO existe

```text
recurrencia de octubre
recurrencia de noviembre
recurrencia de diciembre
```

Está **prohibido** crear:

```text
RecurringPaymentOccurrence
RecurringPaymentMonth
RecurringPaymentHistory   ← como histórico financiero mensual
```

### Qué es y qué no es una recurrencia

| Es | No es |
|---|---|
| Un compromiso permanente (contrato de alquiler, energía) | Una instancia de pago de un mes |
| Una plantilla de datos contables estables | Un histórico de ejecuciones |
| Un registro que sobrevive a los pagos | Un registro que se crea o duplica por competencia |
| Unidad de configuración | Unidad de ejecución |

### Dónde vive el histórico

El histórico de ejecuciones realizadas continúa siendo **`FinancialRecord`** (colección `financial_records`).

```text
RecurringPayment  = plantilla permanente
FinancialRecord   = hecho contable ejecutado (histórico)
currentPayment    = estado operativo bancario en vuelo (NO histórico)
```

No guardar `PAID` como histórico paralelo dentro de la recurrencia. Ver §17.

---

## 2. Regla fundamental: el método de pago NO pertenece a la recurrencia

**Esta decisión es definitiva e irreversible.**

Eliminar conceptualmente del modelo permanente:

```text
RecurringPayment.payment.method
```

No almacenar `PIX` ni `BILL` como método obligatorio de la configuración.

Una recurrencia describe:

> **qué** compromiso existe

y **NO**:

> **cómo** será pagado cada mes.

El método de ejecución se decide **cuando el usuario paga**.

### Justificación

El compromiso (alquiler del templo por R$ 3.500 el día 10) no cambia porque un mes se pague por PIX y otro por boleto. Acoplar el método a la configuración obliga a editar el compromiso para cambiar la forma de pago, y hace imposible representar la realidad operativa de una iglesia.

Ver [`adr/ADR-001-recurring-payment-does-not-own-payment-method.md`](./adr/ADR-001-recurring-payment-does-not-own-payment-method.md).

### Impacto en el contrato de creación (TARGET)

El payload de creación **no** debe exigir `payment.method`. Ver §30.

---

## 3. Modelo objetivo de `RecurringPayment`

### Estructura conceptual

```text
RecurringPayment

  recurringPaymentId
  churchId
  name
  financialConceptId
  costCenterId

  type:
    FIXED
    VARIABLE

  amount?              // solo FIXED
  dayOfMonth

  pixDestination?      // metadato reutilizable OPCIONAL
    pixKey
    pixKeyType

  status:
    ACTIVE
    INACTIVE

  currentPayment?      // estado operativo bancario, NO histórico
```

### Reglas

#### `FIXED`

Debe tener `amount`. El monto es conocido y estable.

```text
Aluguel do templo — FIXED — R$ 3.500
```

- `amount` es **readonly** en la UI de ejecución.
- El comando de ejecución **no debe** enviar `amount`.

#### `VARIABLE`

**NO tiene monto permanente.** El monto se informa **al ejecutar el pago**.

```text
Energia elétrica — VARIABLE
```

- El comando de ejecución **debe** enviar `amount`.
- Enviar `amount` en la creación de una `VARIABLE` es un error de contrato.

### Nota de nomenclatura

`CURRENT` el agregado expone el identificador como **`recurringPaymentsId` (plural)** — `src/Financial/domain/RecurringPayments.ts:16`, `:85`, `:183`. El documento usa `recurringPaymentId` (singular) como nombre conceptual TARGET; la colección y las claves de correlación actuales (`FinancialRecord.recurringPaymentId`, `reference.entityId`) ya usan singular. Ver GAP-13 en la gap analysis.

### Campos obligatorios derivados

| Campo | Obligatoriedad | Razón |
|---|---|---|
| `financialConceptId` | Obligatorio | Debe ser un concepto de tipo `OUTGO` activo de la iglesia. |
| `costCenterId` | **Obligatorio** | Todo gasto tiene centro de costo. Ver §4. |
| `dayOfMonth` | Obligatorio | `1..31`. Si el mes es más corto, se usa el último día del mes. |
| `churchId` | Obligatorio | Aislamiento multi-tenant. |

---

## 4. Cost Center

Todo gasto en Glória Finance tiene un centro de costo. Por tanto:

```text
costCenterId
```

es **obligatorio** en la configuración de `RecurringPayment`.

**No debe preguntarse nuevamente todos los meses.**

```text
Aluguel do templo
  Conceito:        Aluguel
  Centro de custo: Templo
```

Tanto una **ejecución bancaria** como una **ejecución manual** deben generar un `FinancialRecord` con ese mismo centro de costo.

### Invariancia contable

```text
RecurringPayment
  → FinancialConcept OUTGO
  → CostCenter obligatorio
  → FinancialRecord.costCenter = RecurringPayment.costCenter
```

Esta invariancia **no es opcional**. Un `FinancialRecord` originado en una recurrencia sin `costCenter` es un error contable.

Ver [`adr/ADR-002-cost-center-belongs-to-recurring-payment.md`](./adr/ADR-002-cost-center-belongs-to-recurring-payment.md).

### `CURRENT`

`costCenterId` **no existe** en absoluto en el modelo de recurrencias (`RecurringPayments.ts` no lo declara, el validator lo rechaza por `hasOnlyKeys`, y `RegisterRecurringPaymentFinancialRecord` no lo propaga aunque `CreateFinanceRecord.costCenter` y `FinanceRecord.costCenter` sí lo soportan). **GAP-02.**

---

## 5. Destino PIX opcional

Puede existir:

```text
pixDestination?
  pixKey
  pixKeyType
```

como **optimización permanente**.

Ejemplo:

```text
Aluguel do templo
  pixDestination:
    pixKeyType: CNPJ
    pixKey:     12.345.678/0001-90
```

Esto **NO** significa:

```text
paymentMethod = PIX
```

Significa únicamente:

> Glória conoce un destino PIX reutilizable para esta recurrencia.

Puede utilizarse para evitar pedir la llave todos los meses. Ver §12.

### Valores admitidos de `pixKeyType`

```text
CPF | CNPJ | EMAIL | PHONE | EVP
```

Verificado en `church-banking` (`apps/api/src/http/validations/pix-transfer.validation.ts:21`, `packages/integrations/src/asaas/asaas.types.ts`) y en el contrato del cliente de Glória (`src/Banking/domain/interfaces/ChurchBankingClient.interface.ts`). El tipo se **reenvía literal a Asaas, sin normalización ni cambio de capitalización**.

Ver [`adr/ADR-007-pix-destination-is-optional-reusable-metadata.md`](./adr/ADR-007-pix-destination-is-optional-reusable-metadata.md).

---

## 6. La capacidad bancaria pertenece a la iglesia, no a la recurrencia

El flujo depende primero de:

```text
¿La iglesia posee una cuenta bancaria Asaas conectada y activa?
```

**La respuesta debe provenir del backend.** No duplicar reglas complejas de detección en frontend. El frontend consume un booleano/estado derivado; **no** reimplementa la consulta a `Bank` + `AvailabilityAccount`.

### Cómo se determina `HAS_CONNECTED_BANK_ACCOUNT`

#### Prerrequisito de modelo (verificado)

`Bank` **no** tiene colección propia: su `static collectionName()` devuelve `"churches"` (`src/Banking/domain/Bank.ts:11-13`). La configuración bancaria de una iglesia vive **dentro del documento de la iglesia**. La conexión Asaas se materializa como un `Bank` con `active = true`.

`AvailabilityAccount` vive en la colección `availability_accounts` (`src/FinanceConfig/domain/AvailabilityAccount.ts:12-14`) y referencia a su banco por `source.bankId`.

#### Algoritmo `CURRENT` (verificado)

Implementado en `ExecuteRecurringPayment.findConnectedAccount` — `src/Financial/applications/recurringPayments/ExecuteRecurringPayment.ts:191-219`:

```text
1. activeBanks = bankRepository.all(churchId).filter(bank => bank.isActive())
   └─ si activeBanks.length === 0 → RECURRING_PAYMENT_BANK_ACCOUNT_UNAVAILABLE

2. accounts = availabilityAccountRepository.list({
       churchId,
       active: true,
       "source.bankId": { $in: activeBanks.map(b => b.getBankId()) }
   })

3. matches = accounts.map(a => ({ bank: banksById[a.source.bankId], availabilityAccount: a }))
   └─ si el banco no existe en el mapa → RECURRING_PAYMENT_BANK_ACCOUNT_UNAVAILABLE

4. [match, ...otherMatches] = matches
   └─ si (!match || otherMatches.length > 0) → RECURRING_PAYMENT_BANK_ACCOUNT_UNAVAILABLE

5. return { bank: match.bank, availabilityAccount: match.availabilityAccount }
```

#### Lectura arquitectónica de ese algoritmo

```text
HAS_CONNECTED_BANK_ACCOUNT  (CURRENT)
  = existe al menos un Bank activo en la iglesia
  Y existe EXACTAMENTE UNA AvailabilityAccount activa
    cuyo source.bankId apunte a uno de esos bancos activos
```

**Consecuencia crítica (GAP-06):** si la iglesia tiene **dos o más** cuentas activas y conectadas, la expresión `otherMatches.length > 0` hace fallar la ejecución con `RECURRING_PAYMENT_BANK_ACCOUNT_UNAVAILABLE`. Es decir, `CURRENT` no modela "tiene banca conectada", modela "tiene exactamente una cuenta conectada y ambigua".

Esto contradice la realidad operativa descrita en §11 (una iglesia puede pagar desde Itaú un mes y desde Caixa otro) y contradice la premisa de este capítulo (la capacidad bancaria es de la iglesia, no de una cuenta específica).

#### TARGET

Separar dos conceptos que hoy están fundidos:

```text
HAS_CONNECTED_BANK_ACCOUNT   // booleano, capacidad de la iglesia
      = ∃ Bank con active = true
        ∧ ∃ AvailabilityAccount con active = true
          cuyo source.bankId ∈ { bancos activos }

DEFAULT_BANKING_ACCOUNT      // cuenta concreta elegida para una ejecución
      = selección explícita del usuario
        o cuenta marcada como preferida/default
        (PENDING: definir dónde se persiste la preferencia)
```

- `HAS_CONNECTED_BANK_ACCOUNT` debe exponerse al frontend como **estado derivado por el backend**.
- La existencia de **múltiples** cuentas activas **no** debe impedir la ejecución bancaria; debe exigir una selección (o una preferencia).
- `PENDING`: definir el mecanismo de selección/preferencia de cuenta para el flujo bancario (hoy es una cuenta única implícita; para el flujo manual ya existe selección explícita, ver §11).

---

## 7. Árbol principal de decisión

**Este es el diagrama central de la documentación.**

```text
                         RECURRING PAYMENT
                                │
                                ▼
                     ¿Asaas conectado?
                      /                 \
                    NO                   SÍ
                    │                    │
                    ▼                    ▼
             REGISTRO MANUAL       EJECUCIÓN BANCARIA
```

Después:

```text
SIN ASAAS
│
├── FIXED
│     → valor ya conocido (readonly)
│
└── VARIABLE
      → usuario informa valor
```

Y:

```text
CON ASAAS
│
├── FIXED
│     │
│     ├── tiene pixDestination
│     │       → PIX directo (sin volver a preguntar)
│     │
│     └── no tiene pixDestination
│             → usuario elige PIX o BOLETO
│
└── VARIABLE
      │
      ├── usuario informa valor
      │
      └── usuario elige PIX o BOLETO
```

**La diferencia determinante no es el tipo (`FIXED`/`VARIABLE`) sino la capacidad bancaria.** El tipo determina *qué datos* se piden; la capacidad bancaria determina *si Glória ejecuta el pago o solo lo registra*.

Ver el diagrama Mermaid completo y desarrollado en [`recurring-payments-diagrams.md`](./recurring-payments-diagrams.md#1-diagrama-de-decisión-principal).

---

## 8. Caso 1 — FIXED sin Asaas

```text
Aluguel do templo
FIXED
R$ 3.500
```

No existe ejecución bancaria. Glória **no** mueve dinero.

### UI

```text
[ REGISTRAR PAGAMENTO ]
```

### El usuario informa únicamente

```text
Data do pagamento
Conta utilizada
Comprovante          // OBLIGATORIO — ver §10
```

### Se toma de la recurrencia (no se pregunta)

| Dato | Origen |
|---|---|
| Valor | `RecurringPayment.amount` — **readonly** |
| `FinancialConcept` | `RecurringPayment.financialConceptId` |
| `CostCenter` | `RecurringPayment.costCenterId` — **readonly** |

### El método externo de pago NO interesa a Glória

Puede haber sido:

```text
PIX
boleto
TED
dinheiro
lotérica
outro
```

**No modelarlo.** Glória no ejecutó la operación; solo registra el hecho contable. No preguntar "PIX ou boleto?" — ver §9.

---

## 9. Caso 2 — VARIABLE sin Asaas

```text
Energia elétrica
VARIABLE
```

### UI

```text
[ REGISTRAR PAGAMENTO ]
```

### El usuario informa

```text
Valor
Data do pagamento
Conta utilizada
Comprovante          // OBLIGATORIO
```

Glória crea el `FinancialRecord`.

**No preguntar:**

```text
PIX ou boleto?
```

porque Glória **no ejecutará** la operación bancaria. Preguntar el método sería recoger un dato que nadie consume.

### Diferencia con Caso 1

Únicamente que el **input de valor está habilitado** en lugar de ser readonly.

---

## 10. Comprobante en ejecución manual

**Decisión cerrada:**

```text
voucher = REQUIRED
```

Todo registro manual de una recurrencia requiere comprobante. Sin comprobante no hay `FinancialRecord`.

### Flujo de almacenamiento

```text
file upload
    ↓
StorageProviderService.getInstance().uploadFile({ data, mimetype, originalname })
    ↓
URL devuelta por el storage
    ↓
voucher
    ↓
FinancialRecord.voucher
```

### Reutilizar la infraestructura existente

**No crear almacenamiento paralelo.**

| Componente | Ubicación |
|---|---|
| Contrato | `src/Shared/domain/interfaces/StorageService.interface.ts` — `uploadFile(file: any): Promise<string>` |
| Resolución de proveedor | `src/Shared/infrastructure/services/StorageProvider.service.ts` — `StorageProviderService.getInstance(bucketName?)`, vía `CLOUD_PROVIDER` (hoy solo `gcp`) y `BUCKET_FILES` |
| Implementación | `src/package/gcp/infrastructure/StorageGCP.ts` |
| Precedente de uso en flujo bancario | `src/Webhook/infrastructure/services/AsaasReceiptStorage.ts` (`storage.uploadFile({ data: buffer, mimetype: "application/pdf", originalname })`) |

Ver [`adr/ADR-005-manual-voucher-is-mandatory.md`](./adr/ADR-005-manual-voucher-is-mandatory.md).

### `CURRENT`

En el flujo bancario el voucher es **opcional**: `RegisterRecurringPaymentFinancialRecord` solo lo crea si `transactionReceiptUrl` existe (`src/Financial/applications/recurringPayments/RegisterRecurringPaymentFinancialRecord.ts:57-62`), y **no existe ningún flujo manual** que reciba un archivo (no hay `multipart/form-data` en el repo). **GAP-03.**

---

## 11. Availability Account en ejecución manual

`AvailabilityAccount` **NO** forma parte permanente del `RecurringPayment`.

**Debe seleccionarse al registrar el pago.**

```text
Conta utilizada
[ Banco Itaú ▼ ]
```

### Razón

Una iglesia puede pagar:

```text
outubro  → Itaú
novembro → Caixa
```

El `AvailabilityAccount` representa **de dónde salió realmente el dinero**. Es un hecho de la ejecución, no una propiedad del compromiso.

Ver [`adr/ADR-006-availability-account-is-selected-per-manual-execution.md`](./adr/ADR-006-availability-account-is-selected-per-manual-execution.md).

### Contraste con el flujo bancario

En el flujo bancario, `CURRENT` deriva el `availabilityAccountId` automáticamente de la única cuenta emparejada (§6) y lo congela en `currentPayment.availabilityAccountId` (`ExecuteRecurringPayment.ts:141-142`). Esto es coherente con que la cuenta bancaria sea la que ejecuta, pero **hereda la limitación de GAP-06** para iglesias con múltiples cuentas.

---

## 12. Caso 3 — FIXED + Asaas + PIX conocido

```text
Aluguel do templo
FIXED
R$ 3.500

pixDestination:
  pixKeyType: CNPJ
  pixKey:     12.345.678/0001-90
```

### UI

```text
[ PAGAR R$ 3.500,00 ]
```

El usuario **solamente confirma**.

### NO volver a preguntar

```text
valor
chave PIX
tipo da chave
```

### Flujo

```text
Confirmar
    ↓
reserve current payment
    ↓
church-banking PIX transfer
    ↓
PROCESSING
    ↓
webhooks
    ↓
DONE
    ↓
FinancialRecord
    ↓
PAID
```

Ver secuencia 3 en [`recurring-payments-diagrams.md`](./recurring-payments-diagrams.md#23-secuencia-3-fixed-saved-pix).

### Requisito de contrato

`POST /api/v1/recurring-payments/:id/pay` con `{ "competence": "2026-10" }` y **nada más**. El `amount` y el destino PIX provienen de la configuración.

---

## 13. Caso 4 — FIXED + Asaas sin PIX conocido

El monto ya está definido. Pero Glória **no sabe cómo ejecutar** ese pago.

### UI

```text
R$ 3.500,00

Como deseja pagar?

[ PIX ]     [ BOLETO ]
```

### PIX

Solicitar:

```text
pixKey
pixKeyType
```

### BILL

Solicitar:

```text
identificationField
```

### Regla

El usuario puede ejecutar el pago **sin modificar la configuración permanente**.

### Optimización UX documentada

```text
[ ] Salvar esta chave PIX para próximos pagamentos
```

- Si se adopta, eso **actualizaría `pixDestination`**.
- **No** convertiría la recurrencia en `method = PIX`.

**`PENDING`:** decisión de producto sobre si esta casilla se ofrece. Requiere además un contrato de escritura de `pixDestination` (probablemente `PUT /api/v1/recurring-payments/:id`).

### `CURRENT` — este caso no es representable

`ExecuteRecurringPayment` decide el método **exclusivamente** desde la configuración:

```ts
const configuration = recurring.getPayment()          // :228
if (configuration.method === "PIX") { ...createPixTransfer... } else { ...createBillPayment... }  // :243-261
```

Y el validator de ejecución solo acepta `competence`, `amount`, `identificationField` — **no** acepta `pixKey`/`pixKeyType` (`src/Financial/infrastructure/http/validators/RecurringPayment.validator.ts`, `validatePayRecurringPayment`). Por tanto una recurrencia `BILL` **nunca** puede pagarse por PIX, y una recurrencia `PIX` **nunca** puede cambiarse a boleto. **GAP-04.**

El único gesto delegado a la ejecución es `identificationField` (`PayRecurringPaymentRequest.identificationField`), y solo cuando la configuración ya es `BILL`.

---

## 14. Caso 5 — VARIABLE + Asaas

```text
Energia elétrica
VARIABLE
```

Al seleccionar pagar:

```text
Valor
[ R$ ________ ]

Como deseja pagar?

[ PIX ]     [ BOLETO ]
```

### PIX

Solicitar:

```text
pixKey
pixKeyType
```

### BILL

Solicitar:

```text
identificationField
```

### Regla

La decisión pertenece **exclusivamente a esa ejecución**. No se persiste como configuración (salvo la optimización de §13, y solo para el destino PIX).

### `PENDING` crítico — el monto de un boleto

En `church-banking`, `POST /api/bill-payments` **no acepta `value` ni `dueDate`**:

```ts
export type CreateBillPaymentHttpPayload = {
  readonly externalAccountId: string
  readonly identificationField: string
  readonly description: string
  readonly externalReference: string
  readonly context: Record<string, unknown>
}
```

(`apps/api/src/http/validations/bill-payment.validation.ts:5-11`; el validador usa `exactKeys` con esa lista exacta, `:15-22`.)

Asaas **deriva** el valor del propio boleto y `church-banking` **no lo devuelve** al integrador (el snapshot público expone solo `providerBillId, paymentDate, transactionReceiptUrl, failureCode|errorCode` — `apps/api/src/services/bill-payment.service.ts:45-74`).

**Consecuencia para TARGET:** en una ejecución `BILL`, el `amount` informado por el usuario es — para Glória — **conocido** y se usa para reservar y para construir el `FinancialRecord`, pero **no viaja a `church-banking`** y **no es verificable** contra lo que Asaas efectivamente debitó. Esto obliga a decidir:

```text
PENDING (decisión de producto/backend requerida)
  ¿El FinancialRecord de un BILL usa el amount informado por el usuario?
  ¿O depende de un dato de valor que church-banking debe empezar a exponer?
```

Opciones:

1. **Usar el `amount` informado** y asumir el riesgo de divergencia (más simple, sin cambios en `church-banking`).
2. **Extender `church-banking`** para exponer el `value` del boleto en la respuesta de creación y en `BANKING_BILL_PAYMENT_UPDATED`, y conciliar.
3. **Hacer `amount` obligatorio** en el comando BILL y usar la confirmación del webhook (`paymentDate`) como evidencia de pago, manteniendo el valor informado.

**No implementar sin cerrar esta decisión.**

---

## 15. Método pertenece al comando de ejecución

Aunque **NO** existe:

```text
RecurringPayment.payment.method
```

sí puede existir:

```text
PayRecurringPaymentRequest.payment
```

porque describe **la operación concreta**.

### Diferencia explícita: `configuration` vs `execution command`

| | `configuration` (permanente) | `execution command` (efímero) |
|---|---|---|
| Qué describe | **Qué** compromiso existe | **Cómo** se paga este mes |
| Frecuencia de escritura | Una vez (y cambios excepcionales) | Una vez por competencia ejecutada |
| Contiene método de pago | **NO** | **SÍ** |
| Contiene valor | Solo si `FIXED` | **Solo si `VARIABLE`** |
| Contiene destino PIX | Opcional (`pixDestination`) | Opcional (override puntual) |
| Contiene `costCenterId` | **SÍ (obligatorio)** | **NO** |
| Contiene `competence` | **NO** | **SÍ** |
| Persistencia | `recurringPayments` | No se persiste (o `currentPayment` si es bancario) |

**Regla:** ningún dato permanente puede viajar en el comando de ejecución, y ningún dato de ejecución puede escribirse en la configuración.

### Ejemplo PIX (TARGET)

```json
{
  "competence": "2026-10",
  "amount": 742.83,
  "payment": {
    "type": "PIX",
    "pixKey": "12345678000190",
    "pixKeyType": "CNPJ"
  }
}
```

### Ejemplo boleto (TARGET)

```json
{
  "competence": "2026-10",
  "amount": 742.83,
  "payment": {
    "type": "BILL",
    "identificationField": "..."
  }
}
```

### Para `FIXED`

**`amount` no debe enviarse** si puede obtenerse de la configuración.

`CURRENT` ya implementa esta regla correctamente y la defiende con dos errores:

- `RECURRING_PAYMENT_AMOUNT_FORBIDDEN` si `FIXED` + `request.amount !== undefined` (`ExecuteRecurringPayment.ts:174-179`)
- `RECURRING_PAYMENT_AMOUNT_REQUIRED` si `VARIABLE` sin `amount` válido (`:180-188`)

El validador de `amount` exige además precisión de centavos: `Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7` → rechazo (`:184`). **Mantener esta regla.**

### `CURRENT` vs TARGET del comando

| Aspecto | CURRENT | TARGET |
|---|---|---|
| Objeto `payment` en el comando | No existe | `{ type: "PIX" \| "BILL", ... }` |
| `amount` en `FIXED` | Prohibido (`AMOUNT_FORBIDDEN`) | Prohibido — **se mantiene** |
| `amount` en `VARIABLE` | Obligatorio | Obligatorio — **se mantiene** |
| PIX informado en ejecución | **Imposible** | `payment.pixKey` + `payment.pixKeyType` |
| BILL informado en ejecución | `identificationField` (solo si config ya es `BILL`) | `payment.identificationField` (independiente de config) |
| Método | Derivado de la configuración | Decidido por el comando |

**GAP-04** cubre esta divergencia.

---

## 16. Competencia

Toda ejecución corresponde a:

```text
YYYY-MM
```

Ejemplo:

```text
2026-10
```

### No inferirla exclusivamente de la fecha real de pago

```text
competence:  2026-11
paymentDate: 2026-10-30
```

**es válido.** Alguien puede pagar en octubre la competencia de noviembre (pago anticipado), o en noviembre la de octubre (pago atrasado).

### Validación

`assertCompetence` exige el patrón `^\d{4}-(0[1-9]|1[0-2])$` y lanza `RECURRING_PAYMENT_INVALID` (`src/Financial/applications/recurringPayments/RecurringPaymentCompetence.ts:3-7`).

### Fecha de vencimiento de una competencia

`dueDateForCompetence(dayOfMonth, competence)` acota al último día del mes (`:9-17`):

```text
dayOfMonth = 31, competence = 2026-02  →  2026-02-28
dayOfMonth = 31, competence = 2026-04  →  2026-04-30
```

El "hoy" del sistema se calcula en zona `America/Sao_Paulo` (`saoPauloDate`, `:19-31`). **Toda la lógica de `PENDING` / `UPCOMING` depende de esta zona horaria.**

### `CURRENT` vs TARGET

`CURRENT` ya cumple: la competencia es un parámetro explícito, persistido en `currentPayment.competence` y en `FinancialRecord.recurringCompetence`. **Sin gap.**

---

## 17. `FinancialRecord` como fuente histórica

Cuando una competencia termina pagada debe existir:

```text
FinancialRecord
```

con:

```text
recurringPaymentId
recurringCompetence
```

Para **ejecución bancaria**:

```text
bankingExternalReference
```

también debe existir.

Para **manual**:

```text
bankingExternalReference = absent
```

### Regla de verdad

```text
La existencia del FinancialRecord determina PAID
```

**No** guardar `PAID` como histórico paralelo dentro de la recurrencia.

`CURRENT` lo implementa así: `ListRecurringPayments.competenceStatus` consulta los `FinancialRecord` de la competencia y devuelve `"PAID"` si el `recurringPaymentId` está en el conjunto pagado (`src/Financial/applications/recurringPayments/ListRecurringPayments.ts:69-80`). **Sin gap conceptual.**

### Índice único — la base de la idempotencia

```ts
await collection.createIndex(
  { recurringPaymentId: 1, recurringCompetence: 1 },
  {
    unique: true,
    name: "idx_financial_record_recurring_competence_unique",
    partialFilterExpression: {
      recurringPaymentId: { $exists: true },
      recurringCompetence: { $exists: true },
    },
  }
)
```

(`src/Financial/infrastructure/persistence/FinanceRecordMongoRepository.ts:258-267`.)

**Este índice es la garantía dura de "un solo `FinancialRecord` por recurrencia y competencia".** Cualquier flujo nuevo (manual incluido) **debe** apoyarse en él. Ver §22 y §29.

### Campos del `FinancialRecord` (verificado)

Implementados en `CURRENT` para recurrencias (`src/Financial/domain/FinanceRecord.ts:44-47`):

```text
recurringPaymentId?: string
recurringCompetence?: string
bankingExternalReference?: string
```

Consulta de idempotencia (`FinanceRecordMongoRepository.findRecurringPayment`, `:38-48`):

```ts
collection.findOne({ recurringPaymentId, recurringCompetence: competence })
```

Consulta por referencia bancaria (`findByBankingExternalReference`) — usada por el webhook.

---

## 18. Registro manual — endpoint

### Recomendación (TARGET)

```http
POST /api/v1/recurring-payments/:id/register-payment
```

**`multipart/form-data`** (porque el comprobante es obligatorio — §10).

### Campos

```text
competence              // YYYY-MM, obligatorio
amount?                 // obligatorio SOLO para VARIABLE
paymentDate             // obligatorio
availabilityAccountId   // obligatorio — §11
voucher                 // OBLIGATORIO — archivo — §10
```

### NO recibir desde frontend

```text
financialConceptId
costCenterId
type: OUTGO
churchId
```

**Esos datos pertenecen al `RecurringPayment`.** Aceptarlos desde el cliente permitiría crear un `FinancialRecord` que contradiga la configuración — exactamente la clase de incoherencia que este diseño previene.

`churchId` se toma del token autenticado (`req.auth.churchId`).

### Permisos

Siguiendo el patrón existente del controller:

```text
PermissionMiddleware
Can("financial_records", "create")
```

### `CURRENT`

**No existe endpoint de registro manual.** El único endpoint de ejecución es:

```http
POST /api/v1/recurring-payments/:recurringPaymentId/pay
```

(`src/Financial/infrastructure/http/controllers/RecurringPayment.controller.ts:113-138`), y su único camino genera operación bancaria. `RegisterRecurringPaymentFinancialRecord` **no tiene entrypoint HTTP**: solo lo invocan `ExecuteRecurringPayment` y el webhook.

Por tanto, una iglesia **sin Asaas no puede usar recurrencias en absoluto**. **GAP-01 — el gap más severo.**

### Endpoints `CURRENT` completos

| Método | Ruta | Propósito |
|---|---|---|
| `POST` | `/api/v1/recurring-payments` | Crear configuración |
| `PUT` | `/api/v1/recurring-payments/:id` | Actualizar configuración |
| `GET` | `/api/v1/recurring-payments?competence=YYYY-MM` | Listar con estado por competencia |
| `POST` | `/api/v1/recurring-payments/:recurringPaymentId/pay` | Ejecutar pago bancario |

---

## 19. `FinancialRecord` manual

Debe crearse conceptualmente con:

```text
type          = OUTGO
financialConcept = recurringPayment.financialConcept
costCenter       = recurringPayment.costCenter        // obligatorio (§4)
amount           = configured FIXED amount
                   OR execution VARIABLE amount
availabilityAccount = selected by user                // §11
date             = paymentDate
voucher          = required uploaded file             // §10
source           = MANUAL
createdBy        = authenticated user
reference:
  type     = RECURRING_PAYMENT
  entityId = recurringPaymentId
recurringPaymentId
recurringCompetence
bankingExternalReference = ausente
```

### Enums reales verificados

**`FinancialRecordType`** (`src/Financial/domain/enums/FinancialRecordType.enum.ts`):

```text
INCOME | OUTGO | PURCHASE | TRANSFER | REVERSAL
```

**`FinancialRecordSource`** (`:78-82`):

```text
MANUAL | AUTO | IMPORTED
```

**`FinancialRecordStatus`** (`:8-13`):

```text
PENDING | CLEARED | RECONCILED | VOID
```

### Elección de `status` por camino de ejecución

Decisión final (implementada):

```text
Registro manual     (la iglesia declara el pago)  → status = CLEARED
Ejecución bancaria  (Asaas ejecutó y confirmó)    → status = RECONCILED
```

El enum documenta su propia semántica:

- `PENDING`: la transacción fue registrada pero aún no se ha verificado contra el banco. `"No afecta al flujo de caja real, pero puede incluirse en flujo proyectado"`.
- `CLEARED`: ya ocurrió físicamente y cuenta en el flujo de caja real.
- `RECONCILED`: verificado **contra el extracto bancario** (`"el monto, la fecha y la descripción coinciden con una transacción real en cuenta"`).

**Por qué el manual es `CLEARED`:** la iglesia declara un pago ya realizado y aporta comprobante; el dinero salió y debe contar en el flujo de caja real. Es exactamente la semántica que el enum documenta para `CLEARED`.

**Por qué el bancario es `RECONCILED`:** la ejecución fue ordenada por Glória y confirmada por el canal autoritativo del proveedor con `providerTransferId`/`providerBillId`. El hecho está verificado contra la fuente bancaria, no solo declarado.

**Conciliación posterior:** `BankStatementReconciler` acepta registros `PENDING` y `CLEARED` en su filtro de matching y los promueve a `RECONCILED` cuando el extracto confirma monto, fecha y cuenta. Un `CLEARED` manual converge así al mismo estado que un pago bancario.

**Efecto en el listado:** `CLEARED` y `RECONCILED` cuentan como pagado. Un pago manual en `CLEARED` ya figura como `PAID`, porque el dinero salió.

### Nota sobre `CURRENT` bancario

El flujo bancario usa `source = AUTO`, `status = RECONCILED`, `createdBy = "system"`: la operación fue ejecutada por el banco y confirmada por el canal del proveedor, así que está verificada contra la fuente bancaria. El flujo manual usa `source = MANUAL` y `status = CLEARED`: la iglesia declara un pago ya realizado y aporta comprobante. Ver §20.

---

## 20. `FinancialRecord` bancario

Cuando `church-banking` confirme:

| Tipo | Estado de confirmación |
|---|---|
| PIX | `DONE` |
| BILL | `PAID` |

se crea:

```text
FinancialRecord OUTGO

financialConcept
costCenter
amount
availabilityAccount
voucher
recurringPaymentId
recurringCompetence
bankingExternalReference
```

Conceptualmente:

```text
source    = AUTO
status    = RECONCILED
createdBy = system
```

### Verificación contra la semántica existente

**`source = AUTO`** ✅ — no hubo intervención manual; el sistema ejecutó y confirmó.
**`createdBy = system`** ✅ — no hay usuario actuando en el momento de la confirmación; el webhook es la fuente.
**`status = RECONCILED`** — la operación fue **ejecutada por el propio banco por orden de Glória** y confirmada por el canal autoritativo del proveedor con `providerTransferId`/`providerBillId`. Está verificada contra la fuente bancaria, no solo declarada, que es lo que `RECONCILED` significa. El flujo manual nace `CLEARED` y converge a `RECONCILED` cuando el extracto confirma el movimiento. Ver [ADR-004](./adr/ADR-004-financial-record-is-execution-history.md).

### `bankingExternalReference`

`CURRENT` guarda aquí **el `externalReference` que Glória envió a `church-banking`** (`RegisterRecurringPaymentFinancialRecord.ts:86`, desde `payment.externalReference`), con la forma:

```text
urn:recurringPayment:{recurringPaymentsId}:{competence}:{attempt}
```

(`ExecuteRecurringPayment.ts:134`.)

**Este es el identificador correcto para la correlación de webhooks**, porque `church-banking` lo recibe en el body y lo **devuelve intacto** en el webhook (`banking-webhook-event.ts` → `data.pixTransfer.externalReference` / `data.billPayment.externalReference`).

> **Advertencia importante:** `church-banking` usa internamente un **UUID propio** (`providerExternalReference`) como `externalReference` hacia Asaas y para reconciliación. Ese UUID **no** es lo que llega a Glória. Glória correlaciona por **su propio** `externalReference` (el URN), que `church-banking` copia en el evento. No confundir ambos. Ver §26.

---

## 21. `currentPayment`

`currentPayment` existe **solamente para el flujo bancario**, mientras todavía no existe un `FinancialRecord`.

### Su responsabilidad

- evitar doble pago;
- guardar competencia;
- guardar intento (`attempt`);
- guardar `externalReference`;
- correlacionar webhook;
- representar `PROCESSING` / `BLOCKED` / `FAILED`;
- conservar información necesaria para completar el `FinancialRecord`.

### **NO es historial.**

En cuanto se crea el `FinancialRecord`, `currentPayment` se cierra (`closeCurrentPayment`, `RecurringPayments.ts:163-173`).

### Estructura `CURRENT` (verificada)

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

(`src/Financial/domain/RecurringPayments.ts:38-52`.)

### Invariantes de dominio `CURRENT` (verificadas)

| Operación | Regla | Código |
|---|---|---|
| `reserveCurrentPayment` | Falla si `status !== "ACTIVE"` o si ya hay `currentPayment` cuyo status `!== "FAILED"` | `:140-149` |
| `updateCurrentPayment` | Falla si no hay `currentPayment` o si `externalReference` no coincide | `:151-161` |
| `closeCurrentPayment` | Falla si `externalReference` no coincide | `:163-173` |
| `updateConfiguration` | Falla si hay `currentPayment` no-`FAILED` | `:125-138` |

Todas lanzan `RECURRING_PAYMENT_IN_PROGRESS` o `RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH`.

### Concurrencia: compare-and-swap real

`saveIfCurrentPaymentMatches` hace un `replaceOne` con un filtro que incluye el estado esperado completo, y devuelve si hubo match (`RecurringPaymentsMongoRepository.ts:22-45`):

```ts
const result = await collection.replaceOne(
  {
    recurringPaymentsId: ...,
    churchId: ...,
    "currentPayment.competence": expected.competence,
    "currentPayment.attempt": expected.attempt,
    "currentPayment.externalReference": expected.externalReference,
    "currentPayment.status": expected.status,
    "currentPayment.updatedAt": expected.updatedAt,
  },
  recurringPayment.toPrimitives()
)
return result.matchedCount === 1
```

Más un índice único que impide dos referencias activas simultáneas (`RecurringPaymentsMongoRepository.ts:56-63`):

```text
idx_recurring_payments_active_reference_unique
  { "currentPayment.externalReference": 1 }  unique, sparse
```

**Esta es una defensa seria y correcta contra doble pago bancario. Mantenerla.**

Ver [`adr/ADR-008-current-payment-is-banking-operational-state-only.md`](./adr/ADR-008-current-payment-is-banking-operational-state-only.md).

---

## 22. Manual payment y `currentPayment`

**Analizar y documentar la mejor estrategia para evitar doble registro manual.**

### Preferencia (TARGET)

Usar como **protección principal** la invariancia persistente:

```text
recurringPaymentId + recurringCompetence
```

con **índice único en `FinancialRecord`**.

Esa invariancia **ya existe** (`idx_financial_record_recurring_competence_unique`, §17). Es dura, es atómica y es la única que sobrevive a reinicios, reintentos y carreras entre procesos.

### ¿Se necesita una reserva temporal?

**Análisis:**

| Escenario | ¿Basta el índice único? |
|---|---|
| Dos requests concurrentes de registro manual | **Sí.** Una inserta; la otra recibe duplicate-key. |
| Usuario hace doble clic | **Sí.** Igual que arriba. |
| Reintento del cliente tras timeout de red | **Sí.** La segunda inserción falla por duplicate-key y se responde idempotente. |
| Upload del comprobante ya subido y luego falla la creación del registro | **No — hay efecto residual.** El archivo queda huérfano en el storage. |
| Usuario quiere corregir un registro manual ya creado (monto/fecha equivocados) | **No cubierto.** El índice **prohíbe** el segundo registro para la misma competencia. |

### Conclusión

```text
NO introducir un currentPayment manual solo por simetría con el flujo bancario.
```

El `currentPayment` bancario existe porque hay un **estado externo asíncrono** que correlacionar (una operación viva en Asaas con webhook pendiente). En el flujo manual **no hay estado externo**: la operación es una escritura local síncrona. Introducir un `currentPayment` manual añadiría una segunda fuente de verdad, estados intermedios artificiales y una máquina de limpieza, **sin aportar ninguna invariancia que el índice único no dé ya**.

**Regla:** el índice único es la protección principal. El flujo manual no crea `currentPayment`.

### Manejo requerido de los dos casos residuales

**1. Comprobante huérfano.** Secuencia TARGET:

```text
1. Subir el archivo al storage            (efecto externo)
2. Insertar el FinancialRecord            (efecto atómico, protegido por índice único)
3. Si (2) falla por duplicate-key:
     → responder 409/idempotente
     → el archivo subido en (1) queda huérfano → requiere limpieza asíncrona
```

`PENDING`: definir política de limpieza (job de recolección de archivos sin `FinancialRecord` asociado, o subida diferida *después* de reservar). **No puede quedar indefinido**: sin política, cada intento fallido deja basura en el bucket.

**2. Corrección de un registro manual.** El índice único es **absoluto por competencia**, así que la corrección **no** puede modelarse como "otro registro". Debe ser:

```text
edición del FinancialRecord existente   (mismo recurringPaymentId + recurringCompetence)
  o
VOID del existente + creación de uno nuevo bajo una regla explícita y auditada
```

`PENDING`: elegir entre ambas. La opción de edición es más simple; la de `VOID` + nuevo preserva auditoría (`FinancialRecordStatus.VOID` existe para esto).

### Estado intermedio explícito si se quisiera

Si el producto exige que un registro manual nazca "pendiente de validación", **no** usar `currentPayment`. Usar el propio `FinancialRecord`:

```text
FinancialRecord.status = PENDING   →   FinancialRecord.status = CLEARED
```

Eso mantiene **una sola fuente de verdad** y una única máquina de estados.

---

## 23. Estados

El estado operativo de una recurrencia **para una competencia** es:

```text
UPCOMING
PENDING
PROCESSING
BLOCKED
FAILED
PAID
INACTIVE
```

Este es **exactamente** el enum ya implementado como `RecurringPaymentCompetenceStatus` (`src/Financial/applications/recurringPayments/ListRecurringPayments.ts:15-22`). **Sin gap.**

### Semántica

| Estado | Significado | Condición de verdad |
|---|---|---|
| `UPCOMING` | Vencimiento futuro | `dueDateForCompetence(dayOfMonth, competence) > hoy` |
| `PENDING` | Debe pagarse y **no existe** `FinancialRecord` | vencimiento `<= hoy` y sin `FinancialRecord` |
| `PROCESSING` | Existe operación bancaria activa | `currentPayment.status === "PROCESSING"` |
| `BLOCKED` | Operación bancaria activa bloqueada por el provider | `currentPayment.status === "BLOCKED"` |
| `FAILED` | Intento bancario terminó **sin** pago | `currentPayment.status === "FAILED"` |
| `PAID` | Existe `FinancialRecord` liquidado | `∃ FinancialRecord(recurringPaymentId, competence)` con status `CLEARED`/`RECONCILED` |
| `INACTIVE` | Recurrencia desactivada y **sin** registro liquidado en esa competencia | `RecurringPayment.status !== "ACTIVE"` |

### Orden de precedencia (verificado tras la implementación)

`ListRecurringPayments.competenceStatus`:

```text
1. settledIds.has(recurringPaymentId)      → PAID
2. status !== "ACTIVE"                     → INACTIVE
3. currentPayment.status (si competence coincide) → PROCESSING | BLOCKED | FAILED
4. dueDate <= hoy                          → PENDING, si no → UPCOMING
```

`settledIds` son los registros con status `CLEARED`/`RECONCILED`.

**El histórico manda sobre la configuración: `PAID` tiene precedencia sobre `INACTIVE`** (ver [ADR-009](./adr/ADR-009-settlement-history-outranks-configuration.md)). Desactivar una recurrencia detiene compromisos futuros, no borra lo que ya se pagó. El histórico real es el `FinancialRecord`; la configuración solo describe el compromiso. Por eso una competencia liquidada sigue siendo `PAID` aunque la recurrencia esté desactivada.

**`PAID` también tiene precedencia sobre `currentPayment`**: en cuanto existe evidencia contable liquidada, el estado operativo en vuelo es irrelevante.

**Tanto `CLEARED` como `RECONCILED` cuentan como `PAID`.** Un registro `CLEARED` (manual) ya representa dinero que salió y cuenta en el flujo de caja real; un `RECONCILED` (bancario, o manual ya conciliado) está además verificado contra el banco. Un registro `VOID` no cuenta.

### Dos distinciones que deben quedar nítidas

```text
UPCOMING ≠ PENDING   → dependen del calendario, no de la acción del usuario
PENDING  ≠ FAILED    → PENDING = nadie intentó pagar;  FAILED = se intentó y falló
```

---

## 24. `BLOCKED`

**Debe documentarse explícitamente:**

```text
BLOCKED ≠ FAILED
```

### Mientras está `BLOCKED`

- **no** crear `FinancialRecord`;
- **no** permitir otro pago;
- **no** incrementar `attempt`;
- conservar `externalReference`;
- esperar nuevo estado de `church-banking`.

### `CURRENT` — verificado

El retorno temprano para `BLOCKED` **no** incrementa `attempt` ni reenvía a `church-banking`:

```ts
if (existing.status === "BLOCKED") {
  return this.result(existing)          // ExecuteRecurringPayment.ts:106-108
}
```

✅ Cumple las cinco reglas.

### Puede evolucionar a

```text
PROCESSING
DONE
FAILED
CANCELLED
```

según el contrato real de `church-banking`.

### Contrato real verificado (`church-banking`)

```ts
export type PixTransferProviderStatus =
  "PENDING" | "IN_BANK_PROCESSING" | "BLOCKED" | "DONE" | "FAILED" | "CANCELLED"
```

(`packages/modules/src/pix-transfer/pix-transfer.entity.ts:6-7`.)

- `BLOCKED` **solo existe para PIX**. No existe para BILL (`BillPaymentProviderStatus = "PENDING" | "BANK_PROCESSING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED"`, `bill-payment.entity.ts:6-7`).
- `BLOCKED` **no es terminal** en `church-banking`: `isPixTransferTerminal` = `DONE | FAILED | CANCELLED | CREATION_FAILED` (`pix-transfer.entity.ts:211-220`).
- La transición de salida llega por Asaas (`TRANSFER_BLOCKED` está en la lista de eventos suscritos) y **no** por polling.
- Asaas `BLOCKED` se mapea **por identidad** a `BLOCKED` (`create-asaas-pix-transfer.use-case.ts:311-328`).

### Implicación de diseño

`BLOCKED` es un **estado de espera indefinida**. No hay timeout que lo resuelva del lado de Glória. El sistema debe ser capaz de permanecer en `BLOCKED` sin degradar, y el usuario necesita ver un mensaje que explique que la operación está retenida en el banco y que **no** debe reintentar.

**`PENDING`:** definir si `BLOCKED` requiere acción del usuario (contactar al banco / cancelar) y si existe un mecanismo de cancelación. Hoy no existe endpoint de cancelación ni en Glória ni expuesto en el contrato de salida.

---

## 25. Retry

**Solo estados terminales fallidos permiten nuevo intento.**

```text
attempt 1
FAILED
    ↓ retry
attempt 2
PROCESSING
```

### Referencia externa conceptual

```text
urn:recurringPayment:{id}:{competence}:{attempt}
```

**`CURRENT` lo implementa exactamente así** (`ExecuteRecurringPayment.ts:134`).

### No crear nuevo intento para

```text
PROCESSING
BLOCKED
CREATION_UNKNOWN
```

### `CURRENT` — verificado

El cálculo del intento (`:132-133`):

```ts
const attempt =
  existing?.competence === request.competence ? existing.attempt + 1 : 1
```

Se alcanza **solo** si se superó el early-return de `:101-129`, que devuelve sin incrementar para `PROCESSING`/`BLOCKED` y trata `CREATION_UNKNOWN` de forma especial.

### Manejo de `CREATION_UNKNOWN` — el caso más delicado

`CREATION_UNKNOWN` significa: **no sabemos si la operación se creó en el banco.** Es el estado más peligroso, porque un ciego podría pagar dos veces.

`CURRENT` lo maneja con una regla notable (`:124-128`):

```ts
if (existing.providerStatus !== "CREATION_UNKNOWN") {
  return this.result(existing)
}
this.assertSameRetryPayload(existing, recurring, request, amount)
return await this.submit(recurring, existing, concept)
```

Es decir: **reintenta reutilizando el mismo `attempt` y el mismo `externalReference`** (no crea intento nuevo), pero **exige que el payload sea idéntico** (`assertSameRetryPayload`, `:353-366`: mismo `amount`, y mismo `identificationField` si es BILL).

Esta es la decisión correcta: como el `externalReference` es estable, `church-banking` lo deduplica por su índice único `{clientId, externalAccountId, externalReference}` y recupera la operación existente en lugar de crear una segunda. **Un reintento de `CREATION_UNKNOWN` no puede generar doble débito.**

⚠️ **Requisito de contrato que esto impone:** con `CURRENT`, `recurring.getPayment().method` decidía el payload. Al pasar a TARGET (método en el comando, §15), `assertSameRetryPayload` **debe extenderse** para comparar también el objeto `payment` (tipo, `pixKey`, `pixKeyType`, `identificationField`). Si no, un usuario podría reintentar un `CREATION_UNKNOWN` con un destino PIX distinto y la deduplicación de `church-banking` respondería con la operación **original** (409 `PIX_TRANSFER_IDENTITY_CONFLICT` o el snapshot original), produciendo un comportamiento confuso.

### Fallo confirmado vs no confirmado

`CURRENT` distingue correctamente (`:262-286`):

| Situación | `status` | `providerStatus` |
|---|---|---|
| `ChurchBankingClientError.isConfirmedRejection` (rechazo 4xx confirmado) | `FAILED` | `CREATION_FAILED` |
| Cualquier otro error (red, 5xx, respuesta ambigua) | `PROCESSING` | `CREATION_UNKNOWN` |

**Regla:** solo un rechazo **confirmado** habilita `FAILED` → retry. Una duda **no** habilita retry con intento nuevo. Esto es correcto y debe preservarse.

### Correspondencia con `church-banking`

`church-banking` distingue:

- **rechazo confirmado** = `AsaasIntegrationError` con `400 <= status < 500` y **no** 408/425/429 → `CREATION_FAILED` (`create-asaas-pix-transfer.use-case.ts:330-339`)
- **cualquier otra cosa** (transporte, parse, 5xx, 408, 425, 429) → `CREATION_UNKNOWN` (`:138-176`)

La clasificación de Glória es **coherente** con la de `church-banking`. Mantener sincronizada esta semántica: si `church-banking` cambia qué considera "confirmado", Glória debe cambiar con él.

---

## 26. `church-banking`

**Glória Finance NO integra directamente con Asaas.**

Toda ejecución bancaria:

```text
gloria_finance_api
      ↓
church-banking
      ↓
Asaas
```

### Contratos ACTUALES (`church-banking@main`, `0f2089d`)

#### PIX transfer

```http
POST /api/pix-transfers
```

Request (`apps/api/src/http/validations/pix-transfer.validation.ts:5-26`):

```ts
{
  externalAccountId: string
  amountInCents: number          // safeInteger, min 1
  pixKey: string
  pixKeyType: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP"
  description: string            // max 500
  externalReference: string      // max 100
  context: Record<string, unknown>
}
```

`exactKeys` — no se aceptan campos extra. `clientId` se toma del token, **nunca** del body.

#### Bill payment

```http
POST /api/bill-payments
```

Request (`apps/api/src/http/validations/bill-payment.validation.ts:5-22`):

```ts
{
  externalAccountId: string
  identificationField: string    // solo required|string|notBlank
  description: string            // max 500
  externalReference: string      // max 100
  context: Record<string, unknown>
}
```

> ⚠️ **No acepta `value` ni `dueDate`.** Asaas los deriva del boleto. Ver el `PENDING` crítico de §14.

#### Autenticación

- Header `Authorization: Bearer <JWT>` ES256. `iss` = issuer de un `IntegrationClient` activo; `aud` = `"CHURCH_BANKING"`; `sub` = `IntegrationClient.code`.
- Claims obligatorios: `iss, aud, sub, jti, iat, exp, method="POST", path, bodyHash`. `exp - iat <= 300`.
- `bodyHash` = SHA-256 base64url del body **crudo**. Debe cubrir el body exacto enviado.
- El body va cifrado como JWE compacto `ECDH-ES` + `A256GCM` (`{ "jwe": "<...>" }`).
- **Anti-replay:** Redis `SET NX PXAT` por `sha256(clientId \0 jti)`. Un reintento byte-idéntico **debe** llevar un `jti` nuevo.
- Glória ya implementa este esquema en `src/Banking/infrastructure/church-banking/ChurchBankingClient.ts` (`execute()`: JWE con `CompactEncrypt`, JWT `ES256` con `method`/`path`/`bodyHash`, `randomUUID()` como `jti`).

#### Respuesta

```text
{ "data": { ... }, "code": "OK" }  +  header X-Request-Id
```

Mapeo de status HTTP (`create-pix-transfer.service.ts:43-49`, `bill-payment.service.ts:37-43`):

```text
PENDING          → 201
CREATING|RESERVED→ 202
CREATION_UNKNOWN → 503
CREATION_FAILED  → 422
resto            → 200
```

⚠️ Las ramas 422/503 provienen de un `Result` **exitoso** (`code: "OK"`), así que el body es `{data:{...errorCode},code:"OK"}`. **Un consumidor no puede clasificar el resultado por el status HTTP solo: debe inspeccionar `data.status`.**

Glória lo hace correctamente: `parseOutgoingPaymentResponse` valida `result.status` contra la lista completa y lanza `CHURCH_BANKING_INVALID_RESPONSE` (502) si no coincide.

#### Estados de salida

```ts
type ChurchBankingOutgoingStatus =          // contrato del cliente de Glória
  | "RESERVED" | "CREATING" | "CREATION_UNKNOWN" | "CREATION_FAILED"
  | "PENDING" | "IN_BANK_PROCESSING" | "BANK_PROCESSING"
  | "BLOCKED" | "DONE" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED"
```

(`src/Banking/domain/interfaces/ChurchBankingClient.interface.ts:68-81`.) Coincide con la unión real de `church-banking` (PIX + BILL + estados internos). **Sin gap.**

#### Idempotencia del lado bancario

Índice único:

```text
{ clientId: 1, externalAccountId: 1, externalReference: 1 }
  uq_pix_transfers_client_account_reference
  uq_bill_payments_client_account_reference
```

(`pix-transfer.repository.ts:55-74`, `bill-payment.repository.ts:55-74`.)

Algoritmo: buscar por identidad → si existe, continuar; si no, `insert` y capturar duplicate-key → releer ganador → CAS `replaceOne({_id, ...expected})`.

⚠️ **El `externalReference` que `church-banking` envía a Asaas es un UUID propio** (`providerExternalReference = randomUUID()`, `create-asaas-pix-transfer.use-case.ts:72,144`), **no** el de Glória. La reconciliación interna también matchea por ese UUID. Esto significa que **la idempotencia de `church-banking` hacia Asaas está anclada en su propio UUID**, mientras que la de Glória hacia `church-banking` está anclada en el URN.

**No confundir ambos identificadores.** En el webhook, el campo `externalReference` que llega a Glória es **el URN de Glória**, porque `church-banking` lo reenvía desde el `context`/input almacenado.

#### Correlación y fan-out — advertencia

`church-banking` hace **fan-out a todos los bindings activos** de la cuenta (`create-banking-outgoing-money-outbound-events.use-case.ts:32-35`). Es posible que Glória reciba un evento cuyo `externalAccountId` corresponda a un binding distinto del que originó la operación.

**Consecuencia:** la correlación en Glória **no puede** basarse solo en `externalReference`. Debe validarse el conjunto `context + externalReference` (y coherencia con `churchId`). `CURRENT` ya lo hace parcialmente: `assertDuplicateContext` valida `churchId`, `recurringPaymentId`, `externalAccountId` y `context` en el camino de duplicados, y `findOperation` correlaciona por `externalAccountId` + `accountId` + `externalReference` + `context`.

#### Documentación de `church-banking` y drift detectado

`docs/asaas-outgoing-money.md` (7 líneas) es el único doc del flujo. Drift verificado:

| Afirmación del doc | Realidad |
|---|---|
| "un retry recupera por `externalReference`" | Recupera por el UUID `providerExternalReference` interno, no por el del llamador. |
| "Las razones crudas de Asaas no se propagan al integrador" | **Falso.** `failureCode` propaga `failReason`/`failReasons[0].code` de Asaas (`asaas-outgoing-money-webhook.ts:64,75`). Además es inconsistente: en creación es `ASAAS_TRANSFER_FAILED`/`ASAAS_BILL_FAILED` (código propio), después es el string crudo de Asaas. |

Otros drift relevantes: el `openapi.json` de `church-banking` **no** documenta `BankingPixTransferUpdatedEvent` ni `BankingBillPaymentUpdatedEvent` en `BankingWebhookEvent.oneOf`, y documenta 422/503 como `ServiceErrorResponse` cuando el código devuelve `{data, code:"OK"}`.

**Esto importa para Glória:** `failureCode` **sí** llega con la razón cruda de Asaas. No asumir que es un código estable y parseable; tratarlo como texto de diagnóstico para el operador.

---

## 27. Webhooks

Glória recibe dos eventos de salida:

```text
BANKING_PIX_TRANSFER_UPDATED
BANKING_BILL_PAYMENT_UPDATED
```

### Endpoint

```http
POST /webhooks/church-banking
```

(`CHURCH_BANKING_WEBHOOK_PATH`, `src/Webhook/infrastructure/http/ChurchBankingWebhookBun.adapter.ts:8`.)

- Límite de body: 64 KiB (`CHURCH_BANKING_WEBHOOK_MAX_BODY_BYTES`, `:9`).
- Verificación de firma: `ChurchBankingWebhookVerifier` (JWT + `bodyHash`).
- Content-type validado; errores tipados (`CHURCH_BANKING_WEBHOOK_CONTENT_TYPE_INVALID`, `..._PAYLOAD_TOO_LARGE`, `..._BODY_INVALID`, `..._UNAUTHORIZED`).

### Payload recibido

```ts
PixTransferUpdatedEvent = {
  id: string
  occurredAt: string
  externalAccountId: string
  accountId: string
  data: { pixTransfer: {
    providerTransferId, status, amountInCents,
    externalReference, context,
    transactionReceiptUrl: string | null,
    failureCode: string | null
  } }
}

BillPaymentUpdatedEvent = {
  id: string
  occurredAt: string
  externalAccountId: string
  accountId: string
  data: { billPayment: {
    providerBillId, status,
    externalReference, context,
    paymentDate: string | null,
    transactionReceiptUrl: string | null,
    failureCode: string | null
  } }
}
```

(`src/Webhook/infrastructure/services/ProcessRecurringPaymentBankingUpdate.service.ts:22-52`.)

⚠️ **GAP menor:** `church-banking` **también** envía `clientId` y `requestId` en el envelope (`banking-webhook-event.ts:96-115`); el tipo de Glória no los declara. La validación `isWebhookEvent` no es estricta respecto a claves extra, así que no rompe, pero el contrato debería declararlos — `clientId` es útil para defender el fan-out descrito en §26.

### Flujo

```text
webhook
   ↓
authenticate                         (ChurchBankingWebhookVerifier)
   ↓
identify recurring payment           (findOperation: externalAccountId + accountId + externalReference + context)
   ↓
identify competence                  (payment.competence)
   ↓
identify attempt                     (payment.attempt)
   ↓
update currentPayment                (CAS vía saveIfCurrentPaymentMatches)
   ↓
if terminal success                  (PIX: DONE | BILL: PAID)
    create FinancialRecord           (RegisterRecurringPaymentFinancialRecord)
   ↓
close operational payment            (closeCurrentPayment)
```

### **Debe ser idempotente.**

`CURRENT` implementa **dos** capas de idempotencia en el webhook:

**1. Cortocircuito por `bankingExternalReference`** (`processPix`, `:80-92`): si ya existe un `FinancialRecord` con ese `bankingExternalReference`, el evento se considera ya procesado y no se hace nada (solo se registra si es `REFUNDED`).

**2. Guarda en `RegisterRecurringPaymentFinancialRecord`** (`:42-46`): `findRecurringPayment(recurringPaymentId, competence)` → si existe, retorno temprano. Reforzado por el índice único.

Además, el **dispatch del `FinancialRecord` usa un `jobId` determinista** (`RegisterRecurringPaymentFinancialRecord.ts:88`):

```ts
{ jobId: `recurring-${digest}` }   // digest = sha256(externalReference)
```

Esto hace que el encolado sea idempotente a nivel de Bull.

**Esta combinación es sólida. Cualquier flujo nuevo debe preservarla.**

### Validaciones de coherencia del webhook (`CURRENT`)

Además de la idempotencia, el webhook valida:

- `Math.round(payment.amount * 100) === transfer.amountInCents` — si no, `RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH` (`:105-107`).
- Coherencia de `churchId`, `recurringPaymentId`, `externalAccountId` y `context` en el camino de duplicados (`assertDuplicateContext`).
- `paymentDate` parseable para PIX (`:110-112`).

**Mantener estas validaciones.** Un webhook que no coincide en monto debe ser tratado como error de correlación, no como éxito.

### PENDING — `REFUNDED`

`CURRENT` **no** revierte la contabilidad ante un `REFUNDED` posterior a un `DONE`; solo registra un log:

> `"Recognized recurring PIX refund; accounting reversal requires a business rule"`

(`processPix`, `:113-119`.)

```text
PENDING (decisión contable requerida)
  ¿Un REFUNDED de una operación ya PAID debe:
     a) crear un FinancialRecord de tipo REVERSAL?
     b) cambiar el status del FinancialRecord existente a VOID?
     c) permanecer solo como log de diagnóstico?
```

`FinancialRecordType.REVERSAL` existe precisamente para este escenario. **No implementar retry/refund sin cerrar esta decisión.**

---

## 28. Separación del flujo de entradas

**No mezclar** `BANKING_PAYMENT_UPDATED`, usado para **ingresos/contribuciones**, con `BANKING_PIX_TRANSFER_UPDATED` y `BANKING_BILL_PAYMENT_UPDATED`, usados para **salidas recurrentes**.

### **Documentar handlers separados.**

`CURRENT` ya los separa correctamente en el router del webhook (`src/Webhook/infrastructure/http/controllers/ChurchBanking.controller.ts:85-103`):

```ts
if (body.type === "BANKING_PAYMENT_UPDATED") {
  await new ProcessAsaasTransactionService().handle({ ... })     // ingresos
} else if (body.type === "BANKING_PIX_TRANSFER_UPDATED") {
  await this.recurringPaymentWebhook.processPix(body)            // salidas PIX
} else {
  await this.recurringPaymentWebhook.processBill(body)           // salidas BILL
}
```

**Sin gap estructural.** Observaciones:

1. El `else` final asume BILL. Funciona porque el validador ya restringió el tipo, pero es frágil ante la adición de un cuarto evento: un tipo nuevo caería silenciosamente en `processBill`. **Recomendación TARGET:** hacer el despacho exhaustivo (`else if (body.type === "BANKING_BILL_PAYMENT_UPDATED")` + caso por defecto explícito que rechace).
2. Diferencia de instanciación: `ProcessAsaasTransactionService` se instancia **inline por request**, mientras `recurringPaymentWebhook` parece ser un campo del controller. **`PENDING`:** unificar el patrón de inyección (preferible: inyectado en el constructor, como el segundo, por consistencia y testabilidad).

### Tabla de eventos

| Evento | Dirección del dinero | Handler | Crea |
|---|---|---|---|
| `BANKING_PAYMENT_UPDATED` | **INGRESO** (cobro/contribución) | `ProcessAsaasTransactionService` | `FinancialRecord` INCOME / contribución |
| `BANKING_PIX_TRANSFER_UPDATED` | **SALIDA** (PIX recurrentes) | `ProcessRecurringPaymentBankingUpdate.processPix` | `FinancialRecord` OUTGO |
| `BANKING_BILL_PAYMENT_UPDATED` | **SALIDA** (boleto recurrente) | `ProcessRecurringPaymentBankingUpdate.processBill` | `FinancialRecord` OUTGO |
| `BANKING_ACCOUNT_STATUS_UPDATED` | — | (fuera de alcance) | — |
| `BANKING_ONBOARDING_DOCUMENTS_REQUIRED` | — | (fuera de alcance) | — |

---

## 29. Idempotencia

**Documentar las dos capas.**

### Capa 1 — `gloria_finance_api`

**Un solo `FinancialRecord` para:**

```text
recurringPaymentId + recurringCompetence
```

Garantizado por índice único parcial:

```text
idx_financial_record_recurring_competence_unique
  { recurringPaymentId: 1, recurringCompetence: 1 }  unique
  partialFilterExpression: ambos campos $exists
```

(`FinanceRecordMongoRepository.ts:258-267`.)

Reforzado en aplicación por `findRecurringPayment` (§17, §27).

**Alcance:** protege contra doble pago **contable**, en flujo bancario y manual, entre procesos y ante reintentos.

### Capa 2 — `church-banking`

**Una operación bancaria lógica por:**

```text
clientId + externalAccountId + externalReference
```

Garantizado por:

```text
uq_pix_transfers_client_account_reference
uq_bill_payments_client_account_reference
```

Más CAS `replaceOne({_id, ...expected})` y reconciliación de `CREATING` estancado (2 min → `CREATION_UNKNOWN`).

**Alcance:** protege contra doble débito **bancario**.

### Los retries HTTP no pueden generar dobles débitos

```text
Reintento HTTP de Glória a church-banking
   ↓
mismo externalReference (URN con attempt)
   ↓
church-banking: identity() ya existe → continueExisting()
   ↓
NO se crea segunda operación en Asaas
```

Y si la respuesta anterior nunca llegó:

```text
Glória recibe error/ambigüedad → CREATION_UNKNOWN
   ↓
reintento con MISMO attempt y MISMO externalReference
   ↓
church-banking recupera por identidad, o reconcilia por providerExternalReference
   ↓
NO hay doble débito
```

### Punto crítico: `attempt` en el `externalReference` vs idempotencia bancaria

El `externalReference` incluye `attempt`:

```text
urn:recurringPayment:{id}:{competence}:{attempt}
```

Esto significa que **el intento 2 tiene un `externalReference` distinto del intento 1**. Por tanto, para `church-banking` son **operaciones lógicas distintas**.

**Consecuencia:** la idempotencia bancaria **no** protege entre intentos. Protege **dentro** de un intento (reintentos de red del mismo intento). Si el intento 1 falló confirmadamente y se crea el intento 2, es correcto que `church-banking` las trate como operaciones separadas — la de intento 1 ya está en estado terminal fallido.

**Por eso es esencial la regla de §25:** **solo** un fallo **confirmado** habilita el intento nuevo. Si `CREATION_UNKNOWN` creara un `attempt` nuevo, se podría crear una segunda operación bancaria real para la misma competencia. `CURRENT` respeta esto correctamente reutilizando el `attempt` en `CREATION_UNKNOWN`.

**Esta es la invariante más importante de todo el sistema.** Debe tener un test explícito.

### Resumen de las invariantes de no-doble-pago

| Invariante | Mecanismo | Ubicación |
|---|---|---|
| Un `FinancialRecord` por recurrencia+competencia | índice único parcial | `FinanceRecordMongoRepository` |
| Una `currentPayment` con referencia activa | índice único sparse | `RecurringPaymentsMongoRepository` |
| Un solo ganador al reservar | CAS `replaceOne` con estado esperado | `saveIfCurrentPaymentMatches` |
| Webhook procesado una sola vez | cortocircuito por `bankingExternalReference` + `findRecurringPayment` | `ProcessRecurringPaymentBankingUpdate`, `RegisterRecurringPaymentFinancialRecord` |
| Encolado de `FinancialRecord` una sola vez | `jobId` determinista (`sha256(externalReference)`) | `RegisterRecurringPaymentFinancialRecord.ts:88` |
| Una operación lógica en el banco | índice único `{clientId, externalAccountId, externalReference}` | `church-banking` |
| Sin intento nuevo tras duda | `CREATION_UNKNOWN` reutiliza `attempt` y exige payload idéntico | `ExecuteRecurringPayment.ts:124-128, 353-366` |

---

## 30. Creación de `RecurringPayment`

### La UI de configuración debe pedir **únicamente** información permanente

```text
Nome
Conceito financeiro
Centro de custo          ← OBLIGATORIO (§4)
Tipo:
  Fixo
  Variável

Valor                    ← solo si Fixo
Dia de vencimento
Status
```

### Si la iglesia tiene Asaas conectado

Puede **opcionalmente** ofrecer:

```text
Chave PIX para pagamentos futuros      → pixDestination
```

pero **NO**:

```text
Método de pagamento obrigatório
```

### Contrato TARGET de creación

```http
POST /api/v1/recurring-payments
```

```json
{
  "name": "Aluguel do templo",
  "financialConceptId": "urn:financialConcept:...",
  "costCenterId": "urn:costCenter:...",
  "type": "FIXED",
  "amount": 3500,
  "dayOfMonth": 10,
  "status": "ACTIVE",
  "pixDestination": {
    "pixKeyType": "CNPJ",
    "pixKey": "12345678000190"
  }
}
```

`pixDestination` es opcional y **no** implica `method = PIX`.

### `CURRENT` — contrato de creación real

```json
{
  "name": "Aluguel do templo",
  "financialConceptId": "urn:financialConcept:...",
  "type": "FIXED",
  "amount": 3500,
  "dayOfMonth": 10,
  "status": "ACTIVE",
  "payment": { "method": "PIX", "pixKey": "12345678000190", "pixKeyType": "CNPJ" }
}
```

Obligatoriedades verificadas en `validateRecurringPaymentConfiguration`:

```text
payment.method          required, in: PIX, BILL     ← [GAP-01](./recurring-payments-gap-analysis.md#gap-01-paymentmethod-obligatorio-dentro-de-recurringpayment-alto) / [ADR-001](./adr/ADR-001-recurring-payment-does-not-own-payment-method.md)
payment.pixKey          required si method = PIX
payment.pixKeyType      required si method = PIX
payment (claves)        hasOnlyKeys: ["method"] para BILL
                          → BILL NO puede llevar pixKey     ← GAP-05
campos permitidos       name, financialConceptId, type, amount,
                        dayOfMonth, payment, status
                          → costCenterId RECHAZADO           ← GAP-02
amount                  required|numeric si FIXED; debe ser > 0
                        VARIABLE && amount !== undefined → inválido
```

`payment: { method: "BILL" }` es obligatorio y **excluyente** con PIX: no se puede tener una recurrencia sin método, ni con destino PIX disponible para fallback.

### Efecto combinado de los gaps

```text
Una iglesia con Asaas:
  debe fijar PIX o BILL para siempre     → no puede elegir por mes       (GAP-01/04)
  debe fijar la chave PIX si elige PIX   → no puede informarla al pagar  (GAP-04)
  no puede guardar su centro de costo    → FinancialRecord sin costCenter (GAP-02)

Una iglesia sin Asaas:
  no puede usar recurrencias en absoluto                                  (GAP-01-mayor)
```

---

## 31. UX — iglesia sin Asaas

### Fila

```text
Aluguel do templo
R$ 3.500
PENDENTE

[ REGISTRAR PAGAMENTO ]
```

### Modal

```text
Registrar pagamento

Aluguel do templo
Outubro / 2026

Valor
R$ 3.500                    ← readonly (FIXED)

Data do pagamento
[ ... ]

Conta utilizada
[ ... ]                     ← AvailabilityAccount, selección por ejecución (§11)

Centro de custo
Templo                      ← readonly (viene de la recurrencia, §4)

Comprovante *
[ ANEXAR ]                  ← OBLIGATORIO (§10)

[ REGISTRAR PAGAMENTO ]
```

### Reglas de interacción

- **VARIABLE habilita el input de valor**; FIXED lo muestra readonly.
- **No se muestra selector de método de pago** (§8, §9).
- **No se muestran** `Conceito` ni `Centro de custo` como editables: se muestran como contexto informativo.
- El comprobante es obligatorio; el botón de envío permanece deshabilitado sin archivo adjunto.

### Estado del botón según `competenceStatus`

| Estado | Fila | Acción |
|---|---|---|
| `UPCOMING` | Fecha futura visible | Puede permitirse registrar (pago anticipado, §16) — `PENDING` de producto |
| `PENDING` | Resaltado | `[ REGISTRAR PAGAMENTO ]` |
| `PAID` | Marcado como pagado | Sin acción; ver el `FinancialRecord` |
| `INACTIVE` | Atenuado | Sin acción; ofrecer reactivar |

---

## 32. UX — iglesia con Asaas

### FIXED + PIX conocido

```text
[ PAGAR ]
```

→ confirmación directa. No se piden valor, chave ni tipo de chave (§12).

### FIXED sin PIX conocido

```text
Como deseja pagar?

[ PIX ]     [ BOLETO ]
```

El monto se muestra readonly.

### VARIABLE

```text
Valor
[ ... ]

Como deseja pagar?

[ PIX ]     [ BOLETO ]
```

### PIX — datos solicitados

```text
Chave PIX
[ ... ]

Tipo da chave
[ CPF | CNPJ | E-mail | Telefone | Aleatória (EVP) ]
```

### Al confirmar

```text
POST /api/v1/recurring-payments/:id/pay

FIXED + pixDestination:
  { "competence": "2026-10" }

FIXED + PIX informado:
  { "competence": "2026-10",
    "payment": { "type": "PIX", "pixKey": "...", "pixKeyType": "CNPJ" } }

VARIABLE + PIX:
  { "competence": "2026-10", "amount": 742.83,
    "payment": { "type": "PIX", "pixKey": "...", "pixKeyType": "CNPJ" } }
```

### Feedback de estado al usuario

| `competenceStatus` / status | Mensaje sugerido |
|---|---|
| `PROCESSING` | "Pagamento em processamento no banco" |
| `BLOCKED` | "O banco está retendo esta operação. **Não** tente novamente." (§24) |
| `FAILED` | "O pagamento falhou" + `failureCode` como diagnóstico + `[ TENTAR NOVAMENTE ]` |
| `PAID` | "Pagamento confirmado" + link al `FinancialRecord` |

⚠️ `failureCode` puede contener la razón **cruda de Asaas** (§26), no un código tipado. La UI **no** debe intentar traducirlo con un mapa cerrado ni mostrarlo como mensaje principal.

---

## 33. BILL UI

Para boleto:

```text
Código de barras / linha digitável
[ ... ]

[ ESCANEAR CÓDIGO ]
```

- La cámara pertenece al **frontend**.
- El resultado termina siendo `identificationField` para la ejecución bancaria.
- Se envía como `payment.identificationField` (TARGET) o `identificationField` (CURRENT).

### Validación — `PENDING` relevante

`church-banking` **no** valida el `identificationField` más allá de `required|string|notBlank`:

> No existe en el repositorio ninguna validación de dígito verificador, código de barras ni linha digitável. Un `identificationField` malformado llega a Asaas y vuelve como `CREATION_FAILED` (si Asaas responde 4xx confirmado) o `CREATION_UNKNOWN`.

Opciones para TARGET:

1. **Validar en Glória** (frontend + backend) el dígito verificador de la linha digitável / código de barras. Evita un viaje inútil y un posible `CREATION_UNKNOWN`.
2. **No validar** y confiar en `church-banking`/Asaas.
3. **Validar en `church-banking`** (fuente de verdad del contrato bancario) y devolver un error tipado.

`PENDING`: elegir. **Recomendación:** (3) como fuente de verdad + (1) como validación de UX temprana, evitando duplicar reglas divergentes entre capas. Mientras no se cierre, documentar que **un `identificationField` inválido puede producir `FAILED` o `BLOCKED`(no) / `CREATION_UNKNOWN`(sí)**, y que la UI debe tolerar ambos.

---

## 34. Diagrama de flujo obligatorio

El diagrama de decisión completo, desarrollado con **todos** los casos (`FIXED`, `VARIABLE`, PIX guardado, PIX informado en ejecución, BILL, manual, failed, blocked), está en:

[`recurring-payments-diagrams.md` → §1 Diagrama de decisión principal](./recurring-payments-diagrams.md#1-diagrama-de-decisión-principal)

---

## 35. Diagramas de secuencia obligatorios

Los 10 diagramas están en:

[`recurring-payments-diagrams.md` → §2 Diagramas de secuencia](./recurring-payments-diagrams.md#2-diagramas-de-secuencia)

| # | Escenario |
|---|---|
| 1 | FIXED manual |
| 2 | VARIABLE manual |
| 3 | FIXED + saved PIX |
| 4 | FIXED + PIX informado |
| 5 | VARIABLE + PIX |
| 6 | VARIABLE + BILL |
| 7 | banking webhook success |
| 8 | banking failure |
| 9 | BLOCKED |
| 10 | retry |

---

## 36. Diagrama de estado

```text
UPCOMING
    ↓
PENDING

PENDING
├── manual  → PAID
└── banking → PROCESSING

PROCESSING
├── PAID
├── FAILED
└── BLOCKED

BLOCKED
├── PROCESSING
├── PAID
└── FAILED

FAILED
└── retry → PROCESSING
```

**Aclaración obligatoria:**

```text
PAID = FinancialRecord exists
```

`PAID` **no** es un campo que se escriba. Es una consecuencia de la existencia del `FinancialRecord` (§17). Ver el diagrama Mermaid en:

[`recurring-payments-diagrams.md` → §3 Diagrama de estados](./recurring-payments-diagrams.md#3-diagrama-de-estados)

---

## 40. Resultado esperado — matriz de respuestas

| Pregunta | Respuesta | Sección |
|---|---|---|
| ¿Qué **es** una recurrencia? | Un compromiso financiero mensual permanente, configurado una sola vez | §1 |
| ¿Qué **no es** una recurrencia? | Una ocurrencia mensual, un histórico, un método de pago | §1, §2 |
| ¿Qué se configura **una sola vez**? | Nombre, concepto, centro de costo, tipo, monto (si FIXED), día de vencimiento, destino PIX opcional, estado | §3, §30 |
| ¿Qué se solicita **cada mes**? | Competencia, datos de ejecución (monto si VARIABLE, método y destino si no está guardado), cuenta y comprobante si es manual | §11, §15, §18 |
| ¿Qué depende de **Asaas**? | Solo la **ejecución bancaria**: PIX y boleto | §7, §26 |
| ¿Qué ocurre **sin Asaas**? | Registro manual: `FinancialRecord` sin operación bancaria | §8, §9, §18 |
| ¿Cuándo se crea el `FinancialRecord`? | Bancario: al confirmar webhook terminal (`DONE`/`PAID`). Manual: al registrar con comprobante | §19, §20 |
| ¿Cómo se evita el **doble pago**? | Índice único `recurringPaymentId + recurringCompetence` + `currentPayment` CAS + idempotencia de `church-banking` | §22, §29 |
| ¿Cómo funciona **PIX**? | `POST /api/pix-transfers` con `pixKey` + `pixKeyType`; se paga al recibir `DONE` | §12, §13, §26 |
| ¿Cómo funciona **boleto**? | `POST /api/bill-payments` con `identificationField`; se paga al recibir `PAID`. **El valor no viaja** | §14, §26, §33 |
| ¿Cómo funciona **manual**? | `POST .../register-payment` multipart con comprobante obligatorio; crea `FinancialRecord` sin referencia bancaria | §18, §19 |
| ¿Cómo funciona **CostCenter**? | Obligatorio en la configuración; se copia al `FinancialRecord` en toda ejecución | §4 |
| ¿Cómo funciona el **comprobante**? | Obligatorio en manual; vía `StorageProviderService`; en bancario deriva del recibo de Asaas | §10, §20 |
| ¿Cómo funciona **retry**? | Solo desde estado terminal fallido confirmado; `attempt` nuevo; `CREATION_UNKNOWN` reutiliza el intento | §25 |
| ¿Cómo funciona **BLOCKED**? | Estado de espera no terminal; no crea `FinancialRecord`, no permite otro pago, no incrementa `attempt` | §24 |

# Pagamentos Recorrentes — Diagramas

> Documento complementario de [`recurring-payments.md`](./recurring-payments.md).
> Todos los diagramas distinguen **CURRENT** (implementado) de **TARGET** (a implementar) donde difieren.

## Índice

1. [Diagrama de decisión principal](#1-diagrama-de-decisión-principal)
2. [Diagramas de secuencia](#2-diagramas-de-secuencia)
   - [2.1 FIXED manual](#21-secuencia-1-fixed-manual)
   - [2.2 VARIABLE manual](#22-secuencia-2-variable-manual)
   - [2.3 FIXED + saved PIX](#23-secuencia-3-fixed-saved-pix)
   - [2.4 FIXED + PIX informado](#24-secuencia-4-fixed-pix-informado)
   - [2.5 VARIABLE + PIX](#25-secuencia-5-variable-pix)
   - [2.6 VARIABLE + BILL](#26-secuencia-6-variable-bill)
   - [2.7 Banking webhook success](#27-secuencia-7-banking-webhook-success)
   - [2.8 Banking failure](#28-secuencia-8-banking-failure)
   - [2.9 BLOCKED](#29-secuencia-9-blocked)
   - [2.10 Retry](#210-secuencia-10-retry)
3. [Diagrama de estados](#3-diagrama-de-estados)
4. [Diagrama de modelo de datos](#4-diagrama-de-modelo-de-datos)
5. [Diagrama de idempotencia](#5-diagrama-de-idempotencia)

---

## 1. Diagrama de decisión principal

**Este es el diagrama central de la documentación.**

```mermaid
flowchart TD
    RP["RecurringPayment<br/>(compromiso permanente)"]

    RP --> Q1{"¿Iglesia tiene<br/>banca Asaas<br/>conectada y activa?"}

    Q1 -->|NO| MANUAL["REGISTRO MANUAL<br/>(Glória NO ejecuta)"]
    Q1 -->|SÍ| BANK["EJECUCIÓN BANCARIA<br/>(Glória ejecuta vía church-banking)"]

    %% ---------- RAMA MANUAL ----------
    MANUAL --> MT{"Tipo de<br/>recurrencia?"}

    MT -->|FIXED| MF["Valor ya conocido<br/>(readonly desde config)"]
    MT -->|VARIABLE| MV["Usuario informa valor"]

    MF --> MREG["POST .../register-payment<br/>multipart/form-data"]
    MV --> MREG

    MREG --> MDATA["Datos solicitados:<br/>competence<br/>amount (solo VARIABLE)<br/>paymentDate<br/>availabilityAccountId<br/>voucher OBLIGATORIO"]

    MDATA --> MFR["FinancialRecord<br/>type = OUTGO<br/>source = MANUAL<br/>costCenter de la recurrencia<br/>bankingExternalReference = ausente"]

    MFR --> MPAID(["PAID"])

    %% ---------- RAMA BANCARIA ----------
    BANK --> BT{"Tipo de<br/>recurrencia?"}

    BT -->|FIXED| BF{"¿Tiene<br/>pixDestination<br/>guardado?"}
    BT -->|VARIABLE| BV["Usuario informa valor"]

    BF -->|SÍ| BPIXSAVED["PIX directo<br/>SIN volver a preguntar<br/>valor, chave ni tipo"]
    BF -->|NO| BCHOOSE["Usuario elige<br/>PIX o BOLETO"]

    BV --> BCHOOSE

    BCHOOSE -->|PIX| BPIX["Solicitar<br/>pixKey + pixKeyType"]
    BCHOOSE -->|BILL| BBILL["Solicitar<br/>identificationField"]

    BPIXSAVED --> CMD
    BPIX --> CMD
    BBILL --> CMD

    CMD["PayRecurringPaymentRequest<br/>competence<br/>amount? (solo VARIABLE)<br/>payment: type + destino"]

    CMD --> RESERVE["reserve currentPayment<br/>(CAS + índice único)<br/>status = PROCESSING"]

    RESERVE --> OUT["church-banking"]

    OUT -->|PIX| OXPIX["POST /api/pix-transfers"]
    OUT -->|BILL| OXBILL["POST /api/bill-payments"]

    OXPIX --> WH
    OXBILL --> WH

    WH["webhook<br/>BANKING_PIX_TRANSFER_UPDATED<br/>BANKING_BILL_PAYMENT_UPDATED"]

    WH --> WHS{"Estado terminal<br/>de éxito?"}
    WHS -->|"PIX: DONE<br/>BILL: PAID"| BFR["FinancialRecord<br/>type = OUTGO<br/>source = AUTO<br/>status = RECONCILED<br/>costCenter de la recurrencia<br/>bankingExternalReference = URN"]
    WHS -->|FAILED| BFAIL["status = FAILED"]
    WHS -->|BLOCKED| BBLOCK["status = BLOCKED<br/>(NO crea FinancialRecord)"]

    BFR --> BPAID(["PAID"])
    BFR --> CLOSE["close currentPayment"]

    BFAIL --> RETRY{"¿Reintentar?"}
    RETRY -->|SÍ| RESERVE

    BBLOCK --> WAIT["Esperar nuevo estado<br/>de church-banking"]

    classDef manualCls fill:#e8f4ff,stroke:#2b6cb0,color:#1a365d
    classDef bankCls fill:#fff5e6,stroke:#c05621,color:#7b341e
    classDef paidCls fill:#e6fffa,stroke:#2c7a7b,color:#234e52
    classDef failCls fill:#fff5f5,stroke:#c53030,color:#742a2a

    class MANUAL,MT,MF,MV,MREG,MDATA,MFR manualCls
    class BANK,BT,BF,BV,BPIXSAVED,BCHOOSE,BPIX,BBILL,CMD,RESERVE,OUT,OXPIX,OXBILL,WH,WHS,BFR,CLOSE bankCls
    class MPAID,BPAID paidCls
    class BFAIL,BBLOCK,WAIT,RETRY failCls
```

### 1.1 Lectura de las reglas del árbol

| Decisión | Determina | NO determina |
|---|---|---|
| ¿Asaas conectado? | **Quién ejecuta** (Glória o el usuario) | El método de pago |
| `FIXED` / `VARIABLE` | **Qué datos** se piden (valor readonly o input) | Quién ejecuta |
| `pixDestination` presente | **Si se puede saltar** la pregunta de destino PIX | Que el método sea PIX permanentemente |

**La capacidad bancaria y el tipo son dimensiones independientes.** El método de ejecución es una tercera dimensión, decidida en el momento del pago.

---

## 2. Diagramas de secuencia

> Los diagramas marcados **TARGET** requieren endpoints/contratos aún no implementados (ver [`recurring-payments-gap-analysis.md`](./recurring-payments-gap-analysis.md)).
> Los marcados **CURRENT** reflejan código existente en el PR #146.

### 2.1 Secuencia 1 — FIXED manual

**TARGET** (`CURRENT`: no existe endpoint de registro manual — GAP-01-mayor).

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario (tesouraria)
    participant FE as Frontend
    participant API as gloria_finance_api
    participant ST as StorageProviderService
    participant DB as MongoDB

    U->>FE: Clic en [ REGISTRAR PAGAMENTO ]<br/>(Aluguel do templo, Outubro/2026)
    FE->>API: GET /api/v1/recurring-payments?competence=2026-10
    API->>DB: list recurringPayments + financialRecords(competence)
    DB-->>API: recurrencia + registros
    API-->>FE: { ..., amount: 3500, costCenterId, competenceStatus: "PENDING" }

    Note over FE: Valor readonly = 3500<br/>Centro de custo readonly<br/>NO se pregunta método de pago

    U->>FE: Completa<br/>Data do pagamento<br/>Conta utilizada<br/>Anexa comprovante
    FE->>API: POST /api/v1/recurring-payments/:id/register-payment<br/>multipart/form-data<br/>{ competence, paymentDate, availabilityAccountId, voucher }

    API->>API: assertCompetence("2026-10")
    API->>DB: findRecurringPayment(id, "2026-10")
    DB-->>API: undefined (no pagado)

    API->>API: resolveAmount()<br/>FIXED → amount de la configuración<br/>RECHAZA amount enviado en el request

    API->>ST: uploadFile({ data, mimetype, originalname })
    ST-->>API: voucherUrl

    API->>API: financialConcept = recurring.financialConcept<br/>costCenter = recurring.costCenter<br/>type = OUTGO, source = MANUAL<br/>createdBy = usuario autenticado<br/>bankingExternalReference = ausente

    API->>DB: INSERT financial_records<br/>(recurringPaymentId, recurringCompetence)
    Note over DB: idx_financial_record_recurring_competence_unique<br/>impide un segundo registro

    DB-->>API: ok
    API-->>FE: 201 { financialRecordId, status: "CLEARED" }
    FE-->>U: "Pagamento registrado"
```

### 2.2 Secuencia 2 — VARIABLE manual

**TARGET**.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario (tesouraria)
    participant FE as Frontend
    participant API as gloria_finance_api
    participant ST as StorageProviderService
    participant DB as MongoDB

    U->>FE: Clic en [ REGISTRAR PAGAMENTO ]<br/>(Energia elétrica, Outubro/2026)
    FE->>API: GET /api/v1/recurring-payments?competence=2026-10
    API-->>FE: { ..., type: "VARIABLE", sin amount, costCenterId }

    Note over FE: Input de valor HABILITADO<br/>NO se pregunta PIX ou boleto<br/>(Glória no ejecuta)

    U->>FE: Valor: 742.83<br/>Data do pagamento<br/>Conta utilizada<br/>Comprovante
    FE->>API: POST .../register-payment<br/>multipart/form-data<br/>{ competence, amount: 742.83,<br/>paymentDate, availabilityAccountId, voucher }

    API->>API: assertCompetence()
    API->>API: resolveAmount()<br/>VARIABLE → exige amount válido<br/>precisión de centavos, > 0

    API->>DB: findRecurringPayment(id, "2026-10")
    DB-->>API: undefined

    API->>ST: uploadFile(...)
    ST-->>API: voucherUrl

    API->>DB: INSERT financial_records<br/>amount = 742.83 (del request)<br/>costCenter = recurring.costCenter<br/>type = OUTGO, source = MANUAL

    DB-->>API: ok
    API-->>FE: 201 { financialRecordId }
    FE-->>U: "Pagamento registrado"
```

### 2.3 Secuencia 3 — FIXED + saved PIX

**TARGET** (destino en `pixDestination`; `CURRENT` lo tiene en `payment.pixKey` y lo decide por configuración).

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant FE as Frontend
    participant API as gloria_finance_api
    participant CB as church-banking
    participant ASAAS as Asaas
    participant DB as MongoDB

    Note over API: RecurringPayment<br/>FIXED, amount = 3500<br/>pixDestination = { CNPJ, 12345678000190 }

    U->>FE: Clic en [ PAGAR R$ 3.500,00 ]
    FE->>API: POST /api/v1/recurring-payments/:id/pay<br/>{ "competence": "2026-10" }
    Note over FE,API: `competence` = competencia contable de la recurrencia (`YYYY-MM`):<br/>mes al que corresponde el pago recurrente, **no** fecha de pago ni vencimiento<br/>NO se envía amount (FIXED)<br/>NO se envía payment (hay pixDestination)

    API->>API: assertCompetence()
    API->>DB: findRecurringPayment(id, "2026-10")
    DB-->>API: undefined (ALREADY_PAID no aplica)
    API->>API: resolveAmount() → 3500 (de la configuración)
    API->>DB: financialConcept OUTGO activo
    DB-->>API: concept
    API->>API: findConnectedAccount(churchId)<br/>→ HAS_CONNECTED_BANK_ACCOUNT

    API->>API: externalReference =<br/>urn:recurringPayment:{id}:2026-10:1
    API->>DB: reserveCurrentPayment + saveIfCurrentPaymentMatches<br/>(CAS: currentPayment ausente → presente)
    Note over DB: idx_recurring_payments_active_reference_unique<br/>solo un ganador

    API->>CB: POST /api/pix-transfers<br/>{ externalAccountId, amountInCents: 350000,<br/>pixKey, pixKeyType: "CNPJ", description,<br/>externalReference, context }
    Note over API,CB: JWE (ECDH-ES/A256GCM) +<br/>JWT ES256 con method/path/bodyHash

    CB->>ASAAS: POST /v3/transfers<br/>{ value, pixAddressKey, pixAddressKeyType,<br/>description, externalReference: UUID propio }
    ASAAS-->>CB: { id, status: "PENDING" }
    CB-->>API: 201 { data: { status: "PENDING", ... }, code: "OK" }

    API->>DB: updateCurrentPayment<br/>status = PROCESSING
    API-->>FE: 200 { status: "PROCESSING", competence: "2026-10" }
    FE-->>U: "Pagamento em processamento no banco"

    Note over ASAAS,API: ... webhook posterior (§2.7) ...
```

### 2.4 Secuencia 4 — FIXED + PIX informado

**TARGET** (bloqueado hoy: el validator no acepta `pixKey` en la ejecución — GAP-04).

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant FE as Frontend
    participant API as gloria_finance_api
    participant CB as church-banking
    participant DB as MongoDB

    Note over API: RecurringPayment<br/>FIXED, amount = 3500<br/>pixDestination = AUSENTE

    U->>FE: Clic en [ PAGAR ]
    FE-->>U: "Como deseja pagar?" [ PIX ] [ BOLETO ]
    U->>FE: PIX
    FE-->>U: Solicitar chave + tipo

    U->>FE: pixKey = "11987654321"<br/>pixKeyType = "PHONE"
    FE->>API: POST .../pay<br/>{ "competence": "2026-10",<br/>  "payment": { "type": "PIX",<br/>    "pixKey": "11987654321", "pixKeyType": "PHONE" } }

    API->>API: resolveAmount() → 3500 (config)<br/>amount en request → RECHAZADO

    alt Usuario marcó "Salvar esta chave"
        API->>DB: PUT recurringPayments<br/>pixDestination = { PHONE, 11987654321 }
        Note over DB: Actualiza pixDestination.<br/>NO cambia ningún "method".
    end

    API->>API: externalReference =<br/>urn:recurringPayment:{id}:2026-10:1
    API->>DB: reserveCurrentPayment (CAS)

    API->>CB: POST /api/pix-transfers<br/>{ amountInCents: 350000,<br/>pixKey: "11987654321", pixKeyType: "PHONE", ... }
    CB-->>API: { status: "PENDING" }

    API->>DB: currentPayment.status = PROCESSING
    API-->>FE: 200 { status: "PROCESSING" }
```

### 2.5 Secuencia 5 — VARIABLE + PIX

**TARGET**.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant FE as Frontend
    participant API as gloria_finance_api
    participant CB as church-banking
    participant DB as MongoDB

    Note over API: RecurringPayment<br/>VARIABLE (Energia elétrica)

    U->>FE: Clic en [ PAGAR ]
    FE-->>U: Input de valor + "Como deseja pagar?"
    U->>FE: Valor = 742.83, elige PIX<br/>pixKey + pixKeyType

    FE->>API: POST .../pay<br/>{ "competence": "2026-10", "amount": 742.83,<br/>  "payment": { "type": "PIX",<br/>    "pixKey": "...", "pixKeyType": "CNPJ" } }

    API->>API: resolveAmount()<br/>VARIABLE → amount REQUERIDO<br/>valida > 0 y precisión de centavos
    API->>API: externalReference = urn:...:2026-10:1
    API->>DB: reserveCurrentPayment<br/>amount = 742.83 congelado en currentPayment
    API->>DB: saveIfCurrentPaymentMatches (CAS)

    API->>CB: POST /api/pix-transfers<br/>{ amountInCents: 74283, pixKey, pixKeyType, ... }
    CB-->>API: { status: "PENDING" }

    API->>DB: currentPayment.status = PROCESSING
    API-->>FE: 200 { status: "PROCESSING" }

    Note over API,DB: El webhook validará<br/>Math.round(payment.amount*100) === amountInCents
```

### 2.6 Secuencia 6 — VARIABLE + BILL

**TARGET.** Incluye el `PENDING` crítico del valor del boleto (§14 del documento principal).

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant FE as Frontend
    participant API as gloria_finance_api
    participant CB as church-banking
    participant ASAAS as Asaas
    participant DB as MongoDB

    Note over API: RecurringPayment<br/>VARIABLE (Energia elétrica)

    U->>FE: Clic en [ PAGAR ]
    FE-->>U: Input de valor + "Como deseja pagar?"
    U->>FE: Valor = 742.83, elige BOLETO
    FE-->>U: "Código de barras / linha digitável"<br/>[ ESCANEAR CÓDIGO ]
    U->>FE: identificationField = "34191.79001 01043..."

    FE->>API: POST .../pay<br/>{ "competence": "2026-10", "amount": 742.83,<br/>  "payment": { "type": "BILL",<br/>    "identificationField": "34191..." } }

    API->>API: resolveAmount() → 742.83 (VARIABLE)
    API->>API: externalReference = urn:...:2026-10:1
    API->>DB: reserveCurrentPayment<br/>amount = 742.83, identificationField congelado
    API->>DB: saveIfCurrentPaymentMatches (CAS)

    API->>CB: POST /api/bill-payments<br/>{ externalAccountId, identificationField,<br/>description, externalReference, context }
    Note over API,CB: NO se envía value ni dueDate.<br/>church-banking NO los acepta.

    CB->>ASAAS: POST /v3/bill<br/>{ identificationField, description,<br/>externalReference: UUID propio }
    ASAAS-->>CB: { id, status, value, dueDate }
    Note over ASAAS,CB: Asaas DERIVA value y dueDate del boleto
    CB-->>API: { data: { status: "PENDING", ... }, code: "OK" }

    API->>DB: currentPayment.status = PROCESSING
    API-->>FE: 200 { status: "PROCESSING" }

    Note over API,DB: PENDING: el amount del FinancialRecord sale del<br/>valor informado por el usuario, porque church-banking<br/>NO expone el value real del boleto. Ver §14.
```

### 2.7 Secuencia 7 — banking webhook success

**CURRENT** (implementado y verificado).

```mermaid
sequenceDiagram
    autonumber
    participant CB as church-banking
    participant WH as POST /webhooks/church-banking
    participant V as ChurchBankingWebhookVerifier
    participant H as ProcessRecurringPaymentBankingUpdate
    participant REG as RegisterRecurringPaymentFinancialRecord
    participant Q as Bull Queue
    participant JOB as CreateFinancialRecord.job
    participant DB as MongoDB

    CB->>WH: POST { id, occurredAt, externalAccountId,<br/>accountId, data: { pixTransfer: {<br/>  providerTransferId, status: "DONE",<br/>  amountInCents, externalReference, context,<br/>  transactionReceiptUrl, failureCode } } }

    WH->>V: authenticate (JWT + bodyHash)
    V-->>WH: ok

    WH->>H: processPix(event)

    H->>DB: findByBankingExternalReference(externalReference)
    alt Ya existe FinancialRecord
        DB-->>H: record
        H->>H: assertDuplicateContext(churchId,<br/>recurringPaymentId, externalReference,<br/>context, externalAccountId)
        Note over H: IDEMPOTENTE — no se hace nada<br/>(excepto log si REFUNDED)
        H-->>WH: return
    else No existe
        DB-->>H: undefined

        H->>DB: findOperation(externalAccountId, accountId,<br/>externalReference, context)
        DB-->>H: recurringPayment (currentPayment)

        H->>H: validar Math.round(payment.amount*100)<br/>=== transfer.amountInCents
        Note over H: Mismatch → RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH

        H->>REG: recordConfirmed(recurring, payment,<br/>transactionReceiptUrl, paymentDate, "DONE")

        REG->>DB: findRecurringPayment(id, competence)
        alt Ya existe
            DB-->>REG: record
            REG-->>H: return (idempotente)
        else
            DB-->>REG: undefined
            REG->>REG: AsaasReceiptStorage.save(...)<br/>→ voucher vía StorageProviderService
            REG->>Q: dispatch(CreateFinancialRecordJob,<br/>financialRecord, { jobId: "recurring-" + sha256(ref) })
            Note over Q: jobId determinista → encolado idempotente
            Q->>JOB: ejecutar
            JOB->>DB: INSERT financial_records
            Note over DB: type = OUTGO, source = AUTO,<br/>status = RECONCILED, createdBy = "system"<br/>costCenter = recurring.costCenter (TARGET)<br/>bankingExternalReference = URN<br/>recurringPaymentId + recurringCompetence<br/>idx único parcial protege
        end

        H->>DB: closeCurrentPayment(externalReference)
        Note over DB: currentPayment desaparece.<br/>PAID = existencia del FinancialRecord
    end

    WH-->>CB: 200 { message: "ok" }
```

### 2.8 Secuencia 8 — banking failure

**CURRENT**.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant API as gloria_finance_api
    participant CB as church-banking
    participant WH as Webhook
    participant DB as MongoDB

    Note over API: currentPayment.status = PROCESSING<br/>providerStatus = "PENDING"

    CB->>WH: { data: { pixTransfer: {<br/>  status: "FAILED",<br/>  failureCode: "..." } } }
    WH->>DB: findOperation(...)
    DB-->>WH: recurring + currentPayment

    WH->>WH: applyStatus(recurring, payment,<br/>{ providerStatus: "FAILED" })

    WH->>DB: currentPayment.status = "FAILED"<br/>providerStatus = "FAILED"<br/>failureCode = event.failureCode<br/>INTENTO CONSERVADO (attempt sigue siendo 1)
    DB-->>WH: ok

    Note over DB: NO se crea FinancialRecord<br/>competenceStatus = FAILED

    U->>API: GET /api/v1/recurring-payments?competence=2026-10
    API-->>U: { competenceStatus: "FAILED",<br/>  currentPayment: { failureCode } }
    Note over U: UI muestra "O pagamento falhou"<br/>+ [ TENTAR NOVAMENTE ]

    Note over U,API: El retry se documenta en §2.10.<br/>BLOCKED (no-terminal) != FAILED (terminal).
```

### 2.9 Secuencia 9 — BLOCKED

**CURRENT**. `BLOCKED` **solo existe para PIX**; no es terminal en `church-banking`.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant API as gloria_finance_api
    participant CB as church-banking
    participant ASAAS as Asaas
    participant WH as Webhook
    participant DB as MongoDB

    Note over API: currentPayment.status = PROCESSING<br/>attempt = 1

    ASAAS->>CB: TRANSFER_BLOCKED
    CB->>WH: { data: { pixTransfer: { status: "BLOCKED" } } }
    WH->>DB: findOperation(...)
    DB-->>WH: recurring + currentPayment

    WH->>DB: currentPayment.status = "BLOCKED"<br/>providerStatus = "BLOCKED"<br/>externalReference CONSERVADO<br/>attempt NO incrementado
    Note over DB: NO se crea FinancialRecord

    U->>API: GET ...?competence=2026-10
    API-->>U: { competenceStatus: "BLOCKED" }
    Note over U: "O banco está retendo esta operação.<br/>NÃO tente novamente."

    U->>API: POST .../pay (reintento del usuario)
    API->>API: existing.status === "BLOCKED"
    API-->>U: 200 { status: "BLOCKED" }
    Note over API: RETORNO TEMPRANO — no se llama a church-banking<br/>ExecuteRecurringPayment.ts:106-108

    Note over ASAAS,API: Espera indefinida.<br/>No hay timeout del lado de Glória.

    ASAAS->>CB: TRANSFER_DONE (o TRANSFER_FAILED / TRANSFER_CANCELLED)
    CB->>WH: { data: { pixTransfer: { status: "DONE" } } }
    WH->>DB: status = PROCESSING, providerStatus = "DONE"
    WH->>DB: crear FinancialRecord + closeCurrentPayment
    Note over DB: BLOCKED → PAID
```

### 2.10 Secuencia 10 — retry

**CURRENT**. Distingue **rechazo confirmado** de **resultado desconocido** — la distinción más importante del sistema.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant API as gloria_finance_api
    participant CB as church-banking
    participant DB as MongoDB

    rect rgb(255, 245, 245)
    Note over API,CB: CASO A — INTENTO 1 FALLÓ CONFIRMADO
    Note over API: attempt = 1, status = FAILED<br/>providerStatus = CREATION_FAILED

    U->>API: POST .../pay { competence: "2026-10", ... }
    API->>API: existing.status === "FAILED" → permite nuevo intento
    API->>API: attempt = existing.attempt + 1 = 2
    API->>API: externalReference =<br/>urn:recurringPayment:{id}:2026-10:2
    Note over API: REFERENCIA NUEVA → church-banking<br/>la trata como operación lógica distinta

    API->>DB: reserveCurrentPayment (attempt = 2) + CAS
    API->>CB: POST /api/pix-transfers<br/>{ externalReference: "...:2" }
    CB-->>API: { status: "PENDING" }
    API->>DB: status = PROCESSING
    end

    rect rgb(255, 250, 230)
    Note over API,CB: CASO B — INTENTO 1 QUEDÓ INDETERMINADO
    Note over API: attempt = 1, status = PROCESSING<br/>providerStatus = CREATION_UNKNOWN
    Note over API: NO sabemos si Asaas creó la operación

    U->>API: POST .../pay (o reintento automático)
    API->>API: providerStatus === "CREATION_UNKNOWN"
    API->>API: assertSameRetryPayload()<br/>mismo amount y mismo identificationField
    Note over API: Payload distinto → RECURRING_PAYMENT_IN_PROGRESS

    API->>API: MISMO attempt = 1<br/>MISMO externalReference = "...:1"
    Note over API: NO se crea intento nuevo.<br/>Esto evita un segundo débito real.

    API->>CB: POST /api/pix-transfers<br/>{ externalReference: "...:1" (idéntico) }
    CB->>CB: identity() {clientId, externalAccountId,<br/>externalReference} ya existe
    CB->>CB: continueExisting(winner, input)<br/>o reconcileUnknown por providerExternalReference
    CB-->>API: snapshot de la operación ORIGINAL
    Note over CB: NO se crea una segunda operación en Asaas
    API->>DB: updateCurrentPayment
    end

    rect rgb(230, 255, 250)
    Note over API,CB: CASO C — ESTADOS QUE NO PERMITEN RETRY
    Note over API: PROCESSING  → retorno temprano, sin llamada
    Note over API: BLOCKED     → retorno temprano, sin llamada
    Note over API: PAID        → ALREADY_PAID, sin llamada
    end
```

### 2.11 Resumen de las transiciones de retry

```mermaid
flowchart LR
    P["PROCESSING<br/>attempt = N"] -->|webhook FAILED| F["FAILED<br/>terminal"]
    F -->|retry| P2["PROCESSING<br/>attempt = N+1<br/>REFERENCIA NUEVA"]

    P -->|error de red / ambiguo| CU["PROCESSING<br/>CREATION_UNKNOWN<br/>attempt = N"]
    CU -->|retry con payload IDÉNTICO| P3["MISMA referencia<br/>attempt = N<br/>dedup en church-banking"]

    P -->|webhook BLOCKED| B["BLOCKED"]
    B -->|webhook posterior| P
    B -->|webhook posterior| PAID["PAID"]

    P -->|webhook DONE/PAID| PAID

    CU -.->|PROHIBIDO crear intento nuevo| P2
    B -.->|PROHIBIDO crear intento nuevo| P2

    classDef ok fill:#e6fffa,stroke:#2c7a7b
    classDef bad fill:#fff5f5,stroke:#c53030
    classDef warn fill:#fffaf0,stroke:#c05621
    class PAID ok
    class F bad
    class CU,B warn
```

---

## 3. Diagrama de estados

### 3.1 Estado por competencia

```mermaid
stateDiagram-v2
    direction TB

    [*] --> UPCOMING: recurrencia creada (ACTIVE)<br/>vencimiento futuro
    [*] --> INACTIVE: recurrencia creada (INACTIVE)

    UPCOMING --> PENDING: llega la fecha de vencimiento<br/>dueDate <= hoy<br/>sin FinancialRecord

    PENDING --> PAID: MANUAL<br/>register-payment + voucher
    PENDING --> PROCESSING: BANCARIO<br/>reserve currentPayment

    PROCESSING --> PAID: webhook DONE (PIX)<br/>webhook PAID (BILL)<br/>→ FinancialRecord
    PROCESSING --> FAILED: webhook FAILED / CANCELLED
    PROCESSING --> BLOCKED: webhook BLOCKED<br/>(solo PIX)

    BLOCKED --> PROCESSING: webhook posterior
    BLOCKED --> PAID: webhook DONE
    BLOCKED --> FAILED: webhook FAILED / CANCELLED

    FAILED --> PROCESSING: retry<br/>attempt + 1<br/>nueva externalReference

    PAID --> [*]
    INACTIVE --> [*]

    note right of PAID
        PAID = FinancialRecord exists
        No es un campo escrito.
        Es una consecuencia de la
        existencia del FinancialRecord.
    end note

    note right of BLOCKED
        BLOCKED != FAILED
        No crea FinancialRecord
        No permite otro pago
        No incrementa attempt
        Conserva externalReference
        Espera estado de church-banking
    end note

    note right of FAILED
        Solo estados terminales
        fallidos permiten retry.
        PROCESSING / BLOCKED /
        CREATION_UNKNOWN NO.
    end note
```

### 3.2 Tabla de precedencia de cálculo

`ListRecurringPayments.competenceStatus` resuelve el estado en este orden exacto (`CURRENT`, verificado):

| # | Condición | Estado resultante |
|---|---|---|
| 1 | `RecurringPayment.status !== "ACTIVE"` | `INACTIVE` |
| 2 | `∃ FinancialRecord(recurringPaymentId, competence)` | `PAID` |
| 3 | `currentPayment.competence === competence` con `status` en `{PROCESSING, BLOCKED, FAILED}` | ese `status` |
| 4 | `dueDateForCompetence(dayOfMonth, competence) <= hoy` | `PENDING` |
| 5 | caso contrario | `UPCOMING` |

**Preservar este orden.** En particular la precedencia de `PAID` sobre `currentPayment`: la evidencia contable manda sobre el estado operativo.

### 3.3 Relación entre el estado de competencia y `currentPayment.status`

```mermaid
flowchart LR
    subgraph Dominio["RecurringPayment (permanente)"]
        CFG["name<br/>financialConceptId<br/>costCenterId<br/>type, amount?, dayOfMonth<br/>pixDestination?<br/>status: ACTIVE|INACTIVE"]
    end

    subgraph Operativo["currentPayment (en vuelo, NO histórico)"]
        CP["competence, attempt<br/>externalReference<br/>amount, bankId<br/>availabilityAccountId<br/>status: PROCESSING|BLOCKED|FAILED<br/>providerStatus<br/>failureCode?, identificationField?<br/>paymentDate?, transactionReceiptUrl?"]
    end

    subgraph Contable["FinancialRecord (histórico)"]
        FR["recurringPaymentId<br/>recurringCompetence<br/>bankingExternalReference?<br/>type = OUTGO<br/>costCenter<br/>voucher?<br/>source: MANUAL|AUTO<br/>status: CLEARED|RECONCILED"]
    end

    CFG -->|"reserve (bancario)"| CP
    CFG -->|"register (manual)"| FR
    CP -->|"webhook terminal de éxito"| FR
    CP -.->|"closeCurrentPayment"| X["(se elimina)"]

    FR --> PAID(["PAID = existe FinancialRecord"])

    classDef cfg fill:#e8f4ff,stroke:#2b6cb0
    classDef cp fill:#fffaf0,stroke:#c05621
    classDef fr fill:#e6fffa,stroke:#2c7a7b
    class CFG cfg
    class CP cp
    class FR,PAID fr
```

---

## 4. Diagrama de modelo de datos

```mermaid
erDiagram
    CHURCH ||--o{ RECURRING_PAYMENT : "tiene"
    CHURCH ||--o{ BANK : "posee (embebido en el doc church)"
    CHURCH ||--o{ AVAILABILITY_ACCOUNT : "tiene"
    FINANCIAL_CONCEPT ||--o{ RECURRING_PAYMENT : "clasifica"
    COST_CENTER ||--o{ RECURRING_PAYMENT : "imputa"
    RECURRING_PAYMENT ||--o{ FINANCIAL_RECORD : "origina (recurringPaymentId)"
    AVAILABILITY_ACCOUNT ||--o{ FINANCIAL_RECORD : "origen del dinero"
    FINANCIAL_CONCEPT ||--o{ FINANCIAL_RECORD : "clasifica"
    COST_CENTER ||--o{ FINANCIAL_RECORD : "imputa"
    BANK ||--o{ AVAILABILITY_ACCOUNT : "source.bankId"

    RECURRING_PAYMENT {
        string recurringPaymentsId PK "CURRENT (plural)"
        string churchId FK
        string name
        string financialConceptId FK "OUTGO obligatorio"
        string costCenterId FK "TARGET - obligatorio - GAP-02"
        string type "FIXED | VARIABLE"
        number amount "solo FIXED"
        number dayOfMonth "1..31"
        object pixDestination "TARGET - opcional"
        string status "ACTIVE | INACTIVE"
        object currentPayment "operativo, no historico"
    }

    FINANCIAL_RECORD {
        string financialRecordId PK
        string churchId FK
        string recurringPaymentId FK
        string recurringCompetence "YYYY-MM"
        string bankingExternalReference "ausente si manual"
        string type "OUTGO | REVERSAL | ..."
        number amount
        date date
        object costCenter "costCenterId + name"
        object availabilityAccount
        object financialConcept
        string voucher "OBLIGATORIO si manual"
        string source "MANUAL | AUTO | IMPORTED"
        string status "CLEARED | RECONCILED | ..."
        string createdBy
    }

    AVAILABILITY_ACCOUNT {
        string availabilityAccountId PK
        string churchId FK
        string accountName
        boolean active
        object source "bankId"
    }

    BANK {
        string bankId PK
        string churchId FK
        boolean active "HAS_CONNECTED_BANK_ACCOUNT"
        string name
        string tag
    }

    COST_CENTER {
        string costCenterId PK
        string churchId FK
        string name
    }

    FINANCIAL_CONCEPT {
        string financialConceptId PK
        string churchId FK
        string type "OUTGO obligatorio"
        boolean active
    }
```

### 4.1 Nota sobre `Bank`

`Bank` **no tiene colección propia**: `static collectionName()` devuelve `"churches"` (`src/Banking/domain/Bank.ts:11-13`). La configuración bancaria de la iglesia vive **dentro del documento de la iglesia**. El `availabilityAccount.source.bankId` apunta al `bankId` de ese objeto embebido.

---

## 5. Diagrama de idempotencia

### 5.1 Las dos capas

```mermaid
flowchart TD
    subgraph Capa1["CAPA 1 — gloria_finance_api"]
        U1["Usuario / webhook / reintento"]
        U1 --> K1{"¿Existe FinancialRecord<br/>con recurringPaymentId<br/>+ recurringCompetence?"}
        K1 -->|SÍ| R1["Retorno temprano<br/>ALREADY_PAID / idempotente"]
        K1 -->|NO| I1["INSERT financial_records"]
        I1 --> IDX1["idx_financial_record_<br/>recurring_competence_unique<br/>(parcial, unique)"]
        IDX1 -->|duplicate key| R1
        IDX1 -->|ok| OK1["Un solo FinancialRecord<br/>= un solo pago contable"]
    end

    subgraph Capa2["CAPA 2 — church-banking"]
        OUT["POST /api/pix-transfers<br/>POST /api/bill-payments"]
        OUT --> K2{"¿Existe operación con<br/>clientId + externalAccountId<br/>+ externalReference?"}
        K2 -->|SÍ| R2["continueExisting()<br/>o reconcileUnknown()"]
        K2 -->|NO| I2["insert + CAS replaceIfCurrent"]
        I2 --> IDX2["uq_pix_transfers_<br/>client_account_reference<br/>uq_bill_payments_<br/>client_account_reference"]
        IDX2 -->|duplicate key| R2
        IDX2 -->|ok| ASAAS["POST /v3/transfers<br/>POST /v3/bill"]
        ASAAS --> OK2["Una sola operación<br/>= un solo débito bancario"]
    end

    OK1 --> RESULT(["Los retries HTTP NO<br/>pueden generar dobles débitos"])
    OK2 --> RESULT
    R1 --> RESULT
    R2 --> RESULT

    classDef layer1 fill:#e8f4ff,stroke:#2b6cb0
    classDef layer2 fill:#fff5e6,stroke:#c05621
    classDef ok fill:#e6fffa,stroke:#2c7a7b
    class U1,K1,I1,IDX1,R1,OK1 layer1
    class OUT,K2,I2,IDX2,R2,ASAAS,OK2 layer2
    class RESULT ok
```

### 5.2 El papel de `attempt` en la idempotencia

```mermaid
flowchart LR
    E1["externalReference<br/>urn:...:2026-10:1"]
    E2["externalReference<br/>urn:...:2026-10:2"]

    E1 --> D1["church-banking:<br/>operación lógica A"]
    E2 --> D2["church-banking:<br/>operación lógica B"]

    D1 --> N1["Reintentos de red del MISMO intento<br/>→ deduplicados por identidad"]
    D2 --> N2["Intento distinto<br/>→ operación distinta"]

    N1 --> C1["Sin doble débito DENTRO del intento"]
    N2 --> C2["La dedup bancaria NO protege ENTRE intentos"]

    C2 --> RULE["Por eso: SOLO un fallo CONFIRMADO<br/>habilita un attempt nuevo.<br/>CREATION_UNKNOWN reutiliza el attempt."]

    classDef ok fill:#e6fffa,stroke:#2c7a7b
    classDef warn fill:#fffaf0,stroke:#c05621
    class C1 ok
    class C2,RULE warn
```

**Esta es la invariante más importante del sistema y debe tener un test explícito.**

### 5.3 Matriz de invariantes

| Invariante | Mecanismo | Ubicación |
|---|---|---|
| Un `FinancialRecord` por recurrencia+competencia | índice único parcial | `FinanceRecordMongoRepository` |
| Una `currentPayment` con referencia activa | índice único sparse | `RecurringPaymentsMongoRepository` |
| Un solo ganador al reservar | CAS `replaceOne` con estado esperado | `saveIfCurrentPaymentMatches` |
| Webhook procesado una vez | cortocircuito por `bankingExternalReference` + `findRecurringPayment` | `ProcessRecurringPaymentBankingUpdate`, `RegisterRecurringPaymentFinancialRecord` |
| Encolado una sola vez | `jobId` determinista = `recurring-` + `sha256(externalReference)` | `RegisterRecurringPaymentFinancialRecord.ts:88` |
| Una operación lógica en el banco | índice único `{clientId, externalAccountId, externalReference}` | `church-banking` |
| Sin intento nuevo tras duda | `CREATION_UNKNOWN` reutiliza `attempt` y exige payload idéntico | `ExecuteRecurringPayment.ts:124-128, 353-366` |
| Cero registros manuales duplicados | índice único + `findRecurringPayment` (sin `currentPayment`) | §22 del documento principal |

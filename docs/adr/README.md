# Architecture Decision Records — Pagamentos Recorrentes

> Índice de las decisiones arquitectónicas adoptadas para la feature de Pagamentos Recorrentes.
> Documento principal: [`../recurring-payments.md`](../recurring-payments.md)

## Formato

Cada ADR sigue la estructura: **Contexto → Decisión → Consecuencias → Estado → Referencias**.
Las decisiones marcadas como **ACEPTADA** son definitivas y no deben rediseñarse en implementación.

## Índice de decisiones

| ADR | Título | Decisión | Estado |
|---|---|---|---|
| [ADR-001](./ADR-001-recurring-payment-does-not-own-payment-method.md) | RecurringPayment does not own payment method | PIX/BILL pertenece a la ejecución, no a la configuración permanente | **ACEPTADA** |
| [ADR-002](./ADR-002-cost-center-belongs-to-recurring-payment.md) | CostCenter belongs to RecurringPayment | Todo gasto tiene CostCenter; se configura una vez | **ACEPTADA** |
| [ADR-003](./ADR-003-manual-and-banking-execution-coexist.md) | Manual and banking execution coexist | Dos caminos de ejecución, un solo modelo de recurrencia | **ACEPTADA** |
| [ADR-004](./ADR-004-financial-record-is-execution-history.md) | FinancialRecord is execution history | El histórico es `FinancialRecord`; `PAID` es su consecuencia | **ACEPTADA** |
| [ADR-005](./ADR-005-manual-voucher-is-mandatory.md) | Manual voucher is mandatory | Todo registro manual requiere comprobante | **ACEPTADA** |
| [ADR-006](./ADR-006-availability-account-is-selected-per-manual-execution.md) | AvailabilityAccount is selected per manual execution | La cuenta es un hecho de la ejecución, no del compromiso | **ACEPTADA** |
| [ADR-007](./ADR-007-pix-destination-is-optional-reusable-metadata.md) | PIX destination is optional reusable metadata | `pixDestination` es conveniencia, no método | **ACEPTADA** |
| [ADR-008](./ADR-008-current-payment-is-banking-operational-state-only.md) | currentPayment is banking operational state only | Estado operativo en vuelo, nunca histórico, nunca manual | **ACEPTADA** |

## Resumen ejecutivo de las decisiones

```text
ADR-001  RecurringPayment  describe QUÉ compromiso existe
                          NO describe CÓMO se paga cada mes

ADR-002  RecurringPayment → FinancialConcept OUTGO
                          → CostCenter obligatorio (invariancia contable)

ADR-003  Sin Asaas  → REGISTRO MANUAL   (Glória no ejecuta)
         Con Asaas  → EJECUCIÓN BANCARIA (Glória ejecuta vía church-banking)

ADR-004  FinancialRecord = histórico de ejecuciones
         PAID = existe FinancialRecord        (no es un campo)

ADR-005  voucher = REQUIRED en ejecución manual
         reutiliza StorageProviderService     (sin almacenamiento paralelo)

ADR-006  AvailabilityAccount se selecciona al registrar el pago
         outubro → Itaú, novembro → Caixa es válido

ADR-007  pixDestination? = metadato reutilizable OPCIONAL
         NO significa paymentMethod = PIX

ADR-008  currentPayment = estado operativo bancario en vuelo
         NO es historial. NO se introduce en el flujo manual.
```

## Decisiones pendientes (`PENDING`) derivadas de estos ADRs

Estas **no** son ADRs cerrados: son preguntas que deben resolverse antes de implementar.

| # | Pregunta | Bloquea a | Referencia |
|---|---|---|---|
| P-01 | ¿Cómo se elige la cuenta bancaria cuando la iglesia tiene **múltiples** cuentas activas? | ADR-003, ejecución bancaria | `recurring-payments.md` §6 |
| P-02 | ¿El `FinancialRecord` de un BILL usa el `amount` informado por el usuario, o `church-banking` debe exponer el `value` real del boleto? | ADR-004, caso 5 | `recurring-payments.md` §14 |
| P-03 | ¿Se ofrece "Salvar esta chave PIX para próximos pagamentos" en la ejecución? Requiere contrato de escritura de `pixDestination`. | ADR-001, ADR-007 | `recurring-payments.md` §13 |
| P-04 | ¿Un `REFUNDED` posterior a `PAID` crea `REVERSAL`, marca `VOID` o solo se registra? | ADR-004 | `recurring-payments.md` §27 |
| P-05 | ¿`identificationField` se valida (dígito verificador) en Glória, en `church-banking`, o no se valida? | ADR-003 | `recurring-payments.md` §33 |
| P-06 | ¿`BLOCKED` requiere acción del usuario o mecanismo de cancelación? | ADR-008 | `recurring-payments.md` §24 |
| P-07 | Política de limpieza de comprobantes huérfanos (subida exitosa + fallo del insert). | ADR-005 | `recurring-payments.md` §22 |
| P-08 | ¿Corrección de un registro manual: edición del `FinancialRecord` o `VOID` + nuevo? | ADR-004, ADR-005 | `recurring-payments.md` §22 |
| ~~P-09~~ | **RESUELTO:** manual = `PENDING` (pendiente de conciliar), bancario = `CLEARED`. Ver ADR-004. | — | `recurring-payments.md` §19 |
| P-10 | ¿Se permite registrar pago para una competencia `UPCOMING` (pago anticipado)? | ADR-004 | `recurring-payments.md` §31 |

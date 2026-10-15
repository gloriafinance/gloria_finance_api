# ADR-004 — `FinancialRecord` is execution history

- **Estado:** ACEPTADA (definitiva)
- **Fecha:** 2026-10-14
- **Feature:** Pagamentos Recorrentes (PR #146)
- **Documento principal:** [`../recurring-payments.md`](../recurring-payments.md) §1, §17, §19, §20, §23, §36

---

## Contexto

Una recurrencia es un compromiso **permanente**; sus ejecuciones son hechos **mensuales**.

Existe la tentación natural de modelar el histórico dentro de la recurrencia:

```text
RecurringPaymentOccurrence
RecurringPaymentMonth
RecurringPaymentHistory
```

o de guardar el estado de pago por competencia:

```text
RecurringPayment.paidMonths: ["2026-10", "2026-11"]
RecurringPayment.lastPaidCompetence: "2026-11"
```

Estas aproximaciones son peligrosas porque **crean una segunda fuente de verdad financiera** que puede desincronizarse del libro contable. Si la recurrencia dice `paidMonths: ["2026-10"]` pero no existe el `FinancialRecord` correspondiente, ¿cuál es la verdad?

Además, Glória ya tiene un agregado contable completo y probado para registrar hechos:

```ts
// src/Financial/domain/FinanceRecord.ts
private costCenter?: { costCenterId: string; name: string }
private financialConcept: FinancialConcept
private churchId: string
private amount: number
private date: Date
private type: FinancialRecordType
private availabilityAccount: { ... }
private voucher?: string
private reference?: { type: string; entityId: string }
private recurringPaymentId?: string
private recurringCompetence?: string
private bankingExternalReference?: string
private status: FinancialRecordStatus
private source: FinancialRecordSource
private createdBy: string
```

`CURRENT` ya extendió `FinanceRecord` con exactamente los tres campos necesarios para vincularlo a una recurrencia (`:44-47`), y ya existe el índice único que garantiza unicidad por competencia.

---

## Decisión

> **El histórico de ejecuciones de una recurrencia es `FinancialRecord`. `PAID` no es un campo almacenado: es la consecuencia de que exista un `FinancialRecord` para esa competencia.**

### Consecuencias normativas

1. **Prohibido** crear `RecurringPaymentOccurrence`, `RecurringPaymentMonth` o `RecurringPaymentHistory` como histórico financiero mensual.
2. **Prohibido** persistir dentro de la recurrencia el estado de pago por competencia (arreglos de meses pagados, `lastPaidCompetence`, contadores de pago).
3. El estado `PAID` se **calcula**:

   ```text
   PAID(recurringPaymentId, competence)
     ⇔ ∃ FinancialRecord con ese recurringPaymentId y esa recurringCompetence
   ```

4. La unicidad se garantiza con índice único parcial:

   ```text
   idx_financial_record_recurring_competence_unique
     { recurringPaymentId: 1, recurringCompetence: 1 }  unique
     partialFilterExpression: { recurringPaymentId: $exists, recurringCompetence: $exists }
   ```

5. `CURRENT` ya cumple: `ListRecurringPayments.competenceStatus` consulta los registros y devuelve `"PAID"` si el `recurringPaymentId` está en el conjunto pagado (`ListRecurringPayments.ts:69-80`). **Preservar este diseño.**

### Campos de vinculación

| Campo | Obligatorio | Propósito |
|---|---|---|
| `recurringPaymentId` | Sí (en flujo de recurrencia) | Vínculo con el compromiso |
| `recurringCompetence` | Sí (en flujo de recurrencia) | Competencia `YYYY-MM` |
| `bankingExternalReference` | Solo bancario | Correlación de webhooks |
| `reference: { type: "RECURRING_PAYMENT", entityId }` | Sí | Trazabilidad genérica |

### Matriz de valores por camino

| Campo | Manual | Bancario |
|---|---|---|
| `type` | `OUTGO` | `OUTGO` |
| `financialConcept` | de la recurrencia | de la recurrencia |
| `costCenter` | de la recurrencia (ADR-002) | de la recurrencia (ADR-002) |
| `amount` | `amount` configurado (FIXED) o informado (VARIABLE) | `amount` congelado en `currentPayment` |
| `availabilityAccount` | seleccionado por el usuario (ADR-006) | derivado de la cuenta conectada |
| `voucher` | archivo obligatorio (ADR-005) | recibo de Asaas (opcional) |
| `date` | `paymentDate` informado | `paymentDate` del provider o `occurredAt` |
| `source` | `MANUAL` | `AUTO` |
| `status` | `PENDING` — declarado, pendiente de conciliar | `CLEARED` — ejecutado por el banco |
| `createdBy` | usuario autenticado | `"system"` |
| `bankingExternalReference` | **ausente** | URN de la operación |

### Enums reales (verificados)

```text
FinancialRecordType   = INCOME | OUTGO | PURCHASE | TRANSFER | REVERSAL
FinancialRecordSource = MANUAL | AUTO | IMPORTED
FinancialRecordStatus = PENDING | CLEARED | RECONCILED | VOID
```

`REVERSAL` existe para reversiones — relevante para el `PENDING` P-04 (`REFUNDED`).

---

## Consecuencias

### Positivas

- **Una sola fuente de verdad financiera.** No puede haber discrepancia entre "la recurrencia dice pagado" y "existe el registro": son la misma afirmación.
- Los reportes, la conciliación bancaria, el flujo de caja y la consolidación funcionan sin cambios, porque ya leen `FinancialRecord`.
- El histórico es auditable con las herramientas existentes (`createdBy`, `createdAt`, `updatedAt`, `clearedAt`, `reconciledAt`).
- La idempotencia se resuelve con un índice, no con lógica de aplicación dispersa.
- Borrar una recurrencia no borra su historia financiera.

### Negativas / costos

- Consultar el histórico de una recurrencia requiere una consulta por `recurringPaymentId` (ya indexada por `idx_financial_record_recurring_competence_unique` y `idx_financial_records_recurring_by_church_competence`).
- El estado `PAID` no está materializado: cada listado calcula el estado. Aceptable con los índices actuales; revisar si el volumen crece.
- La corrección de un registro manual choca con el índice único: no se puede "crear otro". Debe editarse o reversarse. Ver `PENDING` P-08.

### Resuelto — elección de `status` por camino (antes P-09)

Es la única decisión de esta ADR que queda abierta. Según la semántica documentada en el propio enum:

| `status` | Semántica documentada | ¿Encaja con registro manual? |
|---|---|---|
| `PENDING` | "registrada pero aún no ocurrió… **No afecta al flujo de caja real**" | **No** — el pago ya ocurrió |
| `CLEARED` | "ya ocurrió físicamente… **Tesorería registró el pago de una factura y adjuntó el comprobante**" | **Sí** — es exactamente el caso |
| `RECONCILED` | "verificado contra el extracto bancario" | **No** — no hubo conciliación contra extracto |

**Resuelto:** el registro manual nace `CLEARED` (la iglesia declara un pago realizado) y `BankStatementReconciler` lo promueve a `RECONCILED` al casar el extracto. El bancario nace `RECONCILED` porque el proveedor ya lo confirmó.

### `PENDING` P-04 — `REFUNDED` posterior a `PAID`

`CURRENT` **no** revierte la contabilidad; solo registra un log (`ProcessRecurringPaymentBankingUpdate.processPix`, `:113-119`):

> `"Recognized recurring PIX refund; accounting reversal requires a business rule"`

Opciones:

1. Crear un `FinancialRecord` de tipo `REVERSAL`.
2. Cambiar el `status` del existente a `VOID`.
3. Permanecer como log de diagnóstico.

`PENDING`. No implementar sin decisión contable explícita.

---

## Alternativas consideradas y rechazadas

| Alternativa | Por qué se rechaza |
|---|---|
| `RecurringPaymentOccurrence` (documento por mes) | Duplica el concepto de `FinancialRecord`. Crea una segunda fuente de verdad que puede desincronizarse. Requiere su propia conciliación y sus propios reportes. |
| `RecurringPayment.paidMonths: string[]` | Mismo problema, agravado: el arreglo crece sin límite, no tiene auditoría, ni actor, ni voucher, ni centro de costo, ni vínculo con el banco. |
| `RecurringPaymentHistory` como colección separada de `financial_records` | Aparece en los reportes solo si se agrega lógica especial en cada reporte. Viola DRY contable y crea dos libros. |
| `lastPaidCompetence` como caché del estado | Un caché que puede desincronizarse de la verdad. Introduce un modo de fallo silencioso: la recurrencia dice pagada y el registro no existe. |
| Materializar `PAID` como campo en la recurrencia | Misma objeción. Además `CURRENT` ya demuestra que calcularlo es barato con los índices actuales. |

---

## Verificación de cumplimiento

- [ ] No existe ninguna entidad `RecurringPaymentOccurrence` / `Month` / `History`.
- [ ] `RecurringPayment` **no** persiste estado de pago por competencia.
- [ ] `PAID` se calcula desde la existencia de `FinancialRecord`.
- [ ] Existe y está activo `idx_financial_record_recurring_competence_unique`.
- [ ] Un segundo `FinancialRecord` para la misma `recurringPaymentId + recurringCompetence` es rechazado por la base de datos (no solo por la aplicación).
- [ ] El test de duplicado verifica el **error de duplicate-key**, no solo el camino feliz de la validación en aplicación.
- [ ] El histórico de una recurrencia se obtiene consultando `financial_records`.
- [ ] `bankingExternalReference` está ausente en registros manuales y presente en bancarios.
- [ ] La precedencia de cálculo de estado respeta: `INACTIVE` > `PAID` > `currentPayment.status` > `PENDING`/`UPCOMING`.

---

## Referencias

- `src/Financial/domain/FinanceRecord.ts:44-47`
- `src/Financial/domain/enums/FinancialRecordType.enum.ts` (`FinancialRecordType`, `FinancialRecordStatus`, `FinancialRecordSource`)
- `src/Financial/infrastructure/persistence/FinanceRecordMongoRepository.ts:258-267` (índice único), `:38-48` (`findRecurringPayment`)
- `src/Financial/applications/recurringPayments/ListRecurringPayments.ts:65-80` (cálculo de `PAID`)
- `src/Financial/applications/recurringPayments/RegisterRecurringPaymentFinancialRecord.ts:42-89`
- `src/Webhook/infrastructure/services/ProcessRecurringPaymentBankingUpdate.service.ts:113-119` (`REFUNDED`)
- ADR-002, ADR-008
- Gap analysis: GAP-07

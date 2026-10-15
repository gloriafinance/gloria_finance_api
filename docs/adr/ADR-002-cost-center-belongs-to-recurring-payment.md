# ADR-002 — CostCenter belongs to `RecurringPayment`

- **Estado:** ACEPTADA (definitiva)
- **Fecha:** 2026-10-14
- **Feature:** Pagamentos Recorrentes (PR #146)
- **Documento principal:** [`../recurring-payments.md`](../recurring-payments.md) §4, §19, §20

---

## Contexto

Todo gasto en Glória Finance tiene un centro de costo. Es una dimensión de imputación contable obligatoria: los reportes de resultado y de centros de costo dependen de ella.

`CURRENT`:

- `FinanceRecord` **sí** soporta `costCenter` (`src/Financial/domain/FinanceRecord.ts:22-25`):

  ```ts
  private costCenter?: { costCenterId: string; name: string }
  ```

- `CreateFinanceRecord` **sí** lo acepta (`src/Financial/domain/types/CreateFinanceRecord.type.ts`):

  ```ts
  costCenter?: CostCenter
  ```

- Existe un índice que agrupa por centro de costo (`FinanceRecordMongoRepository.ts`, `idx_cost_centers` sobre `costCenter.costCenterId`).

**Pero `RecurringPayment` no tiene `costCenterId` en absoluto.** Verificado: ninguna de las rutas de recurrencia menciona `costCenter` — ni el agregado, ni el request, ni el validator, ni el caso de uso de registro.

Consecuencias verificadas:

1. **El validator lo rechaza explícitamente.** `validateRecurringPaymentConfiguration` aplica `hasOnlyKeys(body, ["name", "financialConceptId", "type", "amount", "dayOfMonth", "payment", "status"])`. Enviar `costCenterId` produce `RECURRING_PAYMENT_PAYLOAD_INVALID` (422).
2. **El `FinancialRecord` bancario se crea SIN centro de costo.** `RegisterRecurringPaymentFinancialRecord` construye el payload de creación y **no** incluye `costCenter` (`src/Financial/applications/recurringPayments/RegisterRecurringPaymentFinancialRecord.ts:66-89`), aunque `DispatchCreateFinancialRecord` y `FinanceRecord.create` lo soportan.

Resultado: **cada gasto recurrente ejecutado genera un `FinancialRecord` sin imputación de centro de costo**, degradando exactamente los reportes que el índice `idx_cost_centers` existe para alimentar.

### Impacto aguas abajo verificado (agregados de centro de costo)

El daño **no** se limita al campo ausente en el documento. `CreateFinancialRecordJob.dispatchUpdateCostCenter` (`src/Financial/applications/jobs/CreateFinancialRecord.job.ts:119-141`) **retorna temprano si no hay `args.costCenter`**:

```ts
private dispatchUpdateCostCenter(args: FinancialRecordCreateQueue) {
  if (!args.costCenter) {
    return
  }
  ...
}
```

Consecuencia en cascada para **todo** `FinancialRecord` originado en una recurrencia:

1. `FinancialRecord.costCenter` queda `undefined`.
2. **No se encola** `UpdateCostCenterMaster`.
3. **El agregado maestro de centro de costo no acumula ese gasto.**

Es decir, un gasto recurrente (alquiler, energía — precisamente los gastos más predecibles y materiales) **nunca llega a los agregados de centro de costo**. Los reportes que leen `CostCenterMaster` no solo pierden el detalle: pierden el monto. El índice `idx_cost_centers` (que opera sobre `financial_records`) sí vería el registro, pero sin la dimensión de agrupación.

Esto eleva la severidad de GAP-02: no es un campo faltante, es **pérdida silenciosa de imputación en los agregados**.

### Fuerza adicional

Preguntar el centro de costo **cada mes** sería incorrecto por diseño: el alquiler del templo es del templo en octubre y en noviembre. El centro de costo es una propiedad **estable del compromiso**, no un dato variable de la ejecución.

---

## Decisión

> **`costCenterId` es obligatorio en la configuración de `RecurringPayment`. Toda ejecución —bancaria o manual— genera un `FinancialRecord` con ese mismo centro de costo.**

> **ESTADO: IMPLEMENTADO.** El agregado valida el centro de costo al crear y al actualizar, `RegisterRecurringPaymentFinancialRecord` resuelve la entidad `CostCenter` desde la recurrencia y la propaga al `FinancialRecord`, y ambos caminos de ejecución (bancario y manual) pasan por ese punto. El agregado maestro de centro de costo vuelve a acumular estos gastos.

### Invariancia contable

```text
RecurringPayment
  → FinancialConcept OUTGO
  → CostCenter obligatorio
  → FinancialRecord.costCenter = RecurringPayment.costCenter
```

Esta invariancia se aplica a **ambos** caminos de ejecución. No hay camino que omita el centro de costo.

### Consecuencias normativas

1. `RecurringPayment` declara `costCenterId` como campo obligatorio.
2. La creación **valida** que el `costCenterId` exista, pertenezca a la iglesia y esté activo — del mismo modo que hoy se valida el `financialConceptId` (`CreateOrUpdateRecurringPayment.validateConcept`, `:57-72`).
3. El comando de ejecución **NO** recibe `costCenterId`. Es dato permanente (ADR-001).
4. `RegisterRecurringPaymentFinancialRecord` **debe** propagar `costCenter` al payload de `DispatchCreateFinancialRecord`.
5. La resolución del `costCenter` ocurre igual que la del `financialConcept`: desde la recurrencia.
6. `ListRecurringPayments` debe exponer `costCenterId` (y preferiblemente el nombre) para que la UI lo muestre como contexto readonly.

---

## Consecuencias

### Positivas

- Los reportes de centros de costo recuperan los gastos recurrentes, que son precisamente los gastos más predecibles y relevantes (alquiler, energía, servicios).
- La imputación es consistente entre ejecuciones del mismo compromiso.
- El usuario no responde la misma pregunta cada mes.
- Cierra una inconsistencia real: el modelo ya soporta `costCenter`, solo no se estaba usando en este flujo.

### Negativas / costos

- La creación requiere un `CostCenter` válido disponible: si una iglesia no tiene centros de costo configurados, no puede crear recurrencias. Esto es **intencional** (es una precondición contable), pero exige que la UI guíe al usuario a crearlo.

### Sin migración

La feature está **en construcción y no tiene datos productivos**, así que no hay
recurrencias existentes a las que asignar un centro de costo. `costCenterId` es
obligatorio desde el inicio y la validación del agregado lo exige en `create()` y
en `updateConfiguration()`.

### Interacción con ADR-001

`costCenterId` es permanente → vive en la configuración.
`payment` es efímero → vive en el comando.

Ambos cambios tocan el mismo payload de creación. Se implementaron en el mismo cambio para no dejar el modelo en un estado intermedio incoherente.

---

## Alternativas consideradas y rechazadas

| Alternativa | Por qué se rechaza |
|---|---|
| Pedir `costCenterId` en cada ejecución | Contradice el principio de "configurar una sola vez". El centro de costo no cambia entre meses para el mismo compromiso. Genera trabajo repetitivo y errores de imputación. |
| Dejar `costCenterId` opcional | Permite `FinancialRecord` sin imputación desde un flujo que sabemos que siempre tiene un centro de costo asociado. Viola la invariancia contable. |
| Derivar el centro de costo del `FinancialConcept` | Un concepto (p. ej. "Aluguel") puede imputarse a distintos centros de costo (Templo, Sede, Congregación). La derivación sería ambigua o incorrecta. |
| Permitir override del centro de costo por ejecución | **No rechazada de plano, pero fuera de alcance.** Si el producto lo requiere, debe modelarse explícitamente como excepción auditada, no como opcionalidad silenciosa. Ver `PENDING`. |

---

## Verificación de cumplimiento

- [ ] `RecurringPayment` declara `costCenterId` obligatorio.
- [ ] El validator de creación **acepta** `costCenterId` y lo exige.
- [ ] La creación valida que el `CostCenter` pertenezca a la iglesia y esté activo.
- [ ] `RegisterRecurringPaymentFinancialRecord` pasa `costCenter` a `DispatchCreateFinancialRecord`.
- [ ] El flujo **manual** también propaga `costCenter` desde la recurrencia.
- [ ] El comando de ejecución **no** acepta `costCenterId`.
- [ ] `ListRecurringPayments` expone el centro de costo.
- [ ] Existe un test que verifica que el `FinancialRecord` creado por webhook bancario tiene el `costCenterId` de la recurrencia.
- [ ] Existe un test que verifica lo mismo para el flujo manual.

---

## Referencias

- `src/Financial/domain/RecurringPayments.ts:14-26` (ausencia de `costCenterId`)
- `src/Financial/domain/requests/RecurringPayment.request.ts:6-16`
- `src/Financial/infrastructure/http/validators/RecurringPayment.validator.ts` (`hasOnlyKeys` sin `costCenterId`)
- `src/Financial/applications/recurringPayments/RegisterRecurringPaymentFinancialRecord.ts:66-89` (no propaga `costCenter`)
- `src/Financial/domain/FinanceRecord.ts:22-25`
- `src/Financial/domain/types/CreateFinanceRecord.type.ts` (`costCenter?: CostCenter`)
- `src/Financial/infrastructure/persistence/FinanceRecordMongoRepository.ts` (`idx_cost_centers`)
- Gap analysis: GAP-02

# ADR-009 — Settlement history outranks the recurrence configuration

- **Estado:** ACEPTADA (definitiva)
- **Fecha:** 2026-10-17
- **Feature:** Pagamentos Recorrentes
- **Documento principal:** [`../recurring-payments.md`](../recurring-payments.md) §23, §36

---

## Contexto

El estado de una competencia se **calcula** a partir de dos fuentes con naturalezas
distintas:

| Fuente | Qué describe | Naturaleza |
|---|---|---|
| `FinancialRecord` | Lo que **ocurrió**: el dinero se movió y quedó contabilizado | Histórico, inmutable en lo esencial |
| `RecurringPayment` | Lo que **debe ocurrir**: el compromiso mensual | Configuración, mutable por el usuario |

`CURRENT` evaluaba primero `status !== "ACTIVE"` y devolvía `INACTIVE`, y solo
después comprobaba si existía un registro liquidado:

```text
1. status !== "ACTIVE"   → INACTIVE
2. ∃ FinancialRecord     → PAID
```

Consecuencia: desactivar hoy una recurrencia hacía que una competencia **ya pagada**
se mostrara como `INACTIVE`, ocultando un pago que realmente ocurrió. El histórico
quedaba subordinado a la configuración.

---

## Decisión

> **El histórico manda sobre la configuración. Una competencia con registro liquidado
> es `PAID` aunque la recurrencia esté desactivada.**

### Consecuencias normativas

`ListRecurringPayments.competenceStatus` resuelve en este orden:

```text
1. ∃ FinancialRecord liquidado (CLEARED | RECONCILED)  → PAID
2. status !== "ACTIVE"                                 → INACTIVE
3. currentPayment.status (si coincide la competencia)  → PROCESSING | BLOCKED | FAILED
4. dueDate <= hoy                                      → PENDING, si no → UPCOMING
```

Reglas que se derivan:

1. **`PAID` precede a `INACTIVE`.** Desactivar detiene compromisos futuros; no borra
   lo ya pagado.
2. **El histórico real es el `FinancialRecord`**, no el estado derivado del listado.
   El listado es una **vista operativa por competencia**; quien necesite fidelidad
   histórica consulta los registros financieros.
3. **`INACTIVE` solo aplica cuando no hay nada liquidado** en esa competencia.

### Vista por competencia

Una recurrencia aparece en el listado de **cualquier** competencia, incluidas las
anteriores a su creación. No hay `startCompetence`/`effectiveFrom`: el listado
enumera los compromisos vigentes con su estado para el mes consultado.

Una competencia previa a la existencia del compromiso no está liquidada, así que cae
en la decisión usual (`PENDING`/`UPCOMING`) en lugar de fingir que no existió. La
consecuencia se asume explícitamente:

> Si se necesita saber si el compromiso **existía** en ese mes, la fuente es la
> fecha de creación de la recurrencia; el listado por competencia no la reconstruye.

---

## Consecuencias

### Positivas

- Un pago real no se oculta por una acción administrativa posterior.
- La contabilidad y el listado dejan de contradecirse: el registro manda.
- El orden es coherente con ADR-004 (`FinancialRecord` es el histórico de ejecución).

### Negativas / costo asumido

- El listado necesita consultar los registros **antes** de decidir, lo que ya hacía;
  el cambio es de orden, no de costo.
- Una recurrencia desactivada sin pagos del mes se muestra `INACTIVE`; con pagos,
  `PAID`. Es correcto, pero la UI debe explicar ambos casos sin ambigüedad.
- Competencias previas a la creación aparecen como `PENDING`/`UPCOMING`. Es la
  decisión explícita de este ADR, no un efecto colateral.

---

## Alternativas consideradas y rechazadas

| Alternativa | Por qué se rechaza |
|---|---|
| `INACTIVE` antes de `PAID` (estado anterior) | Oculta pagos reales. Subordina el hecho contable a la configuración. |
| Ocultar las recurrencias inactivas del listado | Haría ilegible la historia del mes y rompería la vista por competencia. |
| Introducir `startCompetence`/`effectiveFrom` y filtrar por vigencia | Añade un dato que hoy no existe y obliga a decidir el fin de vigencia. Se descartó mientras se mantenga la vista operativa por competencia; el histórico fiel ya lo da el `FinancialRecord`. |
| Derivar `PAID` desde la recurrencia | Viola ADR-004: crearía una segunda fuente de verdad que puede desincronizarse. |

---

## Verificación de cumplimiento

- [ ] `competenceStatus` evalúa `settledIds` antes de `status !== "ACTIVE"`.
- [ ] Una recurrencia `INACTIVE` con registro liquidado devuelve `PAID`.
- [ ] Una recurrencia `INACTIVE` sin registro liquidado devuelve `INACTIVE`.
- [ ] Una competencia anterior a la creación de la recurrencia aparece en el listado.
- [ ] `PAID` se calcula desde `FinancialRecord`, nunca desde un campo de la recurrencia.

---

## Referencias

- `src/Financial/applications/recurringPayments/ListRecurringPayments.ts`
- `test/Financial/applications/ListRecurringPayments.spec.ts`
- [`ADR-004`](./ADR-004-financial-record-is-execution-history.md)

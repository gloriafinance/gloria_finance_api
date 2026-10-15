# ADR-009 — Settlement history outranks the recurrence configuration

- **Estado:** ACEPTADA (definitiva)
- **Fecha:** 2026-10-17
- **Feature:** Pagamentos Recorrentes
- **Documento principal:** [`../recurring-payments.md`](../recurring-payments.md) §23, §36

---

## Contexto

El estado de una competencia se **calcula** a partir de dos fuentes con naturalezas
distintas:

| Fuente             | Qué describe                                                 | Naturaleza                            |
| ------------------ | ------------------------------------------------------------ | ------------------------------------- |
| `FinancialRecord`  | Lo que **ocurrió**: el dinero se movió y quedó contabilizado | Histórico, inmutable en lo esencial   |
| `RecurringPayment` | Lo que **debe ocurrir**: el compromiso mensual               | Configuración, mutable por el usuario |

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

### `INACTIVE` no se paga por ningún camino

La precedencia anterior es de **lectura**, no de ejecución. Son dos preguntas
distintas y con reglas distintas:

| Pregunta                              | Fuente que manda                             |
| ------------------------------------- | -------------------------------------------- |
| ¿Qué ocurrió en esta competencia?     | El histórico (`FinancialRecord`)             |
| ¿Se puede ejecutar un pago **ahora**? | La configuración (`RecurringPayment.status`) |

Por tanto:

> **Una recurrencia `INACTIVE` no se paga por ningún camino.** El bloqueo es
> idéntico en la ejecución bancaria y en el registro manual, y ambos consultan la
> recurrencia con el mismo filtro `status: "ACTIVE"`.

**Válvula de escape:** para liquidar una competencia histórica se **reactiva** la
recurrencia (`status` es parte del payload de creación/actualización), se registra
el pago y se vuelve a desactivar. No existe una excepción implícita por fecha.

**Por qué no se permite por fecha:** el agregado no guarda _cuándo_ se desactivó
(solo el enum `status`). Permitir "competencias anteriores a la desactivación"
exigiría un timestamp que hoy no existe, y decidir esa fecha de corte es una
decisión de producto aparte, no un efecto colateral de un `if`.

### Existencia de una recurrencia: anclada al calendario, sin campo extra

**Decisión cerrada:** no se introduce `effectiveFrom` ni `startCompetence`.

Una recurrencia **no se notifica retroactivamente** porque la notificación es
dirigida por la fecha en que corre el cron, no por un rango declarado:

```text
NotifyRecurringPaymentDue.handle()
  today        = saoPauloDate(now)        ← fecha real del barrido
  competence   = addDays(today, offset)   ← competencia derivada de esa fecha
  notifica si  dueDateForCompetence(dayOfMonth, competence) === reminderDate
  y solo sobre recurrencias status = "ACTIVE" que existen en ese momento
```

Una recurrencia creada en octubre **no puede** generar un recordatorio de
septiembre: cuando el barrido de septiembre corrió, la recurrencia no existía.
El ancla temporal es el propio calendario de ejecución, no un dato almacenado.

**Consecuencia asumida:** `ListRecurringPayments` proyecta el compromiso vigente
sobre cualquier competencia consultada. Navegar a un mes anterior a la creación
muestra la recurrencia en ese mes. No genera notificaciones, no crea registros y no
declara deuda vencida; es una **vista operativa**, no un reconstruido de existencia
histórica.

**Por qué no se añade el campo:**

| Motivo                                                    | Detalle                                                 |
| --------------------------------------------------------- | ------------------------------------------------------- |
| Resolvería un problema que el calendario ya resuelve      | La notificación ya es date-driven                       |
| El agregado no tiene ancla y añadirla es coste real       | Campo + backfill + filtros en cada consulta             |
| La opción "deducir del primer `FinancialRecord`" no sirve | Una recurrencia sin pagos no tendría ancla              |
| Ya se rechazó `startCompetence` para el listado           | Introducirlo ahora contradiría esa decisión sin aportar |

## Consecuencias normativas

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

### `INACTIVE` no se paga por ningún camino

La precedencia anterior es de **lectura**, no de ejecución. Son dos preguntas
distintas y con reglas distintas:

| Pregunta                              | Fuente que manda                             |
| ------------------------------------- | -------------------------------------------- |
| ¿Qué ocurrió en esta competencia?     | El histórico (`FinancialRecord`)             |
| ¿Se puede ejecutar un pago **ahora**? | La configuración (`RecurringPayment.status`) |

Por tanto:

> **Una recurrencia `INACTIVE` no se paga por ningún camino.** El bloqueo es
> idéntico en la ejecución bancaria y en el registro manual, y ambos consultan la
> recurrencia con el mismo filtro `status: "ACTIVE"`.

**Válvula de escape:** para liquidar una competencia histórica se **reactiva** la
recurrencia (`status` es parte del payload de creación/actualización), se registra
el pago y se vuelve a desactivar. No existe una excepción implícita por fecha.

**Por qué no se permite por fecha:** el agregado no guarda _cuándo_ se desactivó
(solo el enum `status`). Permitir "competencias anteriores a la desactivación"
exigiría un timestamp que hoy no existe, y decidir esa fecha de corte es una
decisión de producto aparte, no un efecto colateral de un `if`.

### Vista por competencia — **DECISIÓN ABIERTA, no cerrada**

> ⚠️ **Esta sección NO es una decisión de producto aprobada.** Describe el
> comportamiento actual y el problema que genera. Requiere cierre explícito del
> product owner antes de considerarse normativa.

**Comportamiento actual:** una recurrencia aparece en el listado de **cualquier**
competencia, sin filtro temporal alguno.

**Problema:** el modelo **no almacena ningún ancla temporal**. La configuración
(`RecurringPaymentConfigurationData`) solo tiene `status`; el único `updatedAt`
pertenece a `currentPayment` (estado operativo en vuelo), y persistir hace
`replaceOne` con `toPrimitives()`, así que ni siquiera un `createdAt` de Mongo
sobreviviría. Consecuencia:

```text
Recurrencia creada: octubre 2026
Usuario navega:     septiembre 2026
Resultado:          "Aluguel: PENDENTE"
```

Se reporta como pendiente una deuda que **nunca existió**, en un mes anterior a que
el compromiso se configurara. No es un artefacto de presentación: el listado afirma
un hecho falso.

**Opciones para cerrar la decisión:**

| Opción                                              | Qué implica                                                                                          | Coste                                                                                |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| A. Mantener el comportamiento actual                | La recurrencia es atemporal; el listado es una proyección del compromiso vigente sobre cualquier mes | Reporta deuda inexistente en meses previos                                           |
| B. No listar antes de la creación                   | Requiere persistir la fecha de creación                                                              | Requiere campo nuevo + backfill                                                      |
| C. `effectiveFrom` explícito elegido por el usuario | El usuario declara desde qué competencia rige el compromiso                                          | Campo nuevo + decisión de UI; responde también el fin de vigencia                    |
| D. Deducir existencia del primer `FinancialRecord`  | No requiere campo nuevo                                                                              | No sirve para una recurrencia sin ejecuciones: seguiría mostrándose antes de existir |

**Recomendación del arquitecto:** **C** (`effectiveFrom`), porque resuelve el mes de
inicio y el de fin con un solo dato declarado, y no depende de que existan pagos.
El listado debe filtrar por ese campo en lugar de proyectar el compromiso sobre
cualquier mes.

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

| Alternativa                                                         | Por qué se rechaza                                                                                                                                                                           |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INACTIVE` antes de `PAID` (estado anterior)                        | Oculta pagos reales. Subordina el hecho contable a la configuración.                                                                                                                         |
| Ocultar las recurrencias inactivas del listado                      | Haría ilegible la historia del mes y rompería la vista por competencia.                                                                                                                      |
| Introducir `startCompetence`/`effectiveFrom` y filtrar por vigencia | Añade un dato que hoy no existe y obliga a decidir el fin de vigencia. Se descartó mientras se mantenga la vista operativa por competencia; el histórico fiel ya lo da el `FinancialRecord`. |
| Derivar `PAID` desde la recurrencia                                 | Viola ADR-004: crearía una segunda fuente de verdad que puede desincronizarse.                                                                                                               |

---

## Verificación de cumplimiento

- [ ] `competenceStatus` evalúa `settledIds` antes de `status !== "ACTIVE"`.
- [ ] Una recurrencia `INACTIVE` con registro liquidado devuelve `PAID`.
- [ ] Una recurrencia `INACTIVE` sin registro liquidado devuelve `INACTIVE`.
- [ ] Una competencia anterior a la creación aparece en el listado como vista operativa,
      pero **no** genera notificación (el barrido es date-driven).
- [ ] No existe `effectiveFrom`/`startCompetence` en el modelo, por decisión explícita.
- [ ] `PAID` se calcula desde `FinancialRecord`, nunca desde un campo de la recurrencia.

---

## Referencias

- `src/Financial/applications/recurringPayments/ListRecurringPayments.ts`
- `test/Financial/applications/ListRecurringPayments.spec.ts`
- [`ADR-004`](./ADR-004-financial-record-is-execution-history.md)

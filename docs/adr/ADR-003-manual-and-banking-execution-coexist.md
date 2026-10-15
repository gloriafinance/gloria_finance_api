# ADR-003 — Manual and banking execution coexist

- **Estado:** ACEPTADA (definitiva)
- **Fecha:** 2026-10-14
- **Feature:** Pagamentos Recorrentes (PR #146)
- **Documento principal:** [`../recurring-payments.md`](../recurring-payments.md) §6, §7, §8, §9, §18

---

## Contexto

No todas las iglesias tienen Asaas conectado. Y aun teniéndolo, no todo compromiso se paga por el banco.

`CURRENT` implementa **un solo camino**: toda ejecución de recurrencia pasa por `church-banking`. Verificado:

- El único endpoint de ejecución es `POST /api/v1/recurring-payments/:recurringPaymentId/pay` (`RecurringPayment.controller.ts:113-138`).
- `ExecuteRecurringPayment` **siempre** llama a `findConnectedAccount(churchId)` (`:131`) y, si no encuentra cuenta, lanza `RECURRING_PAYMENT_BANK_ACCOUNT_UNAVAILABLE` (`:196,210,216`).
- `RegisterRecurringPaymentFinancialRecord` — el único caso de uso que crea el `FinancialRecord` de una recurrencia — **solo lo invocan** `ExecuteRecurringPayment` y el webhook `ProcessRecurringPaymentBankingUpdate`. **No tiene entrypoint HTTP.**

**Consecuencia severa:** una iglesia **sin Asaas no puede usar pagamentos recorrentes en absoluto.** No existe ningún camino que cree el `FinancialRecord`. Es el gap más severo de la feature.

### Fuerzas en tensión

| Fuerza | Posición |
|---|---|
| Cobertura de mercado | La mayoría de las iglesias no tienen banca conectada |
| Modelo contable | El compromiso y su ejecución contable existen independientemente de quién movió el dinero |
| Complejidad | Dos caminos de ejecución añaden superficie y casos de borde |
| Idempotencia | Un camino manual no tiene estado externo que correlacionar (a diferencia del bancario) |

La ausencia del camino manual **no** protege ninguna invariante: el modelo contable requiere que el gasto quede registrado aunque la iglesia lo haya pagado en efectivo.

---

## Decisión

> **Dos caminos de ejecución coexisten sobre un único modelo de recurrencia. La capacidad bancaria de la iglesia determina cuál se usa, no el modelo del compromiso.**

```text
¿La iglesia tiene banca Asaas conectada y activa?

  NO  →  REGISTRO MANUAL       Glória registra el hecho contable
                               Glória NO ejecuta ninguna operación bancaria

  SÍ  →  EJECUCIÓN BANCARIA    Glória ejecuta vía church-banking
```

### Consecuencias normativas

1. **La capacidad bancaria se determina en el backend** y se expone al frontend como estado derivado. El frontend **no** reimplementa la consulta a `Bank` + `AvailabilityAccount` (regla de §6 del documento principal).
2. El modelo `RecurringPayment` es **idéntico** en ambos caminos. No hay dos tipos de recurrencia.
3. Sin Asaas, la UI ofrece `[ REGISTRAR PAGAMENTO ]` y **no** pregunta el método de pago externo (PIX/boleto/TED/dinheiro). Glória no ejecutó la operación; solo registra el hecho.
4. Con Asaas, la UI ofrece `[ PAGAR ]` y la pregunta de método se rige por ADR-001 y ADR-007.
5. Se implementa un endpoint específico de registro manual (ver §18 del documento principal): `POST /api/v1/recurring-payments/:id/register-payment`, `multipart/form-data`.
6. Los dos caminos convergen en el **mismo** `FinancialRecord` (`type = OUTGO`, con el `costCenter` de la recurrencia — ADR-002).

### Tabla diferencial de los dos caminos

| Aspecto | Registro manual (sin Asaas) | Ejecución bancaria (con Asaas) |
|---|---|---|
| ¿Glória mueve dinero? | **No** | Sí, vía `church-banking` |
| ¿Pregunta método (PIX/BILL)? | **No** | Sí, si no hay `pixDestination` |
| Valor | Readonly si `FIXED`; input si `VARIABLE` | Igual |
| `AvailabilityAccount` | **Seleccionado por el usuario** (ADR-006) | Derivado de la cuenta conectada |
| Comprobante | **Obligatorio** (ADR-005) | Deriva del recibo de Asaas |
| `source` | `MANUAL` | `AUTO` |
| `createdBy` | Usuario autenticado | `system` |
| `bankingExternalReference` | **Ausente** | URN de la operación |
| `status` del `FinancialRecord` | `PENDING` — requiere conciliar | `CLEARED` — ejecutado por el banco |
| ¿Crea `currentPayment`? | **No** (ADR-008) | Sí |
| Asincronía | Ninguna — escritura local síncrona | Webhook |
| Estado intermedio posible | Ninguno (o el propio `FinancialRecord.status`) | `PROCESSING` / `BLOCKED` / `FAILED` |
| Idempotencia | Índice único `recurringPaymentId + recurringCompetence` | Índice único + `currentPayment` CAS + dedup bancaria |

**Nótese que el mecanismo de idempotencia principal es el mismo en ambos caminos** (el índice único en `FinancialRecord`). Eso es lo que permite que coexistan sin un modelo paralelo.

---

## Consecuencias

### Positivas

- Las iglesias sin Asaas pueden usar la feature — hoy es imposible.
- El compromiso se modela una sola vez; la capacidad bancaria es un atributo de la infraestructura, no del compromiso.
- La contabilidad queda completa en ambos casos, con el mismo `costCenter`.
- Una iglesia puede conectar Asaas **después** sin rehacer sus recurrencias.

### Negativas / costos

- Dos caminos de UI, dos validadores, dos conjuntos de tests.
- Un camino nuevo (manual) que necesita su propio tratamiento de comprobante (ADR-005) y de cuenta (ADR-006).
- Riesgo de divergencia: si en el futuro se agrega una tercera forma de pago (débito automático, transferencia programada), hay que resistir la tentación de crear un tercer modelo.

### Decisión de arquitectura interna

**El registro manual NO debe reutilizar `ExecuteRecurringPayment`.** Debe ser un caso de uso separado (p. ej. `RegisterRecurringPaymentManually`) porque:

- no reserva `currentPayment`;
- no llama a `church-banking`;
- no genera `externalReference`;
- recibe un archivo, no un JSON;
- es síncrono y su resultado es el `FinancialRecord`, no un estado operativo.

Mezclar ambos caminos en un solo caso de uso produciría un método con ramas mutuamente excluyentes y parámetros opcionales contradictorios. **Compartir** debe ser a nivel de `RegisterRecurringPaymentFinancialRecord` (**el punto de convergencia**, donde se crea el `FinancialRecord`), extendiéndolo para aceptar el modo manual.

### Riesgo de secuencia en el registro manual

El comprobante se sube al storage **antes** de insertar el `FinancialRecord`. Si el insert falla (p. ej. duplicate-key), el archivo queda huérfano. Requiere política de limpieza. Ver `PENDING` P-07 y §22 del documento principal.

---

## Alternativas consideradas y rechazadas

| Alternativa | Por qué se rechaza |
|---|---|
| Solo Asaas; sin Asaas la feature no está disponible | Inaceptable: excluye a la mayoría de las iglesias. Es el estado actual (GAP-01-mayor). |
| Modelo separado de "recurrencia manual" | Duplica el concepto de compromiso. Un alquiler es un alquiler, independientemente de si la iglesia tiene banca. Viola ADR-004 (una sola fuente histórica). |
| Reutilizar `ExecuteRecurringPayment` con un flag `manual: true` | Un caso de uso con dos comportamientos incompatibles (síncrono/asíncrono, con/sin operación bancaria, con/sin `currentPayment`). Viola *Strict contracts only*. |
| Registrar el manual como `currentPayment` y resolverlo después | No hay nada que resolver: la operación local es síncrona. Añade una máquina de estados sin invariante que la justifique. Ver ADR-008. |
| Entrada del comprobante como URL en JSON en lugar de `multipart/form-data` | Permitiría al cliente enviar una URL arbitraria, sin garantizar que el archivo exista en nuestro storage. El comprobante debe ser un archivo real subido a nuestra infraestructura (ADR-005). |

---

## Preguntas abiertas (`PENDING`)

| # | Pregunta | Impacto |
|---|---|---|
| P-01 | ¿Cómo se elige la cuenta bancaria cuando la iglesia tiene múltiples cuentas activas? `CURRENT` falla si hay más de una (`otherMatches.length > 0`). | Bloquea la ejecución bancaria en iglesias multi-cuenta |
| P-05 | ¿Se valida el `identificationField` (dígito verificador)? | Determina si un boleto malformado produce `CREATION_FAILED` o se detecta antes |
| P-10 | ¿Se permite registrar pago de una competencia `UPCOMING` (anticipado)? §16 lo permite conceptualmente. | Comportamiento de la UI en `UPCOMING` |

---

## Verificación de cumplimiento

- [ ] Existe un endpoint `POST /api/v1/recurring-payments/:id/register-payment` con `multipart/form-data`.
- [ ] El endpoint **no** llama a `church-banking` ni a `findConnectedAccount`.
- [ ] El endpoint **no** crea `currentPayment`.
- [ ] El endpoint crea un `FinancialRecord` con `source = MANUAL`, `bankingExternalReference` ausente y el `costCenter` de la recurrencia.
- [ ] El backend expone `HAS_CONNECTED_BANK_ACCOUNT` como estado derivado.
- [ ] El frontend **no** implementa la detección de banca conectada.
- [ ] La UI sin Asaas **no** pregunta PIX/boleto.
- [ ] La UI sin Asaas exige comprobante.
- [ ] Una iglesia sin `Bank` activo puede completar el ciclo: crear recurrencia → registrar 12 competencias → ver 12 `FinancialRecord`.
- [ ] Existe un test de que una iglesia **con** Asaas también puede registrar manualmente (p. ej. pagó en efectivo ese mes). `PENDING` P-10 — confirmar si esto debe permitirse.

---

## Referencias

- `src/Financial/applications/recurringPayments/ExecuteRecurringPayment.ts:131,191-219`
- `src/Financial/applications/recurringPayments/RegisterRecurringPaymentFinancialRecord.ts` (sin entrypoint HTTP)
- `src/Financial/infrastructure/http/controllers/RecurringPayment.controller.ts:113-138` (único endpoint de ejecución)
- `src/Financial/applications/recurringPayments/ListRecurringPayments.ts:15-80` (estados por competencia)
- ADR-005, ADR-006, ADR-008
- Gap analysis: GAP-01-mayor

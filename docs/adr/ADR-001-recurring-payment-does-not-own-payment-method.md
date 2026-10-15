# ADR-001 — `RecurringPayment` does not own payment method

- **Estado:** ACEPTADA (definitiva)
- **Fecha:** 2026-10-14
- **Feature:** Pagamentos Recorrentes (PR #146)
- **Documento principal:** [`../recurring-payments.md`](../recurring-payments.md) §2, §15, §30

---

## Contexto

`CURRENT` el agregado `RecurringPayment` **exige** un método de pago permanente y excluyente:

```ts
// src/Financial/domain/RecurringPayments.ts:22-24
payment:
  | { method: "PIX"; pixKey: string; pixKeyType: PixKeyType }
  | { method: "BILL" }
```

Con obligatoriedad enforced en el validator:

```ts
// src/Financial/infrastructure/http/validators/RecurringPayment.validator.ts
"payment.method": "required|string|in:PIX,BILL",
...(payment.method === "PIX" ? {
  "payment.pixKey": "required|string",
  "payment.pixKeyType": `required|string|in:${[...PIX_TYPES].join(",")}`,
} : {}),
```

Y el método se usa en la ejecución **desde la configuración**, no desde el comando:

```ts
// src/Financial/applications/recurringPayments/ExecuteRecurringPayment.ts:228,243-261
const configuration = recurring.getPayment()
if (configuration.method === "PIX") {
  response = await this.churchBankingClient.createPixTransfer({ ... })
} else {
  response = await this.churchBankingClient.createBillPayment({ ... })
}
```

### Problemas que esto genera

1. **Una recurrencia no puede cambiar de método entre meses.** Un alquiler que este mes se paga por PIX y el próximo por boleto (porque el proveedor cambió) requiere **editar el compromiso**, aunque el compromiso no cambió.
2. **`BILL` excluye PIX.** El validator impone `hasOnlyKeys(payment, ["method"])` cuando el método es `BILL`, de modo que una recurrencia `BILL` no puede tener un destino PIX disponible como conveniencia.
3. **`method = BILL` vuelve imposible la ejecución por PIX**, aunque el usuario tenga la chave a mano en el momento de pagar.
4. **Se confunde negocio con operación.** El "compromiso" es un concepto contable de largo plazo; el "método" es un detalle de una transacción de un día.

### Fuerzas en tensión

| Fuerza | Posición |
|---|---|
| Conveniencia UX | Guardar el método evita preguntarlo cada mes |
| Realidad operativa | El método cambia mes a mes |
| Modelo contable | Una recurrencia es un compromiso, no un plan de pago |
| Idempotencia bancaria | El método forma parte de la **operación**, no del compromiso |

La conveniencia de UX **no requiere** persistir el método: se satisface con `pixDestination` (ADR-007), que es un dato de destino, no una decisión de método.

---

## Decisión

> **`RecurringPayment` NO posee método de pago. PIX/BILL pertenece a la ejecución, no a la configuración permanente.**

> **ESTADO: IMPLEMENTADO.** El payload de configuración ya no acepta `payment`; el comando de ejecución acepta `payment` como unión discriminada por `type`, o se resuelve PIX desde `pixDestination`.

### Consecuencias normativas

1. **Eliminar** `RecurringPayment.payment.method` del modelo permanente.
2. La configuración **no** se crea con método. El payload de creación no lo incluye.
3. El método se declara en el **comando de ejecución**:

   ```text
   PayRecurringPaymentRequest.payment
     { type: "PIX", pixKey, pixKeyType }
     { type: "BILL", identificationField }
   ```

4. Cuando existe `pixDestination` (ADR-007) **y** la intención es PIX, el comando puede omitir `payment` y el sistema resuelve PIX desde el destino guardado.
5. La distinción queda formalizada como:

   ```text
   configuration      → QUÉ compromiso existe        (permanente)
   execution command  → CÓMO se paga este mes        (efímero)
   ```

6. Ningún dato permanente viaja en el comando de ejecución; ningún dato de ejecución se escribe en la configuración — **salvo** la optimización explícita de persistir `pixDestination` (§13 del documento principal, `PENDING` P-03).

---

## Consecuencias

### Positivas

- Una recurrencia puede pagarse por PIX un mes y por boleto el siguiente **sin editar el compromiso**.
- El modelo contable queda limpio: la recurrencia representa solo el compromiso.
- El `FinancialRecord` resultante registra el hecho real, y el método real queda en la ejecución.
- Habilita la optimización de UX sin acoplar el modelo.

### Negativas / costos

- El frontend debe preguntar el método en cada ejecución cuando no hay `pixDestination`. Es un costo de UX aceptado y mitigado por ADR-007.
- `ExecuteRecurringPayment.submit()` debe cambiar de leer `recurring.getPayment()` a leer el `payment` del comando.
- **Implementado:** `assertSameRetryPayload` compara el destino exacto persistido en `currentPayment.executionDestination`. Un `CREATION_UNKNOWN` reintentado con otra chave PIX se rechaza en vez de llegar a `church-banking`. Ver §25 y §29 del documento principal.

### Impacto en idempotencia (crítico)

El `externalReference` (`urn:recurringPayment:{id}:{competence}:{attempt}`) **no cambia** por mover el método al comando. La invariante de no-doble-pago se mantiene intacta porque:

- el `attempt` sigue gobernando la identidad lógica de la operación;
- `church-banking` deduplica por `{clientId, externalAccountId, externalReference}`.

**Pero** el payload asociado a un `externalReference` debe ser inmutable durante su vida. De ahí la obligación de extender `assertSameRetryPayload`.

### Sin migración

La feature está **en construcción y no tiene datos productivos**, así que no existe
estructura anterior que transformar. La política del repositorio (*Fix at source*)
se cumple eliminando el campo antiguo del modelo en el mismo cambio: no se mantiene
compatibilidad dual ni fallback silencioso.

---

## Alternativas consideradas y rechazadas

| Alternativa | Por qué se rechaza |
|---|---|
| Mantener `method` obligatorio y permitir override en la ejecución | Conserva el acoplamiento: sigue existiendo un método "por defecto" que hay que editar para cambiar de comportamiento. Modelo con dos fuentes de verdad. |
| `method: "PIX" \| "BILL" \| "EITHER"` | "EITHER" no es un método; es la ausencia de decisión disfrazada de valor. Genera tres ramas de código donde debería haber una. |
| Guardar una lista de métodos permitidos por recurrencia | Complejidad de configuración sin uso real: la iglesia no restringe sus métodos de pago por compromiso. |
| Mantener `method` solo informativo (no vinculante) | Un campo que no se obedece es peor que no tenerlo: induce a error a quien lee el modelo. Viola *Strict contracts only*. |

---

## Verificación de cumplimiento

Un implementador puede comprobar que esta ADR se respeta si:

- [ ] `RecurringPayment` no declara ningún campo `payment` ni `method`.
- [ ] El payload de creación no acepta `payment` ni `method`.
- [ ] El payload de creación **sí** acepta `pixDestination?` opcional.
- [ ] `PayRecurringPaymentRequest` acepta `payment` con unión discriminada por `type`.
- [ ] `ExecuteRecurringPayment` resuelve el método desde el comando (o desde `pixDestination`), nunca desde un `method` persistido.
- [ ] `assertSameRetryPayload` compara el objeto `payment` completo.
- [ ] Existe un test que paga la **misma** recurrencia por PIX y luego por BILL en competencias distintas.
- [ ] Existe un test que paga la **misma** competencia por PIX y verifica que un segundo intento por BILL es rechazado (no duplica pago).

---

## Referencias

- `src/Financial/domain/RecurringPayments.ts:8,14-26,113-115`
- `src/Financial/domain/requests/RecurringPayment.request.ts:12-21`
- `src/Financial/infrastructure/http/validators/RecurringPayment.validator.ts` (`validateRecurringPaymentConfiguration`, `validatePayRecurringPayment`)
- `src/Financial/applications/recurringPayments/ExecuteRecurringPayment.ts:78-90,228,243-261,353-366`
- [`ADR-007` — PIX destination is optional reusable metadata](./ADR-007-pix-destination-is-optional-reusable-metadata.md)
- Gap analysis: GAP-01, GAP-04

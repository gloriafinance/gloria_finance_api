# ADR-007 — PIX destination is optional reusable metadata

- **Estado:** ACEPTADA (definitiva)
- **Fecha:** 2026-10-14
- **Feature:** Pagamentos Recorrentes (PR #146)
- **Documento principal:** [`../recurring-payments.md`](../recurring-payments.md) §5, §12, §13

---

## Contexto

`CURRENT` acopla el destino PIX al método de pago permanente:

```ts
// src/Financial/domain/RecurringPayments.ts:22-24
payment:
  | { method: "PIX"; pixKey: string; pixKeyType: PixKeyType }
  | { method: "BILL" }
```

Y el validator lo hace **obligatorio y excluyente**:

```ts
"payment.method": "required|string|in:PIX,BILL",
...(payment.method === "PIX" ? {
  "payment.pixKey": "required|string",
  "payment.pixKeyType": "required|string|in:CPF,CNPJ,EMAIL,PHONE,EVP",
} : {}),
// para BILL:
const paymentKeys = payment.method === "PIX" ? ["method","pixKey","pixKeyType"] : ["method"]
hasOnlyKeys(payment, paymentKeys)   // BILL NO puede tener pixKey
```

Esto produce tres consecuencias no deseadas:

1. **`BILL` prohíbe tener un destino PIX.** Una recurrencia que habitualmente se paga por boleto no puede guardar la chave PIX para el mes en que convenga pagar por PIX.
2. **`PIX` exige la chave en la creación.** Si la iglesia aún no conoce la chave (p. ej. el proveedor la informará después), no puede crear la recurrencia como PIX y no tiene forma de informarla al pagar.
3. **No hay forma de informar una chave PIX en la ejecución.** El validator de ejecución solo acepta `competence`, `amount` e `identificationField`.

### La distinción conceptual que falta

Hay tres conceptos distintos que `CURRENT` funde en uno:

| Concepto | Naturaleza | Ejemplo |
|---|---|---|
| **Método de pago** | Decisión de una ejecución | "este mes pago por PIX" |
| **Destino PIX** | Dato reutilizable sobre el acreedor | "el alquiler se paga a la chave CNPJ 12.345.678/0001-90" |
| **Código de boleto** | Dato irrepetible de una ejecución | "el boleto de este mes tiene esta linha digitável" |

El destino PIX es **estable** (el acreedor del alquiler no cambia de chave cada mes), a diferencia del método y del código de boleto. Por tanto merece persistirse — pero **no** es un método.

---

## Decisión

> **`pixDestination` es metadato reutilizable OPCIONAL. Persistirlo NO significa que el método de pago sea PIX.**

```text
RecurringPayment
  pixDestination?
    pixKey
    pixKeyType
```

Significa únicamente:

> Glória conoce un destino PIX reutilizable para esta recurrencia.

### Consecuencias normativas

1. `pixDestination` es **opcional** en la creación. Una recurrencia puede no tenerlo.
2. `pixDestination` **no implica** método. Una recurrencia con `pixDestination` puede pagarse por boleto ese mes.
3. Una recurrencia **sin** `pixDestination` puede pagarse por PIX si el comando informa `pixKey` + `pixKeyType` (ADR-001).
4. Una recurrencia **con** `pixDestination` y el comando **sin** `payment` se resuelve como PIX directo: el usuario solo confirma (caso 3 del documento principal).
5. El comando de ejecución **puede sobreescribir** el destino para una ejecución concreta: informar `payment.pixKey` distinto del guardado debe usarse para **esa** ejecución, sin modificar la configuración.
6. Los valores válidos de `pixKeyType` son:

   ```text
   CPF | CNPJ | EMAIL | PHONE | EVP
   ```

   Verificados en `church-banking` (`apps/api/src/http/validations/pix-transfer.validation.ts:21`) y en la unión real de Asaas. El tipo se reenvía **literal a Asaas, sin normalización ni cambio de capitalización**.

### Reglas de resolución del método (TARGET)

```text
comando.payment presente?
  SÍ  → usar comando.payment.type y su destino
  NO  → si existe pixDestination  → PIX directo con el destino guardado
        si no                    → ERROR: el comando debe declarar el método
```

**Este árbol debe ser explícito y total.** No debe existir un camino donde el sistema "adivine" el método.

---

## Consecuencias

### Positivas

- La iglesia no escribe la chave PIX cada mes: se guarda una vez.
- Una recurrencia que habitualmente se paga por boleto **puede** guardar la chave PIX como alternativa.
- Una recurrencia puede crearse antes de conocer la chave, e informarla en la primera ejecución.
- Habilita el caso 3 (FIXED + PIX conocido): `[ PAGAR ]` con confirmación de un clic.
- No contamina el modelo con un "método por defecto".

### Negativas / costos

- El modelo tiene un campo opcional más.
- Hay que decidir qué ocurre cuando el comando informa un PIX distinto del guardado (punto 5): **se usa el del comando y no se persiste**, salvo la optimización explícita de abajo.
- La UI debe decidir cuándo ofrece el atajo `[ PAGAR ]` directo y cuándo pregunta el método.

### Optimización de UX documentada (`PENDING` P-03)

En el caso 4 (FIXED + Asaas sin PIX conocido), la UI puede ofrecer:

```text
[ ] Salvar esta chave PIX para próximos pagamentos
```

- Si el usuario la marca, se **actualiza `pixDestination`**.
- **No** convierte la recurrencia en `method = PIX`.

`PENDING` P-03. Requiere:

1. Decisión de producto sobre ofrecer la casilla.
2. Un contrato de escritura (probablemente `PUT /api/v1/recurring-payments/:id` con `pixDestination`).
3. Definir si la actualización de `pixDestination` respeta la regla de `updateConfiguration` (que hoy falla con `RECURRING_PAYMENT_IN_PROGRESS` si hay un pago en vuelo — `RecurringPayments.ts:125-138`). **Recomendación: mantener la regla.** No mutar la configuración con una operación en vuelo.

### `PENDING` P-04 del caso de uso §39 — ¿reutilizar `pixDestination` en VARIABLE?

**Pregunta:** ¿un `pixDestination` guardado también debe poder reutilizarse para `VARIABLE`?

**Recomendación: sí**, porque el destino PIX es una propiedad del **acreedor**, no del tipo de monto. Que el monto sea fijo o variable no cambia a quién se le paga.

Pero **debe permitirse cambiar el destino para una ejecución concreta** si el producto lo requiere (punto 5 de la decisión). Un `VARIABLE` con `pixDestination` mostraría:

```text
Valor
[ R$ ________ ]          ← lo único que falta

Pagamento via PIX
Chave CNPJ 12.345.678/0001-90
[ alterar destino ]      ← opcional
```

Si no existe definición suficiente, **registrarlo como decisión pendiente** — que es lo que hace este documento.

---

## Alternativas consideradas y rechazadas

| Alternativa | Por qué se rechaza |
|---|---|
| Mantener `payment.method: "PIX" \| "BILL"` obligatorio (estado actual) | Es ADR-001: el método pertenece a la ejecución. Este ADR añade que incluso el **destino** no debe confundirse con el método. |
| `pixDestination` obligatorio si la iglesia tiene Asaas | Muchos pagos recurrentes no son PIX (boletos de energía, tributos). Exigirlo forzaría datos falsos. |
| No persistir el destino; pedirlo siempre | Fricción mensual innecesaria para un dato estable. Es la razón de existir de este ADR. |
| `paymentMethod: "PIX"` como campo separado que coexiste con `pixDestination` | Reintroduce el método permanente por la puerta trasera. Viola ADR-001. |
| Guardar múltiples destinos PIX por recurrencia | Complejidad sin caso de uso demostrado. Si aparece, modelarlo explícitamente entonces. |

---

## Verificación de cumplimiento

- [ ] `RecurringPayment` declara `pixDestination?: { pixKey, pixKeyType }` opcional.
- [ ] `pixDestination` **no** implica ni setea ningún campo de método.
- [ ] El validator de creación acepta `pixDestination` y lo valida solo si está presente.
- [ ] El validator de creación **no** acepta `payment` ni `method` (ADR-001).
- [ ] El comando de ejecución acepta `payment.pixKey` y `payment.pixKeyType`.
- [ ] Una recurrencia con `pixDestination` puede pagarse por BILL (test explícito).
- [ ] Una recurrencia sin `pixDestination` puede pagarse por PIX informando la chave en el comando (test explícito).
- [ ] Un `payment.pixKey` distinto del guardado se usa para esa ejecución y **no** modifica la configuración (salvo el flag explícito de P-03).
- [ ] Un `pixDestination` guardado es reutilizable para una recurrencia `VARIABLE` (si se adopta la recomendación).
- [ ] `pixKeyType` se propaga literalmente sin normalización.

---

## Referencias

- `src/Financial/domain/RecurringPayments.ts:8,12,22-24`
- `src/Financial/domain/requests/RecurringPayment.request.ts:12-21`
- `src/Financial/infrastructure/http/validators/RecurringPayment.validator.ts`
- `src/Financial/applications/recurringPayments/ExecuteRecurringPayment.ts:228,243-252`
- `church-banking` — `apps/api/src/http/validations/pix-transfer.validation.ts:5-26`
- ADR-001, ADR-004
- Gap analysis: GAP-04, GAP-05

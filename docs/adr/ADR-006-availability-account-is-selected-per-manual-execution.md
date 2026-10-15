# ADR-006 — `AvailabilityAccount` is selected per manual execution

- **Estado:** ACEPTADA (definitiva)
- **Fecha:** 2026-10-14
- **Feature:** Pagamentos Recorrentes (PR #146)
- **Documento principal:** [`../recurring-payments.md`](../recurring-payments.md) §11, §18, §31

---

## Contexto

`AvailabilityAccount` representa **de dónde salió realmente el dinero** (caja, cuenta bancaria, etc.). Vive en la colección `availability_accounts` y referencia su banco por `source.bankId`.

`CURRENT`:

- En el flujo **bancario**, el `availabilityAccountId` se **deriva automáticamente** de la única cuenta activa emparejada con un `Bank` activo, y se congela en `currentPayment.availabilityAccountId` (`ExecuteRecurringPayment.ts:141-142, 202-218`).
- **No existe flujo manual**, y por tanto no existe selección de cuenta.

### La realidad operativa que rompe la derivación

Una iglesia puede pagar el mismo compromiso desde cuentas distintas:

```text
Aluguel do templo — R$ 3.500

  outubro  → pagado desde Banco Itaú
  novembro → pagado desde Caixa
  dezembro → pagado desde Caja (efectivo)
```

El compromiso es idéntico. **El origen del dinero es un hecho de la ejecución, no una propiedad del compromiso.**

Si la cuenta fuese parte de la configuración, la iglesia tendría que elegir una cuenta "del alquiler" y editar el compromiso cada vez que paga desde otra — y el `FinancialRecord` mentiría sobre el origen real del dinero.

### Distinción con la capacidad bancaria (ADR-003)

| Concepto | Naturaleza | Persistencia |
|---|---|---|
| Capacidad bancaria (`HAS_CONNECTED_BANK_ACCOUNT`) | Hecho de la **iglesia** | Derivado de `Bank` + `AvailabilityAccount` |
| Cuenta de una ejecución bancaria | Hecho de la **operación** | `currentPayment.availabilityAccountId` |
| Cuenta de una ejecución manual | Hecho de la **operación** | `FinancialRecord.availabilityAccount` |

Ninguno de los tres es una propiedad del `RecurringPayment`.

---

## Decisión

> **`AvailabilityAccount` NO forma parte permanente del `RecurringPayment`. Debe seleccionarse al registrar el pago.**

```text
Conta utilizada
[ Banco Itaú ▼ ]
```

### Consecuencias normativas

1. `RecurringPayment` **no** declara `availabilityAccountId`.
2. El endpoint de registro manual **exige** `availabilityAccountId` como campo del `multipart/form-data`.
3. El sistema **valida** que la cuenta:
   - pertenezca a la iglesia (`churchId`),
   - esté activa (`active = true`).
4. El `FinancialRecord` resultante persiste la cuenta seleccionada en `availabilityAccount`.
5. En el flujo bancario, la cuenta se resuelve como hoy (derivada de la conexión) y se congela en `currentPayment`.
6. La UI muestra la cuenta como **selector**, no como información readonly.

### Regla de validación compartida

La validación de la cuenta debe ser la misma en ambos caminos:

```text
availabilityAccount.churchId === churchId  ∧  availabilityAccount.active === true
```

`RegisterRecurringPaymentFinancialRecord` ya hace esta validación para el camino bancario (`:48-56`):

```ts
const account = await this.availabilityAccountRepository.one({
  availabilityAccountId: payment.availabilityAccountId,
  churchId: recurring.getChurchId(),
})
if (!account) throw new RecurringPaymentException("RECURRING_PAYMENT_BANK_ACCOUNT_UNAVAILABLE")
```

El camino manual debe reutilizar este punto de convergencia, no duplicar la validación.

---

## Consecuencias

### Positivas

- El `FinancialRecord` refleja **de dónde salió realmente el dinero**: la base de la conciliación bancaria y del flujo de caja por cuenta.
- La iglesia puede pagar desde cualquier cuenta sin editar el compromiso.
- Coherente con el modelo contable: el origen del dinero es un hecho de la transacción.
- El saldo por cuenta (`AvailabilityAccount.balance`) se ve afectado correctamente, porque el registro apunta a la cuenta real.

### Negativas / costos

- Un campo obligatorio más en el modal de registro manual.
- El usuario debe elegir la cuenta correcta cada mes; una elección equivocada produce un `FinancialRecord` con el origen incorrecto.
- **No hay forma de corregirlo fácilmente** una vez creado, porque el índice único impide crear otro registro para la misma competencia (ver `PENDING` P-08 en ADR-004).

### Mitigación recomendada

- Preseleccionar la cuenta usada en la **ejecución anterior** de la misma recurrencia (una ayuda de UX, no una persistencia en la configuración).
- Al listar las cuentas, mostrar saldo y tipo para reducir la elección errónea.

⚠️ **Cuidado:** la preselección es una ayuda de UI. **No** debe materializarse como `RecurringPayment.availabilityAccountId`, porque reintroduciría exactamente el acoplamiento que esta ADR prohíbe.

### Relación con el `PENDING` P-01 (múltiples cuentas bancarias)

El flujo **manual** ya resuelve limpiamente el caso de múltiples cuentas: el usuario elige. El flujo **bancario** no: `findConnectedAccount` falla si hay más de una cuenta activa emparejada (`ExecuteRecurringPayment.ts:214-217`).

Esto sugiere la resolución natural de P-01: **extender la selección explícita al flujo bancario** (o persistir una preferencia de cuenta por iglesia), en lugar de mantener una derivación que solo funciona cuando hay exactamente una cuenta. La asimetría actual — el manual soporta N cuentas, el bancario solo 1 — es un defecto de diseño, no una decisión.

---

## Alternativas consideradas y rechazadas

| Alternativa | Por qué se rechaza |
|---|---|
| `RecurringPayment.availabilityAccountId` obligatorio | El compromiso no tiene una cuenta fija. Obligaría a editar la recurrencia cada vez que la iglesia paga desde otra cuenta, y el `FinancialRecord` mentiría. Es el mismo error de categoría que ADR-001. |
| Derivar la cuenta del `Bank` conectado siempre | En el flujo manual no hay `Bank` involucrado (el pago pudo ser en efectivo). Y en el bancario, la derivación falla con múltiples cuentas (P-01). |
| Usar una cuenta "por defecto" de la iglesia sin preguntar | Registraría el origen equivocado silenciosamente. Viola *No hidden transitions* y *Strict contracts only*: el usuario debe declarar el hecho. |
| Cuenta opcional | El `FinancialRecord.availabilityAccount` es obligatorio en el modelo (`FinanceRecord` lo declara sin `?` como campo de objeto). Un registro sin cuenta rompería los reportes de saldo por cuenta. |

---

## Verificación de cumplimiento

- [ ] `RecurringPayment` **no** declara `availabilityAccountId`.
- [ ] El endpoint de registro manual exige `availabilityAccountId`.
- [ ] Se valida la pertenencia a la iglesia y `active = true`.
- [ ] El `FinancialRecord` manual persiste la cuenta seleccionada.
- [ ] Existe un test que registra dos competencias de la **misma** recurrencia desde **cuentas distintas** y verifica que cada `FinancialRecord` apunta a su cuenta.
- [ ] Existe un test que rechaza una `availabilityAccountId` de otra iglesia.
- [ ] Existe un test que rechaza una cuenta inactiva.
- [ ] La UI muestra la cuenta como selector, no como readonly.
- [ ] La preselección (si existe) es solo de UI y no se persiste en la recurrencia.

---

## Referencias

- `src/FinanceConfig/domain/AvailabilityAccount.ts:12-14,52-56,63-79`
- `src/Financial/applications/recurringPayments/ExecuteRecurringPayment.ts:141-142,191-219`
- `src/Financial/applications/recurringPayments/RegisterRecurringPaymentFinancialRecord.ts:48-56,77`
- `src/Financial/domain/FinanceRecord.ts` (`availabilityAccount` obligatorio)
- ADR-001 (mismo error de categoría), ADR-003, ADR-004
- Gap analysis: GAP-06

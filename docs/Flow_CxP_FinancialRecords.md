# 💸 Flujo de Cuentas por Pagar (CxP) y su Relación con `financial_records`

## 🧭 Propósito general

El módulo de **Cuentas por Pagar (CxP)** actúa como **origen de movimientos financieros** dentro del ledger
`financial_records`.  
Cada obligación registrada, pagada o anulada en CxP debe reflejar un cambio de estado o un nuevo registro en la
colección financiera.

---

## 🧩 1. Creación del compromiso (obligación)

### Evento: **Registrar cuenta por pagar**

El usuario crea una obligación (factura, proveedor, gasto futuro). JSON Básico.

```json
{
  "accountPayableId": "AP-2025-0012",
  "churchId": "IG-01",
  "supplierId": "SUP-34",
  "dueDate": "2025-11-10",
  "amount": 1200,
  "status": "PENDING",
  "description": "Factura de energía eléctrica"
}
```

📌 **Claves:**

- `status = pending` → aún no pagado.
- `source = AUTO` → generado automáticamente por módulo CxP.

---

## 💳 2. Aprobación y pago

### Evento: **Pago de la obligación**

El tesorero aprueba y paga la factura desde el módulo CxP.  
`accounts_payable.status` pasa a `PAID`.

### Acción sobre `financial_records`

El sistema genera un registro financiero por el pago realizado:

```json
{
  "financialRecordId": "FR-001",
  "churchId": "IG-01",
  "type": "OUTGO",
  "amount": 1200,
  "status": "CLEARED",
  "source": "AUTO",
  "reference": "AP-2025-0012",
  "method": "bank",
  "financialConcept": {
    "id": "energy",
    "statementCategory": "OPEX"
  },
  "description": "Factura de energía eléctrica",
  "createdBy": "user_1"
}
```

```

📌 **Claves:**

- `status = cleared` → pago realizado.
- Adjunta comprobante.
- Impacta en flujo de caja real.

---

## 🏦 3. Conciliación bancaria (manual o automática)

### Evento: **Importar extracto / conciliar**

Se importa un archivo OFX/CSV o llega una notificación de Open Finance/Pix.  
El sistema detecta coincidencia entre monto y fecha.

### Acción sobre `financial_records`

```diff
{
  "status": "RECONCILED",
  "reconciledAt": "2025-11-10T10:30:00Z",
  "reconciliationId": "BANK-MATCH-3948"
}
```

📌 **Claves:**

- `status = reconciled` → confirmado con extracto bancario.
- `reconciliationId` → vincula con `bank_statements`.

---

## ⛔ 4. Anulación o reversión

### Evento: **Cancelar pago / Nota de crédito**

El pago fue anulado o se detectó error.

### Acción sobre `financial_records`

Se crea un nuevo registro tipo **REVERSAL**:

```json
{
  "financialRecordId": "FR-001-R",
  "churchId": "IG-01",
  "type": "REVERSAL",
  "amount": -1200,
  "status": "cleared",
  "source": "AUTO",
  "referenceTo": "FR-001",
  "description": "Anulación de factura energía eléctrica"
}
```

Y el registro original se marca como:

```diff
{ "status": "void" }
```

📌 **Claves:**

- No se elimina el registro original, solo se marca `void`.
- `REVERSAL` genera contrapartida contable.

---

## 🧮 5. Reportes y trazabilidad

### Estados posibles

| Estado       | Descripción                       | Impacto               |
|--------------|-----------------------------------|-----------------------|
| `pending`    | Factura creada, no pagada.        | Proyección de salida. |
| `cleared`    | Pago ejecutado internamente.      | Flujo de caja real.   |
| `reconciled` | Confirmado por extracto bancario. | Flujo verificado.     |
| `void`       | Movimiento anulado.               | Excluido de reportes. |



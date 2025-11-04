export enum FinancialRecordType {
  INCOME = "INCOME",
  OUTGO = "OUTGO",
  PURCHASE = "PURCHASE",
  TRANSFER = "TRANSFER",
  REVERSAL = "REVERSAL",
}

export enum FinancialRecordStatus {
  PENDING = "PENDING",
  CLEARED = "CLEARED",
  RECONCILED = "RECONCILED",
  VOID = "VOID",
}

// 🕐 1. pending
// Significa:
//   La transacción fue registrada o programada, pero aún no ocurrió en la cuenta bancaria o caja.
//   Ejemplos:
// Un pago a proveedor creado con fecha futura.
//   Una promesa de ofrenda/donación aún no cobrada.
//   Una compra que espera aprobación o desembolso.
//   Origen típico:
//   Creación manual por tesorería (cuentas por pagar o cobrar).
// Generada automáticamente por un compromiso o una orden de compra.
// Cuándo cambia:
//   Cuando el pago o ingreso realmente ocurre → pasa a cleared.
// En reportes:
//   No afecta el flujo de caja real, pero puede incluirse en flujo proyectado o presupuestado.

// 💸 2. cleared
// Significa:
//   La transacción ya ocurrió físicamente, es decir, el dinero fue pagado o recibido, pero aún no ha sido verificado con el extracto bancario.
//   Ejemplos:
// Tesorería registró el pago de una factura y adjuntó el comprobante.
//   Un depósito identificado en caja, pero el banco aún no lo refleja.
//   Origen típico:
//   Actualización manual después del pago o recibo efectivo.
//   Confirmación interna del tesorero.
//   Cuándo cambia:
//   Cuando el sistema detecta el mismo movimiento en un extracto bancario importado o conectado por Open Finance, pasa a reconciled.
//   En reportes:
//   Ya cuenta en flujo de caja real.
//   No debería aparecer como “pendiente de cobro/pago”.

// 🧾 3. reconciled
// Significa:
//   El movimiento fue verificado contra el extracto bancario — o sea, el monto, la fecha y la descripción coinciden con una transacción real en cuenta.
//   Ejemplos:
// Tu sistema importó un extracto y encontró un e2eid o fitId igual al del pago registrado.
//   Se confirmó automáticamente por integración Pix/Open Finance.
//   Origen típico:
//   Proceso de conciliación manual o automática (por bank_statement.import o futura API Open Finance).
// Cuándo cambia:
//   Solo por conciliación (match manual o automático).
// Si se detecta reversión posterior, podría pasar a void.
// En reportes:
//   Aparece como movimiento confirmado, sirve para cierre contable.
//   Idealmente, solo reconciled debe afectar reportes oficiales de tesorería.

// ⛔ 4. void
//   Significa:
// La transacción fue anulada, revertida o corregida.
//   No tiene efecto contable actual, pero se mantiene para auditoría.
//   Ejemplos:
// Un pago registrado por error.
//   Una reversión (type = REVERSAL) que invalida el movimiento original.
//   Donación duplicada detectada.
//   Origen típico:
//   Acción manual de tesorería (“anular registro”).
// Generado automáticamente cuando se crea un REVERSAL vinculado (referenceTo).
//   Cuándo cambia:
//   Solo por acción explícita o al detectar reversión vinculada.
//   En reportes:
//   No se incluye en sumas de DRE ni flujo de caja.
//   Se conserva para auditoría y trazabilidad.

export enum FinancialRecordSource {
  MANUAL = "MANUAL",
  AUTO = "AUTO",
  IMPORTED = "IMPORTED",
}

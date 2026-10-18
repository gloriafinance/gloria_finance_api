# ADR-010 — Manual voucher depends on account type

- **Estado:** ACEPTADA
- **Fecha:** 2026-10-17
- **Feature:** Ejecución de Pagamentos Recorrentes
- **Reemplaza:** ADR-005

## Decisión

La cuenta seleccionada determina si el registro manual requiere comprobante:

| Tipo de cuenta | Comprobante |
|---|---|
| `BANK` | Obligatorio |
| `WALLET` | Obligatorio |
| `CASH` | No se solicita |

La API valida la cuenta seleccionada antes de almacenar el archivo. En `CASH`,
el registro se crea sin `voucher`. En `BANK` y `WALLET`, se conserva el flujo
multipart y el archivo `file` es requerido.

La selección de una cuenta bancaria vinculada a Asaas continúa por el flujo de
pago bancario; no se registra como pago manual.

## Consecuencias

- La interfaz solicita archivo solo para banco o wallet.
- Efectivo se registra con la fecha, el monto aplicable y la cuenta elegida.
- El `FinancialRecord` contiene `voucher` únicamente cuando se aportó un archivo.

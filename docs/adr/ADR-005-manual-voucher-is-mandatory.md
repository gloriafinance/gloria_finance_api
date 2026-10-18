# ADR-005 — Manual voucher is mandatory

- **Estado:** REEMPLAZADA por [ADR-010](./ADR-010-manual-voucher-by-account-type.md)
- **Fecha:** 2026-10-14
- **Feature:** Pagamentos Recorrentes (PR #146)
- **Documento principal:** [`../recurring-payments.md`](../recurring-payments.md) §10, §18, §19, §31

---

## Contexto

En una ejecución **bancaria**, Glória ordena la operación y el banco responde. La evidencia del pago es el `providerTransferId` / `providerBillId` más el webhook de confirmación, y `church-banking` entrega además un `transactionReceiptUrl` (recibo de Asaas) que `CURRENT` convierte en voucher vía `AsaasReceiptStorage`.

En una ejecución **manual**, no hay ninguna de esas evidencias. Glória no sabe que el pago ocurrió: **el usuario lo afirma**. Sin un comprobante, el `FinancialRecord` manual es una afirmación sin respaldo documental.

`CURRENT`:

- El voucher es **opcional** en el flujo bancario (`RegisterRecurringPaymentFinancialRecord.ts:57-62`: solo se crea si `transactionReceiptUrl` existe).
- **No existe flujo manual** y por tanto no existe ningún requisito de comprobante.
- **No hay ningún endpoint con `multipart/form-data`** en todo el repositorio.

### Fuerzas en tensión

| Fuerza | Posición |
|---|---|
| Integridad contable | Un gasto declarado debe tener respaldo documental |
| Auditoría | Sin comprobante, no hay forma de verificar el pago ni de resolver una disputa |
| Fricción de UX | Exigir un archivo en cada registro añade un paso |
| Realidad operativa | Pagos en efectivo o lotérica sí producen un comprobante (recibo, ticket) |

La fricción es real pero acotada: se pide **una vez por mes por recurrencia**, y el usuario ya tiene el comprobante (acaba de pagar).

---

## Decisión

> **Todo registro manual de una recurrencia requiere comprobante. Sin comprobante no hay `FinancialRecord`.**

```text
voucher = REQUIRED   (ejecución manual)
```

### Flujo de almacenamiento

```text
file upload  (multipart/form-data)
    ↓
StorageProviderService.getInstance().uploadFile({ data, mimetype, originalname })
    ↓
URL del storage
    ↓
voucher
    ↓
FinancialRecord.voucher
```

### Reutilizar la infraestructura existente

**No crear almacenamiento paralelo.**

| Componente | Ubicación |
|---|---|
| Contrato | `src/Shared/domain/interfaces/StorageService.interface.ts` — `uploadFile(file: any): Promise<string>` |
| Resolución de proveedor | `src/Shared/infrastructure/services/StorageProvider.service.ts` — `StorageProviderService.getInstance(bucketName?)`, vía `CLOUD_PROVIDER` (hoy solo `gcp`) y `BUCKET_FILES` |
| Implementación | `src/package/gcp/infrastructure/StorageGCP.ts` |
| Precedente en flujo bancario | `src/Webhook/infrastructure/services/AsaasReceiptStorage.ts` |

`AsaasReceiptStorage` demuestra el patrón: obtiene un buffer, valida el `content-type`, y llama a `storage.uploadFile({ data, mimetype, originalname })`. El flujo manual hace lo mismo con el archivo subido por el usuario.

### Consecuencias normativas

1. El endpoint de registro manual es `multipart/form-data`: `POST /api/v1/recurring-payments/:id/register-payment`.
2. El archivo es **obligatorio**. Su ausencia produce un error de validación (422), no un registro sin voucher.
3. Se valida el `mimetype` (PDF e imágenes al menos) y un tamaño máximo.
4. El `FinancialRecord` persiste la URL resultante en `voucher`.
5. La subida ocurre **antes** de insertar el `FinancialRecord` (no hay transacción entre storage y base de datos). Ver "Riesgo de huérfanos".
6. El flujo bancario **conserva** su comportamiento actual: el voucher deriva del recibo de Asaas y sigue siendo opcional (si Asaas no entrega recibo, no se inventa uno).

---

## Consecuencias

### Positivas

- Todo gasto recurrente registrado manualmente tiene respaldo documental.
- Auditoría y resolución de disputas son posibles.
- Consistencia con el flujo bancario, donde el comprobante ya se almacena.
- Sin infraestructura nueva: se reutiliza `StorageProviderService`.

### Negativas / costos

- Fricción de UX: un archivo obligatorio por registro. Mitigable con cámara del móvil, arrastrar-y-soltar y compresión de imágenes.
- **Riesgo de comprobantes huérfanos:** el archivo se sube antes del insert. Si el insert falla (duplicate-key, validación, error de red), el archivo queda sin referencia.
- Superficie de validación de archivos: tipo, tamaño, contenido malicioso.

### Riesgo de huérfanos — requiere política

```text
1. uploadFile()                    ← efecto externo, no transaccional
2. INSERT financial_records        ← efecto atómico, protegido por índice único
3. si (2) falla → el archivo de (1) queda huérfano
```

`PENDING` P-07. Opciones:

| Opción | Descripción | Trade-off |
|---|---|---|
| A — Job de recolección | Job periódico que lista archivos del bucket sin `FinancialRecord` asociado y los elimina tras un periodo de gracia | Simple; requiere listar el bucket |
| B — Subida diferida | Reservar primero (insertar un `FinancialRecord` en estado previo), subir después, y confirmar | Elimina huérfanos por fallo de insert, pero introduce un estado intermedio y un registro que puede quedar a medias si falla el upload |
| C — Aceptar la basura | No hacer nada | **Rechazada**: acumulación indefinida en el bucket |

**Recomendación: A**, con un periodo de gracia generoso (p. ej. 24 h) para no borrar archivos de un flujo en curso.

### Alternativas de entrada consideradas

| Alternativa | Por qué se rechaza |
|---|---|
| Recibir una URL en JSON en lugar de un archivo | Permitiría al cliente enviar una URL arbitraria (externa, rota, no nuestra). No garantiza que el archivo exista ni que esté bajo nuestro control. |
| Voucher opcional con justificación textual | Un texto libre no es un comprobante. Convierte una obligación verificable en una declaración. |
| Base64 dentro del JSON | Infla el payload, no aprovecha el streaming de multipart, complica los límites de tamaño. |

---

## Verificación de cumplimiento

- [ ] El endpoint de registro manual acepta `multipart/form-data`.
- [ ] El archivo es obligatorio: sin él → 422 con código de error tipado.
- [ ] Se valida `mimetype` y tamaño máximo.
- [ ] Se usa `StorageProviderService.getInstance().uploadFile(...)`; no hay cliente de storage nuevo.
- [ ] El `FinancialRecord` persiste la URL en `voucher`.
- [ ] El flujo bancario sigue funcionando con voucher derivado del recibo de Asaas.
- [ ] Existe una política de limpieza de huérfanos implementada (o un ticket explícito con fecha).
- [ ] Existe un test que verifica el rechazo cuando falta el archivo.
- [ ] Existe un test que verifica que el `voucher` del `FinancialRecord` apunta a la URL subida.

---

## Referencias

- `src/Shared/domain/interfaces/StorageService.interface.ts`
- `src/Shared/infrastructure/services/StorageProvider.service.ts`
- `src/package/gcp/infrastructure/StorageGCP.ts`
- `src/Webhook/infrastructure/services/AsaasReceiptStorage.ts` (patrón de referencia)
- `src/Financial/applications/recurringPayments/RegisterRecurringPaymentFinancialRecord.ts:57-62,79`
- `src/Financial/domain/FinanceRecord.ts` (`voucher?: string`)
- ADR-003, ADR-004
- Gap analysis: GAP-03

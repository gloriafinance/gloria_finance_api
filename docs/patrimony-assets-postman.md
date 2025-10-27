# Patrimony assets · Postman collection guide

Este documento reúne ejemplos de peticiones para el módulo Patrimônio del Church Finance API. Puedes copiarlos en
Postman o Insomnia y ajustar identificadores/datos según tu ambiente. Todos los endpoints están protegidos por
`PermissionMiddleware`, por lo que debes enviar el header `Authorization: Bearer <token>` correspondiente. A menos que
se indique lo contrario, establece también `Content-Type: application/json`. Cuando necesites adjuntar anexos en las
operaciones de alta o edición cambia el body a `multipart/form-data` y agrega cada archivo en un campo `attachments`.

Además del MVP (alta, consulta, edición y reporte), aquí se documentan los flujos de control expandido introducidos en
la Fase 3: baja de bienes y control de inventarios físicos.

## Base URL sugerida

Configura una variable `{{baseUrl}}` apuntando al host de tu instancia (por ejemplo, `https://api.mi-iglesia.test`). Las
rutas del módulo patrimonial cuelgan de `/patrimony`.

## Crear un bien patrimonial

`POST {{baseUrl}}/patrimony`

Carga la información principal del bien y (opcionalmente) hasta 3 anexos. El middleware completará campos como
`performedBy` utilizando el usuario autenticado.

Cuando adjuntes archivos configura el body en Postman como `form-data`. Los campos de texto se envían como `Text` y cada
archivo se agrega en un campo `attachments` (puedes repetir la clave tantas veces como necesites):

| Clave           | Tipo | Valor                          |
|-----------------|------|--------------------------------|
| code            | Text | BEM-2025-001                   |
| name            | Text | Piano Yamaha C3                |
| category        | Text | instrument                     |
| value           | Text | 48000                          |
| quantity        | Text | 12                             |
| acquisitionDate | Text | 2024-04-15                     |
| churchId        | Text | urn:church:central             |
| location        | Text | Salón principal                |
| responsibleId   | Text | urn:member:music-director      |
| status          | Text | ACTIVE                         |
| attachments     | File | factura.pdf                    |
| attachments     | File | foto-frontal.jpg               |
| notes           | Text | Donado por la familia González |

> Los campos `code` (identificador patrimonial) y `quantity` (cantidad registrada) son obligatorios en el alta.

El backend tomará el nombre, tipo y tamaño de cada archivo automáticamente. Si necesitas conservar anexos ya
almacenados (por ejemplo, reusar una URL existente) agrega un campo adicional `attachments` de tipo `Text` con un JSON
como
`[{"name":"Factura.pdf","url":"https://storage.example.com/assets/piano/factura.pdf","mimetype":"application/pdf","size":524288]`;
el orden del array debe coincidir con los archivos enviados para combinar metadatos con nuevos uploads.

> El servicio consulta automáticamente la ficha del miembro indicado en `responsibleId` y guarda su nombre, correo y
> teléfono en el registro del bien para reutilizarlos en reportes y listados.

## Listar bienes con filtros y búsqueda

`GET {{baseUrl}}/patrimony`

Usa query params para acotar los resultados. El patrón Criteria aplica paginación (`page`, `perPage`), filtros
directos (`churchId`, `category`, `status`) y búsqueda textual (`search`) sobre nombre, código, responsable (por id o
nombre) o ubicación. Cuando el activo ya pasó por inventario físico, cada item incluirá `inventoryStatus`,
`inventoryCheckedAt` e `inventoryCheckedBy` (con `memberId`, `name`, `email`, `phone`) para dejar el rastro completo de
quién hizo la última verificación.

```
{{baseUrl}}/patrimony?
  page=1&
  perPage=10&
  churchId=urn:church:central&
  status=ACTIVE&
  search=piano
```

La respuesta tiene formato de paginación estándar del proyecto:

```json
{
  "results": [
    {
      "assetId": "asset-123",
      "code": "BEM-000123",
      "name": "Piano Yamaha C3",
      "category": "instrument",
      "acquisitionDate": "2024-04-15T00:00:00.000Z",
      "value": 48000,
      "quantity": 12,
      "churchId": "urn:church:central",
      "location": "Salón principal",
      "responsibleId": "urn:member:music-director",
      "responsible": {
        "memberId": "urn:member:music-director",
        "name": "Pr. Daniel Ortiz",
        "email": "daniel.ortiz@example.com",
        "phone": "+55 11 91234-5678"
      },
      "status": "ACTIVE",
      "attachments": [
        {
          "attachmentId": "urn:attachment:1",
          "name": "Factura.pdf",
          "url": "https://storage.example.com/assets/piano/factura.pdf",
          "mimetype": "application/pdf",
          "size": 524288,
          "uploadedAt": "2024-04-16T02:31:00.000Z"
        }
      ],
      "history": [
        {
          "action": "CREATED",
          "performedBy": "urn:user:admin",
          "performedAt": "2024-04-16T02:31:00.000Z",
          "notes": "Donado por la familia González",
          "changes": {
            "name": {
              "current": "Piano Yamaha C3"
            },
            "category": {
              "current": "instrument"
            },
            "value": {
              "current": 48000
            }
          }
        }
      ],
      "documentsPending": false,
      "inventoryStatus": "CONFIRMED",
      "inventoryCheckedAt": "2024-09-12T00:00:00.000Z",
      "inventoryCheckedBy": {
        "memberId": "67c11a75-e23e-4e3f-8d3a-a4328246055e",
        "name": "angel",
        "email": "programador@gmail.com",
        "phone": "+55 11 1423-4234"
      },
      "createdAt": "2024-04-16T02:31:00.000Z",
      "updatedAt": "2024-04-16T02:31:00.000Z"
    }
  ],
  "count": 3,
  "page": 1,
  "perPage": 10,
  "nextPag": 2
}
```

## Consultar un bien específico

`GET {{baseUrl}}/patrimony/:assetId`

Solo necesitas sustituir `:assetId` por el identificador interno (`assetId`). Ideal para revisar la ficha completa
durante auditorías.

```
GET {{baseUrl}}/patrimony/asset-123
```

## Actualizar datos o anexos

`PUT {{baseUrl}}/patrimony/:assetId`

Permite corregir información, mover el bien a otra congregación o cargar nuevos anexos (máximo 3). Cualquier cambio
queda registrado en el historial con el usuario autenticado. También puedes eliminar anexos existentes enviando sus
identificadores en el arreglo `attachmentsToRemove`: el servicio los quita de la base de datos y borra los archivos del
storage.

Para actualizar anexos reutiliza el body `form-data`:

* Envía los campos a modificar como entradas `Text` (por ejemplo `name`, `location`, `notes`).
* Si quieres conservar documentos previamente almacenados, agrega un campo `attachments` de tipo `Text` con el JSON de
  cada archivo (`name`, `url`, `mimetype`, `size`).
* Adjunta nuevos archivos repitiendo la clave `attachments` como tipo `File`.
* Para eliminar anexos existentes agrega uno o más campos `attachmentsToRemove` (`Text`) con los `attachmentId`
  originales (puedes consultarlos con `GET /patrimony/:assetId`). Repite la clave para cada id o envía un valor en JSON
  como `["att-1","att-2"]` si estás usando `Content-Type: application/json`.

| Clave               | Tipo | Valor                                                                                                                                       |
|---------------------|------|---------------------------------------------------------------------------------------------------------------------------------------------|
| location            | Text | Auditorio                                                                                                                                   |
| responsibleId       | Text | urn:member:new-director                                                                                                                       |
| notes               | Text | Traslado aprobado en comité 2024-Q3                                                                                                         |
| attachments         | Text | [{"name":"Contrato-donacion.pdf","url":"https://storage.example.com/assets/piano/contrato.pdf","mimetype":"application/pdf","size":524288}] |
| attachments         | File | inventario-2024.pdf                                                                                                                         |
| attachmentsToRemove | Text | urn:attachment:1                                                                                                                            |
| attachmentsToRemove | Text | urn:attachment:2                                                                                                                            |

Cuando envíes `attachmentsToRemove` el backend eliminará esos registros y ejecutará `deleteFile` en cada URL
correspondiente. Si no agregas nuevos archivos y dejas el campo vacío, los anexos restantes se mantienen sin cambios.

## Generar reporte de inventario

`GET {{baseUrl}}/patrimony/report/inventory`

Genera un resumen en CSV o PDF. Usa los mismos filtros de la lista para segmentar por congregación, categoría o estado.
El parámetro `format` acepta `csv` o `pdf`.

Los archivos generados incluyen el nombre del responsable (además del identificador interno) junto con la
información de ubicación, valor y estado.

```
{{baseUrl}}/patrimony/report/inventory?
  format=pdf&
  churchId=urn:church:central&
  category=instrument
```

> El endpoint envía el archivo directamente como descarga (`Content-Disposition: attachment`). Postman no lo mostrará en
> pantalla, así que selecciona "Save Response" para guardarlo en el disco.

## Registrar baja de un bien patrimonial

`POST {{baseUrl}}/patrimony/:assetId/disposal`

Marca un bien como donado, vendido o extraviado y almacena el motivo junto con la fecha del evento. El backend valida
que el `status` pertenezca a los valores de baja permitidos (`DONATED`, `SOLD`, `LOST`). La fecha `disposedAt` es
opcional y debe seguir el formato `YYYY-MM-DD`; si la omites el sistema utilizará la fecha actual. Cualquier texto en
`observations` quedará guardado tanto en el registro de baja como en el historial del bien.

```json
POST {{baseUrl}}/patrimony/asset-123/disposal
{
  "status": "DONATED",
  "reason": "Entregado a la congregación Nueva Vida",
  "disposedAt": "2024-09-10",
  "observations": "Aprobado en asamblea del 08/09"
}
```

La respuesta es el objeto del activo con sus campos actualizados. Verás el `status` cambiado y un bloque `disposal`
similar a:

```json
{
  "status": "DONATED",
  "reason": "Entregado a la congregación Nueva Vida",
  "performedBy": "urn:user:admin",
  "occurredAt": "2024-09-10T00:00:00.000Z",
  "notes": "Aprobado en asamblea del 08/09"
}
```

## Registrar inventario físico de un bien

`POST {{baseUrl}}/patrimony/:assetId/inventory`

Permite dejar constancia de que un activo fue verificado físicamente. El campo `status` usa los valores del enumerado de
inventario (`CONFIRMED`, `NOT_FOUND`). Debes informar el nuevo `code` (etiqueta escrita durante el inventario) y la
`quantity` encontrada en la inspección. Puedes adjuntar notas para clarificar el resultado. El parámetro `checkedAt` es
opcional, acepta formato `YYYY-MM-DD` y, si no se envía, se tomará la fecha actual.

```json
POST {{baseUrl}}/patrimony/asset-123/inventory
{
  "status": "CONFIRMED",
  "code": "INV-2024-00045",
  "quantity": 36,
  "checkedAt": "2024-09-12",
  "notes": "Verificado durante la auditoría trimestral"
}
```

El servicio devolverá el activo con los campos `inventoryStatus`, `inventoryCheckedAt` e `inventoryCheckedBy` completos
y un nuevo evento en el historial (`INVENTORY_CONFIRMED`). El bloque `inventoryCheckedBy` trae los datos del usuario autenticado que ejecutó la operación (`memberId`, `name`, `email`, `phone`), para que quede registrado quién realizó la verificación.

## Descargar checklist para inventario físico

`GET {{baseUrl}}/patrimony/report/inventory/physical`

Genera un CSV listo para imprimir o trabajar en campo, listando los bienes filtrados por congregación, categoría o
estado operativo. El usuario autenticado determina la congregación (`churchId`). Los parámetros admiten los mismos
valores que la búsqueda general (`category`, `status`).

```
{{baseUrl}}/patrimony/report/inventory/physical?
  category=instrument&
  status=ACTIVE
```

El archivo contiene columnas para el identificador interno del bien (`ID do ativo`), código actual, cantidad registrada,
nombre, responsable, localización, estado y el último resultado de inventario registrado, además de campos vacíos para
que el equipo de campo informe el nuevo código y la cantidad contada (`Código inventário`, `Quantidade inventário`,
`Status inventário`, `Observações`). En Postman selecciona "Send and Download" o "Save Response" para guardar el CSV.

## Importar checklist para actualizar inventario

`POST {{baseUrl}}/patrimony/inventory/import`

Permite subir el CSV completado y aplicar los resultados en lote. Envía el archivo como `form-data` en la clave
`inventoryFile` (también acepta `file`). Cada fila debe conservar el `ID do ativo` generado por el sistema y completar al
menos los campos `Código inventário` (nuevo identificador físico) y `Quantidade inventário` (número entero). Opcionalmente
puedes informar `Status inventário` (`CONFIRMED` o `NOT_FOUND`) y `Observações`.

Las filas sin identificador, código o cantidad se descartan automáticamente. La respuesta incluye un resumen con los
contadores `processed`, `updated`, `skipped` y `errors` para ayudarte a validar el resultado. Cada registro actualizado
mostrará el `inventoryCheckedBy` con los datos del usuario que realizó la importación (según el token utilizado), de modo
que tengas trazabilidad del responsable del lote.

---

Con estos ejemplos podrás armar rápidamente una colección en Postman que cubra el módulo patrimonial completo, desde el
MVP hasta las capacidades de control expandido incorporadas en la Fase 3.

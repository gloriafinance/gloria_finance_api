# Patrimony assets · Postman collection guide

Este documento reúne ejemplos de peticiones para el módulo Patrimônio del Church Finance API. Puedes copiarlos en
Postman o Insomnia y ajustar identificadores/datos según tu ambiente. Todos los endpoints están protegidos por
`PermissionMiddleware`, por lo que debes enviar el header `Authorization: Bearer <token>` correspondiente. A menos que
se indique lo contrario, establece también `Content-Type: application/json`. Cuando necesites adjuntar anexos en las
operaciones de alta o edición cambia el body a `multipart/form-data` y agrega cada archivo en un campo `attachments`.

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
| name            | Text | Piano Yamaha C3                |
| category        | Text | instrument                     |
| value           | Text | 48000                          |
| acquisitionDate | Text | 2024-04-15                     |
| churchId        | Text | urn:church:central             |
| location        | Text | Salón principal                |
| responsibleId   | Text | urn:user:music-director        |
| status          | Text | ACTIVE                         |
| attachments     | File | factura.pdf                    |
| attachments     | File | foto-frontal.jpg               |
| notes           | Text | Donado por la familia González |

El backend tomará el nombre, tipo y tamaño de cada archivo automáticamente. Si necesitas conservar anexos ya
almacenados (por ejemplo, reusar una URL existente) agrega un campo adicional `attachments` de tipo `Text` con un JSON
como
`[{"name":"Factura.pdf","url":"https://storage.example.com/assets/piano/factura.pdf","mimetype":"application/pdf","size":524288]`;
el orden del array debe coincidir con los archivos enviados para combinar metadatos con nuevos uploads.

## Listar bienes con filtros y búsqueda

`GET {{baseUrl}}/patrimony`

Usa query params para acotar los resultados. El patrón Criteria aplica paginación (`page`, `perPage`), filtros
directos (`churchId`, `category`, `status`) y búsqueda textual (`search`) sobre nombre, código, responsable o ubicación.

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
      "churchId": "urn:church:central",
      "location": "Salón principal",
      "responsibleId": "urn:user:music-director",
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

| Clave                | Tipo | Valor                                                                                                                                       |
|----------------------|------|---------------------------------------------------------------------------------------------------------------------------------------------|
| location             | Text | Auditorio                                                                                                                                   |
| responsibleId        | Text | urn:user:new-director                                                                                                                       |
| notes                | Text | Traslado aprobado en comité 2024-Q3                                                                                                         |
| attachments          | Text | [{"name":"Contrato-donacion.pdf","url":"https://storage.example.com/assets/piano/contrato.pdf","mimetype":"application/pdf","size":524288}] |
| attachments          | File | inventario-2024.pdf                                                                                                                         |
| attachmentsToRemove  | Text | urn:attachment:1                                                                                                                            |
| attachmentsToRemove  | Text | urn:attachment:2                                                                                                                            |

Cuando envíes `attachmentsToRemove` el backend eliminará esos registros y ejecutará `deleteFile` en cada URL
correspondiente. Si no agregas nuevos archivos y dejas el campo vacío, los anexos restantes se mantienen sin cambios.

## Generar reporte de inventario

`GET {{baseUrl}}/patrimony/assets/report/inventory`

Genera un resumen en CSV o PDF. Usa los mismos filtros de la lista para segmentar por congregación, categoría o estado.
El parámetro `format` acepta `csv` o `pdf`.

```
{{baseUrl}}/patrimony/assets/report/inventory?
  format=pdf&
  churchId=urn:church:central&
  category=instrument
```

> El endpoint devuelve el archivo en el cuerpo de la respuesta con los encabezados correspondientes (
`Content-Type: application/pdf` o `text/csv`). Guarda el archivo desde Postman seleccionando "Save Response".

---

Con estos ejemplos podrás armar rápidamente una colección en Postman que cubra el MVP patrimonial (Fase 1) y validar
tanto flujos de alta como de consulta y reportes.

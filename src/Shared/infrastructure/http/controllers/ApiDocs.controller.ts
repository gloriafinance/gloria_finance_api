import { Controller, Get, Res, type ServerResponse } from "bun-platform-kit"

import { openApiDocument } from "../openapi/OpenApiDocument.generated"

@Controller("/docs")
export class ApiDocsController {
  @Get("/openapi.json")
  async spec(@Res() res: ServerResponse): Promise<void> {
    await res
      .set("Content-Type", "application/json; charset=utf-8")
      .status(200)
      .json(openApiDocument)
  }

  @Get("/")
  async docs(@Res() res: ServerResponse): Promise<void> {
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <title>Glória Finance API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script
      id="api-reference"
      data-url="/docs/openapi.json"
    ></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`

    await res
      .set("Content-Type", "text/html; charset=utf-8")
      .status(200)
      .send(html)
  }
}

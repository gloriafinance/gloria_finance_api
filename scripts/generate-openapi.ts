import { readdir, readFile, writeFile } from "node:fs/promises"
import { join, relative, resolve } from "node:path"
import { format, resolveConfig } from "prettier"

type HttpMethod = "get" | "post" | "put" | "patch" | "delete"

type OpenApiOperation = {
  tags: string[]
  summary: string
  description: string
  operationId: string
  parameters?: Array<{
    name: string
    in: "path" | "query"
    required: boolean
    schema: OpenApiSchema
  }>
  requestBody?: {
    required: true
    content: { "application/json": { schema: OpenApiSchema } }
  }
  security?: Array<{ bearerAuth: string[] }>
  responses: Record<string, OpenApiResponse>
}

type OpenApiExample =
  | string
  | number
  | boolean
  | null
  | OpenApiExample[]
  | { [key: string]: OpenApiExample }

type OpenApiResponse = {
  description: string
  content?: {
    "application/json": {
      examples: {
        success: {
          summary: string
          value: OpenApiExample
        }
      }
    }
  }
}

type OpenApiSchema = {
  type?: "object" | "string" | "number" | "integer" | "boolean" | "array"
  format?: string
  enum?: string[]
  items?: OpenApiSchema
  properties?: Record<string, OpenApiSchema>
  required?: string[]
  additionalProperties?: boolean
  description?: string
}

type OpenApiDocument = {
  openapi: "3.1.0"
  info: { title: string; version: string; description: string }
  paths: Record<string, Partial<Record<HttpMethod, OpenApiOperation>>>
  components: {
    securitySchemes: {
      bearerAuth: { type: "http"; scheme: "bearer"; bearerFormat: "JWT" }
    }
  }
}

type DocumentedRoute = {
  controller: string
  method: HttpMethod
  path: string
  operation: OpenApiOperation
}

const rootDirectory = resolve(import.meta.dir, "..")
const sourceDirectory = join(rootDirectory, "src")
const outputFile = join(
  sourceDirectory,
  "Shared/infrastructure/http/openapi/OpenApiDocument.generated.ts"
)
const checkOnly = process.argv.includes("--check")

const statusCodes: Record<string, number> = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
}

const typeDeclarations = new Map<string, string>()
const enumDeclarations = new Map<string, string[]>()

async function controllerFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(directory, entry.name)
      if (entry.isDirectory()) return controllerFiles(fullPath)
      return entry.name.endsWith(".controller.ts") ? [fullPath] : []
    })
  )

  return files.flat()
}

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(directory, entry.name)
      if (entry.isDirectory()) return sourceFiles(fullPath)
      return entry.name.endsWith(".ts") ? [fullPath] : []
    })
  )
  return files.flat()
}

function matchingBrace(source: string, openIndex: number): number {
  let depth = 0
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1
    if (source[index] === "}") {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return source.length - 1
}

async function loadTypeDeclarations(): Promise<void> {
  for (const file of await sourceFiles(sourceDirectory)) {
    const source = await readFile(file, "utf8")
    const declarationPattern =
      /export\s+(?:declare\s+)?(?:interface|type)\s+([A-Za-z0-9_]+)[^{]*\{/g
    for (const match of source.matchAll(declarationPattern)) {
      const openIndex = source.indexOf("{", match.index)
      typeDeclarations.set(
        match[1]!,
        source.slice(openIndex, matchingBrace(source, openIndex) + 1)
      )
    }
    const enumPattern =
      /export\s+(?:const\s+)?enum\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\}/g
    for (const match of source.matchAll(enumPattern)) {
      const values = [...match[2]!.matchAll(/["']([^"']+)["']/g)].map(
        (value) => value[1]!
      )
      if (values.length > 0) enumDeclarations.set(match[1]!, values)
    }
  }
}

function splitTopLevel(source: string): string[] {
  const values: string[] = []
  let start = 0
  let depth = 0
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!
    if ("{[(<".includes(character)) depth += 1
    if ("}])>".includes(character)) depth -= 1
    if ((character === ";" || character === "\n") && depth === 0) {
      values.push(source.slice(start, index))
      start = index + 1
    }
  }
  values.push(source.slice(start))
  return values
}

function schemaFromType(
  type: string,
  visited = new Set<string>()
): OpenApiSchema {
  const normalized = type.trim()
  if (normalized === "string") return { type: "string" }
  if (normalized === "number") return { type: "number" }
  if (normalized === "boolean") return { type: "boolean" }
  if (normalized === "Date") return { type: "string", format: "date-time" }
  if (normalized.endsWith("[]")) {
    return {
      type: "array",
      items: schemaFromType(normalized.slice(0, -2), visited),
    }
  }
  if (/^"[^"]+"(?:\s*\|\s*"[^"]+")+$/u.test(normalized)) {
    return {
      type: "string",
      enum: [...normalized.matchAll(/"([^"]+)"/g)].map((match) => match[1]!),
    }
  }
  const omit = normalized.match(/^Omit<([A-Za-z0-9_]+),\s*"([A-Za-z0-9_]+)">$/)
  if (omit) {
    const schema = schemaFromType(omit[1]!, visited)
    if (schema.properties) delete schema.properties[omit[2]!]
    if (schema.required)
      schema.required = schema.required.filter((name) => name !== omit[2])
    return schema
  }
  if (normalized.includes(" & ")) {
    const schemas = normalized
      .split(" & ")
      .map((entry) => schemaFromType(entry, visited))
    return schemas.reduce<OpenApiSchema>((schema, entry) => ({
      type: "object",
      properties: { ...schema.properties, ...entry.properties },
      required: [...(schema.required ?? []), ...(entry.required ?? [])],
      additionalProperties: false,
    }))
  }
  if (normalized.startsWith("{") && normalized.endsWith("}")) {
    const properties: Record<string, OpenApiSchema> = {}
    const required: string[] = []
    for (const entry of splitTopLevel(normalized.slice(1, -1))) {
      const property = entry
        .trim()
        .match(/^([A-Za-z0-9_]+)(\?)?\s*:\s*([\s\S]+)$/)
      if (!property) continue
      properties[property[1]!] = schemaFromType(property[3]!, visited)
      if (!property[2]) required.push(property[1]!)
    }
    return { type: "object", properties, required, additionalProperties: false }
  }
  if (enumDeclarations.has(normalized))
    return { type: "string", enum: enumDeclarations.get(normalized) }
  const declaration = typeDeclarations.get(normalized)
  if (declaration && !visited.has(normalized)) {
    visited.add(normalized)
    return schemaFromType(declaration, visited)
  }
  return { description: `TypeScript type: ${normalized || "unknown"}` }
}

function decoratedParameterType(
  handler: string,
  decorator: "Body" | "Query"
): string | undefined {
  const decoratorMatch = new RegExp(
    `@${decorator}\\(\\)[\\s\\S]*?([A-Za-z0-9_]+)\\s*:\\s*`
  ).exec(handler)
  if (!decoratorMatch || decoratorMatch.index === undefined) return undefined
  const start = decoratorMatch.index + decoratorMatch[0].length
  const leading = handler.slice(start).match(/^\s*/)?.[0].length ?? 0
  const typeStart = start + leading
  if (handler[typeStart] === "{") {
    return handler.slice(typeStart, matchingBrace(handler, typeStart) + 1)
  }
  let depth = 0
  for (let index = start; index < handler.length; index += 1) {
    const character = handler[index]!
    if ("{[(<".includes(character)) depth += 1
    if ("}])>".includes(character) && depth > 0) depth -= 1
    if ((character === "," || character === ")") && depth === 0)
      return handler.slice(start, index).trim()
  }
  return handler.slice(start).trim()
}

function matchingDelimiter(
  source: string,
  openIndex: number,
  openDelimiter: string,
  closeDelimiter: string
): number {
  let depth = 0
  let quote: string | undefined

  for (let index = openIndex; index < source.length; index += 1) {
    const character = source[index]!
    const previous = source[index - 1]

    if (quote) {
      if (character === quote && previous !== "\\") quote = undefined
      continue
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character
      continue
    }
    if (character === openDelimiter) depth += 1
    if (character === closeDelimiter) {
      depth -= 1
      if (depth === 0) return index
    }
  }

  return source.length - 1
}

function splitValues(source: string): string[] {
  const values: string[] = []
  let start = 0
  let depth = 0
  let quote: string | undefined

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!
    const previous = source[index - 1]

    if (quote) {
      if (character === quote && previous !== "\\") quote = undefined
      continue
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character
      continue
    }
    if ("{[(".includes(character)) depth += 1
    if ("}])".includes(character)) depth -= 1
    if (character === "," && depth === 0) {
      values.push(source.slice(start, index))
      start = index + 1
    }
  }
  values.push(source.slice(start))
  return values
}

function propertySeparator(source: string): number {
  let depth = 0
  let quote: string | undefined

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!
    const previous = source[index - 1]

    if (quote) {
      if (character === quote && previous !== "\\") quote = undefined
      continue
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character
      continue
    }
    if ("{[(".includes(character)) depth += 1
    if ("}])".includes(character)) depth -= 1
    if (character === ":" && depth === 0) return index
  }
  return -1
}

function exampleForProperty(name: string): OpenApiExample {
  if (/^(is|has)[A-Z_]/.test(name) || /enabled|success|active/i.test(name))
    return true
  if (/count|total|amount|balance|page|perPage|year|month|day/i.test(name))
    return 0
  if (/email/i.test(name)) return "member@example.com"
  if (/date|time|at$/i.test(name)) return "2026-01-01T00:00:00.000Z"
  if (/url/i.test(name)) return "https://example.com"
  if (/token/i.test(name)) return "example-token"
  if (/id$/i.test(name)) return "example-id"
  if (/message/i.test(name)) return "Example message"
  if (/s$/i.test(name)) return []
  return "example"
}

function exampleFromExpression(
  expression: string,
  propertyName?: string
): OpenApiExample {
  const value = expression.trim().replace(/^await\s+/, "")

  if (/^[-+]?\d+(?:\.\d+)?$/.test(value)) return Number(value)
  if (value === "true") return true
  if (value === "false") return false
  if (value === "null") return null
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith("`") && value.endsWith("`"))
  ) {
    return value.slice(1, -1)
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    const values = splitValues(value.slice(1, -1)).filter(Boolean)
    return values.map((entry) => exampleFromExpression(entry))
  }
  if (value.startsWith("{") && value.endsWith("}")) {
    const example: Record<string, OpenApiExample> = {}
    for (const member of splitValues(value.slice(1, -1))) {
      const entry = member.trim()
      if (!entry || entry.startsWith("...")) continue
      const separator = propertySeparator(entry)
      const key = (separator === -1 ? entry : entry.slice(0, separator))
        .trim()
        .replace(/^["']|["']$/g, "")
      if (!/^[A-Za-z0-9_]+$/.test(key)) continue
      example[key] =
        separator === -1
          ? exampleForProperty(key)
          : exampleFromExpression(entry.slice(separator + 1), key)
    }
    return example
  }

  return propertyName ? exampleForProperty(propertyName) : {}
}

function statusFrom(source: string): number | undefined {
  const normalized = source.trim()
  const enumMatch = normalized.match(/^HttpStatus\.([A-Z_]+)$/)
  if (enumMatch) return statusCodes[enumMatch[1]!]
  if (/^20[0-6]$/.test(normalized)) return Number(normalized)
  return undefined
}

function responseExamples(handler: string): Map<number, OpenApiExample> {
  const examples = new Map<number, OpenApiExample>()
  let cursor = 0

  while (cursor < handler.length) {
    const statusStart = handler.indexOf(".status(", cursor)
    if (statusStart === -1) break
    const statusOpen = statusStart + ".status".length
    const statusEnd = matchingDelimiter(handler, statusOpen, "(", ")")
    const status = statusFrom(handler.slice(statusOpen + 1, statusEnd))
    const sender = /^\s*\.\s*(?:send|json)\s*\(/.exec(
      handler.slice(statusEnd + 1)
    )

    if (!status || !sender) {
      cursor = statusEnd + 1
      continue
    }

    const argumentOpen = statusEnd + 1 + sender[0].length - 1
    const argumentEnd = matchingDelimiter(handler, argumentOpen, "(", ")")
    if (
      status >= 200 &&
      status < 300 &&
      status !== 204 &&
      !examples.has(status)
    ) {
      examples.set(
        status,
        exampleFromExpression(handler.slice(argumentOpen + 1, argumentEnd))
      )
    }
    cursor = argumentEnd + 1
  }

  return examples
}

function successResponses(handler: string): Record<string, OpenApiResponse> {
  const statuses = new Set<number>()
  for (const match of handler.matchAll(
    /\.status\(\s*HttpStatus\.([A-Z_]+)\s*\)/g
  )) {
    const status = statusCodes[match[1]!]
    if (status) statuses.add(status)
  }
  for (const match of handler.matchAll(/\.status\(\s*(20[0-6])\s*\)/g))
    statuses.add(Number(match[1]))
  if (statuses.size === 0) statuses.add(200)
  const examples = responseExamples(handler)
  return Object.fromEntries(
    [...statuses].sort().map((status) => [
      String(status),
      {
        description: "Successful response",
        ...(status === 204
          ? {}
          : {
              content: {
                "application/json": {
                  examples: {
                    success: {
                      summary: "Successful response",
                      value: examples.get(status) ?? {},
                    },
                  },
                },
              },
            }),
      },
    ])
  )
}

function normalizedPath(controllerPath: string, routePath: string): string {
  const joined = `${controllerPath.replace(/\/$/, "")}/${routePath.replace(
    /^\//,
    ""
  )}`.replace(/\/+/g, "/")

  const path = joined === "/" ? joined : joined.replace(/\/$/, "")
  return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}") || "/"
}

function readableName(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
}

function operationFor(
  controller: string,
  methodName: string,
  method: HttpMethod,
  path: string,
  requiresBearerAuth: boolean,
  handler: string
): OpenApiOperation {
  const parameterNames = [...path.matchAll(/\{([^}]+)\}/g)].map(
    ([, parameterName]) => parameterName!
  )

  return {
    tags: [controller.replace(/Controller$/, "")],
    summary: readableName(methodName),
    description: `Implemented by ${controller}.${methodName}. The runtime endpoint validates its input and response contract.`,
    operationId: `${method}_${controller.replace(/Controller$/, "")}_${methodName}`,
    ...(parameterNames.length > 0 || handler.includes("@Query()")
      ? {
          parameters: [
            ...parameterNames.map((name) => ({
              name,
              in: "path" as const,
              required: true as const,
              schema: { type: "string" as const },
            })),
            ...(() => {
              const querySchema = schemaFromType(
                decoratedParameterType(handler, "Query") ?? "unknown"
              )
              return Object.entries(querySchema.properties ?? {}).map(
                ([name, schema]) => ({
                  name,
                  in: "query" as const,
                  required: querySchema.required?.includes(name) ?? false,
                  schema,
                })
              )
            })(),
          ],
        }
      : {}),
    ...(handler.includes("@Body()")
      ? {
          requestBody: {
            required: true as const,
            content: {
              "application/json": {
                schema: schemaFromType(
                  decoratedParameterType(handler, "Body") ?? "unknown"
                ),
              },
            },
          },
        }
      : {}),
    ...(requiresBearerAuth ? { security: [{ bearerAuth: [] }] } : {}),
    responses: {
      ...successResponses(handler),
      "400": { description: "Invalid request or domain validation error" },
      "401": { description: "Authentication is required" },
      "403": { description: "The authenticated user is not authorized" },
      "422": { description: "Request validation failed" },
      "500": { description: "Unexpected server error" },
    },
  }
}

async function discoverRoutes(): Promise<DocumentedRoute[]> {
  const files = await controllerFiles(sourceDirectory)
  const routes: DocumentedRoute[] = []

  for (const file of files) {
    const source = await readFile(file, "utf8")
    const controllerMatch = source.match(
      /@Controller\(\s*["']([^"']+)["']\s*\)\s*(?:export\s+)?class\s+([A-Za-z0-9_]+)/
    )
    if (!controllerMatch) continue

    const [, controllerPath, controller] = controllerMatch
    const routePattern =
      /@(Get|Post|Put|Patch|Delete)\(\s*["']([^"']*)["']\s*\)/g
    const matches = [...source.matchAll(routePattern)]

    for (const match of matches) {
      const decorator = match[1]!
      const routePath = match[2]!
      const method = decorator.toLowerCase() as HttpMethod
      const methodStart = match.index!
      const declaration = source.slice(methodStart)
      const asyncMatch = /async\s+([A-Za-z0-9_]+)\s*\(/.exec(declaration)
      const methodName = asyncMatch?.[1]

      if (!methodName) {
        throw new Error(
          `Could not find the method declaration for ${relative(rootDirectory, file)} ${decorator} ${routePath}`
        )
      }

      const methodOpenBrace = source.indexOf(
        "{",
        methodStart + asyncMatch![0].length
      )
      const handler = source.slice(
        methodStart,
        matchingBrace(source, methodOpenBrace) + 1
      )
      const decoratorBlock = source.slice(
        methodStart,
        methodStart + asyncMatch!.index
      )
      const path = normalizedPath(controllerPath!, routePath)
      routes.push({
        controller: controller!,
        method,
        path,
        operation: operationFor(
          controller!,
          methodName,
          method,
          path,
          decoratorBlock.includes("PermissionMiddleware"),
          handler
        ),
      })
    }
  }

  return routes.sort((left, right) =>
    `${left.path}:${left.method}`.localeCompare(`${right.path}:${right.method}`)
  )
}

function createDocument(routes: DocumentedRoute[]): OpenApiDocument {
  const paths: OpenApiDocument["paths"] = {}

  for (const route of routes) {
    const operations = (paths[route.path] ??= {})
    if (operations[route.method]) {
      throw new Error(
        `Duplicate route: ${route.method.toUpperCase()} ${route.path}`
      )
    }
    operations[route.method] = route.operation
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Glória Finance API",
      version: "v1",
      description:
        "HTTP API reference generated from the Bun Platform Kit controller decorators. Authentication and input validation are enforced by each endpoint at runtime.",
    },
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  }
}

async function generatedSource(document: OpenApiDocument): Promise<string> {
  const prettierOptions = await resolveConfig(outputFile)

  return format(
    `// This file is generated by scripts/generate-openapi.ts. Do not edit manually.\nexport const openApiDocument = ${JSON.stringify(document, null, 2)} as const\n`,
    { ...prettierOptions, filepath: outputFile }
  )
}

await loadTypeDeclarations()
const document = createDocument(await discoverRoutes())
const expected = await generatedSource(document)

if (checkOnly) {
  const current = await readFile(outputFile, "utf8")
  if (current !== expected) {
    throw new Error(
      "OpenAPI documentation is stale. Run `bun run docs:generate` and commit the generated document."
    )
  }
} else {
  await writeFile(outputFile, expected)
}

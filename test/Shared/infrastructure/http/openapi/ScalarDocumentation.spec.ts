import type { ServerResponse } from "bun-platform-kit"

import { openApiDocument } from "@/Shared/infrastructure/http/openapi/OpenApiDocument.generated"
import { ApiDocsController } from "@/Shared/infrastructure/http/controllers/ApiDocs.controller"

describe("Scalar documentation", () => {
  it("serves the generated OpenAPI document and the Scalar reference", async () => {
    const openApiResponse = responseStub()
    await new ApiDocsController().spec(openApiResponse.value)

    const docsResponse = responseStub()
    await new ApiDocsController().docs(docsResponse.value)

    expect(openApiResponse.status).toBe(200)
    expect(openApiResponse.body).toBe(openApiDocument)
    expect(openApiResponse.headers["Content-Type"]).toContain(
      "application/json"
    )
    expect(docsResponse.status).toBe(200)
    expect(docsResponse.body).toContain("@scalar/api-reference")
    expect(docsResponse.body).toContain('data-url="/docs/openapi.json"')
  })

  it("preserves handler-specific authentication, input, and success contracts", () => {
    const login = openApiDocument.paths["/api/v1/user/login"]?.post
    const onboarding = openApiDocument.paths["/api/v1/onboarding"]
    const statementImport =
      openApiDocument.paths["/api/v1/bank/statements/import"]?.post

    expect(login?.security).toBeUndefined()
    expect(
      login?.requestBody?.content["application/json"].schema
    ).toMatchObject({
      properties: {
        email: { type: "string" },
        password: { type: "string" },
      },
      required: ["email", "password"],
    })
    expect(
      onboarding?.get?.parameters?.map((parameter) => parameter.name)
    ).toEqual(["page", "perPage"])
    expect(
      onboarding?.post?.requestBody?.content["application/json"].schema
    ).toMatchObject({
      properties: {
        name: { type: "string" },
        representative: {
          properties: { email: { type: "string" } },
        },
      },
    })
    expect(onboarding?.post?.responses["201"]).toMatchObject({
      content: {
        "application/json": {
          examples: {
            success: {
              value: {
                message: "Customer created successfully",
                customerId: "example-id",
              },
            },
          },
        },
      },
    })
    expect(statementImport?.responses["202"]?.content).toBeDefined()
  })

  it("includes a JSON example for every successful response with a body", () => {
    for (const path of Object.values(openApiDocument.paths)) {
      for (const operation of Object.values(path)) {
        if (!operation) continue
        for (const [status, response] of Object.entries(operation.responses)) {
          if (!status.startsWith("2") || status === "204") continue
          expect(
            response.content?.["application/json"].examples.success.value
          ).toBeDefined()
        }
      }
    }
  })
})

function responseStub(): {
  value: ServerResponse
  status?: number
  body?: string | typeof openApiDocument
  headers: Record<string, string>
} {
  const state: {
    value: ServerResponse
    status?: number
    body?: string | typeof openApiDocument
    headers: Record<string, string>
  } = {
    value: undefined as never,
    headers: {},
  }

  state.value = {
    status(code: number) {
      state.status = code
      return this
    },
    json(body: unknown) {
      state.body = body as typeof openApiDocument
    },
    send(body: unknown) {
      state.body = body as string | typeof openApiDocument
    },
    set(name: string, value: string) {
      state.headers[name] = value
      return this
    },
    header(name: string, value: string) {
      state.headers[name] = value
      return this
    },
    end() {},
  }

  return state
}

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
    const cashFlow = openApiDocument.paths["/api/v1/reports/cash-flow"]?.get

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
                customerId: "00000000-0000-0000-0000-000000000001",
              },
            },
          },
        },
      },
    })
    expect(statementImport?.responses["202"]?.content).toBeDefined()
    expect(login?.responses["200"]).toMatchObject({
      content: {
        "application/json": {
          examples: {
            success: {
              value: expect.objectContaining({
                userId: expect.any(String),
                church: expect.objectContaining({ churchId: expect.any(String) }),
                roles: expect.any(Array),
                token: expect.any(String),
                refreshToken: expect.any(String),
              }),
            },
          },
        },
      },
    })
    expect(cashFlow?.responses["200"]).toMatchObject({
      content: {
        "application/json": {
          examples: {
            success: {
              value: expect.objectContaining({
                reportName: expect.any(String),
                summary: expect.any(Object),
                series: expect.any(Array),
              }),
            },
          },
        },
      },
    })
  })

  it("includes a JSON example for every successful response with a body", () => {
    let responseCount = 0
    for (const path of Object.values(openApiDocument.paths)) {
      for (const operation of Object.values(path)) {
        if (!operation) continue
        for (const [status, response] of Object.entries(operation.responses)) {
          if (status !== "200" || status === "204") continue
          if (!response.content?.["application/json"]) continue
          responseCount += 1
          const value = response.content?.["application/json"].examples.success.value
          expect(
            value
          ).toBeDefined()
          expect(value).not.toEqual({})
          expect(JSON.stringify(value)).not.toContain('"example"')
          expect(JSON.stringify(value)).not.toContain('"example-id"')
          expect(JSON.stringify(value)).not.toContain("__@toStringTag")
        }
      }
    }
    expect(responseCount).toBeGreaterThan(0)
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

import { openApiDocument } from "@/Shared/infrastructure/http/openapi/OpenApiDocument.generated"

/**
 * The generated document is a published contract, so its shape is asserted here
 * and not only by `docs:check`, which proves the file is up to date but not that
 * it says the right thing.
 */
const path = openApiDocument.paths["/api/v1/recurring-payments"] as never as {
  get: {
    responses: Record<string, { content?: { "application/json"?: unknown } }>
  }
}

const exampleOf = (status: string): Record<string, unknown> => {
  const content = path.get.responses[status]?.content?.["application/json"] as {
    example?: unknown
    examples?: Record<string, { value?: unknown }>
    schema?: Record<string, unknown>
  }
  const value =
    content?.example ?? content?.examples?.success?.value ?? content?.examples
  return (Array.isArray(value) ? value[0] : value) as Record<string, unknown>
}

describe("OpenAPI example of GET /recurring-payments", () => {
  it("reports competenceStatus as a status, not as the settlement entry", () => {
    // It used to publish the settlement object under this key and a string under
    // `settlement`, because the generator paired the properties with the wrong
    // members.
    const example = exampleOf("200")

    expect(typeof example.competenceStatus).toBe("string")
    expect([
      "PENDING",
      "UPCOMING",
      "PROCESSING",
      "BLOCKED",
      "FAILED",
      "PAID",
      "INACTIVE",
    ]).toContain(example.competenceStatus)
  })

  it("publishes the recurrence configuration as enums instead of placeholders", () => {
    const schema = JSON.stringify(exampleOf("200"))
    expect(schema).not.toContain("TypeScript type:")

    const body = JSON.stringify(openApiDocument)
    expect(body).toContain('"enum":["FIXED","VARIABLE"]')
  })

  it("renders every member from its declared type", () => {
    // The example resolved several members through name heuristics: `type` and
    // `pixDestination` read "Gloria Finance" and `status` became an empty array.
    const example = exampleOf("200")

    expect(example.type).toBe("FIXED")
    expect(example.status).toBe("ACTIVE")
    expect(example.pixDestination).toMatchObject({
      pixKey: expect.any(String),
      pixKeyType: "CPF",
    })
    expect(example.settlement ?? {}).not.toBe("Gloria Finance")
  })
})

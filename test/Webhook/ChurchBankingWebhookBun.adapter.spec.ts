import type { ServerHandler, ServerRequest } from "bun-platform-kit"
import {
  captureChurchBankingWebhookRawBody,
  CHURCH_BANKING_WEBHOOK_MAX_BODY_BYTES,
  type ChurchBankingWebhookRequest,
} from "@/Webhook/infrastructure/http/ChurchBankingWebhookBun.adapter.ts"

describe("captureChurchBankingWebhookRawBody", () => {
  it("preserves the exact bytes and parses the JSON body", async () => {
    const text = '{"id":"event-123","type":"BANKING_PAYMENT_UPDATED"}'
    const req = requestFor(text)
    const response = responseStub()
    let nextCalled = false

    await captureChurchBankingWebhookRawBody(req, response.value, () => {
      nextCalled = true
    })

    expect(nextCalled).toBe(true)
    expect((req as ChurchBankingWebhookRequest).rawBody).toEqual(
      new TextEncoder().encode(text)
    )
    expect(req.body).toEqual({
      id: "event-123",
      type: "BANKING_PAYMENT_UPDATED",
    })
    expect(response.status).toBeUndefined()
  })

  it("does not consume requests for other routes", async () => {
    const text = '{"id":"event-123"}'
    const req = requestFor(text, "/api/v1/other")
    const response = responseStub()
    let nextCalled = false

    await captureChurchBankingWebhookRawBody(req, response.value, () => {
      nextCalled = true
    })

    expect(nextCalled).toBe(true)
    expect((req as ChurchBankingWebhookRequest).rawBody).toBeUndefined()
    expect(req.body).toBeUndefined()
    expect((req.raw as Request).bodyUsed).toBe(false)
  })

  it("rejects invalid JSON", async () => {
    const req = requestFor("{invalid-json")
    const response = responseStub()
    let nextCalled = false

    await captureChurchBankingWebhookRawBody(req, response.value, () => {
      nextCalled = true
    })

    expect(nextCalled).toBe(false)
    expect(response.status).toBe(400)
    expect(response.body).toEqual({ code: "CHURCH_BANKING_WEBHOOK_BODY_INVALID" })
  })

  it("rejects payloads larger than the webhook limit", async () => {
    const req = requestFor("{}")
    req.headers["content-length"] = String(
      CHURCH_BANKING_WEBHOOK_MAX_BODY_BYTES + 1
    )
    const response = responseStub()
    let nextCalled = false

    await captureChurchBankingWebhookRawBody(req, response.value, () => {
      nextCalled = true
    })

    expect(nextCalled).toBe(false)
    expect(response.status).toBe(413)
    expect(response.body).toEqual({
      code: "CHURCH_BANKING_WEBHOOK_PAYLOAD_TOO_LARGE",
    })
  })
})

function requestFor(
  body: string,
  path = "/webhooks/church-banking"
): ServerRequest {
  return {
    method: "POST",
    path,
    originalUrl: path,
    params: {},
    query: {},
    headers: {
      "content-type": "application/json",
      "content-length": String(new TextEncoder().encode(body).byteLength),
    },
    raw: new Request(`https://api.gloriafinance.com.br${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }),
  }
}

function responseStub(): {
  readonly value: Parameters<ServerHandler>[1]
  status?: number
  body?: unknown
} {
  const state: {
    value: Parameters<ServerHandler>[1]
    status?: number
    body?: unknown
  } = {
    value: undefined as unknown as Parameters<ServerHandler>[1],
  }

  state.value = {
    status(code: number) {
      state.status = code
      return this
    },
    json(body: unknown) {
      state.body = body
    },
    send(body: unknown) {
      state.body = body
    },
    set() {
      return this
    },
    header() {
      return this
    },
    end() {},
  }

  return state
}

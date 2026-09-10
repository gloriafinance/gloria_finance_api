import {
  BunWebSocketAdapter,
  type BunWebSocketAdapterOptions,
  type ServerHandler,
  type ServerRequest,
} from "bun-platform-kit"

export const CHURCH_BANKING_WEBHOOK_PATH = "/webhooks/church-banking"
export const CHURCH_BANKING_WEBHOOK_MAX_BODY_BYTES = 64 * 1024

export type ChurchBankingWebhookRequest = ServerRequest & {
  rawBody?: Uint8Array
}

export class ChurchBankingWebhookBunAdapter extends BunWebSocketAdapter {
  constructor(options: BunWebSocketAdapterOptions) {
    super(options)
  }

  override configure(
    app: Parameters<BunWebSocketAdapter["configure"]>[0],
    port: number
  ) {
    app.use(captureChurchBankingWebhookRawBody)
    super.configure(app, port)
  }
}

export const captureChurchBankingWebhookRawBody: ServerHandler = async (
  req,
  res,
  next
): Promise<void> => {
  if (req.method !== "POST" || req.path !== CHURCH_BANKING_WEBHOOK_PATH) {
    next()
    return
  }

  const contentType = String(req.headers["content-type"] ?? "")
  if (!contentType.includes("application/json")) {
    res.status(415).json({
      code: "CHURCH_BANKING_WEBHOOK_CONTENT_TYPE_INVALID",
    })
    return
  }

  const contentLength = Number(req.headers["content-length"])
  if (
    Number.isFinite(contentLength) &&
    contentLength > CHURCH_BANKING_WEBHOOK_MAX_BODY_BYTES
  ) {
    res.status(413).json({
      code: "CHURCH_BANKING_WEBHOOK_PAYLOAD_TOO_LARGE",
    })
    return
  }

  try {
    const rawBody = await readBodyWithinLimit(
      req.raw as Request,
      CHURCH_BANKING_WEBHOOK_MAX_BODY_BYTES
    )
    const webhookRequest = req as ChurchBankingWebhookRequest
    webhookRequest.rawBody = rawBody
    webhookRequest.body = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(rawBody)
    )
    next()
  } catch (error) {
    if (error instanceof BodyLimitExceededError) {
      res.status(413).json({
        code: "CHURCH_BANKING_WEBHOOK_PAYLOAD_TOO_LARGE",
      })
      return
    }

    res.status(400).json({ code: "CHURCH_BANKING_WEBHOOK_BODY_INVALID" })
  }
}

async function readBodyWithinLimit(
  request: Request,
  maximumBytes: number
): Promise<Uint8Array> {
  const reader = request.body?.getReader()
  if (reader === undefined) return new Uint8Array()

  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break

      totalBytes += next.value.byteLength
      if (totalBytes > maximumBytes) {
        await reader.cancel()
        throw new BodyLimitExceededError()
      }
      chunks.push(next.value)
    }
  } finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

class BodyLimitExceededError extends Error {}

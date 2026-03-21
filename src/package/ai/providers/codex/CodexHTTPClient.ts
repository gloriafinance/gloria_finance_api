type PostJsonParams = {
  url: string
  headers?: Record<string, string>
  body?: Record<string, unknown>
}

type PostFormParams = {
  url: string
  headers?: Record<string, string>
  body: Record<string, string | number | undefined>
}

export class CodexHTTPClient {
  async postJson<T = Record<string, unknown>>(
    params: PostJsonParams
  ): Promise<{
    ok: boolean
    status: number
    headers: Headers
    json: T
  }> {
    const response = await fetch(params.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(params.headers ?? {}),
      },
      body: JSON.stringify(params.body ?? {}),
    })

    const json = (await this.tryParseJson(response)) as T
    return {
      ok: response.ok,
      status: response.status,
      headers: response.headers,
      json,
    }
  }

  async postForm<T = Record<string, unknown>>(
    params: PostFormParams
  ): Promise<{
    ok: boolean
    status: number
    headers: Headers
    json: T
  }> {
    const body = new URLSearchParams()
    for (const [key, value] of Object.entries(params.body)) {
      if (value === undefined) continue
      body.set(key, String(value))
    }

    const response = await fetch(params.url, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        ...(params.headers ?? {}),
      },
      body,
    })

    const json = (await this.tryParseJson(response)) as T
    return {
      ok: response.ok,
      status: response.status,
      headers: response.headers,
      json,
    }
  }

  private async tryParseJson(
    response: Response
  ): Promise<Record<string, unknown>> {
    try {
      return (await response.json()) as Record<string, unknown>
    } catch {
      return {}
    }
  }
}

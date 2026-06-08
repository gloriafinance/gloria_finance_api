import { parseCodexResponse } from "./ParseCodexResponse.helper"

describe("parseCodexResponse", () => {
  it("parses direct JSON text", () => {
    const payload = {
      output_text: '{"title":"Direct"}',
    }

    expect(parseCodexResponse(payload)).toEqual({ title: "Direct" })
  })

  it("parses JSON from output items", () => {
    const payload = {
      output: [
        {
          content: [
            {
              text: '{"title":"From output"}',
            },
          ],
        },
      ],
    }

    expect(parseCodexResponse(payload)).toEqual({ title: "From output" })
  })

  it("unwraps nested response payloads", () => {
    const payload = {
      response: {
        output: [
          {
            content: [
              {
                text: '{"title":"Nested"}',
              },
            ],
          },
        ],
      },
    }

    expect(parseCodexResponse(payload)).toEqual({ title: "Nested" })
  })
})

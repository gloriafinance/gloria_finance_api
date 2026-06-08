import { normalizeCodexCompletedResponse } from "./NormalizeCodexCompletedResponse.helper"

describe("normalizeCodexCompletedResponse", () => {
  it("backfills streamed output items when completed response is empty", () => {
    const response = {
      id: "resp_1",
      output: [],
    }
    const streamedOutputItems = [
      {
        id: "msg_1",
        type: "message",
        status: "completed",
        content: [{ type: "output_text", text: '{"title":"Backfilled"}' }],
      },
    ]

    expect(
      normalizeCodexCompletedResponse(response, streamedOutputItems)
    ).toEqual({
      id: "resp_1",
      output: streamedOutputItems,
    })
  })

  it("keeps the server response when it already contains output", () => {
    const response = {
      id: "resp_1",
      output: [{ id: "msg_1" }],
    }

    expect(
      normalizeCodexCompletedResponse(response, [
        { id: "msg_2", type: "message" },
      ])
    ).toBe(response)
  })
})

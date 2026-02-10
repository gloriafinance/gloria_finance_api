import type { ServerApp, ServerInstance } from "bun-platform-kit"
import { BunAdapter } from "bun-platform-kit"

export class BunHostAdapter extends BunAdapter {
  override listen(
    app: ServerApp,
    port: number,
    onListen: () => void
  ): ServerInstance {
    const bunApp = app as any
    const hostname = process.env.APP_HOST ?? "0.0.0.0"

    const server = Bun.serve({
      port,
      hostname,
      fetch: bunApp.createFetchHandler(),
    })

    onListen()

    return {
      close: (callback) => {
        server.stop(true)
        callback?.()
      },
    }
  }
}

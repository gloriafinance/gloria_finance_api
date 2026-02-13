import type { ServerRequest } from "bun-platform-kit"

export type AuthenticatedRequest = ServerRequest & {
  auth: {
    name: string
    memberId?: string
    userId?: string
    isSuperuser: boolean
    churchId: string
    permissions?: string[]
    symbolFormatMoney: string
    lang: string
    email: string
  }
  requiredPermission?: string
}

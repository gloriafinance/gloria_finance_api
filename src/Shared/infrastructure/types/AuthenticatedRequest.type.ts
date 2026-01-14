import type { ServerRequest } from "@abejarano/ts-express-server"

export type AuthenticatedRequest = ServerRequest & {
  auth?: {
    name: string
    memberId?: string
    userId?: string
    isSuperuser: boolean
    churchId?: string
    permissions?: string[]
    symbolFormatMoney: string
  }
  requiredPermission?: string
}

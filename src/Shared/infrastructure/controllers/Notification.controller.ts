import { Body, Controller, Post, Req, Res, Use } from "bun-platform-kit"
import type { ServerResponse, ServerRequest } from "bun-platform-kit"

import domainResponse from "@/Shared/helpers/domainResponse"
import { FindMemberById } from "@/Church/applications"
import { MemberMongoRepository } from "@/Church/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import type { AuthenticatedRequest } from "@/Shared/infrastructure/types/AuthenticatedRequest.type"
import { PermissionMiddleware } from "../middleware/Permission.middleware"

@Controller("/api/v1/Notifications")
export class NotificationController {
  @Post("/push-tokens")
  @Use(PermissionMiddleware)
  async token(
    @Body()
    body: {
      token: string
      platform: "android" | "ios" | "web"
      deviceId: string
    },
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const member = await new FindMemberById(
        MemberMongoRepository.getInstance()
      ).execute(req.auth.memberId)

      const settings = member.getSettings()
      member.setSettings({
        ...settings,
        token: body.token,
        platform: body.platform,
        deviceId: body.deviceId,
      })

      await MemberMongoRepository.getInstance().upsert(member)
      res.status(HttpStatus.OK).send({ message: "Token saved successfully" })
    } catch (e) {
      domainResponse(e, res)
    }
  }
}

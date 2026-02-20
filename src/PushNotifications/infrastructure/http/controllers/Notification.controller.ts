import type { ServerResponse } from "bun-platform-kit"
import { Body, Controller, Post, Req, Res, Use } from "bun-platform-kit"

import domainResponse from "@/Shared/helpers/domainResponse.ts"
import { FindMemberById } from "@/Church/applications"
import { MemberMongoRepository } from "@/Church/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import type { AuthenticatedRequest } from "@/Shared/infrastructure/types/AuthenticatedRequest.type.ts"
import { PermissionMiddleware } from "@/Shared/infrastructure"

@Controller("/api/v1/notifications")
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
      if (!body?.token?.trim() || !body?.deviceId?.trim() || !body?.platform) {
        return res.status(HttpStatus.BAD_REQUEST).send({
          message: "token, platform and deviceId are required",
        })
      }

      const member = await new FindMemberById(
        MemberMongoRepository.getInstance()
      ).execute(req.auth.memberId)

      const settings = member.getSettings()
      member.setSettings({
        ...settings,
        token: body.token.trim(),
        platform: body.platform,
        deviceId: body.deviceId.trim(),
      })

      await MemberMongoRepository.getInstance().upsert(member)
      res.status(HttpStatus.OK).send({ message: "Token saved successfully" })
    } catch (e) {
      domainResponse(e, res)
    }
  }
}

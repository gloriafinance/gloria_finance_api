import type { ServerResponse } from "bun-platform-kit"
import { Body, Controller, Post, Req, Res, Use } from "bun-platform-kit"

import domainResponse from "@/Shared/helpers/domainResponse.ts"
import { FindMemberById } from "@/Church/applications"
import { MemberMongoRepository } from "@/Church/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import type { AuthenticatedRequest } from "@/Shared/infrastructure/types/AuthenticatedRequest.type.ts"
import { PermissionMiddleware } from "@/Shared/infrastructure"
import { FCMNotificationService } from "@/PushNotifications/infrastructure/services/FCMNotification.service.ts"

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
      ).execute({
        memberId: req.auth.memberId,
        churchId: req.auth.churchId,
      })

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

  @Post("/test")
  @Use(PermissionMiddleware)
  async test(@Req() req: AuthenticatedRequest, @Res() res: ServerResponse) {
    const member = (await MemberMongoRepository.getInstance().one({
      email: "programador.angel@gmail.com",
    }))!

    await FCMNotificationService.getInstance().sendToToken(
      member.getSettings().token!,
      {
        title: "test",
        body: "body test",
      }
    )

    res.status(HttpStatus.OK).send("Test route")
  }
}

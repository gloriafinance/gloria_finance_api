import { Body, Controller, Post, Req, Res } from "@abejarano/ts-express-server"
import { Request, Response } from "express"
import domainResponse from "@/Shared/helpers/domainResponse"
import { FindMemberById } from "@/Church/applications"
import { MemberMongoRepository } from "@/Church/infrastructure"
import { HttpStatus } from "@/Shared/domain"

@Controller("/api/v1/Notifications")
export class NotificationController {
  @Post("/push-tokens")
  async token(
    @Body()
    body: {
      token: string
      platform: "android" | "ios" | "web"
      deviceId: string
    },
    @Req() req: Request,
    @Res() res: Response
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

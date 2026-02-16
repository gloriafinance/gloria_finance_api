import { HttpStatus } from "@/Shared/domain"
import domainResponse from "../../../Shared/helpers/domainResponse"
import { SetWhatsappCredentials } from "@/Church/applications"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  type ServerResponse,
  Use,
} from "bun-platform-kit"
import {
  Can,
  PermissionMiddleware,
  type AuthenticatedRequest,
} from "@/Shared/infrastructure"
import { Logger } from "@/Shared/adapter"

@Controller("/api/v1/integrations")
export class IntegrationsController {
  private logger = Logger(IntegrationsController.name)

  @Post("/whatsapp")
  //@Use([PermissionMiddleware, Can("church", "upsert")])
  @Use([PermissionMiddleware])
  async setWhatsappCredentials(
    @Body()
    body: {
      wabaId: string
      phoneNumberId: string
      accessToken: string
    },
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    this.logger.info("Received request to set WhatsApp credentials", body)

    try {
      const { wabaId, phoneNumberId, accessToken } = body

      await new SetWhatsappCredentials(
        ChurchMongoRepository.getInstance()
      ).execute(req.auth.churchId, wabaId, phoneNumberId, accessToken)

      res
        .status(HttpStatus.OK)
        .send({ message: "WhatsApp credentials updated successfully" })
    } catch (e) {
      domainResponse(e, res)
    }
  }
}

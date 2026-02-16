import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  type ServerResponse,
} from "bun-platform-kit"
import { Logger } from "@/Shared/adapter"

@Controller("/webhooks")
export class WhatsappController {
  private logger = Logger(WhatsappController.name)

  @Post("/whatsapp")
  async whatsapp(@Body() body: any, @Res() res: ServerResponse) {
    this.logger.info("Received a WhatsApp webhook request.", body)

    res.status(200).send({ message: "ok" })
  }

  @Get("/whatsapp")
  async index(@Query() query: any, @Res() res: ServerResponse) {
    this.logger.info("Received a WhatsApp webhook request.", query)

    const challenge = query["hub.challenge"]

    res.status(200).send(challenge)
  }
}

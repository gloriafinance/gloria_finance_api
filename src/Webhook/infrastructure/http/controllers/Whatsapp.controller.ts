import { Body, Controller, Post } from "bun-platform-kit"
import { Logger } from "@/Shared/adapter"

@Controller("/webhooks")
export class WhatsappController {
  private logger = Logger(WhatsappController.name)

  @Post("/whatsapp")
  async whatsapp(@Body() body: any) {
    this.logger.info("Received a WhatsApp webhook request.", body)
  }
}

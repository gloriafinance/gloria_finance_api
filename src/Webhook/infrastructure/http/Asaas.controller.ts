import { Controller, Post } from "bun-platform-kit"

@Controller("/webhooks/asaas")
export class AsaasController {
  @Post("/")
  async handleWebhook() {
    // Handle the webhook logic here
    return { message: "Webhook received" }
  }
}

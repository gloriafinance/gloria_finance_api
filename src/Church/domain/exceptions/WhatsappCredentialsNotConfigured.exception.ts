import { DomainException } from "@/Shared/domain"

export class WhatsappCredentialsNotConfigured extends DomainException {
  name = "WHATSAPP_CREDENTIALS_NOT_CONFIGURED"
  message: string

  constructor(churchId: string) {
    super()
    this.message = `WhatsApp credentials are not configured for church ${churchId}`
  }
}

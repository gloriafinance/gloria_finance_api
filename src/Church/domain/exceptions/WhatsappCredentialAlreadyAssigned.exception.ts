import { DomainException } from "@/Shared/domain"

export class WhatsappCredentialAlreadyAssigned extends DomainException {
  name = "WHATSAPP_CREDENTIAL_ALREADY_ASSIGNED"
  message: string

  constructor(type: "wabaId" | "phoneNumberId", churchId: string) {
    super()
    this.message = `The ${type} is already assigned to church ${churchId}`
  }
}

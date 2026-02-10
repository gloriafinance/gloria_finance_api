import { DomainException } from "@/Shared/domain"

export class InvalidSocialToken extends DomainException {
  name = "InvalidSocialToken"
  message = "Invalid social login token."
}

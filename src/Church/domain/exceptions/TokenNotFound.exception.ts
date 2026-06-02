import { DomainException } from "@/Shared/domain"

export class TokenNotFound extends DomainException {
  name = "TOKEN_NOT_FOUND"
  message = "The registration link is invalid or has expired"
}

import { DomainException } from "../../../Shared/domain"

export class BankNotFound extends DomainException {
  name = "BANK_NOT_FOUND"
  message = "Bank not found"
}

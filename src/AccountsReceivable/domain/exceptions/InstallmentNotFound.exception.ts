import { DomainException } from "@/Shared/domain"

export class InstallmentNotFound extends DomainException {
  name = "INSTALLMENT_NOT_FOUND"
  message = "Installment not found"

  constructor(installmentId: string) {
    super()
    this.message = `Installment with id ${installmentId} not found`
  }
}

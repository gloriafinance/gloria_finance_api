import { DomainException } from "@/Shared/domain"

export class InvalidInstallmentsConfiguration extends DomainException {
  name = "INVALID_INSTALLMENTS_CONFIGURATION"
  message =
    "Revise os valores das parcelas: a soma deve coincidir com o total informado ou informe o valor total da nota fiscal quando optar pelo cenário B sem parcelas."

  constructor(message?: string) {
    super()
    if (message) {
      this.message = message
    }
  }
}

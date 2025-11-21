import { DomainException } from "@/Shared/domain"

export class InvalidMemberForInstallmentPayment extends DomainException {
  name = "INVALID_MEMBER_FOR_INSTALLMENT_PAYMENT"
  message = "O membro informado não corresponde ao compromisso de contribuição."
}

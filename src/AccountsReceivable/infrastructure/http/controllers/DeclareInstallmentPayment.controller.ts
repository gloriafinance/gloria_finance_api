import { Response } from "express"
import domainResponse from "@/Shared/helpers/domainResponse"
import { HttpStatus } from "@/Shared/domain"
import { DeclareInstallmentPayment } from "@/AccountsReceivable/applications"
import { AccountsReceivableMongoRepository } from "@/AccountsReceivable/infrastructure/persistence/AccountsReceivableMongoRepository"
import { DeclareInstallmentPaymentRequest } from "@/AccountsReceivable/domain"

export const DeclareInstallmentPaymentController = async (
  req: DeclareInstallmentPaymentRequest,
  res: Response
) => {
  try {
    await new DeclareInstallmentPayment(
      AccountsReceivableMongoRepository.getInstance()
    ).execute(req)

    res.status(HttpStatus.OK).json({
      message: "Contribuição registrada e aguardando verificação.",
    })
  } catch (e) {
    domainResponse(e, res)
  }
}

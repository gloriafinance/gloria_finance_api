import { Response } from "express"
import domainResponse from "@/Shared/helpers/domainResponse"
import { HttpStatus } from "@/Shared/domain"
import { DeclareInstallmentPayment } from "@/AccountsReceivable/applications"
import { AccountsReceivableMongoRepository } from "@/AccountsReceivable/infrastructure/persistence/AccountsReceivableMongoRepository"
import { DeclareInstallmentPaymentRequest } from "@/AccountsReceivable/domain"
import { MemberMongoRepository } from "@/Church/infrastructure"
import { AvailabilityAccountMongoRepository } from "@/Financial/infrastructure/persistence"
import { RegisterContributionsOnline } from "@/Financial/applications"
import { OnlineContributionsMongoRepository } from "@/Financial/infrastructure/persistence/OnlineContributionsMongoRepository"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import { StorageGCP } from "@/Shared/infrastructure"

export const DeclareInstallmentPaymentController = async (
  req: DeclareInstallmentPaymentRequest,
  res: Response
) => {
  try {
    await new DeclareInstallmentPayment(
      AccountsReceivableMongoRepository.getInstance(),
      MemberMongoRepository.getInstance(),
      AvailabilityAccountMongoRepository.getInstance(),
      new RegisterContributionsOnline(
        OnlineContributionsMongoRepository.getInstance(),
        StorageGCP.getInstance(process.env.BUCKET_FILES),
        FinancialYearMongoRepository.getInstance()
      )
    ).execute(req)

    res.status(HttpStatus.OK).json({
      message: "Contribuição registrada e aguardando verificação.",
    })
  } catch (e) {
    domainResponse(e, res)
  }
}

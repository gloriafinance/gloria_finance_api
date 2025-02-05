import { RecordPurchaseRequest } from "../../../domain/requests"
import { Response } from "express"
import domainResponse from "../../../../Shared/helpers/domainResponse"
import { RecordPurchase } from "../../../applications"
import { PurchaseMongoRepository } from "../../persistence/PurchaseMongoRepository"
import {
  AvailabilityAccountMongoRepository,
  FinancialConfigurationMongoRepository,
} from "../../../../Financial/infrastructure/persistence"
import { HttpStatus } from "../../../../Shared/domain"
import { QueueBullService, StorageGCP } from "../../../../Shared/infrastructure"
import { FinancialMonthValidator } from "../../../../ConsolidatedFinancial/applications"
import { FinancialYearMongoRepository } from "../../../../ConsolidatedFinancial/infrastructure"

export const recordPurchaseController = async (
  request: RecordPurchaseRequest,
  res: Response
) => {
  try {
    await new FinancialMonthValidator(
      FinancialYearMongoRepository.getInstance()
    ).validate(request.churchId)

    request.invoice = await StorageGCP.getInstance(
      process.env.BUCKET_FILES
    ).uploadFile(request.file)

    await new RecordPurchase(
      PurchaseMongoRepository.getInstance(),
      AvailabilityAccountMongoRepository.getInstance(),
      FinancialConfigurationMongoRepository.getInstance(),
      QueueBullService.getInstance()
    ).execute(request)

    res.status(HttpStatus.CREATED).send({ message: "Purchase recorded" })
  } catch (e) {
    await StorageGCP.getInstance(process.env.BUCKET_FILES).deleteFile(
      request.invoice
    )
    domainResponse(e, res)
  }
}

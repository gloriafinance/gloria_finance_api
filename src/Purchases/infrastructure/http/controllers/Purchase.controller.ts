import {
  FilterPurchasesRequest,
  RecordPurchaseRequest,
} from "../../../domain/requests"
import { Response } from "express"
import domainResponse from "../../../../Shared/helpers/domainResponse"
import { RecordPurchase, SearchPurchase } from "../../../applications"
import { PurchaseMongoRepository } from "../../persistence/PurchaseMongoRepository"
import {
  AvailabilityAccountMongoRepository,
  FinancialConfigurationMongoRepository,
} from "@/Financial/infrastructure/persistence"
import { HttpStatus } from "@/Shared/domain"
import { StorageGCP } from "@/Shared/infrastructure"
import { FinancialMonthValidator } from "@/ConsolidatedFinancial/applications"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import PurchasePaginateDto from "../dto/PurchasePaginate.dto"
import { QueueService } from "@/Shared/infrastructure/queue/QueueService"

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
      QueueService.getInstance()
    ).execute(request)

    res.status(HttpStatus.CREATED).send({ message: "Purchase recorded" })
  } catch (e) {
    await StorageGCP.getInstance(process.env.BUCKET_FILES).deleteFile(
      request.invoice
    )
    domainResponse(e, res)
  }
}

export const listPurchasesController = async (
  request: FilterPurchasesRequest,
  res: Response
) => {
  try {
    const list = await new SearchPurchase(
      PurchaseMongoRepository.getInstance()
    ).execute(request)

    res.status(HttpStatus.OK).send(await PurchasePaginateDto(list))
  } catch (e) {
    return domainResponse(e, res)
  }
}

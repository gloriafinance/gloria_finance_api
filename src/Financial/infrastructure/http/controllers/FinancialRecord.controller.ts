import { GenericException, HttpStatus } from "../../../../Shared/domain"
import domainResponse from "../../../../Shared/helpers/domainResponse"
import {
  ConceptType,
  CostCenter,
  FinancialRecordRequest,
  TypeOperationMoney,
} from "../../../domain"
import { RegisterFinancialRecord } from "../../../applications/financeRecord/RegisterFinancialRecord"
import { QueueBullService, StorageGCP } from "../../../../Shared/infrastructure"
import { FinancialYearMongoRepository } from "../../../../ConsolidatedFinancial/infrastructure"
import {
  AvailabilityAccountMongoRepository,
  FinanceRecordMongoRepository,
  FinancialConceptMongoRepository,
  FinancialConfigurationMongoRepository,
} from "../../persistence"
import {
  DispatchUpdateAvailabilityAccountBalance,
  DispatchUpdateCostCenterMaster,
  FindAvailabilityAccountByAvailabilityAccountId,
  FindCostCenterByCostCenterId,
  FindFinancialConceptByChurchIdAndFinancialConceptId,
} from "../../../applications"
import { Response } from "express"

export const FinancialRecordController = async (
  request: FinancialRecordRequest,
  res: Response
) => {
  try {
    if (request.file) {
      request.voucher = await StorageGCP.getInstance(
        process.env.BUCKET_FILES
      ).uploadFile(request.file)
    }

    const availabilityAccount = await searchAvailabilityAccount(request)

    let costCenter: CostCenter = undefined

    const financialConcept = await searchFinancialConcept(request)

    if (
      financialConcept.getType() === ConceptType.DISCHARGE &&
      !request.costCenterId
    ) {
      res.status(HttpStatus.BAD_REQUEST).send({
        costCenterId: {
          message: "The costCenterId field is mandatory.",
          rule: "required",
        },
      })
      return
    }
    if (
      financialConcept.getType() === ConceptType.DISCHARGE &&
      request.costCenterId
    ) {
      costCenter = await new FindCostCenterByCostCenterId(
        FinancialConfigurationMongoRepository.getInstance()
      ).execute(request.churchId, request.costCenterId)
    }

    await new RegisterFinancialRecord(
      FinancialYearMongoRepository.getInstance(),
      FinanceRecordMongoRepository.getInstance(),
      FinancialConceptMongoRepository.getInstance(),
      AvailabilityAccountMongoRepository.getInstance()
    ).handle(request, financialConcept, costCenter)

    new DispatchUpdateAvailabilityAccountBalance(
      QueueBullService.getInstance()
    ).execute({
      availabilityAccount: availabilityAccount,
      amount: request.amount,
      concept: financialConcept.getName(),
      operationType:
        financialConcept.getType() === ConceptType.INCOME
          ? TypeOperationMoney.MONEY_IN
          : TypeOperationMoney.MONEY_OUT,
    })

    if (costCenter) {
      new DispatchUpdateCostCenterMaster(
        QueueBullService.getInstance()
      ).execute({
        churchId: request.churchId,
        amount: request.amount,
        costCenterId: costCenter.getCostCenterId(),
      })
    }

    res.status(HttpStatus.CREATED).send({
      message: "successful financial record registration",
    })
  } catch (e) {
    if (request.voucher) {
      await StorageGCP.getInstance(process.env.BUCKET_FILES).deleteFile(
        request.voucher
      )
    }

    return domainResponse(e, res)
  }
}

const searchAvailabilityAccount = async (request: FinancialRecordRequest) => {
  return await new FindAvailabilityAccountByAvailabilityAccountId(
    AvailabilityAccountMongoRepository.getInstance()
  ).execute(request.availabilityAccountId)
}

const searchFinancialConcept = async (request: FinancialRecordRequest) => {
  const financialConcept =
    await new FindFinancialConceptByChurchIdAndFinancialConceptId(
      FinancialConceptMongoRepository.getInstance()
    ).execute(request.churchId, request.financialConceptId)

  if (
    financialConcept.getType() === ConceptType.DISCHARGE &&
    request.costCenterId === undefined
  ) {
    throw new GenericException("The cost center field is mandatory.")
  }

  return financialConcept
}

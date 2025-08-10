import { GenericException, HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  AccountType,
  ConceptType,
  CostCenter,
  FinancialConcept,
  FinancialRecordRequest,
  TypeOperationMoney,
} from "../../../domain"
import {
  CancelFinancialRecord,
  DispatchUpdateAvailabilityAccountBalance,
  DispatchUpdateCostCenterMaster,
  FindAvailabilityAccountByAvailabilityAccountId,
  FindCostCenterByCostCenterId,
  FindFinancialConceptByChurchIdAndFinancialConceptId,
  RegisterFinancialRecord,
} from "@/Financial/applications"
import { QueueService, StorageGCP } from "@/Shared/infrastructure"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import {
  AvailabilityAccountMongoRepository,
  FinanceRecordMongoRepository,
  FinancialConceptMongoRepository,
  FinancialConfigurationMongoRepository,
} from "../../persistence"
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

    const financialConcept = await searchFinancialConcept(request)

    const availabilityAccount = await searchAvailabilityAccount(
      request,
      financialConcept
    )

    let costCenter: CostCenter = undefined

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
      QueueService.getInstance()
    ).execute({
      availabilityAccount: availabilityAccount,
      amount: request.amount,
      concept: financialConcept.getName(),
      operationType:
        financialConcept.getType() === ConceptType.INCOME
          ? TypeOperationMoney.MONEY_IN
          : TypeOperationMoney.MONEY_OUT,
      createdAt: request.date,
    })

    if (costCenter) {
      new DispatchUpdateCostCenterMaster(QueueService.getInstance()).execute({
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

const searchAvailabilityAccount = async (
  request: FinancialRecordRequest,
  financialConcept: FinancialConcept
) => {
  const account = await new FindAvailabilityAccountByAvailabilityAccountId(
    AvailabilityAccountMongoRepository.getInstance()
  ).execute(request.availabilityAccountId)

  if (account.getType() === AccountType.INVESTMENT) {
    throw new GenericException(
      `Selected availability account does not allow this ${financialConcept.getName()}`
    )
  }

  return account
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

export const CancelFinancialRecordController = async (
  req: { financialRecordId: string; churchId: string },
  res: Response
) => {
  try {
    await new CancelFinancialRecord(
      FinancialYearMongoRepository.getInstance(),
      FinanceRecordMongoRepository.getInstance(),
      AvailabilityAccountMongoRepository.getInstance(),
      QueueService.getInstance()
    ).execute(req)

    res.status(HttpStatus.OK).send({
      message: "successful financial record cancellation",
    })
  } catch (e) {
    domainResponse(e, res)
  }
}

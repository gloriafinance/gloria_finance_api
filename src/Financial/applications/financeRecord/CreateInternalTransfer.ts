import type { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain"
import { FinancialMonthValidator } from "@/ConsolidatedFinancial/applications"
import type { IChurchRepository } from "@/Church/domain"
import { FindAvailabilityAccountByAvailabilityAccountId } from "@/FinanceConfig/applications"
import {
  FinanceRecord,
  FinancialConcept,
  FinancialRecordSource,
  FinancialRecordStatus,
  FinancialRecordType,
  INTERNAL_TRANSFER_CONCEPT_TAG,
  INTERNAL_TRANSFER_REFERENCE_DESTINATION,
  INTERNAL_TRANSFER_REFERENCE_SOURCE,
  type InternalTransferRequest,
  TypeOperationMoney,
} from "@/Financial/domain"
import type {
  IAvailabilityAccountRepository,
  IFinancialConceptRepository,
  IFinancialRecordRepository,
} from "@/Financial/domain/interfaces"
import { DispatchUpdateAvailabilityAccountBalance } from "@/Financial/applications"
import { DatabaseTransaction, IdentifyEntity, Logger } from "@/Shared/adapter"
import { GenericException } from "@/Shared/domain"
import type { IQueueService } from "@/package/queue/domain"

export class CreateInternalTransfer {
  private logger = Logger(CreateInternalTransfer.name)

  constructor(
    private readonly financialYearRepository: IFinancialYearRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly financialConceptRepository: IFinancialConceptRepository,
    private readonly churchRepository: IChurchRepository,
    private readonly queueService: IQueueService
  ) {}

  async execute(params: InternalTransferRequest): Promise<{
    transferId: string
    sourceFinancialRecordId: string
    destinationFinancialRecordId: string
  }> {
    this.logger.info("Create internal transfer", params)

    if (!Number.isFinite(params.amount) || Number(params.amount) <= 0) {
      throw new GenericException("Invalid amount for internal transfer")
    }

    if (params.fromAvailabilityAccountId === params.toAvailabilityAccountId) {
      throw new GenericException(
        "Source and destination accounts must be different"
      )
    }

    const transferDate = new Date(params.date)
    if (Number.isNaN(transferDate.getTime())) {
      throw new GenericException("Invalid transfer date")
    }

    await new FinancialMonthValidator(this.financialYearRepository).validate({
      churchId: params.churchId,
      month: transferDate.getUTCMonth() + 1,
      year: transferDate.getUTCFullYear(),
    })

    const [sourceAccount, destinationAccount] = await Promise.all([
      new FindAvailabilityAccountByAvailabilityAccountId(
        this.availabilityAccountRepository
      ).execute(params.fromAvailabilityAccountId, params.churchId),
      new FindAvailabilityAccountByAvailabilityAccountId(
        this.availabilityAccountRepository
      ).execute(params.toAvailabilityAccountId, params.churchId),
    ])

    if (sourceAccount.getSymbol() !== destinationAccount.getSymbol()) {
      throw new GenericException(
        "Internal transfer supports only accounts with the same currency"
      )
    }

    const transferConcept = await this.ensureTransferConcept(params.churchId)
    const transferId = IdentifyEntity.get("internalTransfer")
    const amount = Math.abs(Number(params.amount))
    const customDescription = params.description?.trim()
    const sourceDescription =
      customDescription ||
      `Internal transfer to ${destinationAccount.getAccountName()}`
    const destinationDescription =
      customDescription ||
      `Internal transfer from ${sourceAccount.getAccountName()}`

    const sourceRecord = FinanceRecord.create({
      churchId: params.churchId,
      amount,
      date: transferDate,
      availabilityAccount: sourceAccount,
      description: sourceDescription,
      type: FinancialRecordType.OUTGO,
      status: FinancialRecordStatus.CLEARED,
      source: FinancialRecordSource.MANUAL,
      createdBy: params.createdBy,
      financialConcept: transferConcept,
      reference: {
        type: INTERNAL_TRANSFER_REFERENCE_SOURCE,
        entityId: transferId,
      },
    })

    const destinationRecord = FinanceRecord.create({
      churchId: params.churchId,
      amount,
      date: transferDate,
      availabilityAccount: destinationAccount,
      description: destinationDescription,
      type: FinancialRecordType.INCOME,
      status: FinancialRecordStatus.CLEARED,
      source: FinancialRecordSource.MANUAL,
      createdBy: params.createdBy,
      financialConcept: transferConcept,
      reference: {
        type: INTERNAL_TRANSFER_REFERENCE_DESTINATION,
        entityId: transferId,
      },
    })

    try {
      const response = await DatabaseTransaction.run(async (transaction) => {
        await this.financialRecordRepository.upsert(sourceRecord, transaction)
        await this.financialRecordRepository.upsert(
          destinationRecord,
          transaction
        )

        return {
          transferId,
          sourceFinancialRecordId: sourceRecord.getFinancialRecordId(),
          destinationFinancialRecordId:
            destinationRecord.getFinancialRecordId(),
        }
      })

      new DispatchUpdateAvailabilityAccountBalance(this.queueService).execute({
        availabilityAccount: sourceAccount,
        amount,
        concept: transferConcept.getName(),
        operationType: TypeOperationMoney.MONEY_OUT,
        createdAt: transferDate,
      })

      new DispatchUpdateAvailabilityAccountBalance(this.queueService).execute({
        availabilityAccount: destinationAccount,
        amount,
        concept: transferConcept.getName(),
        operationType: TypeOperationMoney.MONEY_IN,
        createdAt: transferDate,
      })

      return response
    } catch (error) {
      throw error
    }
  }

  private async ensureTransferConcept(
    churchId: string
  ): Promise<FinancialConcept> {
    const byTag = await this.financialConceptRepository.one({
      churchId,
      tag: INTERNAL_TRANSFER_CONCEPT_TAG,
    })

    if (!byTag) {
      throw new GenericException(
        "Internal transfer concept is not created, contact the system administrator"
      )
    }

    return byTag
  }
}

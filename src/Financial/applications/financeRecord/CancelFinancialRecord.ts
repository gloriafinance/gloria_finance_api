import { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain"
import {
  AvailabilityAccount,
  CreateFinanceRecord,
  FinanceRecord,
  FinancialMovementNotFound,
  FinancialRecordSource,
  FinancialRecordStatus,
  FinancialRecordType,
  TypeOperationMoney,
} from "@/Financial/domain"
import { Logger } from "@/Shared/adapter"
import { DateBR } from "@/Shared/helpers"
import {
  IAvailabilityAccountRepository,
  IFinancialRecordRepository,
} from "@/Financial/domain/interfaces"
import { IQueueService } from "@/Shared/domain"
import {
  DispatchUpdateAvailabilityAccountBalance,
  DispatchUpdateCostCenterMaster,
  DispatchUpdateStatusFinancialRecord,
} from "@/Financial/applications"
import { FinancialMonthValidator } from "@/ConsolidatedFinancial/applications"

/**
 * Este caso de uso se encarga de anular un registro financiero.
 * Si el registro es de tipo DESCARGO, se procede a revertirlo.
 */
export class CancelFinancialRecord {
  private logger = Logger(CancelFinancialRecord.name)

  constructor(
    private readonly financialYearRepository: IFinancialYearRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly queueService: IQueueService
  ) {}

  async execute(params: {
    financialRecordId: string
    churchId: string
    createdBy: string
  }) {
    this.logger.info(`Execute financial recordId:`, params)

    const { financialRecordId, churchId, createdBy } = params

    const financialRecord = await this.financialRecordRepository.one({
      financialRecordId,
      churchId,
    })

    if (!financialRecord) {
      this.logger.error(`Movement not found`, params)
      throw new FinancialMovementNotFound()
    }

    const date = financialRecord.getDate()

    await new FinancialMonthValidator(this.financialYearRepository).validate({
      churchId: financialRecord.getChurchId(),
      month: date.getUTCMonth() + 1,
      year: date.getFullYear(),
    })

    if (financialRecord.getType() === FinancialRecordType.OUTGO) {
      await this.cancelOutgoRecord(financialRecord, createdBy)
    }
  }

  private async cancelOutgoRecord(
    financialRecord: FinanceRecord,
    createdBy: string
  ) {
    const availabilityAccount = await this.availabilityAccountRepository.one({
      availabilityAccountId: financialRecord.getAvailabilityAccountId(),
    })

    await this.financeRecordReversal({
      availabilityAccount,
      financeRecordReversal: {
        churchId: financialRecord.getChurchId(),
        amount: financialRecord.getAmount(),
        date: new Date(DateBR().toISOString().split("T")[0]),
        availabilityAccount,
        description:
          "Reversão do movimento " + financialRecord.getFinancialRecordId(),
        type: FinancialRecordType.REVERSAL,
        status: FinancialRecordStatus.VOID,
        source: FinancialRecordSource.MANUAL,
        createdBy,
      },
      operation: TypeOperationMoney.MONEY_IN,
    })

    new DispatchUpdateCostCenterMaster(this.queueService).execute({
      costCenterId: financialRecord.getCostCenterId(),
      amount: financialRecord.getAmount(),
      churchId: financialRecord.getChurchId(),
      operation: "subtract",
    })

    new DispatchUpdateStatusFinancialRecord(this.queueService).execute({
      financialRecord: {
        ...financialRecord.toPrimitives(),
        id: financialRecord.getId(),
      },
      status: FinancialRecordStatus.VOID,
    })
  }

  private async financeRecordReversal(params: {
    availabilityAccount: AvailabilityAccount
    financeRecordReversal: CreateFinanceRecord
    operation: TypeOperationMoney
  }) {
    this.logger.info(`Reversing financial record`, params)
    const { availabilityAccount, financeRecordReversal, operation } = params

    await this.financialRecordRepository.upsert(
      FinanceRecord.create(financeRecordReversal)
    )

    new DispatchUpdateAvailabilityAccountBalance(this.queueService).execute({
      availabilityAccount: availabilityAccount,
      amount: Math.abs(financeRecordReversal.amount),
      concept: financeRecordReversal.description,
      operationType: operation,
      createdAt: financeRecordReversal.date,
    })

    this.logger.info(`Financial record reversed successfully`)
  }
}

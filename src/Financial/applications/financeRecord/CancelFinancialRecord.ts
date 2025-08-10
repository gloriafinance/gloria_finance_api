import { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain"
import {
  AvailabilityAccount,
  ConceptType,
  CreateFinanceRecord,
  FinanceRecord,
  FinancialMovementNotFound,
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

  async execute(params: { financialRecordId: string; churchId: string }) {
    this.logger.info(`Execute financial recordId:`, params)

    const { financialRecordId, churchId } = params

    const movement = await this.financialRecordRepository.one({
      financialRecordId,
      churchId,
    })

    if (!movement) {
      this.logger.error(`Movement not found`, params)
      throw new FinancialMovementNotFound()
    }

    await new FinancialMonthValidator(this.financialYearRepository).validate({
      churchId: movement.getChurchId(),
      month: movement.getDate().getMonth() + 1,
      year: movement.getDate().getFullYear(),
    })

    if (movement.getType() === ConceptType.DISCHARGE) {
      await this.cancelOutgoRecord(movement)
    }
  }

  private async cancelOutgoRecord(movement: FinanceRecord) {
    const availabilityAccount = await this.availabilityAccountRepository.one({
      availabilityAccountId: movement.getAvailabilityAccountId(),
    })

    await this.financeRecordReversal({
      availabilityAccount,
      financeRecordReversal: {
        churchId: movement.getChurchId(),
        amount: movement.getAmount(),
        date: DateBR(),
        availabilityAccount,
        description: "Reversão do movimento " + movement.getFinancialRecordId(),
        type: ConceptType.REVERSAL,
      },
      operation: TypeOperationMoney.MONEY_IN,
    })

    new DispatchUpdateCostCenterMaster(this.queueService).execute({
      costCenterId: movement.getCostCenterId(),
      amount: movement.getAmount(),
      churchId: movement.getChurchId(),
      operation: "subtract",
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
      amount: financeRecordReversal.amount,
      concept: financeRecordReversal.description,
      operationType: operation,
      createdAt: financeRecordReversal.date,
    })

    this.logger.info(`Financial record reversed successfully`)
  }
}

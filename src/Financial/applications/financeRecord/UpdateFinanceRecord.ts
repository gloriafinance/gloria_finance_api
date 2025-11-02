import { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain"
import { IFinancialRecordRepository } from "@/Financial/domain/interfaces"
import { IQueue } from "@/Shared/domain"
import { Logger } from "@/Shared/adapter"
import {
  FinanceRecord,
  UpdateStatusFinancialRecordQueue,
} from "@/Financial/domain"
import { FinancialMonthValidator } from "@/ConsolidatedFinancial/applications"

export class UpdateStatusFinancialRecord implements IQueue {
  private logger = Logger(UpdateStatusFinancialRecord.name)
  constructor(
    private readonly financialYearRepository: IFinancialYearRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository
  ) {}

  async handle(args: UpdateStatusFinancialRecordQueue): Promise<void> {
    this.logger.info(`UpdateFinancialRecord handle:`, args)

    const financialRecord = FinanceRecord.fromPrimitives(args.financialRecord)

    await new FinancialMonthValidator(this.financialYearRepository).validate({
      churchId: financialRecord.getChurchId(),
      month: financialRecord.getDate().getMonth() + 1,
      year: financialRecord.getDate().getFullYear(),
    })

    financialRecord.setStatus(args.status)

    financialRecord.update()

    await this.financialRecordRepository.upsert(financialRecord)
  }
}

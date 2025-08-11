import {
  ActionsFinancialMonth,
  IFinancialYearRepository,
  UpdateFinancialMonthRequest,
} from "../domain"
import { FinancialMontNotFound } from "../domain/exceptions"
import { Logger } from "@/Shared/adapter"

/**
 * Este caso de uso se encarga de cerrar o abrir un mes financiero.
 */
export class UpdateFinancialMonth {
  private logger = Logger(UpdateFinancialMonth.name)

  constructor(
    private readonly financialYearRepository: IFinancialYearRepository
  ) {}

  async execute(args: UpdateFinancialMonthRequest): Promise<void> {
    this.logger.info(`Closing financial month:`, args)

    const financialMonth = await this.financialYearRepository.one({
      month: args.month,
      year: args.year,
      churchId: args.churchId,
    })

    if (!financialMonth) {
      this.logger.info(`Financial month not found`)
      throw new FinancialMontNotFound()
    }

    if (args.action === ActionsFinancialMonth.CLOSE) {
      financialMonth.close()
    } else {
      financialMonth.open()
    }

    await this.financialYearRepository.upsert(financialMonth)
  }
}

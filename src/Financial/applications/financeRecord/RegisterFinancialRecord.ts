import { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain"
import { IQueue } from "@/Shared/domain"
import { FinanceRecord } from "@/Financial/domain"
import { FinancialMonthValidator } from "@/ConsolidatedFinancial/applications"
import {
  IAvailabilityAccountRepository,
  IFinancialConceptRepository,
  IFinancialRecordRepository,
} from "../../domain/interfaces"
import {
  AvailabilityAccountNotFound,
  CostCenter,
  FinancialConcept,
  FinancialRecordQueueRequest,
} from "../../domain"
import { FindFinancialConceptByChurchIdAndFinancialConceptId } from "@/Financial/applications"
import { Logger } from "@/Shared/adapter"

export class RegisterFinancialRecord implements IQueue {
  private logger = Logger(RegisterFinancialRecord.name)

  constructor(
    private readonly financialYearRepository: IFinancialYearRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly financialConceptRepository: IFinancialConceptRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository
  ) {}

  async handle(
    args: FinancialRecordQueueRequest,
    financialConcept?: FinancialConcept,
    costCenter?: CostCenter
  ): Promise<FinanceRecord> {
    this.logger.info(`Record financial movement`, args)

    await new FinancialMonthValidator(this.financialYearRepository).validate({
      churchId: args.churchId,
    })

    const availabilityAccount = await this.availabilityAccountRepository.one({
      availabilityAccountId: args.availabilityAccountId,
    })

    if (!availabilityAccount) {
      this.logger.debug(`Availability account not found`)
      throw new AvailabilityAccountNotFound()
    }

    if (!financialConcept) {
      this.logger.info(
        `Searching financial concept by churchId: ${args.churchId} and financialConceptId: ${args.financialConceptId}`
      )
      financialConcept =
        await new FindFinancialConceptByChurchIdAndFinancialConceptId(
          this.financialConceptRepository
        ).execute(args.churchId, args.financialConceptId)
    }

    const financialRecord = FinanceRecord.create({
      financialConcept: financialConcept,
      churchId: args.churchId,
      amount: args.amount,
      date: new Date(args.date),
      availabilityAccount,
      description: args.description,
      voucher: args.voucher,
      costCenter,
      type: financialConcept.getType(),
    })

    await this.financialRecordRepository.upsert(financialRecord)

    this.logger.info(`Financial transaction record completed`)

    return financialRecord
  }
}

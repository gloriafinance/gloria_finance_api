import { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain"
import { IQueue } from "@/Shared/domain"
import { FinanceRecord } from "../../domain/FinanceRecord"
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

export class RegisterFinancialRecord implements IQueue<FinanceRecord> {
  private logger = Logger("RegisterFinancialRecord")

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
    this.logger.info(`RegisterFinancialRecord`, args)

    await new FinancialMonthValidator(this.financialYearRepository).validate(
      args.churchId
    )

    const availabilityAccount =
      await this.availabilityAccountRepository.findAvailabilityAccountByAvailabilityAccountId(
        args.availabilityAccountId
      )

    if (!availabilityAccount) {
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
      financialConcept: FinancialConcept.fromPrimitives(financialConcept),
      churchId: args.churchId,
      amount: args.amount,
      date: new Date(args.date),
      availabilityAccount,
      description: args.description,
      voucher: args.voucher,
      costCenter,
    })

    await this.financialRecordRepository.upsert(financialRecord)

    this.logger.info(`RegisterFinancialRecord finish`)

    return financialRecord
  }
}

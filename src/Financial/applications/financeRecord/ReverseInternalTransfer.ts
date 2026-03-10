import type { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain"
import { FinancialMonthValidator } from "@/ConsolidatedFinancial/applications"
import {
  FinancialRecordStatus,
  FinancialRecordType,
  INTERNAL_TRANSFER_REFERENCE_DESTINATION,
  INTERNAL_TRANSFER_REFERENCE_SOURCE,
} from "@/Financial/domain"
import type {
  IAvailabilityAccountRepository,
  IFinancialRecordRepository,
} from "@/Financial/domain/interfaces"
import { Logger } from "@/Shared/adapter"
import { GenericException } from "@/Shared/domain"
import type { IQueueService } from "@/package/queue/domain"
import {
  Criteria,
  Filters,
  Operator,
  Order,
  OrderTypes,
} from "@abejarano/ts-mongodb-criteria"
import { CancelFinancialRecord } from "./CancelFinancialRecord"

export class ReverseInternalTransfer {
  private logger = Logger(ReverseInternalTransfer.name)

  constructor(
    private readonly financialYearRepository: IFinancialYearRepository,
    private readonly financialRecordRepository: IFinancialRecordRepository,
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly queueService: IQueueService
  ) {}

  async execute(params: {
    churchId: string
    transferId: string
    createdBy: string
  }): Promise<void> {
    const records = await this.fetchTransferRecords(
      params.churchId,
      params.transferId
    )

    const sourceRecord = records.find(
      (record) => record.reference?.type === INTERNAL_TRANSFER_REFERENCE_SOURCE
    )
    const destinationRecord = records.find(
      (record) =>
        record.reference?.type === INTERNAL_TRANSFER_REFERENCE_DESTINATION
    )

    if (!sourceRecord || !destinationRecord) {
      throw new GenericException("Internal transfer records were not found")
    }

    if (
      sourceRecord.status === FinancialRecordStatus.VOID ||
      destinationRecord.status === FinancialRecordStatus.VOID
    ) {
      throw new GenericException("Internal transfer was already reversed")
    }

    this.validateCancelableRecordType(sourceRecord)
    this.validateCancelableRecordType(destinationRecord)

    const transferDate = new Date(sourceRecord.date)
    await new FinancialMonthValidator(this.financialYearRepository).validate({
      churchId: sourceRecord.churchId,
      month: transferDate.getUTCMonth() + 1,
      year: transferDate.getUTCFullYear(),
    })

    const cancelFinancialRecord = new CancelFinancialRecord(
      this.financialYearRepository,
      this.financialRecordRepository,
      this.availabilityAccountRepository,
      this.queueService
    )

    await cancelFinancialRecord.execute({
      churchId: params.churchId,
      financialRecordId: sourceRecord.financialRecordId,
      createdBy: params.createdBy,
    })

    await cancelFinancialRecord.execute({
      churchId: params.churchId,
      financialRecordId: destinationRecord.financialRecordId,
      createdBy: params.createdBy,
    })

    this.logger.info("Internal transfer reversed", params)
  }

  private async fetchTransferRecords(
    churchId: string,
    transferId: string
  ): Promise<any[]> {
    const filters = Filters.fromValues([
      new Map([
        ["field", "churchId"],
        ["operator", Operator.EQUAL],
        ["value", churchId],
      ]),
      new Map([
        ["field", "reference.entityId"],
        ["operator", Operator.EQUAL],
        ["value", transferId],
      ]),
      new Map([
        ["field", "reference.type"],
        ["operator", Operator.IN],
        [
          "value",
          [
            INTERNAL_TRANSFER_REFERENCE_SOURCE,
            INTERNAL_TRANSFER_REFERENCE_DESTINATION,
          ],
        ],
      ]),
    ])

    const paginated = await this.financialRecordRepository.list(
      new Criteria(filters, Order.fromValues("date", OrderTypes.DESC), 20, 1)
    )

    if (!paginated.results.length) {
      throw new GenericException("Internal transfer not found")
    }

    return paginated.results
  }

  private validateCancelableRecordType(record: any): void {
    const type = record.type
    if (
      type !== FinancialRecordType.INCOME &&
      type !== FinancialRecordType.OUTGO
    ) {
      throw new GenericException(
        `Cannot reverse transfer for financial record type ${type}`
      )
    }
  }
}

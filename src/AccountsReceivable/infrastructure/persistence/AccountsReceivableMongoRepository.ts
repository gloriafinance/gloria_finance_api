import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import {
  AccountReceivable,
  AccountReceivableType,
  AccountsReceivableStatus,
  IAccountsReceivableRepository,
} from "../../domain"
import { Collection } from "mongodb"
import { InstallmentsStatus } from "@/Shared/domain"

export class AccountsReceivableMongoRepository
  extends MongoRepository<AccountReceivable>
  implements IAccountsReceivableRepository
{
  private static instance: AccountsReceivableMongoRepository

  private constructor() {
    super(AccountReceivable)
  }

  public static getInstance(): AccountsReceivableMongoRepository {
    if (AccountsReceivableMongoRepository.instance) {
      return AccountsReceivableMongoRepository.instance
    }
    AccountsReceivableMongoRepository.instance =
      new AccountsReceivableMongoRepository()
    return AccountsReceivableMongoRepository.instance
  }

  collectionName(): string {
    return "accounts_receivable"
  }

  async countByDebtorAndStatus(params: {
    churchId: string
    debtorDni: string
    statuses?: AccountsReceivableStatus[]
    types?: AccountReceivableType[]
  }): Promise<number> {
    const { churchId, debtorDni, statuses, types } = params
    const collection = await this.collection()

    const filter: Record<string, unknown> = {
      churchId,
      "debtor.debtorDNI": debtorDni,
    }

    if (statuses?.length) {
      filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses }
    }

    if (types?.length) {
      filter.type = types.length === 1 ? types[0] : { $in: types }
    }

    return collection.countDocuments(filter)
  }

  async sumPaidInstallmentsByDebtorAndDateRanges(params: {
    churchId: string
    debtorDni: string
    types?: AccountReceivableType[]
    yearRange: { start: Date; end: Date }
    monthRange: { start: Date; end: Date }
  }): Promise<{ contributedYear: number; contributedMonth: number }> {
    const { churchId, debtorDni, types, yearRange, monthRange } = params
    const collection = await this.collection()

    const matchFilter: Record<string, unknown> = {
      churchId,
      "debtor.debtorDNI": debtorDni,
    }

    if (types?.length) {
      matchFilter.type = types.length === 1 ? types[0] : { $in: types }
    }

    const result = await collection
      .aggregate([
        { $match: matchFilter },
        { $unwind: "$installments" },
        {
          $match: {
            "installments.status": {
              $in: [InstallmentsStatus.PAID, InstallmentsStatus.PARTIAL],
            },
          },
        },
        {
          $addFields: {
            _paymentDate: {
              $ifNull: [
                {
                  $convert: {
                    input: "$installments.paymentDate",
                    to: "date",
                    onError: null,
                    onNull: null,
                  },
                },
                {
                  $convert: {
                    input: "$installments.dueDate",
                    to: "date",
                    onError: null,
                    onNull: null,
                  },
                },
              ],
            },
            _amountValue: {
              $ifNull: ["$installments.amountPaid", "$installments.amount"],
            },
          },
        },
        {
          $group: {
            _id: null,
            contributedYear: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$_paymentDate", yearRange.start] },
                      { $lte: ["$_paymentDate", yearRange.end] },
                    ],
                  },
                  "$_amountValue",
                  0,
                ],
              },
            },
            contributedMonth: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$_paymentDate", monthRange.start] },
                      { $lte: ["$_paymentDate", monthRange.end] },
                    ],
                  },
                  "$_amountValue",
                  0,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            contributedYear: 1,
            contributedMonth: 1,
          },
        },
      ])
      .toArray()

    if (!result?.length) {
      return { contributedYear: 0, contributedMonth: 0 }
    }

    return {
      contributedYear: Number(result[0]!.contributedYear ?? 0),
      contributedMonth: Number(result[0]!.contributedMonth ?? 0),
    }
  }

  protected async ensureIndexes(collection: Collection): Promise<void> {
    await collection.createIndex({ accountReceivableId: 1 }, { unique: true })
    await collection.createIndex(
      {
        churchId: 1,
        "debtor.debtorDNI": 1,
        status: 1,
        type: 1,
      },
      { background: true, name: "idx_receivable_debtor_status" }
    )
    await collection.createIndex(
      {
        churchId: 1,
        "debtor.debtorDNI": 1,
        type: 1,
        "installments.status": 1,
        "installments.paymentDate": 1,
      },
      { background: true, name: "idx_receivable_installment_paid_date" }
    )
  }
}

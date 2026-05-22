import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import {
  AccountPayable,
  type AccountPayablesDashboardType,
  type IAccountPayableRepository,
} from "@/AccountsPayable/domain"
import { Collection } from "mongodb"

export class AccountsPayableMongoRepository
  extends MongoRepository<AccountPayable>
  implements IAccountPayableRepository
{
  private static instance: AccountsPayableMongoRepository

  private constructor() {
    super(AccountPayable)
  }

  public static getInstance(): AccountsPayableMongoRepository {
    if (AccountsPayableMongoRepository.instance) {
      return AccountsPayableMongoRepository.instance
    }
    AccountsPayableMongoRepository.instance =
      new AccountsPayableMongoRepository()
    return AccountsPayableMongoRepository.instance
  }

  collectionName(): string {
    return "accounts_payable"
  }

  async dashboardAccountPayable(
    churchId: string
  ): Promise<AccountPayablesDashboardType | null> {
    const collection = await this.collection()

    const aggregationPipeline = [
      {
        $match: { churchId, status: { $in: ["PENDING", "PARTIAL"] } },
      },
      {
        $addFields: {
          overdueInstallment: {
            $arrayElemAt: [
              {
                $sortArray: {
                  input: {
                    $filter: {
                      input: "$installments",
                      as: "installment",
                      cond: {
                        $and: [
                          {
                            $lte: ["$$installment.dueDate", "$$NOW"],
                          },
                          {
                            $ne: ["$$installment.status", "PAID"],
                          },
                        ],
                      },
                    },
                  },
                  sortBy: {
                    dueDate: 1,
                  },
                },
              },
              0,
            ],
          },

          nextPendingInstallment: {
            $arrayElemAt: [
              {
                $sortArray: {
                  input: {
                    $filter: {
                      input: "$installments",
                      as: "installment",
                      cond: {
                        $and: [
                          {
                            $gt: ["$$installment.dueDate", "$$NOW"],
                          },
                          {
                            $ne: ["$$installment.status", "PAID"],
                          },
                        ],
                      },
                    },
                  },
                  sortBy: {
                    dueDate: 1,
                  },
                },
              },
              0,
            ],
          },

          lastPaidInstallment: {
            $arrayElemAt: [
              {
                $sortArray: {
                  input: {
                    $filter: {
                      input: "$installments",
                      as: "installment",
                      cond: {
                        $eq: ["$$installment.status", "PAID"],
                      },
                    },
                  },
                  sortBy: {
                    dueDate: -1,
                  },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $addFields: {
          selectedInstallment: {
            $ifNull: [
              "$overdueInstallment",
              {
                $ifNull: ["$nextPendingInstallment", "$lastPaidInstallment"],
              },
            ],
          },
          paymentSituation: {
            $cond: {
              if: {
                $ne: ["$overdueInstallment", null],
              },
              then: "OVERDUE",
              else: "UP_TO_DATE",
            },
          },
        },
      },
      {
        $facet: {
          accountPayables: [
            {
              $sort: {
                "selectedInstallment.dueDate": 1,
              },
            },
            {
              $group: {
                _id: "$accountPayableId",
                installmentAmount: {
                  $first: "$selectedInstallment.amount",
                },
                total: {
                  $sum: {
                    $abs: "$amountPending",
                  },
                },
                nextPaymentDate: {
                  $first: "$selectedInstallment.dueDate",
                },
                status: {
                  $first: "$selectedInstallment.status",
                },
                paymentSituation: {
                  $first: "$paymentSituation",
                },
              },
            },
            {
              $project: {
                _id: 0,
                accountPayableId: "$_id",
                installmentAmount: 1,
                total: 1,
                nextPaymentDate: 1,
                status: 1,
                paymentSituation: 1,
              },
            },
          ],
          summary: [
            {
              $group: {
                _id: null,
                total: {
                  $sum: {
                    $abs: "$amountPending",
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                total: 1,
              },
            },
          ],
        },
      },
      {
        $project: {
          accountPayables: 1,
          total: {
            $ifNull: [
              {
                $arrayElemAt: ["$summary.total", 0],
              },
              0,
            ],
          },
        },
      },
    ]

    return await collection
      .aggregate<AccountPayablesDashboardType>(aggregationPipeline)
      .next()
  }

  protected async ensureIndexes(collection: Collection): Promise<void> {
    await collection.createIndex({
      status: 1,
      createdAt: -1,
    })
    await collection.createIndex(
      {
        churchId: 1,
        accountPayableId: 1,
      },
      {
        name: "idx_account_payables_church_accountPayable",
      }
    )
    await collection.createIndex(
      {
        churchId: 1,
        status: 1,
      },
      {
        name: "idx_account_payables_church_status",
      }
    )
  }
}

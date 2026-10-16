import { FinancialMonth, type IFinancialYearRepository } from "../../domain"
import {
  MongoRepository,
  MongoTransaction,
} from "@abejarano/ts-mongodb-criteria"
import { Collection } from "mongodb"
import { DateBR } from "@/Shared/helpers"

export class FinancialYearMongoRepository
  extends MongoRepository<FinancialMonth>
  implements IFinancialYearRepository
{
  private static instance: FinancialYearMongoRepository

  constructor() {
    super(FinancialMonth)
  }

  static getInstance(): FinancialYearMongoRepository {
    if (FinancialYearMongoRepository.instance) {
      return FinancialYearMongoRepository.instance
    }
    FinancialYearMongoRepository.instance = new FinancialYearMongoRepository()
    return FinancialYearMongoRepository.instance
  }

  protected async ensureIndexes(collection: Collection): Promise<void> {
    await collection.createIndex({
      month: 1,
      year: 1,
      churchId: 1,
    })
  }

  async markReservation(
    input: { churchId: string; month: number; year: number },
    transaction?: MongoTransaction
  ): Promise<boolean> {
    const collection = await this.collection()
    const result = await collection.updateOne(
      {
        churchId: input.churchId,
        month: input.month,
        year: input.year,
        closed: false,
        closing: { $ne: true },
      },
      { $inc: { reservationSeq: 1 } },
      { session: MongoTransaction.sessionFor(transaction) }
    )
    return result.modifiedCount === 1
  }

  async claimClosing(input: {
    churchId: string
    month: number
    year: number
  }): Promise<number | null> {
    const collection = await this.collection()
    const result = await collection.findOneAndUpdate(
      {
        churchId: input.churchId,
        month: input.month,
        year: input.year,
        closed: false,
        closing: { $ne: true },
      },
      { $set: { closing: true } },
      { returnDocument: "after" }
    )
    // The sequence travels with the claim so the close can prove nothing was
    // reserved for this month while it counted.
    return result === null ? null : Number(result.reservationSeq ?? 0)
  }

  async finishClosing(input: {
    churchId: string
    month: number
    year: number
    closedBy: string
    expectedReservationSeq: number
  }): Promise<boolean> {
    const collection = await this.collection()
    const result = await collection.updateOne(
      {
        churchId: input.churchId,
        month: input.month,
        year: input.year,
        closing: true,
        reservationSeq: input.expectedReservationSeq,
      },
      {
        $set: {
          closed: true,
          closing: false,
          closedAt: DateBR(),
          closedBy: input.closedBy,
        },
      }
    )
    return result.modifiedCount === 1
  }

  async releaseClosing(input: {
    churchId: string
    month: number
    year: number
  }): Promise<void> {
    const collection = await this.collection()
    await collection.updateOne(
      {
        churchId: input.churchId,
        month: input.month,
        year: input.year,
        closing: true,
      },
      { $set: { closing: false } }
    )
  }
}

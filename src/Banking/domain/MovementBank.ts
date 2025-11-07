import { IdentifyEntity } from "@/Shared/adapter"
import { Bank } from "@/Banking/domain"
import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import {
  OperationImpactType,
  TypeBankingOperation,
} from "./enums/TypeBankingOperation.enum"
import { DateBR } from "@/Shared/helpers"

export class MovementBank extends AggregateRoot {
  private id?: string
  private movementBankId: string
  private amount: number
  private impact: OperationImpactType
  private operationType: TypeBankingOperation
  private concept: string
  private bankId: string
  private churchId: string
  private createdAt: Date

  static create(
    amount: number,
    operationType: TypeBankingOperation,
    concept: string,
    bank: Bank,
    createdAt?: Date
  ): MovementBank {
    const movementBank: MovementBank = new MovementBank()
    movementBank.amount = Number(amount)
    movementBank.impact = OperationImpact[operationType]
    movementBank.operationType = operationType
    movementBank.concept = concept
    movementBank.movementBankId = IdentifyEntity.get(`movementBank`)
    movementBank.bankId = bank.getBankId()
    movementBank.churchId = bank.getChurchId()
    movementBank.createdAt = createdAt || DateBR()

    return movementBank
  }

  static fromPrimitives(plainData: any): MovementBank {
    const movementBank: MovementBank = new MovementBank()
    movementBank.amount = plainData.amount
    movementBank.impact = plainData.impact
    movementBank.operationType = plainData.operationType
    movementBank.concept = plainData.concept
    movementBank.movementBankId = plainData.movementBankId
    movementBank.bankId = plainData.bankId
    movementBank.churchId = plainData.churchId
    movementBank.createdAt = plainData.createdAt
    return movementBank
  }

  getId(): string {
    return this.id
  }

  getBankId(): string {
    return this.bankId
  }

  getChurchId(): string {
    return this.churchId
  }

  toPrimitives(): any {
    return {
      movementBankId: this.movementBankId,
      operationType: this.operationType,
      impact: this.impact,
      amount: this.amount,
      concept: this.concept,
      bankId: this.bankId,
      churchId: this.churchId,
      createdAt: this.createdAt,
    }
  }
}

const OperationImpact: Record<TypeBankingOperation, OperationImpactType> = {
  [TypeBankingOperation.DEPOSIT]: OperationImpactType.CREDIT,
  [TypeBankingOperation.INTEREST]: OperationImpactType.CREDIT,
  [TypeBankingOperation.WITHDRAWAL]: OperationImpactType.DEBIT,
}

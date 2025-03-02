import { ValueObject } from "./value-object"
import { InvalidArgumentError } from "../exceptions/invalid-argument-error"

export class AmountValueObject extends ValueObject<number> {
  constructor(readonly value: any) {
    super(value)
    this.ensureValueIsPositive()
  }

  static create(value: number): AmountValueObject {
    return new AmountValueObject(value)
  }

  getValue(): number {
    return Number(this.value)
  }

  private ensureValueIsPositive(): void {
    if (this.value <= 0) {
      throw new InvalidArgumentError("Amount must be positive")
    }
  }
}

import { ValueObject } from "./ValueObject"
import { InvalidArgumentError } from "@/Shared/domain"

export class AmountValue extends ValueObject<number> {
  private constructor(readonly value: any) {
    super(value)
    this.ensureValueIsPositive()
  }

  static create(value: number): AmountValue {
    return new AmountValue(value)
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

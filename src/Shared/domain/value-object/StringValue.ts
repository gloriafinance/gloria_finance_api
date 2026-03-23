import { ValueObject } from "./ValueObject"
import { InvalidArgumentError } from "@/Shared/domain"

export class StringValue extends ValueObject<string> {
  constructor(protected override readonly value: string) {
    super(value)
    this.ensureStringIsNotEmpty()
  }

  static create(value: string): StringValue {
    return new StringValue(value)
  }

  getValue(): string {
    return String(this.value)
  }

  private ensureStringIsNotEmpty(): void {
    if (this.value.length < 1) {
      throw new InvalidArgumentError("String should have a length")
    }
  }
}

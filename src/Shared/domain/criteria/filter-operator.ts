import { EnumValue } from "../value-object/EnumValue"
import { InvalidArgumentError } from "../exceptions/invalid-argument-error"

export enum Operator {
  EQUAL = "=",
  NOT_EQUAL = "!=",
  GT = ">",
  LT = "<",
  CONTAINS = "CONTAINS",
  NOT_CONTAINS = "NOT_CONTAINS",
  GTE = ">=",
  LTE = "<=",
  DATE_RANGE = "DATE_RANGE",
}

export class FilterOperator extends EnumValue<Operator> {
  constructor(value: Operator) {
    super(value, Object.values(Operator))
  }

  static fromValue(value: string): FilterOperator {
    for (const operatorValue of Object.values(Operator)) {
      if (value === operatorValue.toString()) {
        return new FilterOperator(operatorValue)
      }
    }

    throw new InvalidArgumentError(`The filter operator ${value} is invalid`)
  }

  static equal() {
    return this.fromValue(Operator.EQUAL)
  }

  public isPositive(): boolean {
    return (
      this.value !== Operator.NOT_EQUAL && this.value !== Operator.NOT_CONTAINS
    )
  }

  protected throwErrorForInvalidValue(value: Operator): void {
    throw new InvalidArgumentError(`The filter operator ${value} is invalid`)
  }
}

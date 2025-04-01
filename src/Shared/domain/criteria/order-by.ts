import { StringValue } from "../value-object/StringValue"

export class OrderBy extends StringValue {
  constructor(value: string) {
    super(value)
  }
}

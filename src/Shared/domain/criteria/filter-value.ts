import { StringValue } from "../value-object/StringValue"

export class FilterValue extends StringValue {
  constructor(value: string) {
    super(value)
  }
}

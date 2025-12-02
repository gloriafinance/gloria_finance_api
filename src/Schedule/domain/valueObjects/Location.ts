import { ScheduleItemException } from "../exceptions/ScheduleItemException"

export type LocationPrimitives = {
  name: string
  address?: string
}

export class Location {
  private constructor(
    private readonly name: string,
    private readonly address?: string
  ) {}

  static create(props: LocationPrimitives): Location {
    if (!props.name || !props.name.trim()) {
      throw new ScheduleItemException("Location name is required")
    }

    return new Location(props.name.trim(), props.address?.trim())
  }

  static fromPrimitives(plainData: LocationPrimitives): Location {
    return new Location(plainData.name, plainData.address)
  }

  getName(): string {
    return this.name
  }

  getAddress(): string | undefined {
    return this.address
  }

  toPrimitives(): LocationPrimitives {
    return {
      name: this.name,
      address: this.address,
    }
  }
}

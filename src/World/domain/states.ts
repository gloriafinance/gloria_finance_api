import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"

export class States extends AggregateRoot {
  private id?: string
  private countryId: string
  private stateId: string
  private name: string

  static fromPrimitives(plainData: any): States {
    const s: States = new States()
    s.id = plainData.id
    s.countryId = plainData.countryId
    s.stateId = plainData.stateId
    s.name = plainData.name
    return s
  }

  getId(): string {
    return this.id
  }

  getName(): string {
    return this.name
  }

  getStateId(): string {
    return this.stateId
  }

  toPrimitives(): any {
    return {
      countryId: this.countryId,
      stateId: this.stateId,
      name: this.name,
    }
  }
}

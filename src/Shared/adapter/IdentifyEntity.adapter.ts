import { v4 } from "uuid"

export class IdentifyEntity {
  static get(entityName: string): string {
    return `urn:${entityName}:${v4()}`
  }
}

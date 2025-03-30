export class IdentifyEntity {
  static get(entityName: string): string {
    return `urn:${entityName}:v4()`
  }
}

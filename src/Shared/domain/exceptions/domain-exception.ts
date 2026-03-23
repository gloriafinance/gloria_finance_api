export abstract class DomainException implements Error {
  abstract message: string
  abstract name: string

  data?: unknown[]

  getMessage(): string {
    return this.message
  }

  getErrorCode() {
    return this.name
  }

  getData(): unknown[] | undefined {
    return this.data
  }
}

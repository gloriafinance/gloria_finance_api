export class Urn {
  static create(params: {
    entity: string
    entityId?: string
    churchId?: string
  }): string {
    const { entity, entityId, churchId } = params

    const resolvedEntityId =
      entityId && entityId.length > 0 ? entityId : crypto.randomUUID()
    const baseUrn = `urn:${entity}:${resolvedEntityId}`

    if (churchId && churchId.length > 0) {
      return `${baseUrn}:church:${churchId}`
    }

    return baseUrn
  }

  static entity(urn: string): string {
    return urn.split(":")[1]
  }

  static id(urn: string): string {
    return urn.split(":")[2]
  }

  static key(urn: string, key: string): string {
    const urnRegex = /([^:]+):([^:]+)/g
    const parts: Record<string, string> = {}
    let match: RegExpExecArray | null

    while ((match = urnRegex.exec(urn)) !== null) {
      parts[match[1]] = match[2]
    }

    delete parts["urn"]
    return parts[key]
  }

  static isValid(urn: string): boolean {
    const parts = urn.split(":")
    if (parts.length !== 3 && parts.length !== 5) return false

    const hasBase = parts[0] === "urn" && parts[1] !== "" && parts[2] !== ""
    if (!hasBase) return false

    if (parts.length === 5) {
      return parts[3] === "church" && parts[4] !== ""
    }

    return true
  }

  static urnForKey(urn: string, key: string): string {
    const parts = urn.split(":")
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i] === key) {
        return `urn:${key}:${parts[i + 1]}`
      }
    }
    return undefined
  }
}

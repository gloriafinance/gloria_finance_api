import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"

export type PermissionPrimitives = {
  id?: string
  permissionId: string
  module: string
  action: string
  description: string
  isSystem: boolean
}

export class Permission extends AggregateRoot {
  private id?: string
  private permissionId: string
  private module: string
  private action: string
  private description: string
  private isSystem: boolean

  private constructor() {
    super()
  }

  static create(data: Omit<PermissionPrimitives, "id">): Permission {
    const permission = new Permission()
    permission.permissionId = data.permissionId
    permission.module = data.module
    permission.action = data.action
    permission.description = data.description
    permission.isSystem = data.isSystem

    return permission
  }

  static fromPrimitives(data: any): Permission {
    const permission = new Permission()
    permission.id = data.id
    permission.permissionId = data.permissionId
    permission.module = data.module
    permission.action = data.action
    permission.description = data.description
    permission.isSystem = data.isSystem
    return permission
  }

  getId(): string {
    return this.id
  }

  getPermissionId(): string {
    return this.permissionId
  }

  getModule(): string {
    return this.module
  }

  getAction(): string {
    return this.action
  }

  getDescription(): string {
    return this.description
  }

  toPrimitives(): PermissionPrimitives {
    return {
      permissionId: this.permissionId,
      module: this.module,
      action: this.action,
      description: this.description,
      isSystem: this.isSystem,
    }
  }
}

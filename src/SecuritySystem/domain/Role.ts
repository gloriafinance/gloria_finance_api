import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { DateBR } from "@/Shared/helpers"
import { IdentifyEntity } from "@/Shared/adapter"

export type RolePrimitives = {
  id?: string
  churchId: string
  roleId: string
  name: string
  description: string
  isSystem: boolean
  createdAt: Date
}

export class Role extends AggregateRoot {
  private id?: string
  private churchId: string
  private roleId: string
  private name: string
  private description: string
  private isSystem: boolean
  private createdAt: Date

  private constructor() {
    super()
  }

  static create(
    churchId: string,
    name: string,
    description: string,
    isSystem = false,
    roleId?: string
  ): Role {
    const role = new Role()
    role.churchId = churchId
    role.roleId = roleId ?? IdentifyEntity.get("role")
    role.name = name
    role.description = description
    role.isSystem = isSystem
    role.createdAt = DateBR()
    return role
  }

  static fromPrimitives(data: any): Role {
    const role = new Role()
    role.id = data.id
    role.churchId = data.churchId
    role.roleId = data.roleId
    role.name = data.name
    role.description = data.description
    role.isSystem = data.isSystem
    role.createdAt = data.createdAt
    return role
  }

  getRoleId(): string {
    return this.roleId
  }

  getChurchId(): string {
    return this.churchId
  }

  getName(): string {
    return this.name
  }

  getDescription(): string {
    return this.description
  }

  isSystemRole(): boolean {
    return this.isSystem
  }

  toPrimitives(): RolePrimitives {
    return {
      id: this.id,
      churchId: this.churchId,
      roleId: this.roleId,
      name: this.name,
      description: this.description,
      isSystem: this.isSystem,
      createdAt: this.createdAt,
    }
  }

  getId(): string {
    return this.id
  }
}

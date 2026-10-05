import {
  AggregateRoot,
  type AggregateRelations,
} from "@abejarano/ts-mongodb-criteria"
import { DateBR } from "@/Shared/helpers"

export type UserAssignmentPrimitives = {
  id?: string
  churchId: string
  userId: string
  roles: string[]
  updatedAt: Date
}

export class UserAssignment extends AggregateRoot {
  static collectionName(): string {
    return "user_assignments"
  }

  static relations(): AggregateRelations {
    return {}
  }

  private churchId: string
  private userId: string
  private roles: string[]
  private updatedAt: Date

  static create(
    churchId: string,
    userId: string,
    roles: string[]
  ): UserAssignment {
    const assignment = new UserAssignment()
    assignment.churchId = churchId
    assignment.userId = userId
    assignment.roles = roles
    assignment.updatedAt = DateBR()
    return assignment
  }

  static fromPrimitives(data: any): UserAssignment {
    const assignment = new UserAssignment()
    assignment.churchId = data.churchId
    assignment.userId = data.userId
    assignment.roles = data.roles
    assignment.updatedAt = data.updatedAt
    return assignment
  }

  getRoles(): string[] {
    return this.roles
  }

  getUserId(): string {
    return this.userId
  }

  getChurchId(): string {
    return this.churchId
  }

  toPrimitives(): UserAssignmentPrimitives {
    return {
      churchId: this.churchId,
      userId: this.userId,
      roles: this.roles,
      updatedAt: this.updatedAt,
    }
  }
}

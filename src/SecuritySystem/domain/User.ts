import { IdentifyEntity } from "@/Shared/adapter"
import { DateBR } from "@/Shared/helpers"
import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { UserPolicies } from "./types/user-policies.type"

export class User extends AggregateRoot {
  isActive: boolean
  private id?: string
  private userId: string
  private email: string
  private name: string
  private password: string
  private createdAt: Date
  private churchId: string
  private memberId?: string
  private lastLogin?: Date
  private policies?: UserPolicies

  static create(
    name: string,
    email: string,
    password: string,
    churchId: string
  ): User {
    const u = new User()
    u.email = email
    u.password = password

    u.churchId = churchId

    u.userId = IdentifyEntity.get(`user`)

    u.createdAt = DateBR()
    u.isActive = true
    u.name = name

    return u
  }

  static fromPrimitives(data: any): User {
    const u: User = new User()
    u.email = data.email
    u.createdAt = data.createdAt
    u.isActive = data.isActive
    u.id = data.id
    u.password = data.password
    u.userId = data.userId
    u.churchId = data.churchId
    u.name = data.name
    u.memberId = data.memberId
    u.lastLogin = data.lastLogin ?? null
    u.policies = data.policies

    return u
  }

  setMemberId(memberId: string): User {
    this.memberId = memberId
    return this
  }

  getChurchId(): string {
    return this.churchId
  }

  getId(): string {
    return this.id
  }

  getName(): string {
    return this.name
  }

  getPassword(): string {
    return this.password
  }

  getEmail(): string {
    return this.email
  }

  getUserId(): string {
    return this.userId
  }

  getMemberId(): string | undefined {
    return this.memberId
  }

  getPolicies(): UserPolicies | undefined {
    return this.policies
  }

  setEmail(email: string): User {
    this.email = email
    return this
  }

  setUpdatePassword(newPass: string): User {
    this.password = newPass
    return this
  }

  updateLastLogin(): User {
    this.lastLogin = DateBR()
    return this
  }

  acceptPolicies(
    privacyPolicyVersion: string,
    sensitiveDataPolicyVersion: string
  ): User {
    const acceptedAt = DateBR()
    this.policies = {
      privacyPolicy: {
        accepted: true,
        version: privacyPolicyVersion,
        acceptedAt,
      },
      sensitiveDataPolicy: {
        accepted: true,
        version: sensitiveDataPolicyVersion,
        acceptedAt,
      },
    }
    return this
  }

  enable(): User {
    this.isActive = true
    return this
  }

  disable(): User {
    this.isActive = false
    return this
  }

  toPrimitives(): any {
    return {
      name: this.name,
      email: this.email,
      password: this.password,
      createdAt: this.createdAt,
      isActive: this.isActive,
      userId: this.userId,
      churchId: this.churchId,
      memberId: this.memberId,
      lastLogin: this.lastLogin,
      policies: this.policies,
    }
  }
}

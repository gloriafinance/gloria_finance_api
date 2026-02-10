import { Urn } from "@/Shared/adapter"
import { DateBR } from "@/Shared/helpers"
import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import type { UserPolicies } from "./types/user-policies.type"

export class User extends AggregateRoot {
  isActive: boolean
  isSuperUser: boolean
  private id?: string
  private userId: string
  private email: string
  private name: string
  private password: string
  private createdAt: Date
  private memberId?: string
  private lastLogin?: Date
  private policies?: UserPolicies
  private churchId: string

  private constructor() {
    super()
  }

  static create(
    name: string,
    email: string,
    password: string,
    churchId: string,
    isSuperUser: boolean = false
  ): User {
    const u = new User()
    u.email = email.toLowerCase()
    u.password = password

    u.userId = Urn.create({ entity: "user", churchId: Urn.id(churchId) })

    u.createdAt = DateBR()
    u.isActive = true
    u.name = name
    u.churchId = churchId

    u.isSuperUser = isSuperUser

    return u
  }

  static override fromPrimitives(data: any): User {
    const u: User = new User()
    u.email = data.email
    u.createdAt = data.createdAt
    u.isActive = data.isActive
    u.id = data.id
    u.password = data.password
    u.userId = data.userId
    u.name = data.name
    u.memberId = data.memberId
    u.lastLogin = data.lastLogin ?? null
    u.policies = data.policies
    u.isSuperUser = data.isSuperUser ?? false
    u.churchId = data.churchId

    return u
  }

  setMemberId(memberId: string): User {
    this.memberId = memberId
    return this
  }

  getChurchId(): string {
    if (Urn.isValid(this.userId)) {
      return Urn.urnForKey(this.userId, "church")
    }

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
      memberId: this.memberId,
      lastLogin: this.lastLogin,
      policies: this.policies,
      isSuperUser: this.isSuperUser,
      churchId: this.churchId,
    }
  }
}

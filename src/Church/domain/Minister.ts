import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { IdentifyEntity } from "@/Shared/adapter"
import { Church } from "./Church"
import { MinisterType } from "./enums/MinisterType.enum"
import { DateBR } from "@/Shared/helpers"

export class Minister extends AggregateRoot {
  private id?: string
  private ministerId: string
  private name: string
  private email: string
  private phone: string
  private createdAt: Date
  private dni: string
  private ministerType: MinisterType
  private churchId: string

  static create(
    name: string,
    email: string,
    phone: string,
    dni: string,
    ministerType: MinisterType
  ): Minister {
    const m: Minister = new Minister()
    m.name = name
    m.email = email
    m.phone = phone
    m.createdAt = DateBR()
    m.dni = dni
    m.ministerType = ministerType
    m.ministerId = IdentifyEntity.get(`minister`)

    return m
  }

  static fromPrimitives(plainData: any): Minister {
    const m: Minister = new Minister()
    m.id = plainData.id
    m.name = plainData.name
    m.email = plainData.email
    m.phone = plainData.phone
    m.createdAt = plainData.createdAt
    m.dni = plainData.dni
    m.ministerType = plainData.ministerType
    m.ministerId = plainData.ministerId
    m.churchId = plainData.churchId

    return m
  }

  setEmail(email: string) {
    this.email = email
  }

  setPhone(phone: string) {
    this.phone = phone
  }

  setName(name: string) {
    this.name = name
  }

  getId(): string {
    return this.id
  }

  getMinisterId(): string {
    return this.ministerId
  }

  getChurchId() {
    return this.churchId
  }

  setChurch(church: Church) {
    this.churchId = church.getChurchId()
  }

  removeChurch() {
    this.churchId = undefined
  }

  getName(): string {
    return this.name
  }

  getEmail(): string {
    return this.email
  }

  getPhone(): string {
    return this.phone
  }

  getMinisterType(): MinisterType {
    return this.ministerType
  }

  getDNI(): string {
    return this.dni
  }

  toPrimitives(): any {
    return {
      ministerId: this.ministerId,
      name: this.name,
      email: this.email,
      phone: this.phone,
      createdAt: this.createdAt,
      dni: this.dni,
      ministerType: this.ministerType,
      churchId: this.churchId ?? null,
    }
  }
}

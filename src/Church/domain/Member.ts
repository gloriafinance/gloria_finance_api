import { IdentifyEntity } from "@/Shared/adapter"
import { Church } from "./Church"
import { DateBR } from "@/Shared/helpers"
import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { MemberSettings } from "@/Church/domain"

export class Member extends AggregateRoot {
  public isTreasurer: boolean
  public isMinister: boolean
  private id?: string
  private memberId: string
  private name: string
  private email: string
  private phone: string
  private createdAt: Date
  private dni: string
  private conversionDate: Date
  private baptismDate?: Date
  private birthdate: Date
  //private churchId: string
  private church: {
    churchId: string
    name: string
  }
  private active: boolean
  private settings: MemberSettings

  static create(params: {
    name: string
    phone: string
    dni: string
    church: Church
    birthdate: Date
    email: string
    conversionDate: Date
    isTreasurer: boolean
    isMinister: boolean
    settings?: MemberSettings
    baptismDate?: Date
  }): Member {
    const {
      name,
      phone,
      dni,
      church,
      birthdate,
      email,
      conversionDate,
      isTreasurer,
      isMinister,
      settings,
      baptismDate,
    } = params

    const m: Member = new Member()
    m.name = name
    m.email = email.toLowerCase()
    m.phone = phone
    m.createdAt = DateBR()
    m.dni = dni
    m.conversionDate = conversionDate
    m.baptismDate = baptismDate

    m.church = { churchId: church.getChurchId(), name: church.getName() }
    //m.churchId = church.getChurchId()

    m.birthdate = birthdate
    m.memberId = IdentifyEntity.get(`member`)
    m.isTreasurer = isTreasurer
    m.isMinister = isMinister
    m.active = true

    if (!settings) {
      m.settings = {
        notifyPaymentCommitments: true,
        notifyChurchEvents: true,
        notifyStatusContributions: true,
        lang: church.getLang(),
      }
    } else {
      m.settings = settings
    }

    return m
  }

  static fromPrimitives(plainData: any): Member {
    const m: Member = new Member()
    m.memberId = plainData.memberId
    m.name = plainData.name
    m.email = plainData.email
    m.phone = plainData.phone
    m.createdAt = plainData.createdAt
    m.dni = plainData.dni
    m.conversionDate = plainData.conversionDate
    m.baptismDate = plainData.baptismDate
    m.birthdate = plainData.birthdate
    m.isMinister = plainData.isMinister
    m.isTreasurer = plainData.isTreasurer

    m.church = plainData.church
    //m.churchId = plainData.church.churchId

    m.id = plainData.id
    m.active = plainData.active
    m.settings = plainData.settings
      ? plainData.settings
      : {
          notificationPaymentCommitments: true,
          notificationChurchEvents: true,
          notificationStatusContributions: true,
          lang: "pt-BR",
        }

    return m
  }

  getId(): string {
    return this.id
  }

  getPhone() {
    return this.phone
  }

  getChurch(): { churchId: string; name: string } {
    return this.church
  }

  getEmail(): string {
    return this.email
  }

  getDni(): string {
    return this.dni
  }

  getName(): string {
    return this.name
  }

  getMemberId(): string {
    return this.memberId
  }

  setEmail(email: string) {
    this.email = email.toLowerCase()
  }

  setPhone(phone: string) {
    this.phone = phone
  }

  setDni(dni: string) {
    this.dni = dni
  }

  setConversionDate(conversionDate: Date) {
    this.conversionDate = conversionDate
  }

  setSettings(settings: MemberSettings) {
    this.settings = settings
  }

  setBaptismDate(baptismDate: Date) {
    this.baptismDate = baptismDate
  }

  setBirthdate(birthdate: Date) {
    this.birthdate = birthdate
  }

  setName(name: string) {
    this.name = name
  }

  disable() {
    this.active = false
  }

  enable() {
    this.active = true
  }

  getSettings() {
    return this.settings
  }

  toPrimitives(): any {
    return {
      memberId: this.memberId,
      church: this.church,
      name: this.name,
      email: this.email,
      phone: this.phone,
      createdAt: this.createdAt,
      dni: this.dni,
      conversionDate: this.conversionDate,
      baptismDate: this.baptismDate,
      birthdate: this.birthdate,
      isMinister: this.isMinister,
      isTreasurer: this.isTreasurer,
      settings: this.settings,
      active: this.active,
    }
  }
}

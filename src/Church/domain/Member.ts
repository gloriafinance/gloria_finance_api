import { IdentifyEntity } from "@/Shared/adapter"
import { Church } from "./Church"
import { DateBR } from "@/Shared/helpers"
import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { MemberSettings } from "@/Church/domain"
import { MemberStatus } from "./enums/MemberStatus.enum"
import { MemberGender } from "./enums/MemberGender.enum"
import { InvalidMemberStatus } from "./exceptions/InvalidMemberStatus.exception"
import type { MemberAddress } from "./type/MemberAddress.type"
import type { LgpdConsent } from "./type/LgpdConsent.type"

export class Member extends AggregateRoot {
  public isTreasurer: boolean
  public isMinister: boolean
  private memberId: string
  private name: string
  private email: string
  private phone: string
  private createdAt: Date
  private dni: string
  private conversionDate: Date
  private baptismDate?: Date
  private birthdate: Date
  private church: {
    churchId: string
    name: string
  }
  private status: MemberStatus
  private settings: MemberSettings
  private profilePhoto?: string
  private gender?: MemberGender
  private address?: MemberAddress
  private lgpdConsent?: LgpdConsent

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
    status?: MemberStatus
    profilePhoto?: string
    gender?: MemberGender
    address?: MemberAddress
    lgpdConsent?: LgpdConsent
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
      status,
      profilePhoto,
      gender,
      address,
      lgpdConsent,
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

    m.birthdate = birthdate
    m.memberId = IdentifyEntity.get(`member`)
    m.isTreasurer = isTreasurer
    m.isMinister = isMinister
    m.status = status ?? MemberStatus.APPROVED

    if (!settings) {
      m.settings = {
        notifyPaymentCommitments: true,
        notifyChurchEvents: true,
        notifyStatusContributions: true,
        whatsappOptIn: false,
        lang: church.getLang(),
      }
    } else {
      m.settings = settings
    }

    m.profilePhoto = profilePhoto
    m.gender = gender
    m.address = address
    m.lgpdConsent = lgpdConsent

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

    if (
      !plainData.status ||
      !Object.values(MemberStatus).includes(plainData.status)
    ) {
      throw new InvalidMemberStatus()
    }
    m.status = plainData.status as MemberStatus

    m.settings = plainData.settings
      ? plainData.settings
      : {
          notificationPaymentCommitments: true,
          notificationChurchEvents: true,
          notificationStatusContributions: true,
          whatsappOptIn: false,
          lang: "pt-BR",
        }

    m.profilePhoto = plainData.profilePhoto
    m.gender = plainData.gender ? (plainData.gender as MemberGender) : undefined
    m.address = plainData.address
    m.lgpdConsent = plainData.lgpdConsent

    return m
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

  getStatus(): MemberStatus {
    return this.status
  }

  setStatus(status: MemberStatus) {
    this.status = status
  }

  approve() {
    this.status = MemberStatus.APPROVED
  }

  markAsPendingReview() {
    this.status = MemberStatus.PENDING_REVIEW
  }

  inactivate() {
    this.status = MemberStatus.INACTIVE
  }

  getSettings() {
    return this.settings
  }

  getBirthdate(): Date {
    return this.birthdate
  }

  getProfilePhoto(): string | undefined {
    return this.profilePhoto
  }

  setProfilePhoto(profilePhoto: string) {
    this.profilePhoto = profilePhoto
  }

  getGender(): MemberGender | undefined {
    return this.gender
  }

  setGender(gender: MemberGender) {
    this.gender = gender
  }

  getAddress(): MemberAddress | undefined {
    return this.address
  }

  setAddress(address: MemberAddress) {
    this.address = address
  }

  getLgpdConsent(): LgpdConsent | undefined {
    return this.lgpdConsent
  }

  setLgpdConsent(lgpdConsent: LgpdConsent) {
    this.lgpdConsent = lgpdConsent
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
      status: this.status,
      profilePhoto: this.profilePhoto,
      gender: this.gender,
      address: this.address,
      lgpdConsent: this.lgpdConsent,
    }
  }
}

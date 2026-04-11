//import { Minister, Region } from "../../OrganizacionalStructure/domain";
import { IdentifyEntity } from "@/Shared/adapter"
import { ChurchStatus } from "./enums/ChurchStatus.enum"
import { Minister } from "./Minister"
import { DateBR } from "@/Shared/helpers"
import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import type { ChurchDoctrinalBase } from "./type/ChurchDoctrinalBase.type"

export class Church extends AggregateRoot {
  private id?: string
  private churchId: string
  private name: string
  private city: string
  private address: string
  private street: string
  private number: string
  private postalCode: string
  private registerNumber: string
  private email: string
  private openingDate: Date
  private ministerId: string
  private lang: string
  private country: string
  private timezone: string
  private symbolFormatMoney: string
  //private region: Region;
  private status: ChurchStatus
  private createdAt: Date
  private wabaId?: string
  private phoneNumberId?: string
  private accessTokenSecretId?: string
  private logoUrl?: string
  private doctrinalBases: ChurchDoctrinalBase[] = []
  private notificationTime: string

  static create(params: {
    name: string
    city: string
    address: string
    street: string
    number: string
    postalCode: string
    email: string
    openingDate: Date
    //region: Region,
    lang: string
    country: string
    timezone?: string
    registerNumber?: string
    symbolFormatMoney?: string
    wabaId?: string
    phoneNumberId?: string
    accessTokenSecretId?: string
    logoUrl?: string
    doctrinalBases?: ChurchDoctrinalBase[]
    notificationTime?: string
  }): Church {
    const {
      name,
      city,
      address,
      street,
      number,
      postalCode,
      registerNumber = "",
      email,
      openingDate,
      lang,
      country,
      timezone,
      symbolFormatMoney,
      wabaId,
      phoneNumberId,
      accessTokenSecretId,
      logoUrl,
      doctrinalBases,
      notificationTime,
      //region,
    } = params
    const c: Church = new Church()

    c.name = name
    c.city = city
    c.address = address
    c.street = street
    c.number = number
    c.postalCode = postalCode
    c.registerNumber = registerNumber
    c.email = email
    c.openingDate = openingDate
    c.lang = lang
    c.country = country
    c.timezone = Church.normalizeTimezone(timezone, country)
    c.symbolFormatMoney = symbolFormatMoney ?? "R$"
    //c.region = region;
    c.createdAt = DateBR()
    c.churchId = IdentifyEntity.get(`church`)
    c.status = ChurchStatus.ACTIVE
    c.wabaId = wabaId
    c.phoneNumberId = phoneNumberId
    c.accessTokenSecretId = accessTokenSecretId
    c.logoUrl = logoUrl
    c.doctrinalBases = Church.normalizeDoctrinalBases(doctrinalBases)

    c.notificationTime = notificationTime ?? "15:30"

    return c
  }

  static override fromPrimitives(plainData: any): Church {
    const c: Church = new Church()

    c.id = plainData.id
    c.churchId = plainData.churchId
    c.name = plainData.name
    c.city = plainData.city
    c.address = plainData.address
    c.street = plainData.street
    c.number = plainData.number
    c.postalCode = plainData.postalCode
    c.registerNumber = plainData.registerNumber
    c.email = plainData.email
    c.openingDate = plainData.openingDate
    c.ministerId = plainData.ministerId
    c.lang = plainData.lang ?? "pt-BR"
    c.symbolFormatMoney = plainData.symbolFormatMoney ?? "R\$"
    //c.region = Region.fromPrimitives(plainData.region);
    c.status = plainData.status

    c.country = plainData.country ?? "BR"
    c.timezone = Church.normalizeTimezone(plainData.timezone, c.country)
    c.createdAt = plainData.createdAt
    c.wabaId = plainData.wabaId
    c.phoneNumberId = plainData.phoneNumberId
    c.accessTokenSecretId = plainData.accessTokenSecretId
    c.logoUrl = plainData.logoUrl
    c.doctrinalBases = Church.normalizeDoctrinalBases(plainData.doctrinalBases)
    c.notificationTime = plainData.notificationTime ?? "15:30"

    return c
  }

  private static normalizeDoctrinalBases(
    doctrinalBases: unknown
  ): ChurchDoctrinalBase[] {
    if (!Array.isArray(doctrinalBases)) {
      return []
    }

    return doctrinalBases
      .map((item) => {
        const title =
          typeof item?.title === "string" ? item.title.trim() : undefined
        const scripture =
          typeof item?.scripture === "string"
            ? item.scripture.trim()
            : undefined

        if (!title || !scripture) {
          return undefined
        }

        return {
          title,
          scripture,
        }
      })
      .filter(Boolean) as ChurchDoctrinalBase[]
  }

  private static normalizeTimezone(
    timezone: unknown,
    country?: string
  ): string {
    const normalized = String(timezone ?? "").trim()
    if (normalized) {
      return normalized
    }

    const countryCode = String(country ?? "")
      .trim()
      .toUpperCase()

    const map: Record<string, string> = {
      BR: "America/Sao_Paulo",
      US: "America/New_York",
      CA: "America/Toronto",
      MX: "America/Mexico_City",
      CO: "America/Bogota",
      PE: "America/Lima",
      VE: "America/Caracas",
      AR: "America/Argentina/Buenos_Aires",
      CL: "America/Santiago",
      BO: "America/La_Paz",
      PY: "America/Asuncion",
      UY: "America/Montevideo",
      EC: "America/Guayaquil",
      PA: "America/Panama",
      CR: "America/Costa_Rica",
      GT: "America/Guatemala",
      HN: "America/Tegucigalpa",
      SV: "America/El_Salvador",
      DO: "America/Santo_Domingo",
      PR: "America/Puerto_Rico",
    }

    return map[countryCode] ?? "America/Sao_Paulo"
  }

  setName(name: string) {
    this.name = name
  }

  setStatus(status: ChurchStatus) {
    this.status = status
  }

  getId(): string | undefined {
    return this.id
  }

  // setRegion(region: Region) {
  //   this.region = region;
  // }

  getChurchId(): string {
    return this.churchId
  }

  getLang(): string {
    return this.lang
  }

  setRegisterNumber(registerNumber: string) {
    this.registerNumber = registerNumber
  }

  setMinister(minister: Minister) {
    this.ministerId = minister.getMinisterId()
  }

  setEmail(email: string) {
    this.email = email
  }

  setAddress(
    city: string,
    address: string,
    street: string,
    number: string,
    postalCode: string
  ) {
    this.city = city
    this.address = address
    this.street = street
    this.number = number
    this.postalCode = postalCode
  }

  setOpeningDate(openingDate: Date) {
    this.openingDate = openingDate
  }

  getCountry() {
    return this.country
  }

  getSymbolFormatMoney() {
    return this.symbolFormatMoney
  }

  setWhatsappCredentials(
    wabaId: string,
    phoneNumberId: string,
    accessTokenSecretId?: string
  ) {
    this.wabaId = wabaId
    this.phoneNumberId = phoneNumberId
    this.accessTokenSecretId = accessTokenSecretId
  }

  getWhatsappCredentials() {
    return {
      wabaId: this.wabaId,
      phoneNumberId: this.phoneNumberId,
      accessTokenSecretId: this.accessTokenSecretId,
    }
  }

  isWhatsappConnected(): boolean {
    return Boolean(
      this.wabaId?.trim() &&
      this.phoneNumberId?.trim() &&
      this.accessTokenSecretId?.trim()
    )
  }

  clearWhatsappCredentials() {
    this.wabaId = undefined
    this.phoneNumberId = undefined
    this.accessTokenSecretId = undefined
  }

  setLogoUrl(logoUrl: string) {
    this.logoUrl = logoUrl
  }

  getLogoUrl(): string | undefined {
    return this.logoUrl
  }

  setDoctrinalBases(doctrinalBases: ChurchDoctrinalBase[]) {
    this.doctrinalBases = Church.normalizeDoctrinalBases(doctrinalBases)
  }

  getDoctrinalBases(): ChurchDoctrinalBase[] {
    return [...this.doctrinalBases]
  }

  getName(): string {
    return this.name
  }

  setTimezone(timezone: string) {
    this.timezone = Church.normalizeTimezone(timezone, this.country)
  }

  getTimezone(): string {
    return this.timezone
  }

  getMinisterId() {
    return this.ministerId
  }

  // getRegion(): Region {
  //   return this.region;
  // }

  // removeMinister() {
  //   this.ministerId = undefined
  // }

  getAddress(): string {
    return `${this.address}, ${this.street}, ${this.number}, ${this.postalCode}, ${this.city}`
  }

  getNotificationTime() {
    return this.notificationTime
  }

  toPrimitives(): any {
    return {
      churchId: this.churchId,
      name: this.name,
      city: this.city,
      address: this.address,
      street: this.street,
      number: this.number,
      postalCode: this.postalCode,
      registerNumber: this.registerNumber,
      email: this.email,
      openingDate: this.openingDate,
      //region: this.region.toPrimitives(),
      createdAt: this.createdAt,
      ministerId: this.ministerId ?? null,
      status: this.status,
      lang: this.lang,
      country: this.country,
      timezone: this.timezone,
      symbolFormatMoney: this.symbolFormatMoney,
      wabaId: this.wabaId,
      phoneNumberId: this.phoneNumberId,
      accessTokenSecretId: this.accessTokenSecretId,
      logoUrl: this.logoUrl,
      doctrinalBases: this.doctrinalBases,
      notificationTime: this.notificationTime,
    }
  }
}

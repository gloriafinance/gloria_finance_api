//import { Minister, Region } from "../../OrganizacionalStructure/domain";
import { IdentifyEntity } from "@/Shared/adapter"
import { ChurchStatus } from "./enums/ChurchStatus.enum"
import { Minister } from "./Minister"
import { DateBR } from "@/Shared/helpers"
import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"

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
  //private region: Region;
  private status: ChurchStatus
  private createdAt: Date

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
    registerNumber?: string
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
    //c.region = region;
    c.createdAt = DateBR()
    c.churchId = IdentifyEntity.get(`church`)
    c.status = ChurchStatus.ACTIVE

    return c
  }

  static fromPrimitives(plainData: any): Church {
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
    //c.region = Region.fromPrimitives(plainData.region);
    c.status = plainData.status

    c.createdAt = plainData.createdAt

    return c
  }

  setStatus(status: ChurchStatus) {
    this.status = status
  }

  getId(): string {
    return this.id
  }

  getChurchId(): string {
    return this.churchId
  }

  getLang(): string {
    return this.lang
  }

  // setRegion(region: Region) {
  //   this.region = region;
  // }

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

  getName(): string {
    return this.name
  }

  getMinisterId() {
    return this.ministerId
  }

  removeMinister() {
    this.ministerId = undefined
  }

  getAddress(): string {
    return `${this.address}, ${this.street}, ${this.number}, ${this.postalCode}, ${this.city}`
  }

  // getRegion(): Region {
  //   return this.region;
  // }

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
    }
  }
}

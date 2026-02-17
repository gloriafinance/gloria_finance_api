import { ChurchStatus } from "../index"
import type { ChurchDoctrinalBase } from "../type/ChurchDoctrinalBase.type"

export type ChurchRequest = {
  churchId?: string
  name: string
  city: string
  address: string
  street: string
  number: string
  postalCode: string
  registerNumber?: string
  email: string
  openingDate: Date | string
  regionId?: string
  status?: ChurchStatus
  lang?: string
  symbolFormatMoney?: string
  country?: string
  doctrinalBases?: ChurchDoctrinalBase[]
}

import { MemberSettings } from "@/Church/domain"

export type CreateMemberRequest = {
  name: string
  email: string
  phone: string
  dni: string
  conversionDate: Date
  baptismDate?: Date
  isTreasurer: boolean
  churchId: string
  birthdate: Date
  active: boolean
  settings?: MemberSettings
}

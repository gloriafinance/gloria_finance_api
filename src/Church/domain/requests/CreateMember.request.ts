import { MemberSettings } from "@/Church/domain"
import { MemberStatus } from "../enums/MemberStatus.enum"

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
  status?: MemberStatus
  settings?: MemberSettings
}

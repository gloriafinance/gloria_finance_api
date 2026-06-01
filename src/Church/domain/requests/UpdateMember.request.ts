import { MemberSettings } from "@/Church/domain"
import { MemberStatus } from "../enums/MemberStatus.enum"

export type UpdateMemberRequest = {
  memberId: string
  name?: string
  email?: string
  phone?: string
  dni?: string
  conversionDate?: Date
  baptismDate?: Date
  isTreasurer?: boolean
  birthdate?: Date
  status?: MemberStatus
  settings?: MemberSettings
}

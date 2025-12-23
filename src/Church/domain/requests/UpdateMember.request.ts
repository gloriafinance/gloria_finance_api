import { MemberSettings } from "@/Church/domain"

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
  active?: boolean
  settings?: MemberSettings
}

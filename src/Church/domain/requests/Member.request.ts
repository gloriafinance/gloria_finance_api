export type MemberRequest = {
  memberId?: string
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
}

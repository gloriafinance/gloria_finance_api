export type CreateUserRequest = {
  userId?: string
  name: string
  email: string
  password: string
  isActive: boolean
  churchId: string
  memberId?: string
}

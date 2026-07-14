import { User } from "../User"
import { IRepository } from "@abejarano/ts-mongodb-criteria"

export interface IUserRepository extends IRepository<User> {
  findByEmail(email: string): Promise<User | undefined>

  findByUserId(userId: string): Promise<User | undefined>

  findByMemberIdAndChurchId(
    memberId: string,
    churchId: string
  ): Promise<User | undefined>

  deleteByUserId(userId: string): Promise<void>

  updatePassword(user: User): Promise<void>
}

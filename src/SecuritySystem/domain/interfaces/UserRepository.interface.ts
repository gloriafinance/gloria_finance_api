import { User } from "../User"
import { IRepository } from "@abejarano/ts-mongodb-criteria"

export interface IUserRepository extends IRepository<User> {
  findByEmail(email: string): Promise<User | undefined>

  findByUserId(userId: string): Promise<User | undefined>

  updatePassword(user: User): Promise<void>
}

import { AcceptPolicies } from "@/SecuritySystem/applications/AcceptPolicies"
import {
  IUserRepository,
  User,
  UserNotFound,
} from "@/SecuritySystem/domain"
import { Criteria, Paginate } from "@abejarano/ts-mongodb-criteria"

class InMemoryUserRepository implements IUserRepository {
  private users = new Map<string, User>()

  async findByEmail(email: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.getEmail() === email) return user
    }
    return undefined
  }

  async findByUserId(userId: string): Promise<User | undefined> {
    return this.users.get(userId)
  }

  async upsert(user: User): Promise<void> {
    this.users.set(user.getUserId(), user)
  }

  async fetchCriteria(_payload: Criteria): Promise<Paginate<User>> {
    return {
      count: this.users.size,
      nextPag: null,
      results: Array.from(this.users.values()),
    }
  }

  async updatePassword(user: User): Promise<void> {
    this.users.set(user.getUserId(), user)
  }
}

const buildUser = () =>
  User.fromPrimitives({
    id: "db-id",
    userId: "user-1",
    churchId: "church-1",
    email: "test@example.com",
    name: "Test",
    password: "hashed",
    isActive: true,
    createdAt: new Date(),
  })

describe("AcceptPolicies use case", () => {
  it("updates policies for an existing user", async () => {
    const repo = new InMemoryUserRepository()
    const user = buildUser()
    await repo.upsert(user)

    const useCase = new AcceptPolicies(repo)
    const updated = await useCase.execute("user-1", "1.0.0", "1.0.0")

    const policies = updated.getPolicies()
    expect(policies?.privacyPolicy?.accepted).toBe(true)
    expect(policies?.privacyPolicy?.version).toBe("1.0.0")
    expect(policies?.privacyPolicy?.acceptedAt).toBeInstanceOf(Date)
    expect(policies?.sensitiveDataPolicy?.accepted).toBe(true)
    expect(policies?.sensitiveDataPolicy?.version).toBe("1.0.0")
    expect(policies?.sensitiveDataPolicy?.acceptedAt).toBeInstanceOf(Date)
  })

  it("throws when the user does not exist", async () => {
    const repo = new InMemoryUserRepository()
    const useCase = new AcceptPolicies(repo)

    await expect(
      useCase.execute("missing-user", "1.0.0", "1.0.0")
    ).rejects.toBeInstanceOf(UserNotFound)
  })
})

import * as express from "express"
import * as supertest from "supertest"
import {
  IUserRepository,
  User,
} from "@/SecuritySystem/domain"
import { Criteria, Paginate } from "@abejarano/ts-mongodb-criteria"

class InMemoryUserRepository implements IUserRepository {
  private users = new Map<string, User>()

  constructor(initialUser?: User) {
    if (initialUser) {
      this.users.set(initialUser.getUserId(), initialUser)
    }
  }

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

describe("POST /api/v1/user/accept-policies", () => {
  const httpRequest = (supertest as any).default ?? (supertest as any)

  beforeEach(() => {
    jest.resetModules()
  })

  it("accepts policies for an authenticated user", async () => {
    const user = buildUser()
    const repo = new InMemoryUserRepository(user)

    jest.doMock("@/Shared/infrastructure", () => ({
      PermissionMiddleware: (req, _res, next) => {
        req.auth = { userId: "user-1", churchId: "church-1" }
        next()
      },
    }))

    const { UserMongoRepository } = await import(
      "@/SecuritySystem/infrastructure/persistence/UserMongoRepository"
    )
    jest
      .spyOn(UserMongoRepository, "getInstance")
      .mockReturnValue(repo as any)

    const userRoutes = (await import(
      "@/SecuritySystem/infrastructure/http/routes/user.routes"
    )).default

    const app = express()
    app.use(express.json())
    app.use("/api/v1/user", userRoutes)

    const res = await httpRequest(app)
      .post("/api/v1/user/accept-policies")
      .send({
        privacyPolicyVersion: "1.0.0",
        sensitiveDataPolicyVersion: "1.0.0",
      })
      .expect(200)

    expect(res.body.data.policies.privacyPolicy.accepted).toBe(true)
    expect(res.body.data.policies.privacyPolicy.version).toBe("1.0.0")
    expect(res.body.data.policies.sensitiveDataPolicy.accepted).toBe(true)
    expect(res.body.data.policies.sensitiveDataPolicy.version).toBe("1.0.0")

    const updatedUser = await repo.findByUserId("user-1")
    expect(updatedUser?.getPolicies()?.privacyPolicy?.accepted).toBe(true)
  })
})

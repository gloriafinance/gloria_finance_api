import { GetOrCreateMemberRegistrationLink } from "@/Church/applications"
import {
  Church,
  ChurchNotFound,
  ChurchStatus,
  IChurchRepository,
} from "@/Church/domain"

const createChurch = (
  overrides: Partial<{ memberRegistration?: { token: string; createdAt: Date } }> = {}
): Church => {
  const church = Church.fromPrimitives({
    id: "church-db-id",
    churchId: "church-1",
    name: "Test Church",
    city: "City",
    address: "Address",
    street: "Street",
    number: "1",
    postalCode: "00000",
    registerNumber: "",
    email: "church@church.com",
    openingDate: new Date(),
    ministerId: "minister-1",
    lang: "pt-BR",
    status: ChurchStatus.ACTIVE,
    createdAt: new Date(),
    ...overrides,
  })
  return church
}

describe("GetOrCreateMemberRegistrationLink", () => {
  const churchRepository = {
    findById: jest.fn(),
    getOrCreateMemberRegistrationToken: jest.fn(),
  } as unknown as jest.Mocked<IChurchRepository>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("throws ChurchNotFound when church does not exist", async () => {
    churchRepository.findById.mockResolvedValue(undefined)

    const useCase = new GetOrCreateMemberRegistrationLink(churchRepository)
    await expect(useCase.execute("church-1")).rejects.toBeInstanceOf(
      ChurchNotFound
    )
  })

  it("generates token for church without memberRegistration and returns registrationPath", async () => {
    const church = createChurch()
    churchRepository.findById.mockResolvedValue(church)
    churchRepository.getOrCreateMemberRegistrationToken.mockResolvedValue(
      "mreg_abc123"
    )

    const useCase = new GetOrCreateMemberRegistrationLink(churchRepository)
    const result = await useCase.execute("church-1")

    expect(result.churchId).toBe("church-1")
    expect(result.churchName).toBe("Test Church")
    expect(result.token).toBe("mreg_abc123")
    expect(result.registrationPath).toBe("/member-registration/mreg_abc123")
    expect(churchRepository.getOrCreateMemberRegistrationToken).toHaveBeenCalledWith(
      "church-1"
    )
  })

  it("returns existing token without generating a new one", async () => {
    const church = createChurch()
    churchRepository.findById.mockResolvedValue(church)
    churchRepository.getOrCreateMemberRegistrationToken.mockResolvedValue(
      "mreg_existing"
    )

    const useCase = new GetOrCreateMemberRegistrationLink(churchRepository)
    const result1 = await useCase.execute("church-1")
    const result2 = await useCase.execute("church-1")

    expect(result1.token).toBe("mreg_existing")
    expect(result2.token).toBe("mreg_existing")
    expect(churchRepository.getOrCreateMemberRegistrationToken).toHaveBeenCalledTimes(2)
  })

  it("returns token with correct prefix and sufficient length", async () => {
    const church = createChurch()
    churchRepository.findById.mockResolvedValue(church)
    const token = "mreg_" + "a".repeat(64)
    churchRepository.getOrCreateMemberRegistrationToken.mockResolvedValue(token)

    const useCase = new GetOrCreateMemberRegistrationLink(churchRepository)
    const result = await useCase.execute("church-1")

    expect(result.token.startsWith("mreg_")).toBe(true)
    expect(result.token.length).toBeGreaterThan(20)
    expect(result.token).not.toBe(result.churchId)
  })

  it("does not depend on member repository or queue service", () => {
    const useCase = new GetOrCreateMemberRegistrationLink(churchRepository)
    expect(useCase).toBeDefined()
  })
})

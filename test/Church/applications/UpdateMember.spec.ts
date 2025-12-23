import { UpdateMember } from "@/Church/applications"
import { IMemberRepository, Member, MemberNotFound } from "@/Church/domain"

const createMember = (): Member =>
  Member.fromPrimitives({
    id: "member-db-id",
    memberId: "member-1",
    name: "John Doe",
    email: "john@church.com",
    phone: "555-0100",
    createdAt: new Date(),
    dni: "123",
    conversionDate: new Date(),
    baptismDate: new Date(),
    birthdate: new Date(),
    isMinister: false,
    isTreasurer: false,
    church: { churchId: "church-1", name: "Church" },
    active: true,
    settings: {
      notifyPaymentCommitments: true,
      notifyChurchEvents: true,
      notifyStatusContributions: true,
      lang: "pt-BR",
    },
  })

describe("UpdateMember", () => {
  const memberRepository = {
    one: jest.fn(),
    upsert: jest.fn(),
    list: jest.fn(),
    all: jest.fn(),
  } as unknown as jest.Mocked<IMemberRepository>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("throws when memberId is missing", async () => {
    const useCase = new UpdateMember(memberRepository)
    // @ts-expect-error testing invalid input
    await expect(useCase.execute({})).rejects.toBeInstanceOf(MemberNotFound)
  })

  it("throws when member does not exist", async () => {
    memberRepository.one.mockResolvedValue(undefined)
    const useCase = new UpdateMember(memberRepository)

    await expect(useCase.execute({ memberId: "member-1" })).rejects.toBeInstanceOf(
      MemberNotFound
    )
  })

  it("updates only provided fields", async () => {
    const member = createMember()
    memberRepository.one.mockResolvedValue(member)

    const useCase = new UpdateMember(memberRepository)
    await useCase.execute({ memberId: "member-1", active: false, email: "NEW@X.com" })

    expect(memberRepository.upsert).toHaveBeenCalledTimes(1)
    const persisted = memberRepository.upsert.mock.calls[0][0]
    const primitives = persisted.toPrimitives()
    expect(primitives.active).toBe(false)
    expect(primitives.email).toBe("new@x.com")
  })
})


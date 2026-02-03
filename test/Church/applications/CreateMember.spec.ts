import { CreateMember } from "@/Church/applications"
import {
  Church,
  ChurchStatus,
  CreateMemberRequest,
  IChurchRepository,
  IMemberRepository,
  MemberExist,
} from "@/Church/domain"
import { type IQueueService, QueueName } from "@/package/queue/domain"

const createChurch = (): Church =>
  Church.fromPrimitives({
    id: "church-db-id",
    churchId: "church-1",
    name: "Church",
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
  })

const validRequest = (
  overrides: Partial<CreateMemberRequest> = {}
): CreateMemberRequest => ({
  name: "John Doe",
  email: "john@church.com",
  phone: "555-0100",
  dni: "123",
  conversionDate: new Date(),
  baptismDate: new Date(),
  isTreasurer: false,
  churchId: "church-1",
  birthdate: new Date(),
  active: true,
  ...overrides,
})

describe("CreateMember", () => {
  const memberRepository = {
    one: jest.fn(),
    upsert: jest.fn(),
    list: jest.fn(),
    all: jest.fn(),
  } as unknown as jest.Mocked<IMemberRepository>

  const churchRepository = {
    one: jest.fn(),
    upsert: jest.fn(),
    list: jest.fn(),
    listByDistrictId: jest.fn(),
    hasAnAssignedMinister: jest.fn(),
    withoutAssignedMinister: jest.fn(),
  } as unknown as jest.Mocked<IChurchRepository>

  const queueService = {
    dispatch: jest.fn(),
  } as jest.Mocked<IQueueService>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("throws when member already exists", async () => {
    memberRepository.one.mockResolvedValue({} as any)

    const useCase = new CreateMember(
      memberRepository,
      churchRepository,
      queueService
    )
    await expect(useCase.execute(validRequest())).rejects.toBeInstanceOf(
      MemberExist
    )
  })

  it("creates member, persists and dispatches queue", async () => {
    memberRepository.one.mockResolvedValue(undefined)
    churchRepository.findById.mockResolvedValue(createChurch())

    const useCase = new CreateMember(
      memberRepository,
      churchRepository,
      queueService
    )
    await useCase.execute(validRequest({ active: false }))

    expect(memberRepository.upsert).toHaveBeenCalledTimes(1)
    const member = memberRepository.upsert.mock.calls[0][0]
    expect(member.toPrimitives().active).toBe(false)

    expect(queueService.dispatch).toHaveBeenCalledWith(
      QueueName.CreateUserForMemberJob,
      member
    )
  })
})

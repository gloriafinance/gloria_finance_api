jest.mock("@/Shared/adapter", () => ({
  Logger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
  IdentifyEntity: {
    get: jest.fn((entity: string) => `${entity}-id`),
  },
  Urn: {
    create: jest.fn(({ entity, churchId }: any) => `urn:${entity}:${churchId}`),
    id: jest.fn((urn: string) => urn.split(":")[2]),
  },
}))

import { CreateUserForMemberJob } from "@/SecuritySystem/applications/CreateUserForMember.job"
import { Member, MemberStatus } from "@/Church/domain"
import type { IMemberRepository } from "@/Church/domain"
import type { IPasswordAdapter, IUserRepository } from "@/SecuritySystem/domain"
import type { IQueueService } from "@/package/queue/domain"

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
    status: MemberStatus.APPROVED,
    settings: {
      notifyPaymentCommitments: true,
      notifyChurchEvents: true,
      notifyStatusContributions: true,
      lang: "pt-BR",
    },
  })

describe("CreateUserForMemberJob", () => {
  const userRepository = {
    findByEmail: jest.fn(),
    findByUserId: jest.fn(),
    findByMemberIdAndChurchId: jest.fn(),
    deleteByUserId: jest.fn(),
    upsert: jest.fn(),
    one: jest.fn(),
    list: jest.fn(),
    updatePassword: jest.fn(),
  } as unknown as jest.Mocked<IUserRepository>

  const passwordAdapter = {
    encrypt: jest.fn(),
    check: jest.fn(),
  } as unknown as jest.Mocked<IPasswordAdapter>

  const memberRepository = {
    one: jest.fn(),
    upsert: jest.fn(),
    list: jest.fn(),
    all: jest.fn(),
    deleteByMemberId: jest.fn(),
  } as unknown as jest.Mocked<IMemberRepository>

  const queueService = {
    dispatch: jest.fn(),
  } as unknown as jest.Mocked<IQueueService>

  const buildJob = () =>
    new CreateUserForMemberJob(
      userRepository,
      passwordAdapter,
      memberRepository,
      queueService
    )

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("creates user and dispatches bootstrap when member still exists", async () => {
    const member = createMember()
    memberRepository.one.mockResolvedValue(member)
    userRepository.findByEmail.mockResolvedValue(undefined)
    userRepository.upsert.mockResolvedValue(undefined)

    passwordAdapter.encrypt.mockResolvedValue("hashed-password")

    await buildJob().handle(member.toPrimitives())

    expect(memberRepository.one).toHaveBeenCalledWith({
      memberId: "member-1",
      "church.churchId": "church-1",
    })
    expect(userRepository.upsert).toHaveBeenCalledTimes(1)
    expect(queueService.dispatch).toHaveBeenCalledTimes(1)
  })

  it("skips creation when member was deleted before job runs", async () => {
    const member = createMember()
    memberRepository.one.mockResolvedValue(null)

    await buildJob().handle(member.toPrimitives())

    expect(memberRepository.one).toHaveBeenCalledWith({
      memberId: "member-1",
      "church.churchId": "church-1",
    })
    expect(userRepository.findByEmail).not.toHaveBeenCalled()
    expect(userRepository.upsert).not.toHaveBeenCalled()
    expect(queueService.dispatch).not.toHaveBeenCalled()
  })

  it("skips creation when user already exists", async () => {
    const member = createMember()
    memberRepository.one.mockResolvedValue(member)
    userRepository.findByEmail.mockResolvedValue({ getUserId: () => "user-1" } as any)

    await buildJob().handle(member.toPrimitives())

    expect(userRepository.upsert).not.toHaveBeenCalled()
    expect(queueService.dispatch).not.toHaveBeenCalled()
  })
})

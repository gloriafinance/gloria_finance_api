import { DeleteMember } from "@/Church/applications/members/DeleteMember"
import {
  IMemberRepository,
  Member,
  MemberNotFound,
  MemberSelfDeletionNotAllowed,
  MemberStatus,
} from "@/Church/domain"
import type { IUserRepository } from "@/SecuritySystem/domain/interfaces/UserRepository.interface"
import type { IUserAssignmentRepository } from "@/SecuritySystem/domain/interfaces/rbac"
import type { IStorageService } from "@/Shared/domain"
import { AuthorizationService } from "@/SecuritySystem/applications/rbac/AuthorizationService"

const createMember = (overrides: Partial<Member> = {}): Member =>
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
    ...overrides,
  })

const createUser = (overrides: Partial<Record<string, unknown>> = {}): any => ({
  getUserId: () => "user-1",
  getMemberId: () => "member-1",
  ...overrides,
})

describe("DeleteMember", () => {
  const memberRepository = {
    one: jest.fn(),
    deleteByMemberId: jest.fn(),
  } as unknown as jest.Mocked<IMemberRepository>

  const userRepository = {
    findByMemberIdAndChurchId: jest.fn(),
    deleteByUserId: jest.fn(),
  } as unknown as jest.Mocked<IUserRepository>

  const userAssignmentRepository = {
    deleteByUser: jest.fn(),
  } as unknown as jest.Mocked<IUserAssignmentRepository>

  const storage = {
    deleteFile: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<IStorageService>

  const authorizationService = {
    invalidateUserCache: jest.fn(),
  } as unknown as jest.Mocked<AuthorizationService>

  const buildUseCase = () =>
    new DeleteMember(
      memberRepository,
      userRepository,
      userAssignmentRepository,
      storage,
      authorizationService
    )

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("deletes member, profile photo, linked user, assignment and invalidates cache", async () => {
    const member = createMember()
    member.setProfilePhoto("2026/7/profile.jpg")
    memberRepository.one.mockResolvedValue(member)
    userRepository.findByMemberIdAndChurchId.mockResolvedValue(createUser())

    await buildUseCase().execute({
      memberId: "member-1",
      churchId: "church-1",
      authenticatedUserId: "user-admin",
    })

    expect(memberRepository.deleteByMemberId).toHaveBeenCalledWith("member-1")
    expect(storage.deleteFile).toHaveBeenCalledWith("2026/7/profile.jpg")
    expect(userRepository.deleteByUserId).toHaveBeenCalledWith("user-1")
    expect(userAssignmentRepository.deleteByUser).toHaveBeenCalledWith(
      "church-1",
      "user-1"
    )
    expect(authorizationService.invalidateUserCache).toHaveBeenCalledWith(
      "church-1",
      "user-1"
    )
  })

  it("throws when member does not exist", async () => {
    memberRepository.one.mockResolvedValue(null as any)

    await expect(
      buildUseCase().execute({
        memberId: "member-1",
        churchId: "church-1",
        authenticatedUserId: "user-admin",
      })
    ).rejects.toBeInstanceOf(MemberNotFound)

    expect(memberRepository.deleteByMemberId).not.toHaveBeenCalled()
  })

  it("throws when member belongs to another church", async () => {
    memberRepository.one.mockResolvedValue(null as any)

    await expect(
      buildUseCase().execute({
        memberId: "member-1",
        churchId: "church-2",
        authenticatedUserId: "user-admin",
      })
    ).rejects.toBeInstanceOf(MemberNotFound)
  })

  it("deletes member without linked user and skips user cleanup", async () => {
    const member = createMember()
    memberRepository.one.mockResolvedValue(member)
    userRepository.findByMemberIdAndChurchId.mockResolvedValue(undefined)

    await buildUseCase().execute({
      memberId: "member-1",
      churchId: "church-1",
      authenticatedUserId: "user-admin",
    })

    expect(memberRepository.deleteByMemberId).toHaveBeenCalledWith("member-1")
    expect(userRepository.deleteByUserId).not.toHaveBeenCalled()
    expect(userAssignmentRepository.deleteByUser).not.toHaveBeenCalled()
    expect(authorizationService.invalidateUserCache).not.toHaveBeenCalled()
  })

  it("prevents self-deletion when linked user matches authenticated user", async () => {
    const member = createMember()
    memberRepository.one.mockResolvedValue(member)
    userRepository.findByMemberIdAndChurchId.mockResolvedValue(
      createUser({ getUserId: () => "user-self" })
    )

    await expect(
      buildUseCase().execute({
        memberId: "member-1",
        churchId: "church-1",
        authenticatedUserId: "user-self",
      })
    ).rejects.toBeInstanceOf(MemberSelfDeletionNotAllowed)

    expect(memberRepository.deleteByMemberId).not.toHaveBeenCalled()
    expect(userRepository.deleteByUserId).not.toHaveBeenCalled()
  })

  it("logs storage failure but continues deletion", async () => {
    const member = createMember()
    member.setProfilePhoto("2026/7/profile.jpg")
    memberRepository.one.mockResolvedValue(member)
    userRepository.findByMemberIdAndChurchId.mockResolvedValue(undefined)
    storage.deleteFile.mockRejectedValue(new Error("storage unavailable"))

    await buildUseCase().execute({
      memberId: "member-1",
      churchId: "church-1",
      authenticatedUserId: "user-admin",
    })

    expect(memberRepository.deleteByMemberId).toHaveBeenCalledWith("member-1")
    expect(storage.deleteFile).toHaveBeenCalled()
  })
})

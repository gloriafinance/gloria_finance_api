const deleteMemberExecuteMock = jest.fn()

jest.mock("@/Church/applications/members/DeleteMember", () => ({
  DeleteMember: jest.fn().mockImplementation(() => ({
    execute: deleteMemberExecuteMock,
  })),
}))

jest.mock("@/Church/infrastructure", () => ({
  ChurchMongoRepository: {
    getInstance: jest.fn(() => ({} as any)),
  },
  MemberMongoRepository: {
    getInstance: jest.fn(() => ({} as any)),
  },
}))

jest.mock("@/SecuritySystem/infrastructure", () => ({
  UserMongoRepository: {
    getInstance: jest.fn(() => ({} as any)),
  },
  UserAssignmentMongoRepository: {
    getInstance: jest.fn(() => ({} as any)),
  },
  PermissionMongoRepository: {
    getInstance: jest.fn(() => ({} as any)),
  },
  RolePermissionMongoRepository: {
    getInstance: jest.fn(() => ({} as any)),
  },
}))

jest.mock("@/SecuritySystem/applications/rbac/AuthorizationService", () => ({
  AuthorizationService: {
    getInstance: jest.fn(() => ({} as any)),
  },
}))

jest.mock("@/Shared/infrastructure", () => ({
  PermissionMiddleware: jest.fn(),
  Can: jest.fn(() => jest.fn()),
  StorageProviderService: {
    getInstance: jest.fn(() => ({} as any)),
  },
  CacheProviderService: {
    getInstance: jest.fn(() => ({} as any)),
  },
}))

jest.mock("@/Shared/helpers/domainResponse", () => ({
  __esModule: true,
  default: jest.fn(),
}))

import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { MemberController } from "@/Church/infrastructure/http/controllers/Member.controller"

describe("MemberController - delete", () => {
  const buildRes = () => {
    const res = {
      status: jest.fn(),
      send: jest.fn(),
    }
    res.status.mockReturnValue(res)
    return res
  }

  const buildReq = (overrides?: Record<string, unknown>) =>
    ({
      auth: {
        churchId: "church-1",
        userId: "user-admin",
      },
      params: {
        memberId: "member-1",
      },
      ...overrides,
    }) as any

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("deletes member using churchId and userId from authentication", async () => {
    deleteMemberExecuteMock.mockResolvedValue(undefined)

    const controller = new MemberController()
    const res = buildRes()

    await controller.delete("member-1", buildReq(), res as any)

    expect(deleteMemberExecuteMock).toHaveBeenCalledWith({
      memberId: "member-1",
      churchId: "church-1",
      authenticatedUserId: "user-admin",
    })
    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK)
    expect(res.send).toHaveBeenCalledWith({
      message: "MEMBER_DELETED",
    })
  })

  it("resolves domain errors through domainResponse", async () => {
    const error = new Error("MEMBER_NOT_FOUND")
    deleteMemberExecuteMock.mockRejectedValue(error)

    const controller = new MemberController()
    const res = buildRes()

    await controller.delete("member-1", buildReq(), res as any)

    expect(domainResponse).toHaveBeenCalledWith(error, res)
  })
})

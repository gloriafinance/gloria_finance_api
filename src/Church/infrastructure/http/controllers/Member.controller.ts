import type {
  CreateMemberRequest,
  MemberPaginateRequest,
  UpdateMemberRequest,
} from "../../../domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { ApprovePendingMember } from "../../../applications/members/ApprovePendingMember"
import { AllMember } from "../../../applications/members/AllMember"
import { CreateMember } from "../../../applications/members/CreateMember"
import { DeleteMember } from "../../../applications/members/DeleteMember"
import { FindMemberById } from "../../../applications/members/FindMemberById"
import { FindPendingReviewMemberById } from "../../../applications/members/FindPendingReviewMemberById"
import { GetOrCreateMemberRegistrationLink } from "../../../applications/members/GetOrCreateMemberRegistrationLink"
import { RejectPendingMember } from "../../../applications/members/RejectPendingMember"
import { SearchMembers } from "../../../applications/members/SearchMembers"
import { SearchPendingReviewMembers } from "../../../applications/members/SearchPendingReviewMembers"
import { UpdateMember } from "../../../applications/members/UpdateMember"
import {
  ChurchMongoRepository,
  MemberMongoRepository,
} from "@/Church/infrastructure"
import {
  PermissionMongoRepository,
  RolePermissionMongoRepository,
  UserAssignmentMongoRepository,
  UserMongoRepository,
} from "@/SecuritySystem/infrastructure"
import { AuthorizationService } from "@/SecuritySystem/applications/rbac/AuthorizationService"
import { CacheProviderService } from "@/Shared/infrastructure/services/CacheProvider.service"
import { HttpStatus } from "@/Shared/domain"
import { QueueService } from "@/package/queue/infrastructure/QueueService.ts"
import { Cache } from "@/Shared/decorators"
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  type ServerResponse,
  Use,
} from "bun-platform-kit"
import {
  type AuthenticatedRequest,
  Can,
  PermissionMiddleware,
} from "@/Shared/infrastructure"
import { StorageProviderService } from "@/Shared/infrastructure"
import {
  CreateMemberValidator,
  UpdateMemberValidator,
} from "@/Church/infrastructure/http/validators/"

const normalizeDate = (value?: Date | string): Date | undefined => {
  if (!value) return undefined
  return value instanceof Date ? value : new Date(value)
}

@Controller("/api/v1/church/member")
export class MemberController {
  @Get("/list")
  @Use([PermissionMiddleware, Can("members", "manage")])
  async list(
    @Query() memberRequest: MemberPaginateRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const members = await new SearchMembers(
        MemberMongoRepository.getInstance()
      ).execute({
        ...memberRequest,
        churchId: req.auth.churchId!,
      })

      res.status(HttpStatus.OK).send(members)
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Get("/pending-review")
  @Use([PermissionMiddleware, Can("members", "manage")])
  async listPendingReview(
    @Query() memberRequest: MemberPaginateRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const members = await new SearchPendingReviewMembers(
        MemberMongoRepository.getInstance()
      ).execute({
        ...memberRequest,
        churchId: req.auth.churchId!,
      })

      res.status(HttpStatus.OK).send(members)
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Get("/pending-review/:memberId")
  @Use([PermissionMiddleware, Can("members", "manage")])
  async findPendingReviewById(
    @Param("memberId") memberId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const member = await new FindPendingReviewMemberById(
        MemberMongoRepository.getInstance()
      ).execute({
        memberId,
        churchId: req.auth.churchId!,
      })

      res.status(HttpStatus.OK).send(await this.mapMemberResponse(member))
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Cache("members", 600)
  @Get("/all")
  @Use([PermissionMiddleware, Can("members", "manage")])
  async all(@Req() req: AuthenticatedRequest, @Res() res: ServerResponse) {
    try {
      const members = await new AllMember(
        MemberMongoRepository.getInstance()
      ).execute(req.auth.churchId!)

      res.status(HttpStatus.OK).send(members)
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Get("/registration-link")
  @Use([PermissionMiddleware, Can("members", "registration_link")])
  async registrationLink(
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const result = await new GetOrCreateMemberRegistrationLink(
        ChurchMongoRepository.getInstance()
      ).execute(req.auth.churchId!)

      res.status(HttpStatus.OK).send(result)
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Get("/:memberId")
  @Use([PermissionMiddleware, Can("members", "manage")])
  async findById(
    @Param("memberId") memberId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const member = await new FindMemberById(
        MemberMongoRepository.getInstance()
      ).execute({
        memberId,
        churchId: req.auth.churchId!,
      })

      res.status(HttpStatus.OK).send(await this.mapMemberResponse(member))
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Patch("/:memberId/approve")
  @Use([PermissionMiddleware, Can("members", "manage")])
  async approve(
    @Param("memberId") memberId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      await new ApprovePendingMember(
        MemberMongoRepository.getInstance(),
        QueueService.getInstance()
      ).execute({
        memberId,
        churchId: req.auth.churchId!,
      })

      res.status(HttpStatus.OK).send({
        message: "MEMBER_APPROVED",
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Delete("/:memberId/reject")
  @Use([PermissionMiddleware, Can("members", "manage")])
  async reject(
    @Param("memberId") memberId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      await new RejectPendingMember(
        MemberMongoRepository.getInstance(),
        StorageProviderService.getInstance()
      ).execute({
        memberId,
        churchId: req.auth.churchId!,
      })

      res.status(HttpStatus.OK).send({
        message: "MEMBER_REJECTED",
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Delete("/:memberId")
  @Use([PermissionMiddleware, Can("members", "delete")])
  async delete(
    @Param("memberId") memberId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      await new DeleteMember(
        MemberMongoRepository.getInstance(),
        UserMongoRepository.getInstance(),
        UserAssignmentMongoRepository.getInstance(),
        StorageProviderService.getInstance(),
        AuthorizationService.getInstance(
          UserAssignmentMongoRepository.getInstance(),
          RolePermissionMongoRepository.getInstance(),
          PermissionMongoRepository.getInstance(),
          CacheProviderService.getInstance()
        )
      ).execute({
        memberId,
        churchId: req.auth.churchId!,
        authenticatedUserId: req.auth.userId!,
      })

      res.status(HttpStatus.OK).send({
        message: "MEMBER_DELETED",
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Put("/:memberId")
  @Use([PermissionMiddleware, UpdateMemberValidator, Can("members", "manage")])
  async update(
    @Param("memberId") memberId: string,
    @Body() request: UpdateMemberRequest,
    @Res() res: ServerResponse
  ) {
    try {
      await new UpdateMember(MemberMongoRepository.getInstance()).execute({
        ...request,
        memberId,
        conversionDate: normalizeDate(request.conversionDate),
        baptismDate: normalizeDate(request.baptismDate),
        birthdate: normalizeDate(request.birthdate),
      } as UpdateMemberRequest)

      res.status(HttpStatus.OK).send({
        message: "Updated member",
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Post("/")
  @Use([PermissionMiddleware, CreateMemberValidator, Can("members", "manage")])
  async create(
    @Body() request: CreateMemberRequest,
    @Res() res: ServerResponse
  ) {
    try {
      await new CreateMember(
        MemberMongoRepository.getInstance(),
        ChurchMongoRepository.getInstance(),
        QueueService.getInstance()
      ).execute({
        ...request,
        conversionDate: normalizeDate(request.conversionDate),
        baptismDate: normalizeDate(request.baptismDate),
        birthdate: normalizeDate(request.birthdate),
      } as CreateMemberRequest)

      res.status(HttpStatus.CREATED).send({
        message: "Registered member",
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  private async mapMemberResponse(member: any) {
    const response = {
      id: member.getId?.(),
      ...member.toPrimitives(),
    }

    if (response.profilePhoto) {
      response.profilePhoto =
        await StorageProviderService.getInstance().downloadFile(
          response.profilePhoto
        )
    }

    return response
  }
}

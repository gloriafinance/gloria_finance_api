import {
  CreateMemberRequest,
  MemberPaginateRequest,
  UpdateMemberRequest,
} from "../../../domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  AllMember,
  CreateMember,
  FindMemberById,
  SearchMembers,
  UpdateMember,
} from "../../../applications"
import {
  ChurchMongoRepository,
  MemberMongoRepository,
} from "@/Church/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import { QueueService } from "@/Shared/infrastructure/queue/QueueService"
import { Request, Response } from "express"
import { Cache } from "@/Shared/decorators"
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  Use,
} from "@abejarano/ts-express-server"
import { Can, PermissionMiddleware } from "@/Shared/infrastructure"
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
  async list(@Query() memberRequest: MemberPaginateRequest, res: Response) {
    try {
      const members = await new SearchMembers(
        MemberMongoRepository.getInstance()
      ).execute(memberRequest)

      res.status(HttpStatus.OK).send(members)
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Cache("members", 600)
  @Get("/all")
  @Use([PermissionMiddleware, Can("members", "manage")])
  async all(@Req() req: Request, @Res() res: Response) {
    try {
      const members = await new AllMember(
        MemberMongoRepository.getInstance()
      ).execute(req.auth.churchId)

      res.status(HttpStatus.OK).send(members)
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Get("/:memberId")
  @Use([PermissionMiddleware, Can("members", "manage")])
  async findById(memberId: string, res: Response) {
    try {
      const member = await new FindMemberById(
        MemberMongoRepository.getInstance()
      ).execute(memberId)

      res.status(HttpStatus.OK).send(member)
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Put("/:memberId")
  @Use([PermissionMiddleware, UpdateMemberValidator, Can("members", "manage")])
  async update(
    @Param("memberId") memberId: string,
    @Body() request: UpdateMemberRequest,
    res: Response
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
  async create(@Body() request: CreateMemberRequest, @Res() res: Response) {
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
}

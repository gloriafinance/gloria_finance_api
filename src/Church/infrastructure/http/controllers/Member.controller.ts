import { MemberPaginateRequest, MemberRequest } from "../../../domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  AllMember,
  CreateOrUpdateMember,
  FindMemberById,
  SearchMembers,
} from "../../../applications"
import {
  ChurchMongoRepository,
  MemberMongoRepository,
} from "@/Church/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import { QueueService } from "@/Shared/infrastructure/queue/QueueService"
import { Response } from "express"
import { Cache } from "@/Shared/decorators"

export class MemberController {
  static async createOrUpdate(memberRequest: MemberRequest, res: Response) {
    try {
      await new CreateOrUpdateMember(
        MemberMongoRepository.getInstance(),
        ChurchMongoRepository.getInstance(),
        QueueService.getInstance()
      ).execute(memberRequest)

      res.status(HttpStatus.CREATED).send({
        message: "Registered member",
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  static async list(memberRequest: MemberPaginateRequest, res: Response) {
    try {
      const members = await new SearchMembers(
        MemberMongoRepository.getInstance()
      ).execute(memberRequest)

      res.status(HttpStatus.OK).send(members)
    } catch (e) {
      domainResponse(e, res)
    }
  }

  static async findById(memberId: string, res: Response) {
    try {
      const member = await new FindMemberById(
        MemberMongoRepository.getInstance()
      ).execute(memberId)

      res.status(HttpStatus.OK).send(member)
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Cache("members", 600)
  static async all(churchId: string, res: Response) {
    try {
      const members = await new AllMember(
        MemberMongoRepository.getInstance()
      ).execute(churchId)

      res.status(HttpStatus.OK).send(members)
    } catch (e) {
      domainResponse(e, res)
    }
  }
}

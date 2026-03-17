import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Res,
  type ServerResponse,
  Use,
} from "bun-platform-kit"
import { DevotionalCommunityService } from "@/Church/applications/devotional/services/DevotionalCommunityService"
import {
  type CreateDevotionalCommentRequest,
  type SetDevotionalReactionRequest,
  type UpdateDevotionalCommentRequest,
} from "@/Church/domain"
import {
  DevotionalCommentMongoRepository,
  DevotionalMongoRepository,
  DevotionalReactionMongoRepository,
} from "@/Church/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  type AuthenticatedRequest,
  PermissionMiddleware,
} from "@/Shared/infrastructure"
import CreateDevotionalCommentValidator from "../validators/CreateDevotionalComment.validator"
import SetDevotionalReactionValidator from "../validators/SetDevotionalReaction.validator"
import UpdateDevotionalCommentValidator from "../validators/UpdateDevotionalComment.validator"

@Controller("/api/v1/church/devotional")
export class DevotionalCommunityController {
  @Get("/:devotionalId/community")
  @Use(PermissionMiddleware)
  async getCommunity(
    @Param("devotionalId") devotionalId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const data = await this.communityService().getCommunity(
        req.auth.churchId,
        devotionalId,
        req.auth.memberId
      )

      res.status(HttpStatus.OK).send({ data })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Put("/:devotionalId/reaction")
  @Use([PermissionMiddleware, SetDevotionalReactionValidator])
  async setReaction(
    @Param("devotionalId") devotionalId: string,
    @Body()
    body: Omit<
      SetDevotionalReactionRequest,
      "churchId" | "devotionalId" | "memberId"
    >,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    const memberId = this.requireMemberScope(req, res)
    if (!memberId) {
      return
    }

    try {
      const data = await this.communityService().setReaction({
        churchId: req.auth.churchId,
        devotionalId,
        memberId,
        reactionType: body.reactionType,
      })

      res.status(HttpStatus.OK).send({ data })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Delete("/:devotionalId/reaction")
  @Use(PermissionMiddleware)
  async clearReaction(
    @Param("devotionalId") devotionalId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    const memberId = this.requireMemberScope(req, res)
    if (!memberId) {
      return
    }

    try {
      const data = await this.communityService().clearReaction({
        churchId: req.auth.churchId,
        devotionalId,
        memberId,
      })

      res.status(HttpStatus.OK).send({ data })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Post("/:devotionalId/comments")
  @Use([PermissionMiddleware, CreateDevotionalCommentValidator])
  async addComment(
    @Param("devotionalId") devotionalId: string,
    @Body()
    body: Omit<
      CreateDevotionalCommentRequest,
      "churchId" | "devotionalId" | "memberId" | "authorName"
    >,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    const memberId = this.requireMemberScope(req, res)
    if (!memberId) {
      return
    }

    try {
      const data = await this.communityService().addComment({
        churchId: req.auth.churchId,
        devotionalId,
        memberId,
        authorName: req.auth.name,
        message: body.message,
      })

      res.status(HttpStatus.CREATED).send({ data })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Patch("/:devotionalId/comments/:commentId")
  @Use([PermissionMiddleware, UpdateDevotionalCommentValidator])
  async updateComment(
    @Param("devotionalId") devotionalId: string,
    @Param("commentId") commentId: string,
    @Body()
    body: Omit<
      UpdateDevotionalCommentRequest,
      "churchId" | "devotionalId" | "commentId" | "memberId"
    >,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    const memberId = this.requireMemberScope(req, res)
    if (!memberId) {
      return
    }

    try {
      const data = await this.communityService().updateComment({
        churchId: req.auth.churchId,
        devotionalId,
        commentId,
        memberId,
        message: body.message,
      })

      res.status(HttpStatus.OK).send({ data })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  private communityService() {
    return new DevotionalCommunityService(
      DevotionalMongoRepository.getInstance(),
      DevotionalReactionMongoRepository.getInstance(),
      DevotionalCommentMongoRepository.getInstance()
    )
  }

  private requireMemberScope(
    req: AuthenticatedRequest,
    res: ServerResponse
  ): string | undefined {
    if (!req.auth.memberId) {
      res.status(HttpStatus.FORBIDDEN).send({
        message: "Member scope is required for devotional community actions",
      })
      return undefined
    }

    return req.auth.memberId
  }
}

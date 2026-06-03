import { UpdateMemberProfilePhoto, FindMemberById } from "@/Church/applications"
import { MemberMongoRepository } from "@/Church/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  Controller,
  Get,
  Patch,
  Req,
  Res,
  type ServerResponse,
  Use,
} from "bun-platform-kit"
import {
  type AuthenticatedRequest,
  PermissionMiddleware,
} from "@/Shared/infrastructure"
import { StorageProviderService } from "@/Shared/infrastructure"
import { UpdateMemberProfilePhotoValidator } from "../validators/UpdateMemberProfilePhoto.validator"

@Controller("/api/v1/member")
export class MemberProfileController {
  @Get("/profile")
  @Use([PermissionMiddleware])
  async profile(@Req() req: AuthenticatedRequest, @Res() res: ServerResponse) {
    try {
      const memberId = req.auth?.memberId
      if (!memberId) {
        return res.status(HttpStatus.FORBIDDEN).send({
          message: "Authenticated member scope is required",
        })
      }

      const member = await new FindMemberById(
        MemberMongoRepository.getInstance()
      ).execute({
        memberId,
        churchId: req.auth.churchId,
      })

      res.status(HttpStatus.OK).send(await this.mapMemberResponse(member))
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Patch("/profile/photo")
  @Use([PermissionMiddleware, UpdateMemberProfilePhotoValidator])
  async updateProfilePhoto(
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const memberId = req.auth?.memberId
      if (!memberId) {
        return res.status(HttpStatus.FORBIDDEN).send({
          message: "Authenticated member scope is required",
        })
      }

      const profilePhoto = (req as any).body?.profilePhoto

      const result = await new UpdateMemberProfilePhoto(
        MemberMongoRepository.getInstance()
      ).execute({
        churchId: req.auth.churchId,
        memberId,
        profilePhoto,
      })

      res.status(HttpStatus.OK).send({
        message: "MEMBER_PROFILE_PHOTO_UPDATED",
        profilePhoto: result.profilePhoto,
        profilePhotoUrl: result.profilePhotoUrl,
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
      response.profilePhotoUrl =
        await StorageProviderService.getInstance().downloadFile(
          response.profilePhoto
        )
    }

    return response
  }
}

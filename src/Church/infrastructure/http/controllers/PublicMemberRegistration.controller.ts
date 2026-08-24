import {
  GetPublicChurchByToken,
  RegisterMemberByToken,
} from "../../../applications"
import {
  ChurchMongoRepository,
  MemberMongoRepository,
} from "@/Church/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  type ServerResponse,
} from "bun-platform-kit"
import { MemberAlreadyExists, TokenNotFound } from "@/Church/domain"
import { StorageProviderService } from "@/Shared/infrastructure"
import {
  issueProfilePhotoUploadReceipt,
  verifyProfilePhotoUploadReceipt,
} from "../ProfilePhotoUploadReceipt"
import { uploadRawProfilePhoto } from "../ProfilePhotoRawUpload"

@Controller("/api/v1/public/member-registration")
export class PublicMemberRegistrationController {
  @Get("/:token")
  async getChurchByToken(
    @Param("token") token: string,
    @Res() res: ServerResponse
  ) {
    try {
      const result = await new GetPublicChurchByToken(
        ChurchMongoRepository.getInstance()
      ).execute(token)

      res.status(HttpStatus.OK).send(result)
    } catch (e) {
      if (e instanceof TokenNotFound) {
        return res.status(HttpStatus.NOT_FOUND).send({
          code: "TOKEN_NOT_FOUND",
          message: "The registration link is invalid or has expired",
        })
      }
      domainResponse(e, res)
    }
  }

  @Post("/:token")
  async register(
    @Param("token") token: string,
    @Req() req: any,
    @Res() res: ServerResponse
  ) {
    try {
      const body = req.body ?? {}
      const stagedProfilePhotoPath = verifyProfilePhotoUploadReceipt(
        body.profilePhotoUploadReceipt?.toString() ?? "",
        token
      )
      if (!stagedProfilePhotoPath) {
        return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
          code: "PROFILE_PHOTO_UPLOAD_REQUIRED",
          message: "A valid profile photo upload is required",
        })
      }

      const fullName = body.fullName?.toString().trim()
      const phone = body.phone?.toString().trim()
      const lgpdConsentAccepted =
        body.lgpdConsentAccepted?.toString() === "true"

      if (!fullName || !phone || !lgpdConsentAccepted) {
        return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
          code: "INVALID_PAYLOAD",
          message: "fullName, phone and lgpdConsentAccepted are required",
        })
      }

      const birthdateRaw = body.birthdate
      const birthdate = birthdateRaw ? new Date(birthdateRaw) : undefined

      const result = await new RegisterMemberByToken(
        MemberMongoRepository.getInstance(),
        ChurchMongoRepository.getInstance()
      ).execute({
        token,
        fullName,
        phone,
        lgpdConsentAccepted,
        stagedProfilePhotoPath,
        email: body.email?.toString().trim(),
        dni: body.dni?.toString().trim(),
        birthdate,
        gender: body.gender,
        address: body.address
          ? {
              street: body.address.street?.toString().trim(),
              number: body.address.number?.toString().trim(),
              complement: body.address.complement?.toString().trim(),
              district: body.address.district?.toString().trim(),
              city: body.address.city?.toString().trim(),
              state: body.address.state?.toString().trim(),
              zipCode: body.address.zipCode?.toString().trim(),
            }
          : undefined,
      })

      res.status(HttpStatus.OK).send(result)
    } catch (e) {
      if (e instanceof TokenNotFound) {
        return res.status(HttpStatus.NOT_FOUND).send({
          code: "TOKEN_NOT_FOUND",
          message: "The registration link is invalid or has expired",
        })
      }
      if (e instanceof MemberAlreadyExists) {
        return res.status(HttpStatus.CONFLICT).send({
          code: "MEMBER_ALREADY_EXISTS",
          message: "A member with this document or email already exists",
        })
      }
      domainResponse(e, res)
    }
  }

  @Post("/:token/photo")
  async uploadPhoto(
    @Param("token") token: string,
    @Req() req: { raw?: Request },
    @Res() res: ServerResponse
  ) {
    try {
      await new GetPublicChurchByToken(
        ChurchMongoRepository.getInstance()
      ).execute(token)
      if (!req.raw) {
        return res.status(HttpStatus.BAD_REQUEST).send({
          code: "PROFILE_PHOTO_REQUIRED",
          message: "Profile photo is required",
        })
      }
      const stagedProfilePhotoPath = await uploadRawProfilePhoto(
        req.raw,
        res,
        StorageProviderService.getInstance()
      )
      if (!stagedProfilePhotoPath) return

      res.status(HttpStatus.OK).send({
        profilePhotoUploadReceipt: issueProfilePhotoUploadReceipt(
          token,
          stagedProfilePhotoPath
        ),
      })
    } catch (e) {
      if (e instanceof TokenNotFound) {
        return res.status(HttpStatus.NOT_FOUND).send({
          code: "TOKEN_NOT_FOUND",
          message: "The registration link is invalid or has expired",
        })
      }
      domainResponse(e, res)
    }
  }
}

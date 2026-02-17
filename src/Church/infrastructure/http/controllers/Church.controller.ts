import { HttpStatus } from "@/Shared/domain"
import { GenericException } from "@/Shared/domain/exceptions/generic-exception"
import domainResponse from "../../../../Shared/helpers/domainResponse"
import { Church } from "../../../domain"
import type { ChurchPaginateRequest, ChurchRequest } from "../../../domain"
import {
  CreateOrUpdateChurch,
  UploadChurchLogo,
  FindChurchById,
  RemoveMinister,
  SearchChurches,
  SearchChurchesByDistrictId,
  WithoutAssignedMinister,
} from "../../../applications"
import {
  ChurchMongoRepository,
  MinisterMongoRepository,
} from "@/Church/infrastructure"
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
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
  StorageProviderService,
} from "@/Shared/infrastructure"
import { Logger } from "@/Shared/adapter"

@Controller("/api/v1/church")
export class ChurchController {
  private readonly logger = Logger(ChurchController.name)

  @Post("/")
  @Use([PermissionMiddleware, Can("church", "upsert")])
  async createOrUpdate(@Body() req: ChurchRequest, @Res() res: ServerResponse) {
    try {
      const church = await new CreateOrUpdateChurch(
        ChurchMongoRepository.getInstance()
        //RegionMongoRepository.getInstance(),
      ).execute(req)

      if (req.churchId) {
        return res
          .status(HttpStatus.CREATED)
          .send({ message: "Dados da igreja atualizados" })
      }

      res.status(HttpStatus.CREATED).send({ message: "Igreja cadastrada" })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Post("/logo")
  @Use([PermissionMiddleware, Can("church", "upsert")])
  async uploadLogo(
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const files = req.files?.file
      const file = Array.isArray(files) ? files[0] : files

      if (!file) {
        throw new GenericException("Field `file` is required")
      }

      const { url } = await new UploadChurchLogo(
        ChurchMongoRepository.getInstance()
      ).execute(req.auth.churchId, file)

      res.status(HttpStatus.OK).send({
        message: "Church logo updated successfully",
        url,
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Get("/")
  @Use(PermissionMiddleware)
  async list(@Param() req: ChurchPaginateRequest, @Res() res: ServerResponse) {
    try {
      const churches = await new SearchChurches(
        ChurchMongoRepository.getInstance()
      ).execute(req)

      res.status(HttpStatus.OK).send(
        churches
        //{
        // data: PaginateChurchDto(
        //   churches,
        //   await MinisterMongoRepository.getInstance().allActive(),
        // ),
        //}
      )
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Get("/list/by-district-id")
  @Use([PermissionMiddleware, Can("church", "search")])
  async listByDistrictId(
    @Query() params: { districtId: string },
    @Res() res: ServerResponse
  ) {
    try {
      const churches = await new SearchChurchesByDistrictId(
        ChurchMongoRepository.getInstance()
      ).execute(params.districtId)

      res.status(HttpStatus.OK).send({
        data: churches,
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Get("/:churchId")
  @Use([PermissionMiddleware, Can("church", "search")])
  async findByChurchId(
    @Param("churchId") churchId: string,
    @Res() res: ServerResponse
  ) {
    try {
      const church: Church = await new FindChurchById(
        ChurchMongoRepository.getInstance()
      ).execute(churchId)

      res.status(HttpStatus.OK).send(await this.churchResponse(church))
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Post("/remove-minister/:churchId")
  @Use([PermissionMiddleware, Can("ministers", "manage")])
  async removeMinister(
    @Param("churchId") churchId: string,
    @Res() res: ServerResponse
  ) {
    try {
      await new RemoveMinister(
        MinisterMongoRepository.getInstance(),
        ChurchMongoRepository.getInstance()
      ).execute(churchId)

      res.status(HttpStatus.OK).send({ message: "Minister removed" })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Get("/without-assigned-minister")
  @Use([PermissionMiddleware, Can("church", "search")])
  async listWithoutAssignedMinister(
    @Query() params: ChurchPaginateRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const churches = await new WithoutAssignedMinister(
        ChurchMongoRepository.getInstance()
      ).execute()

      res.status(HttpStatus.OK).send({
        data: churches,
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  private async churchResponse(church: Church) {
    const payload = church.toPrimitives()
    delete payload.accessTokenSecretId

    let logoUrl = payload.logoUrl
    if (typeof logoUrl === "string" && logoUrl.trim()) {
      try {
        logoUrl =
          await StorageProviderService.getInstance().downloadFile(logoUrl)
      } catch (error: any) {
        this.logger.error("Unable to resolve signed URL for church logo", {
          churchId: church.getChurchId(),
          logoPath: payload.logoUrl,
          message: error?.message ?? "Unknown error",
        })
      }
    }

    return {
      id: church.getId(),
      ...payload,
      logoUrl,
      isWhatsappConnected: church.isWhatsappConnected(),
    }
  }
}

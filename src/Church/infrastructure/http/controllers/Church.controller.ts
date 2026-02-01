import { HttpStatus } from "@/Shared/domain"
import domainResponse from "../../../../Shared/helpers/domainResponse"
import { Church } from "../../../domain"
import type { ChurchPaginateRequest, ChurchRequest } from "../../../domain"
import {
  CreateOrUpdateChurch,
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
  Res,
  type ServerResponse,
  Use,
} from "bun-platform-kit"
import { Can, PermissionMiddleware } from "@/Shared/infrastructure"
type AuthContext = {
  userId: string
  churchId: string
  roles: string[]
  permissions: string[]
}

@Controller("/api/v1/church")
export class ChurchController {
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

      res.status(HttpStatus.OK).send(church)
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
}

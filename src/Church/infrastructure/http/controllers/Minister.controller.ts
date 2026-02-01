import type { MinisterRequest } from "../../../domain"
import { AssignChurch, RegisterOrUpdateMinister } from "../../../applications"
import { HttpStatus } from "../../../../Shared/domain"
import domainResponse from "../../../../Shared/helpers/domainResponse"
import { MinisterMongoRepository } from "../../persistence/MinisterMongoRepository"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import { Body, Controller, Post, Res, Use } from "bun-platform-kit"
import { Can, PermissionMiddleware } from "@/Shared/infrastructure"
import MinisterValidator from "@/Church/infrastructure/http/validators/Mininister.validator"
import AssignChurchValidator from "@/Church/infrastructure/http/validators/AssignChurch.validator"

@Controller("/api/v1/minister")
export class MinisterController {
  @Post("/")
  @Use([PermissionMiddleware, Can("ministers", "manage"), MinisterValidator])
  async createOrUpdate(
    @Body() request: MinisterRequest,
    @Res() res: ServerResponse
  ) {
    try {
      await new RegisterOrUpdateMinister(
        MinisterMongoRepository.getInstance()
      ).execute(request)

      res.status(HttpStatus.CREATED).send({
        message: "Registered minister",
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Post("/assign-church")
  @Use([
    PermissionMiddleware,
    Can("ministers", "manage"),
    AssignChurchValidator,
  ])
  async assignChurch(
    @Body() payload: { churchId: string; ministerId: string },
    @Res() res: ServerResponse
  ) {
    try {
      await new AssignChurch(
        MinisterMongoRepository.getInstance(),
        ChurchMongoRepository.getInstance()
      ).execute(payload.ministerId, payload.churchId)

      res.status(HttpStatus.OK).send({ message: "Assigned church" })
    } catch (e) {
      domainResponse(e, res)
    }
  }
}

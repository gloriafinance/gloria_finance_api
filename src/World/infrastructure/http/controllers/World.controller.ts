import { Controller, Get, Param, Res, Use } from "bun-platform-kit"
import type { ServerResponse } from "bun-platform-kit"

import domainResponse from "@/Shared/helpers/domainResponse"
import { HttpStatus } from "@/Shared/domain"
import { FindStateByCountryId } from "@/World/applications"
import { WorldMongoRepository } from "@/World/infrastructure/persistence/WorldMongoRepository"
import { Can, PermissionMiddleware } from "@/Shared/infrastructure"

@Controller("/api/v1/world")
export class WorldController {
  @Get("/states/:countryId")
  @Use([PermissionMiddleware, Can("world", "states_read")])
  async listStatesByCountry(
    @Param("countryId") countryId: string,
    @Res() res: ServerResponse
  ) {
    try {
      const states = await new FindStateByCountryId(
        WorldMongoRepository.getInstance()
      ).run(countryId)

      res.status(HttpStatus.OK).send({ data: states })
    } catch (e) {
      domainResponse(e, res)
    }
  }
}

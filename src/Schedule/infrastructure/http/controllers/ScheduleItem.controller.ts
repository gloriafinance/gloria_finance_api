import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  Use,
} from "bun-platform-kit"

import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  ActivateScheduleItem,
  CreateScheduleItem,
  DeactivateScheduleItem,
  GetScheduleItem,
  ListScheduleItemsConfig,
  ListWeeklyScheduleOccurrences,
  UpdateScheduleItem,
} from "@/Schedule/application"
import { ScheduleItemMongoRepository } from "@/Schedule/infrastructure"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import {
  type CreateScheduleEventRequest,
  type ListScheduleEventsFiltersRequest,
  type UpdateScheduleEventRequest,
  WeeklyScheduleOccurrencesRequest,
} from "@/Schedule/domain/requests/ScheduleItem.request"
import { Can, PermissionMiddleware } from "@/Shared/infrastructure"
import type { AuthenticatedRequest } from "@/Shared/infrastructure"
import CreateScheduleItemValidator from "../validators/CreateScheduleItem.validator"
import UpdateScheduleItemValidator from "../validators/UpdateScheduleItem.validator"
import ScheduleItemsQueryValidator from "../validators/ScheduleItemsQuery.validator"
import WeeklyScheduleQueryValidator from "../validators/WeeklyScheduleQuery.validator"

import { mapToConfigDTO } from "../utils/scheduleMapper"
import { ScheduleEventVisibility } from "@/Schedule/domain"
import { ensureChurchScope } from "../utils/scheduleScope"

type WeeklyScheduleQuery = Pick<
  WeeklyScheduleOccurrencesRequest,
  "weekStartDate" | "visibilityScope"
>

@Controller("/api/v1/schedule")
export class ScheduleController {
  @Post("/")
  @Use([
    PermissionMiddleware,
    Can("schedule", ["configure"]),
    CreateScheduleItemValidator,
  ])
  async createScheduleItem(
    @Body() body: CreateScheduleEventRequest,
    @Res() res: ServerResponse,
    @Req() req: AuthenticatedRequest
  ) {
    const churchId = ensureChurchScope(req, res)
    if (!churchId) return

    try {
      const scheduleItem = await new CreateScheduleItem(
        ScheduleItemMongoRepository.getInstance(),
        ChurchMongoRepository.getInstance()
      ).execute({
        ...body,
        churchId,
        currentUserId: req.auth?.userId,
      })

      res.status(HttpStatus.CREATED).send(mapToConfigDTO(scheduleItem))
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Get("/")
  @Use([
    PermissionMiddleware,
    Can("schedule", ["configure", "read"]),
    ScheduleItemsQueryValidator,
  ])
  async listScheduleItems(
    @Query() query: ListScheduleEventsFiltersRequest,
    @Res() res: ServerResponse,
    @Req() req: AuthenticatedRequest
  ) {
    const churchId = ensureChurchScope(req, res)
    if (!churchId) return

    try {
      const scheduleItems = await new ListScheduleItemsConfig(
        ScheduleItemMongoRepository.getInstance()
      ).execute({
        churchId,
        ...query,
      })

      res.status(HttpStatus.OK).send(scheduleItems)
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Get("/weekly")
  @Use([
    PermissionMiddleware,
    Can("schedule", ["configure", "read"]),
    WeeklyScheduleQueryValidator,
  ])
  async weeklySchedule(
    @Query() query: WeeklyScheduleQuery,
    @Res() res: ServerResponse,
    @Req() req: AuthenticatedRequest
  ) {
    const churchId = ensureChurchScope(req, res)
    if (!churchId) return

    try {
      const visibilityScope =
        query.visibilityScope ||
        (req.auth?.permissions?.some((permission) =>
          ["schedule:manage", "schedule:configure"].includes(permission)
        )
          ? ScheduleEventVisibility.INTERNAL_LEADERS
          : ScheduleEventVisibility.PUBLIC)

      const occurrences = await new ListWeeklyScheduleOccurrences(
        ScheduleItemMongoRepository.getInstance()
      ).execute({
        churchId,
        weekStartDate: query.weekStartDate,
        visibilityScope,
      })

      res.status(HttpStatus.OK).send(occurrences)
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Get("/:scheduleItemId")
  @Use([PermissionMiddleware, Can("schedule", ["configure", "read"])])
  async getScheduleItem(
    @Param("scheduleItemId") scheduleItemId: string,
    @Res() res: ServerResponse,
    @Req() req: AuthenticatedRequest
  ) {
    const churchId = ensureChurchScope(req, res)
    if (!churchId) return

    try {
      const scheduleItem = await new GetScheduleItem(
        ScheduleItemMongoRepository.getInstance()
      ).execute({
        churchId,
        scheduleItemId,
      })

      res.status(HttpStatus.OK).send(mapToConfigDTO(scheduleItem))
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Put("/:scheduleItemId")
  @Use([
    PermissionMiddleware,
    Can("schedule", ["configure"]),
    UpdateScheduleItemValidator,
  ])
  async updateScheduleItem(
    @Param("scheduleItemId") scheduleItemId: string,
    @Body() body: UpdateScheduleEventRequest,
    @Res() res: ServerResponse,
    @Req() req: AuthenticatedRequest
  ) {
    const churchId = ensureChurchScope(req, res)
    if (!churchId) return

    try {
      await new UpdateScheduleItem(
        ScheduleItemMongoRepository.getInstance()
      ).execute({
        ...body,
        churchId,
        scheduleItemId,
        currentUserId: req.auth?.userId,
      })

      const scheduleItem = await new GetScheduleItem(
        ScheduleItemMongoRepository.getInstance()
      ).execute({
        churchId,
        scheduleItemId,
      })

      res.status(HttpStatus.OK).send(mapToConfigDTO(scheduleItem))
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Delete("/:scheduleItemId")
  @Use([PermissionMiddleware, Can("schedule", ["configure"])])
  async deactivateScheduleItem(
    @Param("scheduleItemId") scheduleItemId: string,
    @Res() res: ServerResponse,
    @Req() req: AuthenticatedRequest
  ) {
    const churchId = ensureChurchScope(req, res)
    if (!churchId) return

    try {
      await new DeactivateScheduleItem(
        ScheduleItemMongoRepository.getInstance()
      ).execute({
        churchId,
        scheduleItemId,
        currentUserId: req.auth?.userId,
      })

      res
        .status(HttpStatus.OK)
        .send({ message: "Schedule item deactivated successfully" })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Post("/:scheduleItemId/reactivate")
  @Use([PermissionMiddleware, Can("schedule", ["configure"])])
  async activateScheduleItem(
    @Param("scheduleItemId") scheduleItemId: string,
    @Res() res: ServerResponse,
    @Req() req: AuthenticatedRequest
  ) {
    const churchId = ensureChurchScope(req, res)
    if (!churchId) return

    try {
      await new ActivateScheduleItem(
        ScheduleItemMongoRepository.getInstance()
      ).execute({
        churchId,
        scheduleItemId,
        currentUserId: req.auth?.userId,
      })

      res
        .status(HttpStatus.OK)
        .send({ message: "Schedule item activated successfully" })
    } catch (error) {
      domainResponse(error, res)
    }
  }
}

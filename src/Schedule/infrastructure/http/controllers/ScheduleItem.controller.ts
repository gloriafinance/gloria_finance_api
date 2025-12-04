import { Response } from "express"
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
} from "@abejarano/ts-express-server"
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
  CreateScheduleItemRequest,
  ListScheduleItemsFiltersRequest,
  UpdateScheduleItemRequest,
  WeeklyScheduleOccurrencesRequest,
} from "@/Schedule/domain/requests/ScheduleItem.request"
import {
  AuthenticatedRequest,
  Can,
  PermissionMiddleware,
} from "@/Shared/infrastructure"
import CreateScheduleItemValidator from "../validators/CreateScheduleItem.validator"
import UpdateScheduleItemValidator from "../validators/UpdateScheduleItem.validator"
import ScheduleItemsQueryValidator from "../validators/ScheduleItemsQuery.validator"
import WeeklyScheduleQueryValidator from "../validators/WeeklyScheduleQuery.validator"

import { mapToConfigDTO } from "../utils/scheduleMapper"
import { ScheduleItemVisibility } from "@/Schedule/domain"
import { ensureChurchScope } from "../utils/scheduleScope"

type WeeklyScheduleQuery = Pick<
  WeeklyScheduleOccurrencesRequest,
  "weekStartDate" | "visibilityScope"
>

@Controller("/api/v1/schedule")
export class ScheduleController {
  private readonly scheduleItemRepository =
    ScheduleItemMongoRepository.getInstance()
  private readonly churchRepository = ChurchMongoRepository.getInstance()

  @Post("/")
  @Use([
    PermissionMiddleware,
    Can("schedule", ["configure", "manage"]),
    CreateScheduleItemValidator,
  ])
  async createScheduleItem(
    @Body() body: CreateScheduleItemRequest,
    @Res() res: Response,
    @Req() req: AuthenticatedRequest
  ) {
    const churchId = ensureChurchScope(req, res)
    if (!churchId) return

    try {
      const scheduleItem = await new CreateScheduleItem(
        this.scheduleItemRepository,
        this.churchRepository
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
    Can("schedule", ["configure", "manage", "read"]),
    ScheduleItemsQueryValidator,
  ])
  async listScheduleItems(
    @Query() query: ListScheduleItemsFiltersRequest,
    @Res() res: Response,
    @Req() req: AuthenticatedRequest
  ) {
    const churchId = ensureChurchScope(req, res)
    if (!churchId) return

    try {
      const scheduleItems = await new ListScheduleItemsConfig(
        this.scheduleItemRepository
      ).execute({
        churchId,
        ...query,
      })

      res.status(HttpStatus.OK).send(scheduleItems)
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Get("/:scheduleItemId")
  @Use([PermissionMiddleware, Can("schedule", ["configure", "manage", "read"])])
  async getScheduleItem(
    @Param("scheduleItemId") scheduleItemId: string,
    @Res() res: Response,
    @Req() req: AuthenticatedRequest
  ) {
    const churchId = ensureChurchScope(req, res)
    if (!churchId) return

    try {
      const scheduleItem = await new GetScheduleItem(
        this.scheduleItemRepository
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
    Can("schedule", ["configure", "manage"]),
    UpdateScheduleItemValidator,
  ])
  async updateScheduleItem(
    @Param("scheduleItemId") scheduleItemId: string,
    @Body() body: UpdateScheduleItemRequest,
    @Res() res: Response,
    @Req() req: AuthenticatedRequest
  ) {
    const churchId = ensureChurchScope(req, res)
    if (!churchId) return

    try {
      await new UpdateScheduleItem(this.scheduleItemRepository).execute({
        ...body,
        churchId,
        scheduleItemId,
        currentUserId: req.auth?.userId,
      })

      const scheduleItem = await new GetScheduleItem(
        this.scheduleItemRepository
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
  @Use([PermissionMiddleware, Can("schedule", ["configure", "manage"])])
  async deactivateScheduleItem(
    @Param("scheduleItemId") scheduleItemId: string,
    @Res() res: Response,
    @Req() req: AuthenticatedRequest
  ) {
    const churchId = ensureChurchScope(req, res)
    if (!churchId) return

    try {
      await new DeactivateScheduleItem(this.scheduleItemRepository).execute({
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
  @Use([PermissionMiddleware, Can("schedule", ["configure", "manage"])])
  async activateScheduleItem(
    @Param("scheduleItemId") scheduleItemId: string,
    @Res() res: Response,
    @Req() req: AuthenticatedRequest
  ) {
    const churchId = ensureChurchScope(req, res)
    if (!churchId) return

    try {
      await new ActivateScheduleItem(this.scheduleItemRepository).execute({
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

  @Get("/weekly")
  @Use([PermissionMiddleware, WeeklyScheduleQueryValidator])
  async weeklySchedule(
    @Query() query: WeeklyScheduleQuery,
    @Res() res: Response,
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
          ? ScheduleItemVisibility.INTERNAL_LEADERS
          : ScheduleItemVisibility.PUBLIC)

      const occurrences = await new ListWeeklyScheduleOccurrences(
        this.scheduleItemRepository
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
}

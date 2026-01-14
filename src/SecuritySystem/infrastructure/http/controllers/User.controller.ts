import {
  AcceptPolicies,
  ChangePassword,
  CreateOrUpdateUser,
  MakeLogin,
} from "../../../applications"
import {
  AuthTokenAdapter,
  UserAssignmentMongoRepository,
  UserMongoRepository,
} from "@/SecuritySystem/infrastructure"
import { PasswordAdapter } from "../../adapters/Password.adapter"
import { HttpStatus } from "@/Shared/domain"

import domainResponse from "../../../../Shared/helpers/domainResponse"
import type {
  AcceptPoliciesRequest,
  CreateUserRequest,
  FilterUserRequest,
} from "../../../domain"
import { FetchAllUsers } from "../../../applications/finder/FetchAllUsers"
import { Logger } from "@/Shared/adapter"

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
  Use,
} from "@abejarano/ts-express-server"
import type { ServerResponse } from "@abejarano/ts-express-server"

import randomString from "@/Shared/helpers/randomString"
import { SendMailChangePassword } from "@/SendMail/applications"
import { PermissionMiddleware, QueueService } from "@/Shared/infrastructure"
import type { AuthenticatedRequest } from "@/Shared/infrastructure"
import { FindChurchById, FindMemberById } from "@/Church/applications"
import {
  ChurchMongoRepository,
  MemberMongoRepository,
} from "@/Church/infrastructure"

export type userLoginPayload = {
  email: string
  password: string
}

@Controller("/api/v1/user")
export class UserController {
  private logger = Logger(UserController.name)

  @Post("/login")
  async login(@Body() payload: userLoginPayload, res: ServerResponse) {
    try {
      const user = await new MakeLogin(
        UserMongoRepository.getInstance(),
        new PasswordAdapter()
      ).execute(payload.email, payload.password)

      let church: {
        churchId: string
        name: string
        lang: string
        country: string
        symbolFormatMoney: string
      }

      const c = await new FindChurchById(
        ChurchMongoRepository.getInstance()
      ).execute(user.getChurchId())

      church = {
        churchId: c.getChurchId(),
        name: c.getName(),
        lang: c.getLang(),
        country: c.getCountry(),
        symbolFormatMoney: c.getSymbolFormatMoney(),
      }

      if (!user.isSuperUser) {
        const member = await new FindMemberById(
          MemberMongoRepository.getInstance()
        ).execute(user.getMemberId())

        church = {
          ...church,
          churchId: member?.getChurch()?.churchId,
          name: member?.getChurch()?.name,
          lang: member?.getSettings()?.lang,
        }
      }

      const roles =
        await UserAssignmentMongoRepository.getInstance().findByUser(
          user.getChurchId(),
          user.getUserId()
        )

      const token = new AuthTokenAdapter().createToken({
        churchId: user.getChurchId(),
        userId: user.getUserId(),
        email: user.getEmail(),
        name: user.getName(),
        memberId: user.getMemberId(),
        lang: church.lang,
        symbolFormatMoney: church.symbolFormatMoney,
        isSuperUser: user.isSuperUser,
      })

      const responseUser = user.toPrimitives()

      delete responseUser.password
      delete responseUser.churchId

      res.status(HttpStatus.OK).send({
        ...responseUser,
        church,
        roles: roles.getRoles(),
        token,
      })
    } catch (e) {
      this.logger.error(`login error`, e)
      domainResponse(e, res)
    }
  }

  @Put("/edit-user/:userId")
  @Post("/create")
  @Use(PermissionMiddleware)
  async createOrUpdateUser(
    @Body() payload: CreateUserRequest,
    @Param("userId") userId: string,
    res: ServerResponse
  ) {
    try {
      const user = await new CreateOrUpdateUser(
        UserMongoRepository.getInstance(),
        new PasswordAdapter()
      ).execute({
        ...payload,
        userId,
      })

      const response = user.toPrimitives()
      delete response.password

      res.status(HttpStatus.OK).send({
        message: "Usuario actualizado",
        ...response,
      })
    } catch (e) {
      this.logger.error(`create usuario error`, e)
      domainResponse(e, res)
    }
  }

  @Post("/accept-policies")
  @Use(PermissionMiddleware)
  async acceptPolicies(
    @Body() payload: AcceptPoliciesRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      if (!req.auth?.userId) {
        return res.status(HttpStatus.UNAUTHORIZED).send({
          message: "Unauthorized.",
        })
      }

      if (
        !payload?.privacyPolicyVersion ||
        !payload?.sensitiveDataPolicyVersion
      ) {
        return res.status(HttpStatus.BAD_REQUEST).send({
          message:
            "privacyPolicyVersion and sensitiveDataPolicyVersion are required",
        })
      }

      const user = await new AcceptPolicies(
        UserMongoRepository.getInstance()
      ).execute(
        req.auth.userId,
        payload.privacyPolicyVersion,
        payload.sensitiveDataPolicyVersion
      )

      const response = user.toPrimitives()
      delete response.password

      res.status(HttpStatus.OK).send({
        message: "Policies accepted",
        ...response,
      })
    } catch (e) {
      this.logger.error(`accept policies error`, e)
      domainResponse(e, res)
    }
  }

  @Get("/")
  @Use(PermissionMiddleware)
  async fetchAllUser(
    @Param() filter: FilterUserRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    const logger = Logger("FetchAllUserController")
    try {
      const result = await new FetchAllUsers(
        UserMongoRepository.getInstance()
      ).execute({ ...filter, churchId: req.auth.churchId })

      res.status(HttpStatus.OK).send({
        data: result,
      })
    } catch (e) {
      logger.error(`fetch all user error`, e)
      domainResponse(e, res)
    }
  }

  @Post("/recovery-password")
  async recoveryPassword(@Body() req: any, res: ServerResponse) {
    try {
      const temporalPassword = randomString(10)

      const user = await new ChangePassword(
        UserMongoRepository.getInstance(),
        new PasswordAdapter()
      ).execute(req.email ?? "", temporalPassword)

      new SendMailChangePassword(QueueService.getInstance()).execute(
        user,
        temporalPassword
      )

      res.status(HttpStatus.OK).send({
        message: "Temporal password generated",
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Post("/change-password")
  async changePassword(
    @Body()
    payload: {
      email: string
      newPassword: string
      oldPassword: string
    },
    res: ServerResponse
  ) {
    try {
      await new MakeLogin(
        UserMongoRepository.getInstance(),
        new PasswordAdapter()
      ).execute(payload.email, payload.oldPassword)

      await new ChangePassword(
        UserMongoRepository.getInstance(),
        new PasswordAdapter()
      ).execute(payload.email, payload.newPassword)

      res.status(200).send({
        message: "Senha alterada com sucesso",
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }
}

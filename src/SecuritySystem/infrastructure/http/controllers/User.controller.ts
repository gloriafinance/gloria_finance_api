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
import {
  AcceptPoliciesRequest,
  CreateUserRequest,
  FilterUserRequest,
} from "../../../domain"
import { FetchAllUsers } from "../../../applications/finder/FetchAllUsers"
import { Logger } from "@/Shared/adapter"
import { Request, Response } from "express"
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
import randomString from "@/Shared/helpers/randomString"
import { SendMailChangePassword } from "@/SendMail/applications"
import { PermissionMiddleware, QueueService } from "@/Shared/infrastructure"
import { FindChurchById } from "@/Church/applications"
import { ChurchMongoRepository } from "@/Church/infrastructure"

export type userLoginPayload = {
  email: string
  password: string
}

@Controller("/api/v1/user")
export class UserController {
  private logger = Logger(UserController.name)

  @Post("/login")
  async login(@Body() payload: userLoginPayload, res: Response) {
    try {
      const { user, token } = await new MakeLogin(
        UserMongoRepository.getInstance(),
        new PasswordAdapter(),
        new AuthTokenAdapter()
      ).execute(payload.email, payload.password)

      const church = await new FindChurchById(
        ChurchMongoRepository.getInstance()
      ).execute(user.getChurchId())

      const roles =
        await UserAssignmentMongoRepository.getInstance().findByUser(
          user.getChurchId(),
          user.getUserId()
        )

      const responseUser = user.toPrimitives()

      delete responseUser.password
      delete responseUser.churchId

      res.status(HttpStatus.OK).send({
        ...responseUser,
        church: {
          churchId: user.getChurchId(),
          name: church?.getName() || "",
        },
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
    res: Response
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
    @Req() req: Request,
    @Res() res: Response
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
  async fetchAllUser(@Param() filter: FilterUserRequest, res: Response) {
    const logger = Logger("FetchAllUserController")
    try {
      const result = await new FetchAllUsers(
        UserMongoRepository.getInstance()
      ).execute(filter)

      res.status(HttpStatus.OK).send({
        data: result,
      })
    } catch (e) {
      logger.error(`fetch all user error`, e)
      domainResponse(e, res)
    }
  }

  @Post("/recovery-password")
  async recoveryPassword(@Body() req: any, res: Response) {
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
    res: Response
  ) {
    try {
      await new MakeLogin(
        UserMongoRepository.getInstance(),
        new PasswordAdapter(),
        new AuthTokenAdapter()
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

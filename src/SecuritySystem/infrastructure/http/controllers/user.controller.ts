import {
  ChangePassword,
  CreateOrUpdateUser,
  MakeLogin,
} from "../../../applications"
import { UserMongoRepository } from "../../persistence/UserMongoRepository"
import { PasswordAdapter } from "../../adapters/Password.adapter"
import { AuthTokenAdapter } from "../../adapters/AuthToken.adapter"
import { HttpStatus } from "../../../../Shared/domain"

import domainResponse from "../../../../Shared/helpers/domainResponse"
import { CreateUserRequest, FilterUserRequest } from "../../../domain"
import { FetchAllUsers } from "../../../applications/finder/FetchAllUsers"
import { Logger } from "../../../../Shared/adapter"
import { Response } from "express"
import { SendEmailChangePassword } from "../../../../SendMail/applications"
import randomString from "../../../../Shared/helpers/randomString"
import { QueueService } from "@/Shared/infrastructure"

export type userLoginPayload = {
  email: string
  password: string
}

export class UserController {
  static async login(payload: userLoginPayload, res) {
    const logger = Logger("LoginController")

    try {
      const { user, token } = await new MakeLogin(
        UserMongoRepository.getInstance(),
        new PasswordAdapter(),
        new AuthTokenAdapter()
      ).execute(payload.email, payload.password)

      const responseUser = user.toPrimitives()

      delete responseUser.password

      res.status(HttpStatus.OK).send({
        ...responseUser,
        token,
      })
    } catch (e) {
      logger.error(`login error`, e)
      domainResponse(e, res)
    }
  }

  static async createOrUpdateUser(payload: CreateUserRequest, res) {
    const logger = Logger("CreateOrUpdateUserController")
    try {
      const user = await new CreateOrUpdateUser(
        UserMongoRepository.getInstance(),
        new PasswordAdapter()
      ).execute(payload)

      const response = user.toPrimitives()
      delete response.password

      res.status(HttpStatus.OK).json({
        message: "Usuario actualizado",
        data: response,
      })
    } catch (e) {
      logger.error(`create usuario error`, e)
      domainResponse(e, res)
    }
  }

  static async fetchAllUser(req: FilterUserRequest, res) {
    const logger = Logger("FetchAllUserController")
    try {
      const result = await new FetchAllUsers(
        UserMongoRepository.getInstance()
      ).execute(req)

      res.status(HttpStatus.OK).send({
        data: result,
      })
    } catch (e) {
      logger.error(`fetch all user error`, e)
      domainResponse(e, res)
    }
  }
}

export const recoveryPassword = async (email: string, res: Response) => {
  const logger = Logger("GenerateTemporalPasswordController")
  try {
    const temporalPassword = randomString(10)

    const user = await new ChangePassword(
      UserMongoRepository.getInstance(),
      new PasswordAdapter()
    ).execute(email, temporalPassword)

    new SendEmailChangePassword(QueueService.getInstance()).execute(
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

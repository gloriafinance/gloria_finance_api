import { HttpStatus } from "../../../../Shared/domain"
import domainResponse from "../../../../Shared/helpers/domainResponse"
import { Church, ChurchPaginateRequest, ChurchRequest } from "../../../domain"
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

type AuthContext = {
  userId: string
  churchId: string
  roles: string[]
  permissions: string[]
}

export class ChurchController {
  static async createOrUpdate(req: ChurchRequest, res) {
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

  static async list(req: ChurchPaginateRequest, res) {
    try {
      const churches = await new SearchChurches(
        ChurchMongoRepository.getInstance()
      ).execute(req)

      res.status(HttpStatus.OK).send({
        // data: PaginateChurchDto(
        //   churches,
        //   await MinisterMongoRepository.getInstance().allActive(),
        // ),
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  static async listByDistrictId(districtId: string, res) {
    try {
      const churches = await new SearchChurchesByDistrictId(
        ChurchMongoRepository.getInstance()
      ).execute(districtId)

      res.status(HttpStatus.OK).send({
        data: churches,
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  static async findByChurchId(churchId: string, res) {
    try {
      const church: Church = await new FindChurchById(
        ChurchMongoRepository.getInstance()
      ).execute(churchId)

      res.status(HttpStatus.OK).send(church)
    } catch (e) {
      domainResponse(e, res)
    }
  }

  static async listWithoutAssignedMinister(res) {
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

  static async removeMinister(churchId: string, res) {
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
}

import domainResponse from "@/Shared/helpers/domainResponse"
import { BankRequest, ConceptType } from "@/Financial/domain"
import {
  CreateOrUpdateBank,
  FinBankByBankId,
  FindFinancialConceptsByChurchIdAndTypeConcept,
  SearchBankByChurchId,
} from "@/Financial/applications"
import {
  FinancialConceptMongoRepository,
  FinancialConfigurationMongoRepository,
} from "../../persistence"
import { HttpStatus } from "@/Shared/domain"
import { ChurchMongoRepository } from "@/Church/infrastructure"

export class FinancialConfigurationController {
  static async createOrUpdateBank(request: BankRequest, res) {
    try {
      await new CreateOrUpdateBank(
        FinancialConfigurationMongoRepository.getInstance(),
        ChurchMongoRepository.getInstance()
      ).execute(request)

      if (!request.bankId) {
        res.status(HttpStatus.CREATED).send({
          message: "Registered bank",
        })
      } else {
        res.status(HttpStatus.OK).send({ message: "Updated bank" })
      }
    } catch (e) {
      domainResponse(e, res)
    }
  }

  static async findBankByBankId(bankId: string, res) {
    try {
      const bank = await new FinBankByBankId(
        FinancialConfigurationMongoRepository.getInstance()
      ).execute(bankId)

      res.status(HttpStatus.OK).send(bank)
    } catch (e) {
      domainResponse(e, res)
    }
  }

  static async findFinancialConceptsByChurchIdAndTypeConcept(
    churchId: string,
    res,
    typeConcept?: ConceptType
  ) {
    try {
      const financial = await new FindFinancialConceptsByChurchIdAndTypeConcept(
        FinancialConceptMongoRepository.getInstance(),
        ChurchMongoRepository.getInstance()
      ).execute(churchId, typeConcept)

      res.status(HttpStatus.OK).send(financial)
    } catch (e) {
      domainResponse(e, res)
    }
  }

  static async listBankByChurchId(churchId: string, res) {
    try {
      const bank = await new SearchBankByChurchId(
        FinancialConfigurationMongoRepository.getInstance()
      ).execute(churchId)

      res.status(HttpStatus.OK).send(bank)
    } catch (e) {
      domainResponse(e, res)
    }
  }
}

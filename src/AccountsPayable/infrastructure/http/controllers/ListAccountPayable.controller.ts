import {
  AccountPayable,
  FilterAccountPayableRequest,
} from "@/AccountsPayable/domain"
import { Response } from "express"
import domainResponse from "@/Shared/helpers/domainResponse"
import { ListAccountsPayable } from "@/AccountsPayable/applications"
import { Logger } from "@/Shared/adapter"
import { HttpStatus } from "@/Shared/domain"
import { AccountsPayableMongoRepository } from "@/AccountsPayable/infrastructure/persistence"
import { Paginate } from "@abejarano/ts-mongodb-criteria"

/**
 * @function ListAccountPayableController
 * @description Handles the retrieval of accounts payable based on filtering criteria
 *
 * @param params
 * @param res
 *
 * @example
 * // Example request:
 * {
 *   "churchId": "church123",
 *   "startDate": "2023-01-01T00:00:00.000Z",
 *   "endDate": "2023-12-31T23:59:59.999Z",
 *   "status": "PENDING",
 *   "page": 1,
 *   "perPage": 10
 * }
 *
 * // Example response:
 * {
 *   "nextPag": 2,
 *   "count": 25,
 *   "results": [
 *   {
 *   "status": "PENDING",
 *   "createdAt": "2023-05-15T14:30:00.000Z",
 *   "updatedAt": "2023-05-15T14:30:00.000Z",
 *   "provider": {
 *      "providerType": "MEMBER",
 *      "providerDNI": "member123",
 *      "name": "John Doe",
 *      "phone": "123456789"
 *   },
 *   "accountPayableId": "acc123",
 *   "churchId": "church123",
 *   "description": "Monthly tithe",
 *   "amountTotal": 500,
 *   "amountPaid": 0,
 *   "amountPending": 500,
 *   "taxAmountTotal": 25,
 *   "taxMetadata": {
 *        "status": "TAXED",
 *        "cstCode": "101",
 *        "cfop": "5933",
 *        "observation": "Retenção padrão"
 *   },
 *   "taxes": [
 *        {
 *          "taxType": "ISS",
 *          "percentage": 5,
 *          "amount": 25
 *        }
 *    ],
 *   "installments": [
 *        {
 *          "installmentId": "inst123",
 *          "amount": 500,
 *          "dueDate": "2023-06-01T00:00:00.000Z",
 *          "status": "PENDING"
 *        }
 *    ]
 * }
 *
 */
export const ListAccountPayableController = async (
  params: FilterAccountPayableRequest,
  res: Response
) => {
  try {
    const logger = Logger("ListAccountPayableController")

    const list: Paginate<AccountPayable> = await new ListAccountsPayable(
      AccountsPayableMongoRepository.getInstance()
    ).execute(params)

    logger.info("Response list account payable", list)

    res.status(HttpStatus.OK).send(list)
  } catch (e) {
    domainResponse(e, res)
  }
}

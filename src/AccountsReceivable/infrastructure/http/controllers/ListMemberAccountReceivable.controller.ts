import {
  AccountReceivable,
  FilterMemberAccountReceivableRequest,
} from "@/AccountsReceivable/domain"
import { ListMemberAccountReceivable } from "@/AccountsReceivable/applications"
import { AccountsReceivableMongoRepository } from "@/AccountsReceivable/infrastructure/persistence/AccountsReceivableMongoRepository"
import { Response } from "express"
import domainResponse from "@/Shared/helpers/domainResponse"
import { HttpStatus } from "@/Shared/domain"
import { Paginate } from "@abejarano/ts-mongodb-criteria"

export const ListMemberAccountReceivableController = async (
  req: FilterMemberAccountReceivableRequest,
  res: Response
) => {
  try {
    const list: Paginate<AccountReceivable> =
      await new ListMemberAccountReceivable(
        AccountsReceivableMongoRepository.getInstance()
      ).execute(req)

    res.status(HttpStatus.OK).json(list)
  } catch (e) {
    domainResponse(e, res)
  }
}

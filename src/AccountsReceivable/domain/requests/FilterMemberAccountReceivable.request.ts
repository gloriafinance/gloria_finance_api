import {
  AccountReceivableType,
  AccountsReceivableStatus,
} from "@/AccountsReceivable/domain"
import { ListParams } from "@/Shared/domain"

export type FilterMemberAccountReceivableRequest = {
  memberId: string
  status?: AccountsReceivableStatus
  type?: AccountReceivableType
} & ListParams

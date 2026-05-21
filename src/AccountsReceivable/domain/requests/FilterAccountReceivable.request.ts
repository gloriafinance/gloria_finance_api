import {
  AccountReceivableType,
  AccountsReceivableStatus,
} from "@/AccountsReceivable/domain"
import { type ListParams } from "@/Shared/domain"

export type FilterAccountReceivableRequest = {
  status?: AccountsReceivableStatus
  type?: AccountReceivableType
} & ListParams

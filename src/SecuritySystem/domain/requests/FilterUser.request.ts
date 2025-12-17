import { ListParams } from "@/Shared/domain"

export type FilterUserRequest = {
  isSuperuser: string
  isActive: string
} & ListParams

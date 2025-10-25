import { DomainException } from "@/Shared/domain"

export class AssetNotFoundException extends DomainException {
  code = "ASSET_NOT_FOUND"
  message = "O bem patrimonial informado não foi encontrado."
}

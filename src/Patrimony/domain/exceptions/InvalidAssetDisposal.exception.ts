import { DomainException } from "@/Shared/domain"

export class InvalidAssetDisposalException extends DomainException {
  code = "INVALID_ASSET_DISPOSAL"
  message =
    "O status informado para a baixa do bem patrimonial é inválido para esta operação."
}

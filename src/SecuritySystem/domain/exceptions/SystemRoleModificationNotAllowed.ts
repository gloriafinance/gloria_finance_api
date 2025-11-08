import { DomainException } from "@/Shared/domain"

export class SystemRoleModificationNotAllowed extends DomainException {
  name = "SYSTEM_ROLE_MODIFICATION_NOT_ALLOWED"
  message = "Nao e possivel modificar um papel do sistema."
}

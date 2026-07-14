import { DomainException } from "@/Shared/domain"

export class MemberSelfDeletionNotAllowed extends DomainException {
  name = "MEMBER_SELF_DELETION_NOT_ALLOWED"
  message = "You cannot delete the member associated with your own user"
}

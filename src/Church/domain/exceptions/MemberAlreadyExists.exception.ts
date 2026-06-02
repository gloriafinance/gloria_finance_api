import { DomainException } from "@/Shared/domain"

export class MemberAlreadyExists extends DomainException {
  name = "MEMBER_ALREADY_EXISTS"
  message = "A member with this document or email already exists"
}

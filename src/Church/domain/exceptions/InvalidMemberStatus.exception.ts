import { DomainException } from "@/Shared/domain"

export class InvalidMemberStatus extends DomainException {
  name = "INVALID_MEMBER_STATUS"
  message = "The member status is invalid or missing"
}

import { DomainException } from "@/Shared/domain"

export class MemberMissingUserCredentials extends DomainException {
  name = "MEMBER_MISSING_USER_CREDENTIALS"
  message =
    "The member must have email and dni before approval can create a user"
}

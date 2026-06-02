import { DomainException } from "@/Shared/domain"

export class MemberNotPendingReview extends DomainException {
  name = "MEMBER_NOT_PENDING_REVIEW"
  message = "The member is not pending review"
}

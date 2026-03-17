import { DomainException } from "@/Shared/domain"

export class DevotionalCommentEditNotAllowed extends DomainException {
  name = "DEVOTIONAL_COMMENT_EDIT_NOT_ALLOWED"
  message = "You can only edit your own devotional comment"
}

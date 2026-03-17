import { DomainException } from "@/Shared/domain"

export class DevotionalCommentNotFound extends DomainException {
  name = "DEVOTIONAL_COMMENT_NOT_FOUND"
  message = "Devotional comment not found"
}

import { DomainException } from "./domain-exception"

export class InvalidProfilePhotoContent extends DomainException {
  name = "PROFILE_PHOTO_INVALID"
  message = "Profile photo content is invalid or cannot be processed"
}

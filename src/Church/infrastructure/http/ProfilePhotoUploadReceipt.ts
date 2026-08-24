import jwt from "jsonwebtoken"

type ProfilePhotoUploadReceiptPayload = {
  purpose: "member-registration"
  registrationToken: string
  stagedProfilePhotoPath: string
}

const expiresIn = "10m"

export const issueProfilePhotoUploadReceipt = (
  registrationToken: string,
  stagedProfilePhotoPath: string
): string =>
  jwt.sign(
    {
      purpose: "member-registration",
      registrationToken,
      stagedProfilePhotoPath,
    } satisfies ProfilePhotoUploadReceiptPayload,
    process.env.JWT_SECRET!,
    { expiresIn }
  )

export const verifyProfilePhotoUploadReceipt = (
  receipt: string,
  registrationToken: string
): string | undefined => {
  try {
    const payload = jwt.verify(
      receipt,
      process.env.JWT_SECRET!
    ) as ProfilePhotoUploadReceiptPayload
    if (
      payload.purpose !== "member-registration" ||
      payload.registrationToken !== registrationToken ||
      !payload.stagedProfilePhotoPath.startsWith("profile-photos/staged/")
    ) {
      return undefined
    }
    return payload.stagedProfilePhotoPath
  } catch {
    return undefined
  }
}

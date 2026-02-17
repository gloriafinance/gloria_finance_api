export type MetaDebugTokenData = {
  is_valid?: boolean
  expires_at?: number
  granular_scopes?: Array<{
    scope?: string
    target_ids?: string[]
  }>
}

export type MetaWabaAccount = {
  id?: string
  name?: string
}

export type MetaPhoneNumber = {
  id?: string
  display_phone_number?: string
}

export type MetaErrorPayload = {
  error?: {
    message?: string
    type?: string
    code?: number
    error_subcode?: number
    fbtrace_id?: string
  }
}

export type MetaTokenResponse = {
  access_token?: string
  expires_in?: number
}

export type MetaDebugTokenResponse = {
  data?: MetaDebugTokenData
}

export type MetaWabaListResponse = {
  data?: MetaWabaAccount[]
}

export type MetaPhoneListResponse = {
  data?: MetaPhoneNumber[]
}

export type MetaMessagesResponse = {
  messages?: Array<{
    id?: string
  }>
}

export type MetaSuccessResponse = {
  success?: boolean
}

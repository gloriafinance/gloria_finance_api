export type DevotionalScripture = {
  reference: string
  quote: string
}

export type DevotionalResponse = {
  title: string
  devotional: string
  scriptures: DevotionalScripture[]
  push: {
    push_title: string
    push_body: string
  }
}


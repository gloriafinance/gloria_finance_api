import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { IdentifyEntity } from "@/Shared/adapter"
import { AssetStatus } from "./enums/AssetStatus.enum"
import { AssetAttachment } from "./types/AssetAttachment.type"
import { AssetHistoryEntry } from "./types/AssetHistoryEntry.type"
import { v4 } from "uuid"
import { DateBR } from "@/Shared/helpers"

export type AssetPrimitives = {
  id?: string
  assetId: string
  code: string
  name: string
  category: string
  acquisitionDate: Date
  value: number
  churchId: string
  location: string
  responsibleId: string
  status: AssetStatus
  attachments: AssetAttachment[]
  history: AssetHistoryEntry[]
  inventoryCheckedAt?: Date | null
  inventoryCheckedBy?: string | null
  createdAt: Date
  updatedAt: Date
}

export class Asset extends AggregateRoot {
  private id?: string
  private assetId: string
  private code: string
  private name: string
  private category: string
  private acquisitionDate: Date
  private value: number
  private churchId: string
  private location: string
  private responsibleId: string
  private status: AssetStatus
  private attachments: AssetAttachment[]
  private history: AssetHistoryEntry[]
  private inventoryCheckedAt?: Date | null
  private inventoryCheckedBy?: string | null
  private createdAt: Date
  private updatedAt: Date

  static create(
    props: {
      code: string
      name: string
      category: string
      acquisitionDate: Date
      value: number
      churchId: string
      location: string
      responsibleId: string
      status: AssetStatus
      attachments?: Array<Omit<AssetAttachment, "attachmentId" | "uploadedAt">>
    },
    metadata: { performedBy: string; notes?: string }
  ): Asset {
    const asset = new Asset()

    asset.assetId = IdentifyEntity.get("asset")
    asset.code = props.code
    asset.name = props.name
    asset.category = props.category
    asset.acquisitionDate = props.acquisitionDate
    asset.value = props.value
    asset.churchId = props.churchId
    asset.location = props.location
    asset.responsibleId = props.responsibleId
    asset.status = props.status
    asset.attachments = (props.attachments ?? []).map((attachment) => ({
      attachmentId: v4(),
      uploadedAt: DateBR(),
      ...attachment,
    }))
    asset.history = []
    asset.createdAt = DateBR()
    asset.updatedAt = asset.createdAt

    asset.appendHistory({
      action: "CREATED",
      performedBy: metadata.performedBy,
      notes: metadata.notes,
      changes: {
        name: { current: asset.name },
        category: { current: asset.category },
        value: { current: asset.value },
        churchId: { current: asset.churchId },
        responsibleId: { current: asset.responsibleId },
        status: { current: asset.status },
      },
    })

    return asset
  }

  static fromPrimitives(plainData: AssetPrimitives): Asset {
    const asset = new Asset()

    asset.id = plainData.id
    asset.assetId = plainData.assetId
    asset.code = plainData.code
    asset.name = plainData.name
    asset.category = plainData.category
    asset.acquisitionDate = new Date(plainData.acquisitionDate)
    asset.value = plainData.value
    asset.churchId = plainData.churchId
    asset.location = plainData.location
    asset.responsibleId = plainData.responsibleId
    asset.status = plainData.status
    asset.attachments = (plainData.attachments ?? []).map((attachment) => ({
      ...attachment,
      uploadedAt: new Date(attachment.uploadedAt),
    }))
    asset.history = (plainData.history ?? []).map((entry) => ({
      ...entry,
      performedAt: new Date(entry.performedAt),
    }))
    asset.inventoryCheckedAt = plainData.inventoryCheckedAt
      ? new Date(plainData.inventoryCheckedAt)
      : null
    asset.inventoryCheckedBy = plainData.inventoryCheckedBy ?? null
    asset.createdAt = new Date(plainData.createdAt)
    asset.updatedAt = new Date(plainData.updatedAt)

    return asset
  }

  getId(): string {
    return this.id
  }

  getAssetId(): string {
    return this.assetId
  }

  getCode(): string {
    return this.code
  }

  getAttachments(): AssetAttachment[] {
    return this.attachments
  }

  getHistory(): AssetHistoryEntry[] {
    return this.history
  }

  toPrimitives(): AssetPrimitives {
    return {
      assetId: this.assetId,
      code: this.code,
      name: this.name,
      category: this.category,
      acquisitionDate: this.acquisitionDate,
      value: this.value,
      churchId: this.churchId,
      location: this.location,
      responsibleId: this.responsibleId,
      status: this.status,
      attachments: this.attachments,
      history: this.history,
      inventoryCheckedAt: this.inventoryCheckedAt ?? null,
      inventoryCheckedBy: this.inventoryCheckedBy ?? null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }

  updateDetails(
    payload: {
      name?: string
      category?: string
      acquisitionDate?: Date
      value?: number
      churchId?: string
      location?: string
      responsibleId?: string
      status?: AssetStatus
      attachments?: AssetAttachment[]
    },
    metadata: { performedBy: string; notes?: string }
  ): AssetHistoryEntry | undefined {
    const changes: AssetHistoryEntry["changes"] = {}

    if (payload.name !== this.name) {
      changes.name = { previous: this.name, current: payload.name }
      this.name = payload.name
    }

    if (payload.category !== this.category) {
      changes.category = { previous: this.category, current: payload.category }
      this.category = payload.category
    }

    if (
      payload.acquisitionDate &&
      payload.acquisitionDate.getTime() !== this.acquisitionDate.getTime()
    ) {
      changes.acquisitionDate = {
        previous: this.acquisitionDate,
        current: payload.acquisitionDate,
      }
      this.acquisitionDate = payload.acquisitionDate
    }

    if (Number(payload.value) !== Number(this.value)) {
      changes.value = { previous: this.value, current: payload.value }
      this.value = Number(payload.value)
    }

    if (payload.location !== this.location) {
      changes.location = { previous: this.location, current: payload.location }
      this.location = payload.location
    }

    if (payload.responsibleId !== this.responsibleId) {
      changes.responsibleId = {
        previous: this.responsibleId,
        current: payload.responsibleId,
      }
      this.responsibleId = payload.responsibleId
    }

    if (payload.status && payload.status !== this.status) {
      changes.status = { previous: this.status, current: payload.status }
      this.status = payload.status
    }

    if (payload.attachments) {
      const previousAttachments = this.attachments ?? []
      const nextAttachments = payload.attachments

      const hasDifference =
        previousAttachments.length !== nextAttachments.length ||
        previousAttachments.some((attachment, index) => {
          const next = nextAttachments[index]
          if (!next) {
            return true
          }

          return attachment.attachmentId !== next.attachmentId
        })

      if (hasDifference) {
        changes.attachments = {
          previous: previousAttachments.map((att) => att.attachmentId),
          current: nextAttachments.map((att) => att.attachmentId),
        }
      }

      this.attachments = payload.attachments
    }

    if (Object.keys(changes).length === 0) {
      return undefined
    }

    this.touch()

    const entry = this.appendHistory({
      action: "UPDATED",
      performedBy: metadata.performedBy,
      notes: metadata.notes,
      changes,
    })

    return entry
  }

  replaceAttachments(
    attachments: Array<Omit<AssetAttachment, "attachmentId" | "uploadedAt">>,
    metadata: { performedBy: string; notes?: string }
  ) {
    const previous = this.attachments
    this.attachments = attachments.map((attachment) => ({
      attachmentId: v4(),
      uploadedAt: DateBR(),
      ...attachment,
    }))
    this.touch()
    this.appendHistory({
      action: "ATTACHMENTS_UPDATED",
      performedBy: metadata.performedBy,
      notes: metadata.notes,
      changes: {
        attachments: {
          previous: previous.map((att) => att.attachmentId),
          current: this.attachments.map((att) => att.attachmentId),
        },
      },
    })
  }

  markInventory(metadata: {
    performedBy: string
    notes?: string
    checkedAt?: Date
  }) {
    this.inventoryCheckedAt = metadata.checkedAt ?? DateBR()
    this.inventoryCheckedBy = metadata.performedBy
    this.touch()
    this.appendHistory({
      action: "INVENTORY_CONFIRMED",
      performedBy: metadata.performedBy,
      notes: metadata.notes,
    })
  }

  private touch() {
    this.updatedAt = DateBR()
  }

  private appendHistory(
    entry: Omit<AssetHistoryEntry, "entryId" | "performedAt">
  ): AssetHistoryEntry {
    const historyEntry: AssetHistoryEntry = {
      entryId: IdentifyEntity.get("asset-history"),
      performedAt: DateBR(),
      ...entry,
    }

    this.history = [historyEntry, ...(this.history ?? [])]

    return historyEntry
  }
}

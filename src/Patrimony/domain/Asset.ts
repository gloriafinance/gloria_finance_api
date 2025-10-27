import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { IdentifyEntity } from "@/Shared/adapter"
import { AssetStatus } from "./enums/AssetStatus.enum"
import { AssetInventoryStatus } from "./enums/AssetInventoryStatus.enum"
import { AssetAttachment } from "./types/AssetAttachment.type"
import { AssetHistoryEntry } from "./types/AssetHistoryEntry.type"
import { AssetDisposalRecord } from "./types/AssetDisposal.type"
import { AssetResponsible } from "./types/AssetResponsible.type"
import { v4 } from "uuid"
import { DateBR } from "@/Shared/helpers"
import { InvalidAssetDisposalException } from "./exceptions/InvalidAssetDisposal.exception"
import { AssetInventoryChecker } from "./types/AssetInventoryChecker.type"

export type AssetPrimitives = {
  id?: string
  assetId: string
  code: string
  name: string
  category: string
  acquisitionDate: Date
  value: number
  quantity: number
  churchId: string
  location: string
  responsible?: AssetResponsible
  responsibleId?: string
  status: AssetStatus
  attachments: AssetAttachment[]
  history: AssetHistoryEntry[]
  inventoryStatus?: AssetInventoryStatus | null
  inventoryCheckedAt?: Date | null
  inventoryCheckedBy?: AssetInventoryChecker | null
  disposal?: AssetDisposalRecord | null
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
  private quantity: number
  private churchId: string
  private location: string
  private responsible: AssetResponsible
  private status: AssetStatus
  private attachments: AssetAttachment[]
  private history: AssetHistoryEntry[]
  private inventoryStatus?: AssetInventoryStatus | null
  private inventoryCheckedAt?: Date | null
  private inventoryCheckedBy?: AssetInventoryChecker | null
  private disposal?: AssetDisposalRecord | null
  private createdAt: Date
  private updatedAt: Date

  static create(
    props: {
      code: string
      name: string
      category: string
      acquisitionDate: Date
      value: number
      quantity: number
      churchId: string
      location: string
      responsible: AssetResponsible
      status: AssetStatus
      attachments?: Array<Omit<AssetAttachment, "attachmentId" | "uploadedAt">>
    },
    metadata: {
      performedByDetails: {
        memberId: string
        name: string
        email: string
      }
      notes?: string
    }
  ): Asset {
    const asset = new Asset()

    asset.assetId = IdentifyEntity.get("asset")
    asset.code = props.code
    asset.name = props.name
    asset.category = props.category
    asset.acquisitionDate = props.acquisitionDate
    asset.value = props.value
    asset.quantity = props.quantity
    asset.churchId = props.churchId
    asset.location = props.location
    asset.responsible = {
      memberId: props.responsible.memberId,
      name: props.responsible.name,
      email: props.responsible.email ?? null,
      phone: props.responsible.phone ?? null,
    }
    asset.status = props.status
    asset.attachments = (props.attachments ?? []).map((attachment) => ({
      attachmentId: v4(),
      uploadedAt: DateBR(),
      ...attachment,
    }))
    asset.history = []
    asset.inventoryStatus = null
    asset.createdAt = DateBR()
    asset.inventoryCheckedAt = null
    asset.inventoryCheckedBy = null
    asset.disposal = null
    asset.updatedAt = asset.createdAt

    asset.appendHistory({
      action: "CREATED",
      performedByDetails: metadata.performedByDetails,
      notes: metadata.notes,
      changes: {
        code: { current: asset.code },
        name: { current: asset.name },
        category: { current: asset.category },
        value: { current: asset.value },
        quantity: { current: asset.quantity },
        responsible: { current: asset.responsible },
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
    asset.quantity = plainData.quantity
    asset.churchId = plainData.churchId
    asset.location = plainData.location
    asset.responsible = plainData.responsible

    asset.status = plainData.status
    asset.attachments = (plainData.attachments ?? []).map((attachment) => ({
      ...attachment,
      uploadedAt: new Date(attachment.uploadedAt),
    }))
    asset.history = (plainData.history ?? []).map((entry) => ({
      ...entry,
      performedAt: new Date(entry.performedAt),
    }))
    asset.inventoryStatus = plainData.inventoryStatus ?? null
    asset.inventoryCheckedAt = new Date(plainData.inventoryCheckedAt) ?? null

    asset.inventoryCheckedBy = plainData.inventoryCheckedBy ?? null

    asset.disposal = plainData.disposal
      ? {
          ...plainData.disposal,
          occurredAt: new Date(plainData.disposal.occurredAt),
        }
      : null
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

  getQuantity(): number {
    return this.quantity
  }

  getResponsible(): AssetResponsible {
    return this.responsible
  }

  getResponsibleId(): string {
    return this.responsible.memberId
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
      quantity: this.quantity,
      churchId: this.churchId,
      location: this.location,
      responsibleId: this.responsible.memberId,
      responsible: this.responsible,
      status: this.status,
      attachments: this.attachments,
      history: this.history,
      inventoryStatus: this.inventoryStatus ?? null,
      inventoryCheckedAt: this.inventoryCheckedAt ?? null,
      inventoryCheckedBy: this.inventoryCheckedBy
        ? {
            memberId: this.inventoryCheckedBy.memberId,
            name: this.inventoryCheckedBy.name,
            email: this.inventoryCheckedBy.email,
          }
        : null,
      disposal: this.disposal ?? null,
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
      quantity?: number
      churchId?: string
      location?: string
      responsible?: AssetResponsible
      status?: AssetStatus
      attachments?: AssetAttachment[]
    },
    metadata: {
      performedByDetails: {
        memberId: string
        name: string
        email: string
      }
      notes?: string
    }
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

    if (typeof payload.value === "number" && payload.value !== this.value) {
      changes.value = { previous: this.value, current: payload.value }
      this.value = payload.value
    }

    if (
      typeof payload.quantity === "number" &&
      payload.quantity !== this.quantity
    ) {
      changes.quantity = { previous: this.quantity, current: payload.quantity }
      this.quantity = payload.quantity
    }

    if (payload.location !== this.location) {
      changes.location = { previous: this.location, current: payload.location }
      this.location = payload.location
    }

    if (payload.responsible) {
      const isSameResponsible =
        payload.responsible.memberId === this.responsible.memberId &&
        payload.responsible.name === this.responsible.name &&
        (payload.responsible.email ?? null) ===
          (this.responsible.email ?? null) &&
        (payload.responsible.phone ?? null) === (this.responsible.phone ?? null)

      if (!isSameResponsible) {
        changes.responsibleId = {
          previous: this.responsible.memberId,
          current: payload.responsible.memberId,
        }
        changes.responsible = {
          previous: this.responsible,
          current: payload.responsible,
        }

        this.responsible = {
          memberId: payload.responsible.memberId,
          name: payload.responsible.name,
          email: payload.responsible.email ?? null,
          phone: payload.responsible.phone ?? null,
        }
      }
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
      performedByDetails: metadata.performedByDetails,
      notes: metadata.notes,
      changes,
    })

    return entry
  }

  replaceAttachments(
    attachments: Array<Omit<AssetAttachment, "attachmentId" | "uploadedAt">>,
    metadata: {
      performedByDetails: {
        memberId: string
        name: string
        email: string
      }
      notes?: string
    }
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
      performedByDetails: metadata.performedByDetails,
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
    performedByDetails?: AssetInventoryChecker
    status: AssetInventoryStatus
    notes?: string
    checkedAt?: Date
    code: string
    quantity: number
  }) {
    const previousStatus = this.inventoryStatus ?? null
    const previousCode = this.code
    const previousQuantity = this.quantity
    const previousChecker = this.inventoryCheckedBy ?? null

    const normalizedCode = metadata.code.trim()
    this.code = normalizedCode
    this.quantity = metadata.quantity

    this.inventoryCheckedAt = metadata.checkedAt ?? DateBR()
    const checkerDetails = metadata.performedByDetails
    this.inventoryCheckedBy = {
      memberId: checkerDetails.memberId,
      name: checkerDetails.name,
      email: checkerDetails.email,
    }
    this.inventoryStatus = metadata.status
    this.touch()
    this.appendHistory({
      action: "INVENTORY_CONFIRMED",
      performedByDetails: metadata.performedByDetails,
      notes: metadata.notes,
      changes: {
        inventoryStatus: {
          previous: previousStatus,
          current: metadata.status,
        },
        ...(previousCode !== this.code
          ? {
              code: {
                previous: previousCode,
                current: this.code,
              },
            }
          : {}),
        ...(previousQuantity !== this.quantity
          ? {
              quantity: {
                previous: previousQuantity,
                current: this.quantity,
              },
            }
          : {}),
        ...(previousChecker?.memberId !== this.inventoryCheckedBy?.memberId ||
        previousChecker?.name !== this.inventoryCheckedBy?.name
          ? {
              inventoryCheckedBy: {
                previous: previousChecker,
                current: this.inventoryCheckedBy,
              },
            }
          : {}),
      },
    })
  }

  dispose(payload: {
    status: AssetStatus
    reason: string
    performedByDetails: {
      memberId: string
      name: string
      email: string
    }
    occurredAt?: Date
    notes?: string
  }) {
    const allowedStatuses: AssetStatus[] = [
      AssetStatus.DONATED,
      AssetStatus.SOLD,
      AssetStatus.LOST,
    ]

    if (!allowedStatuses.includes(payload.status)) {
      throw new InvalidAssetDisposalException()
    }

    const occurredAt = payload.occurredAt ?? DateBR()

    const previousStatus = this.status
    const previousDisposal = this.disposal

    this.status = payload.status
    const disposal: AssetDisposalRecord = {
      status: payload.status,
      reason: payload.reason,
      performedByDetails: payload.performedByDetails,
      occurredAt,
      notes: payload.notes,
    }

    this.disposal = disposal

    this.touch()
    this.appendHistory({
      action: "DISPOSAL",
      performedByDetails: payload.performedByDetails,
      notes: payload.notes,
      changes: {
        status: { previous: previousStatus, current: this.status },
        disposalReason: {
          previous: previousDisposal?.reason,
          current: disposal.reason,
        },
        disposalDate: {
          previous: previousDisposal?.occurredAt,
          current: occurredAt,
        },
      },
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

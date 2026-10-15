module.exports = {
  /**
   * Recurring payments no longer own a payment method, and the permanent
   * identifier uses the singular form consistently.
   *
   * - `recurringPaymentsId` -> `recurringPaymentId`
   * - drop `payment` (PIX/BILL now belongs to a single execution)
   * - drop `payment.pixKey` / `payment.pixKeyType` after relocating them to
   *   `pixDestination`, so no reusable destination is lost
   *
   * `costCenterId` is NOT invented here: it cannot be derived safely and must be
   * assigned by the church. Documents without it are flagged with
   * `requiresCostCenter`, which blocks execution through
   * RECURRING_PAYMENT_COST_CENTER_INVALID until they are completed.
   *
   * Idempotent: re-running changes nothing.
   *
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const exists = await db
      .listCollections({ name: "recurringPayments" }, { nameOnly: true })
      .hasNext()
    if (!exists) {
      return
    }

    const collection = db.collection("recurringPayments")

    // 1. Relocate a stored PIX key into the optional reusable destination.
    await collection.updateMany(
      {
        "payment.method": "PIX",
        "payment.pixKey": { $exists: true },
        pixDestination: { $exists: false },
      },
      [
        {
          $set: {
            pixDestination: {
              pixKey: "$payment.pixKey",
              pixKeyType: "$payment.pixKeyType",
            },
          },
        },
      ]
    )

    // 2. Rename the permanent identifier (singular, matching the record link).
    await collection.updateMany(
      { recurringPaymentsId: { $exists: true } },
      { $rename: { recurringPaymentsId: "recurringPaymentId" } }
    )

    // 3. Retire the permanent payment method.
    await collection.updateMany(
      { payment: { $exists: true } },
      { $unset: { payment: "" } }
    )

    // 4. Flag recurrences that still need a cost center.
    await collection.updateMany(
      { costCenterId: { $exists: false } },
      { $set: { requiresCostCenter: true } }
    )

    // 5. The identifier is now the durable key for lookups.
    const hasIdIndex = await collection.indexExists(
      "idx_recurring_payments_id_unique"
    )
    if (hasIdIndex) {
      await collection.dropIndex("idx_recurring_payments_id_unique")
    }
    await collection.createIndex(
      { recurringPaymentId: 1 },
      { unique: true, name: "idx_recurring_payments_id_unique" }
    )
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const exists = await db
      .listCollections({ name: "recurringPayments" }, { nameOnly: true })
      .hasNext()
    if (!exists) {
      return
    }

    const collection = db.collection("recurringPayments")

    await collection.updateMany(
      { recurringPaymentId: { $exists: true } },
      { $rename: { recurringPaymentId: "recurringPaymentsId" } }
    )
    await collection.updateMany(
      { requiresCostCenter: { $exists: true } },
      { $unset: { requiresCostCenter: "" } }
    )

    const hasIdIndex = await collection.indexExists(
      "idx_recurring_payments_id_unique"
    )
    if (hasIdIndex) {
      await collection.dropIndex("idx_recurring_payments_id_unique")
    }
    await collection.createIndex(
      { recurringPaymentsId: 1 },
      { unique: true, name: "idx_recurring_payments_id_unique" }
    )
  },
}

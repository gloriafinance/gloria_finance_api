module.exports = {
  /**
   * A voided financial record no longer settles its competence, so it must not
   * block paying that competence again.
   *
   * The uniqueness of (recurringPaymentId, recurringCompetence) now applies only
   * to effective records; voided ones are excluded. Re-execution gets a distinct
   * `financialRecordId` derived from the prior record count.
   *
   * Idempotent: dropping and recreating with the same definition is a no-op.
   *
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const exists = await db
      .listCollections({ name: "financial_records" }, { nameOnly: true })
      .hasNext()
    if (!exists) {
      return
    }

    const collection = db.collection("financial_records")
    const indexName = "idx_financial_record_recurring_competence_unique"

    if (await collection.indexExists(indexName)) {
      await collection.dropIndex(indexName)
    }

    await collection.createIndex(
      { recurringPaymentId: 1, recurringCompetence: 1 },
      {
        unique: true,
        name: indexName,
        partialFilterExpression: {
          recurringPaymentId: { $exists: true },
          recurringCompetence: { $exists: true },
          status: { $ne: "VOID" },
        },
      }
    )
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const exists = await db
      .listCollections({ name: "financial_records" }, { nameOnly: true })
      .hasNext()
    if (!exists) {
      return
    }

    const collection = db.collection("financial_records")
    const indexName = "idx_financial_record_recurring_competence_unique"

    if (await collection.indexExists(indexName)) {
      await collection.dropIndex(indexName)
    }

    await collection.createIndex(
      { recurringPaymentId: 1, recurringCompetence: 1 },
      {
        unique: true,
        name: indexName,
        partialFilterExpression: {
          recurringPaymentId: { $exists: true },
          recurringCompetence: { $exists: true },
        },
      }
    )
  },
}

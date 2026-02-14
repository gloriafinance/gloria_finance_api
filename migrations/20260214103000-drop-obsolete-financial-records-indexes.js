module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const collectionExists = await db
      .listCollections({ name: "financial_records" }, { nameOnly: true })
      .hasNext()
    if (!collectionExists) {
      return
    }

    const collection = db.collection("financial_records")

    const indexesToDrop = [
      "idx_dre_core",
      "idx_income_statement_v2",
      "idx_financial_records_income_statement",
    ]

    for (const indexName of indexesToDrop) {
      const exists = await collection.indexExists(indexName)
      if (exists) {
        await collection.dropIndex(indexName)
      }
    }

    await collection.createIndex(
      {
        churchId: 1,
        status: 1,
        date: 1,
        type: 1,
        "financialConcept.statementCategory": 1,
        "availabilityAccount.symbol": 1,
      },
      {
        name: "idx_financial_records_income_statement",
        background: true,
        partialFilterExpression: {
          status: { $in: ["CLEARED", "RECONCILED"] },
          $or: [
            { "financialConcept.affectsResult": true },
            { "financialConcept.affectsBalance": true },
          ],
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
    const collectionExists = await db
      .listCollections({ name: "financial_records" }, { nameOnly: true })
      .hasNext()
    if (!collectionExists) {
      return
    }

    const collection = db.collection("financial_records")

    const hasIncomeStatementIdx = await collection.indexExists(
      "idx_financial_records_income_statement"
    )
    if (hasIncomeStatementIdx) {
      await collection.dropIndex("idx_financial_records_income_statement")
    }

    const hasIdxDreCore = await collection.indexExists("idx_dre_core")
    if (!hasIdxDreCore) {
      await collection.createIndex(
        {
          churchId: 1,
          date: 1,
          status: 1,
          "financialConcept.statementCategory": 1,
        },
        {
          name: "idx_dre_core",
          background: true,
          partialFilterExpression: {
            status: { $in: ["CLEARED", "RECONCILED"] },
          },
        }
      )
    }

    const hasLegacyIncomeStatementIdx = await collection.indexExists(
      "idx_income_statement_v2"
    )
    if (!hasLegacyIncomeStatementIdx) {
      await collection.createIndex(
        {
          churchId: 1,
          status: 1,
          date: 1,
          type: 1,
          "financialConcept.statementCategory": 1,
          "availabilityAccount.symbol": 1,
        },
        {
          name: "idx_income_statement_v2",
          background: true,
          partialFilterExpression: {
            status: { $in: ["CLEARED", "RECONCILED"] },
            $or: [
              { "financialConcept.affectsResult": true },
              { "financialConcept.affectsBalance": true },
            ],
          },
        }
      )
    }
  },
}

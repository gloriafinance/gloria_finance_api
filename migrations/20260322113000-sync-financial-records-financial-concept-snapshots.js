module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const conceptsCollection = db.collection("financial_concepts")
    const recordsCollection = db.collection("financial_records")

    const concepts = await conceptsCollection
      .find(
        {},
        {
          projection: {
            _id: 0,
            financialConceptId: 1,
            churchId: 1,
            name: 1,
            description: 1,
            active: 1,
            type: 1,
            statementCategory: 1,
            createdAt: 1,
            affectsCashFlow: 1,
            affectsResult: 1,
            affectsBalance: 1,
            isOperational: 1,
            tag: 1,
            isSystem: 1,
          },
        }
      )
      .toArray()

    if (!concepts.length) {
      return
    }

    const operations = []

    for (const concept of concepts) {
      if (!concept.financialConceptId || !concept.churchId) {
        continue
      }

      operations.push({
        updateMany: {
          filter: {
            churchId: concept.churchId,
            "financialConcept.financialConceptId": concept.financialConceptId,
          },
          update: {
            $set: {
              financialConcept: {
                financialConceptId: concept.financialConceptId,
                churchId: concept.churchId,
                name: concept.name,
                description: concept.description,
                active: concept.active,
                type: concept.type,
                statementCategory: concept.statementCategory,
                createdAt: concept.createdAt,
                affectsCashFlow: concept.affectsCashFlow,
                affectsResult: concept.affectsResult,
                affectsBalance: concept.affectsBalance,
                isOperational: concept.isOperational,
                tag: concept.tag,
                isSystem: concept.isSystem,
              },
            },
          },
        },
      })
    }

    const BATCH_SIZE = 500
    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
      const batch = operations.slice(i, i + BATCH_SIZE)
      if (!batch.length) {
        continue
      }

      await recordsCollection.bulkWrite(batch, { ordered: false })
    }
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Irreversible: this migration resynchronizes embedded snapshots in
    // financial_records using financial_concepts as source of truth.
  },
}

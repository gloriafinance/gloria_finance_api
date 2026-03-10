const { randomUUID } = require("node:crypto")

const TRANSFER_INTERNAL_TAG = "TRANSFER_INTERNAL"

module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const churchesCollection = db.collection("churches")
    const conceptsCollection = db.collection("financial_concepts")

    const churches = await churchesCollection
      .find({}, { projection: { _id: 0, churchId: 1 } })
      .toArray()

    for (const church of churches) {
      if (!church.churchId) {
        continue
      }

      const existing = await conceptsCollection.findOne({
        churchId: church.churchId,
        $or: [{ tag: TRANSFER_INTERNAL_TAG }, { name: TRANSFER_INTERNAL_TAG }],
      })

      if (existing) {
        continue
      }

      await conceptsCollection.insertOne({
        financialConceptId: `urn:financialConcept:${randomUUID()}`,
        churchId: church.churchId,
        name: TRANSFER_INTERNAL_TAG,
        description: "Transferência interna entre contas de disponibilidade",
        active: true,
        type: "OUTGO",
        statementCategory: "OTHER",
        createdAt: new Date(),
        affectsCashFlow: true,
        affectsResult: false,
        affectsBalance: false,
        isOperational: false,
        tag: TRANSFER_INTERNAL_TAG,
        isSystem: true,
      })
    }
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const conceptsCollection = db.collection("financial_concepts")

    await conceptsCollection.deleteMany({
      tag: TRANSFER_INTERNAL_TAG,
      isSystem: true,
    })
  },
}

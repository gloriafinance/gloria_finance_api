module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @returns {Promise<void>}
   */
  async up(db) {
    const collectionExists = await db
      .listCollections({ name: "churches" }, { nameOnly: true })
      .hasNext()
    if (!collectionExists) return

    await db.collection("churches").updateMany(
      { bankingOnboarding: { $exists: false } },
      { $set: { bankingOnboarding: null } }
    )
  },

  /**
   * @param db {import('mongodb').Db}
   * @returns {Promise<void>}
   */
  async down(db) {
    const collectionExists = await db
      .listCollections({ name: "churches" }, { nameOnly: true })
      .hasNext()
    if (!collectionExists) return

    await db
      .collection("churches")
      .updateMany({}, { $unset: { bankingOnboarding: "" } })
  },
}

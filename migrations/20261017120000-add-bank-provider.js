module.exports = {
  /**
   * Marks which churches' bank accounts are connected to a payment provider.
   *
   * `Bank.provider` is what later tells recurring execution which account the
   * provider actually debits. Without it every bank of a church looks the same,
   * so a payment could be recorded against an account the provider never moved.
   *
   * Existing connections were created through church-banking, which reports the
   * provider account as bank code 461. Banks registered manually carry the code
   * the church typed, so they are left without a provider on purpose.
   *
   * Idempotent: only touches banks that still lack the field.
   *
   * ⚠️ The 461 discriminator is an inference, not provider metadata. It is used
   * here only to backfill accounts connected before `provider` existed; new
   * connections set the field explicitly. Revisit if church-banking ever reports
   * a different code.
   *
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const exists = await db
      .listCollections({ name: "churches" }, { nameOnly: true })
      .hasNext()
    if (!exists) {
      return
    }

    await db.collection("churches").updateMany(
      {
        banks: {
          $elemMatch: {
            "bankInstruction.codeBank": "461",
            provider: { $exists: false },
          },
        },
      },
      { $set: { "banks.$[connected].provider": "ASAAS" } },
      { arrayFilters: [{ "connected.bankInstruction.codeBank": "461" }] }
    )
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const exists = await db
      .listCollections({ name: "churches" }, { nameOnly: true })
      .hasNext()
    if (!exists) {
      return
    }

    await db
      .collection("churches")
      .updateMany({}, { $unset: { "banks.$[].provider": "" } })
  },
}

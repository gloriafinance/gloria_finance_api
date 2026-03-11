const COUNTRY_TIMEZONE_MAP = {
  BR: "America/Sao_Paulo",
  US: "America/New_York",
  CA: "America/Toronto",
  MX: "America/Mexico_City",
  CO: "America/Bogota",
  PE: "America/Lima",
  VE: "America/Caracas",
  AR: "America/Argentina/Buenos_Aires",
  CL: "America/Santiago",
  BO: "America/La_Paz",
  PY: "America/Asuncion",
  UY: "America/Montevideo",
  EC: "America/Guayaquil",
  PA: "America/Panama",
  CR: "America/Costa_Rica",
  GT: "America/Guatemala",
  HN: "America/Tegucigalpa",
  SV: "America/El_Salvador",
  DO: "America/Santo_Domingo",
  PR: "America/Puerto_Rico",
}

const resolveTimezone = (country) => {
  const code = String(country ?? "")
    .trim()
    .toUpperCase()

  return COUNTRY_TIMEZONE_MAP[code] ?? "America/Sao_Paulo"
}

module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const collectionExists = await db
      .listCollections({ name: "churches" }, { nameOnly: true })
      .hasNext()
    if (!collectionExists) {
      return
    }

    const collection = db.collection("churches")
    const cursor = collection.find(
      {
        $or: [
          { timezone: { $exists: false } },
          { timezone: null },
          { timezone: "" },
        ],
      },
      { projection: { _id: 1, country: 1 } }
    )

    const operations = []
    for await (const doc of cursor) {
      operations.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { timezone: resolveTimezone(doc.country) } },
        },
      })
    }

    if (operations.length) {
      await collection.bulkWrite(operations, { ordered: false })
    }
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const collectionExists = await db
      .listCollections({ name: "churches" }, { nameOnly: true })
      .hasNext()
    if (!collectionExists) {
      return
    }

    const collection = db.collection("churches")
    await collection.updateMany({}, { $unset: { timezone: "" } })
  },
}

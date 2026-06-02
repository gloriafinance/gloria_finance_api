const FIELDS = ["birthdate", "conversionDate", "baptismDate"]

const DDMMYYYY = /^(\d{2})\/(\d{2})\/(\d{4})$/
const YYYYMMDD = /^(\d{4})-(\d{2})-(\d{2})$/

function toUtcMidnight(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d))
}

function isValidCalendarDate(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d))
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  )
}

function parseLegacy(raw) {
  if (raw instanceof Date) {
    return { action: "skip", reason: "already-Date" }
  }
  if (raw === null || raw === undefined) {
    return { action: "skip", reason: "null" }
  }
  if (typeof raw !== "string") {
    return { action: "skip", reason: "non-string-non-date" }
  }

  const s = raw.trim()
  if (!s) {
    return { action: "skip", reason: "empty" }
  }

  let m = s.match(DDMMYYYY)
  if (m) {
    const dd = Number(m[1])
    const mm = Number(m[2])
    const yyyy = Number(m[3])
    if (!isValidCalendarDate(yyyy, mm, dd)) {
      return { action: "skip", reason: "invalid-dmy-date" }
    }
    return { action: "convert", date: toUtcMidnight(yyyy, mm, dd) }
  }

  m = s.match(YYYYMMDD)
  if (m) {
    const yyyy = Number(m[1])
    const mm = Number(m[2])
    const dd = Number(m[3])
    if (!isValidCalendarDate(yyyy, mm, dd)) {
      return { action: "skip", reason: "invalid-ymd-date" }
    }
    return { action: "convert", date: toUtcMidnight(yyyy, mm, dd) }
  }

  return { action: "skip", reason: "unrecognized-format" }
}

function pad2(n) {
  return n < 10 ? `0${n}` : String(n)
}

function dateToDdMmYyyy(date) {
  const dd = pad2(date.getUTCDate())
  const mm = pad2(date.getUTCMonth() + 1)
  const yyyy = date.getUTCFullYear()
  return `${dd}/${mm}/${yyyy}`
}

module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const collection = db.collection("members")

    const summary = {
      fields: FIELDS,
      converted: Object.fromEntries(FIELDS.map((f) => [f, 0])),
      skipped: Object.fromEntries(FIELDS.map((f) => [f, 0])),
      skippedDetails: [],
    }

    const cursor = collection.find(
      {},
      {
        projection: {
          _id: 1,
          memberId: 1,
          birthdate: 1,
          conversionDate: 1,
          baptismDate: 1,
        },
      }
    )

    let batch = []
    const BATCH_SIZE = 500

    while (await cursor.hasNext()) {
      const doc = await cursor.next()
      if (!doc) continue

      const setOps = {}

      for (const field of FIELDS) {
        const result = parseLegacy(doc[field])

        if (result.action === "convert") {
          setOps[field] = result.date
          summary.converted[field] += 1
        } else {
          summary.skipped[field] += 1
          if (result.reason !== "already-Date" && result.reason !== "null") {
            summary.skippedDetails.push({
              memberId: doc.memberId ?? String(doc._id),
              field,
              raw: doc[field],
              reason: result.reason,
            })
          }
        }
      }

      if (Object.keys(setOps).length > 0) {
        batch.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: setOps },
          },
        })
      }

      if (batch.length >= BATCH_SIZE) {
        await collection.bulkWrite(batch, { ordered: false })
        batch = []
      }
    }

    if (batch.length > 0) {
      await collection.bulkWrite(batch, { ordered: false })
    }

    await cursor.close()

    // eslint-disable-next-line no-console
    console.log("[normalize-member-date-strings] up summary:")
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(summary, null, 2))
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const collection = db.collection("members")

    const summary = {
      fields: FIELDS,
      converted: Object.fromEntries(FIELDS.map((f) => [f, 0])),
      skipped: Object.fromEntries(FIELDS.map((f) => [f, 0])),
      skippedDetails: [],
    }

    const cursor = collection.find(
      {},
      {
        projection: {
          _id: 1,
          memberId: 1,
          birthdate: 1,
          conversionDate: 1,
          baptismDate: 1,
        },
      }
    )

    let batch = []
    const BATCH_SIZE = 500

    while (await cursor.hasNext()) {
      const doc = await cursor.next()
      if (!doc) continue

      const setOps = {}

      for (const field of FIELDS) {
        const value = doc[field]

        if (value instanceof Date) {
          setOps[field] = dateToDdMmYyyy(value)
          summary.converted[field] += 1
        } else {
          summary.skipped[field] += 1
          if (value !== null && value !== undefined) {
            summary.skippedDetails.push({
              memberId: doc.memberId ?? String(doc._id),
              field,
              raw: value,
              reason: "not-a-date",
            })
          }
        }
      }

      if (Object.keys(setOps).length > 0) {
        batch.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: setOps },
          },
        })
      }

      if (batch.length >= BATCH_SIZE) {
        await collection.bulkWrite(batch, { ordered: false })
        batch = []
      }
    }

    if (batch.length > 0) {
      await collection.bulkWrite(batch, { ordered: false })
    }

    await cursor.close()

    // eslint-disable-next-line no-console
    console.log("[normalize-member-date-strings] down summary:")
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(summary, null, 2))
  },
}

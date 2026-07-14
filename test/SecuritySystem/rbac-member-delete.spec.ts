import { BASE_PERMISSIONS, BASE_ROLES } from "@/SecuritySystem/domain"

const migration = require("../../migrations/20260714000000-add-member-delete-permission")

describe("members:delete RBAC catalog and migration", () => {
  it("includes members:delete in base permissions", () => {
    const permission = BASE_PERMISSIONS.find(
      (p) => p.permissionId === "members:delete"
    )

    expect(permission).toBeDefined()
    expect(permission?.module).toBe("members")
    expect(permission?.action).toBe("delete")
    expect(permission?.isSystem).toBe(true)
  })

  it("assigns members:delete to ADMIN and PASTOR base roles", () => {
    const admin = BASE_ROLES.find((r) => r.roleId === "ADMIN")
    const pastor = BASE_ROLES.find((r) => r.roleId === "PASTOR")

    expect(admin?.permissions).toContain("members:delete")
    expect(pastor?.permissions).toContain("members:delete")
  })

  describe("migration", () => {
    const createInMemoryCollection = () => {
      const documents: any[] = []
      return {
        documents,
        async updateOne(filter: any, update: any, options?: any) {
          const existingIndex = documents.findIndex((doc) =>
            Object.entries(filter).every(
              ([key, value]) => doc[key] === value
            )
          )

          if (existingIndex >= 0) {
            if (options?.upsert && update.$setOnInsert) {
              return
            }
            return
          }

          const newDoc = options?.upsert
            ? { ...filter, ...(update.$setOnInsert ?? {}) }
            : { ...filter, ...(update.$set ?? {}) }
          documents.push(newDoc)
        },
        find(query: any, options?: any) {
          const filtered = documents.filter((doc) =>
            Object.entries(query).every(([key, value]) => {
              if (Array.isArray(value)) {
                return value.includes(doc[key])
              }
              if (value && typeof value === "object" && "$in" in value) {
                const allowed = value.$in as any[]
                return allowed.includes(doc[key])
              }
              return doc[key] === value
            })
          )
          return {
            project: () => ({
              toArray: async () => filtered,
            }),
            toArray: async () => filtered,
          }
        },
        async deleteMany(filter: any) {
          for (let i = documents.length - 1; i >= 0; i--) {
            const matches = Object.entries(filter).every(([key, value]) => {
              if (Array.isArray(value)) {
                return value.includes(documents[i]![key])
              }
              if (value && typeof value === "object" && "$in" in value) {
                const allowed = value.$in as any[]
                return allowed.includes(documents[i]![key])
              }
              return documents[i]![key] === value
            })
            if (matches) {
              documents.splice(i, 1)
            }
          }
        },
      }
    }

    const createDb = () => {
      const permissions = createInMemoryCollection()
      const roles = createInMemoryCollection()
      const rolePermissions = createInMemoryCollection()

      roles.documents.push(
        { churchId: "church-a", roleId: "ADMIN" },
        { churchId: "church-a", roleId: "PASTOR" },
        { churchId: "church-b", roleId: "ADMIN" }
      )

      return {
        collection: (name: string) => {
          if (name === "permissions") return permissions
          if (name === "roles") return roles
          if (name === "role_permissions") return rolePermissions
          throw new Error(`Unknown collection ${name}`)
        },
        permissions,
        roles,
        rolePermissions,
      }
    }

    it("inserts permission and assigns it to ADMIN and PASTOR roles", async () => {
      const db = createDb()

      await migration.up(db, null as any)

      const permission = db.permissions.documents.find(
        (d: any) => d.permissionId === "members:delete"
      )
      expect(permission).toBeDefined()

      const assignments = db.rolePermissions.documents.filter(
        (d: any) => d.permissionId === "members:delete"
      )
      expect(assignments).toHaveLength(3)
      expect(
        assignments.some(
          (a: any) => a.churchId === "church-a" && a.roleId === "ADMIN"
        )
      ).toBe(true)
      expect(
        assignments.some(
          (a: any) => a.churchId === "church-a" && a.roleId === "PASTOR"
        )
      ).toBe(true)
      expect(
        assignments.some(
          (a: any) => a.churchId === "church-b" && a.roleId === "ADMIN"
        )
      ).toBe(true)
    })

    it("can run up multiple times without duplicates", async () => {
      const db = createDb()

      await migration.up(db, null as any)
      await migration.up(db, null as any)
      await migration.up(db, null as any)

      expect(
        db.permissions.documents.filter(
          (d: any) => d.permissionId === "members:delete"
        )
      ).toHaveLength(1)
      expect(
        db.rolePermissions.documents.filter(
          (d: any) => d.permissionId === "members:delete"
        )
      ).toHaveLength(3)
    })

    it("down removes assignments and permission", async () => {
      const db = createDb()

      await migration.up(db, null as any)
      await migration.down(db, null as any)

      expect(
        db.permissions.documents.some(
          (d: any) => d.permissionId === "members:delete"
        )
      ).toBe(false)
      expect(
        db.rolePermissions.documents.some(
          (d: any) => d.permissionId === "members:delete"
        )
      ).toBe(false)
    })
  })
})

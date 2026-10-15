import { controllersModule } from "@/bootstrap/RouterModule"

describe("RouterModule", () => {
  it("loads the registered controllers and their dependencies", () => {
    expect(controllersModule()).toBeDefined()
  })
})

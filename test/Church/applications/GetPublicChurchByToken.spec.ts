import { GetPublicChurchByToken } from "@/Church/applications/members/GetPublicChurchByToken"
import { Church, ChurchStatus, IChurchRepository } from "@/Church/domain"

const createChurch = (): Church =>
  Church.fromPrimitives({
    id: "church-db-id",
    churchId: "church-1",
    name: "Test Church",
    city: "City",
    address: "Address",
    street: "Street",
    number: "1",
    postalCode: "00000",
    registerNumber: "",
    email: "church@church.com",
    openingDate: new Date(),
    ministerId: "minister-1",
    lang: "es",
    country: "VE",
    status: ChurchStatus.ACTIVE,
    createdAt: new Date(),
    memberRegistration: {
      token: "registration-token",
      createdAt: new Date(),
    },
  })

describe("GetPublicChurchByToken", () => {
  const churchRepository = {
    one: jest.fn(),
  } as unknown as jest.Mocked<IChurchRepository>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns the country needed by the public registration form", async () => {
    churchRepository.one.mockResolvedValue(createChurch())

    const result = await new GetPublicChurchByToken(churchRepository).execute(
      "registration-token"
    )

    expect(result).toEqual({
      churchId: "church-1",
      churchName: "Test Church",
      country: "VE",
    })
  })
})

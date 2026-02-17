import {
  Church,
  ChurchNotFound,
  type ChurchRequest,
  type IChurchRepository,
} from "../../domain"
import { Logger } from "@/Shared/adapter"
import { GenericException } from "@/Shared/domain"

// import {
//   IRegionRepository,
//   Region,
//   RegionNotFound,
// } from "../../../OrganizacionalStructure/domain";

export class CreateOrUpdateChurch {
  private logger = Logger(CreateOrUpdateChurch.name)

  constructor(
    private readonly churchRepository: IChurchRepository
    //private readonly regionRepository: IRegionRepository,
  ) {}

  async execute(churchRequest: ChurchRequest): Promise<Church> {
    let church: Church | null = null

    if (!churchRequest.churchId) {
      church = await this.create(churchRequest)

      await this.churchRepository.upsert(church)

      return church
    }

    church = await this.churchRepository.one({
      churchId: churchRequest.churchId,
    })
    if (!church) {
      throw new ChurchNotFound()
    }

    if (churchRequest.name?.trim()) {
      church.setName(churchRequest.name.trim())
    }

    if (
      churchRequest.city &&
      churchRequest.address &&
      churchRequest.street &&
      churchRequest.number &&
      churchRequest.postalCode
    ) {
      church.setAddress(
        churchRequest.city,
        churchRequest.address,
        churchRequest.street,
        churchRequest.number,
        churchRequest.postalCode
      )
    }

    if (churchRequest.email) {
      church.setEmail(churchRequest.email)
    }

    if (churchRequest.openingDate) {
      church.setOpeningDate(this.normalizeDate(churchRequest.openingDate))
    }

    if (churchRequest.registerNumber !== undefined) {
      church.setRegisterNumber(churchRequest.registerNumber)
    }

    if (churchRequest.status) {
      church.setStatus(churchRequest.status)
    }

    await this.churchRepository.upsert(church)

    return church
  }

  // private async getRegion(regionId: string): Promise<Region> {
  //   const region: Region = await this.regionRepository.findById(regionId);
  //
  //   if (!region) {
  //     throw new RegionNotFound();
  //   }
  //
  //   return region;
  // }

  private async create(churchRequest: ChurchRequest): Promise<Church> {
    this.logger.info(`Registrar iglesia ${JSON.stringify(churchRequest)}`)
    //const region: Region = await this.getRegion(churchRequest.regionId);

    return Church.create({
      name: churchRequest.name,
      city: churchRequest.city,
      address: churchRequest.address,
      street: churchRequest.street,
      number: churchRequest.number,
      postalCode: churchRequest.postalCode,
      email: churchRequest.email,
      openingDate: this.normalizeDate(churchRequest.openingDate),
      lang: churchRequest.lang ?? "pt-BR",
      symbolFormatMoney: churchRequest.symbolFormatMoney,
      country: churchRequest.country ?? "BR",
      //region,
      registerNumber: churchRequest.registerNumber,
    })
  }

  private normalizeDate(value: Date | string): Date {
    if (value instanceof Date) {
      return value
    }

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      throw new GenericException("Invalid openingDate")
    }
    return parsed
  }
}

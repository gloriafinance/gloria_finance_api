import {
  Church,
  ChurchNotFound,
  ChurchRequest,
  IChurchRepository,
} from "../../domain"
import { Logger } from "@/Shared/adapter"

// import {
//   IRegionRepository,
//   Region,
//   RegionNotFound,
// } from "../../../OrganizacionalStructure/domain";

export class CreateOrUpdateChurch {
  private logger = Logger("CreateOrUpdateChurch")

  constructor(
    private readonly churchRepository: IChurchRepository
    //private readonly regionRepository: IRegionRepository,
  ) {}

  async execute(churchRequest: ChurchRequest): Promise<Church> {
    let church: Church

    if (!churchRequest.churchId) {
      church = await this.create(churchRequest)

      await this.churchRepository.upsert(church)

      return church
    }

    church = await this.churchRepository.one(churchRequest.churchId)
    if (!church) {
      throw new ChurchNotFound()
    }

    //const region: Region = await this.getRegion(churchRequest.regionId);

    //church.setRegion(region);
    church.setAddress(
      churchRequest.city,
      churchRequest.address,
      churchRequest.street,
      churchRequest.number,
      churchRequest.postalCode
    )
    church.setEmail(churchRequest.email)
    church.setOpeningDate(churchRequest.openingDate)
    church.setRegisterNumber(churchRequest.registerNumber)
    church.setStatus(churchRequest.status)

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

    return Church.create(
      churchRequest.name,
      churchRequest.city,
      churchRequest.address,
      churchRequest.street,
      churchRequest.number,
      churchRequest.postalCode,
      churchRequest.email,
      churchRequest.openingDate,
      //region,
      churchRequest.registerNumber
    )
  }
}

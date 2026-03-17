import {
  DevotionalComment,
  DevotionalNotFound,
  DevotionalReaction,
  DEVOTIONAL_REACTION_TYPE_VALUES,
  type CreateDevotionalCommentRequest,
  type DevotionalReactionType,
  type IDevotionalCommentRepository,
  type IDevotionalReactionRepository,
  type IDevotionalRepository,
  type SetDevotionalReactionRequest,
} from "@/Church/domain"

export class DevotionalCommunityService {
  constructor(
    private readonly devotionalRepository: IDevotionalRepository,
    private readonly devotionalReactionRepository: IDevotionalReactionRepository,
    private readonly devotionalCommentRepository: IDevotionalCommentRepository
  ) {}

  async getCommunity(
    churchId: string,
    devotionalId: string,
    memberId?: string
  ) {
    await this.assertDevotionalExists(churchId, devotionalId)

    const [viewerReaction, countedReactions, comments, totalComments] =
      await Promise.all([
        memberId
          ? this.devotionalReactionRepository.findByDevotionalAndMember(
              churchId,
              devotionalId,
              memberId
            )
          : Promise.resolve(undefined),
        this.devotionalReactionRepository.countByDevotional(
          churchId,
          devotionalId
        ),
        this.devotionalCommentRepository.listRecentByDevotional(
          churchId,
          devotionalId,
          20
        ),
        this.devotionalCommentRepository.countByDevotional(
          churchId,
          devotionalId
        ),
      ])

    const totals = DEVOTIONAL_REACTION_TYPE_VALUES.reduce(
      (acc, reactionType) => {
        acc[reactionType] = countedReactions[reactionType] ?? 0
        return acc
      },
      {} as Record<DevotionalReactionType, number>
    )

    const total = Object.values(totals).reduce((sum, value) => sum + value, 0)

    return {
      devotionalId,
      reactions: {
        viewerReactionType: viewerReaction?.getReactionType() ?? null,
        totals,
        total,
      },
      comments: {
        total: totalComments,
        items: comments.map((comment) => comment.toPrimitives()),
      },
    }
  }

  async setReaction(request: SetDevotionalReactionRequest) {
    await this.assertDevotionalExists(request.churchId, request.devotionalId)

    const existing =
      await this.devotionalReactionRepository.findByDevotionalAndMember(
        request.churchId,
        request.devotionalId,
        request.memberId
      )

    if (existing) {
      existing.changeReactionType(request.reactionType)
      await this.devotionalReactionRepository.upsert(existing)
    } else {
      await this.devotionalReactionRepository.upsert(
        DevotionalReaction.create(request)
      )
    }

    return this.getCommunity(
      request.churchId,
      request.devotionalId,
      request.memberId
    )
  }

  async clearReaction(params: {
    churchId: string
    devotionalId: string
    memberId: string
  }) {
    await this.assertDevotionalExists(params.churchId, params.devotionalId)

    await this.devotionalReactionRepository.deleteByDevotionalAndMember(
      params.churchId,
      params.devotionalId,
      params.memberId
    )

    return this.getCommunity(
      params.churchId,
      params.devotionalId,
      params.memberId
    )
  }

  async addComment(request: CreateDevotionalCommentRequest) {
    await this.assertDevotionalExists(request.churchId, request.devotionalId)

    await this.devotionalCommentRepository.create(
      DevotionalComment.create({
        churchId: request.churchId,
        devotionalId: request.devotionalId,
        memberId: request.memberId,
        authorName: request.authorName,
        message: request.message,
      })
    )

    return this.getCommunity(
      request.churchId,
      request.devotionalId,
      request.memberId
    )
  }

  private async assertDevotionalExists(churchId: string, devotionalId: string) {
    const devotional = await this.devotionalRepository.findByDevotionalId(
      churchId,
      devotionalId
    )

    if (!devotional) {
      throw new DevotionalNotFound()
    }
  }
}

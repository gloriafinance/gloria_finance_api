export class ContributionMemberSnapshot {
  private memberId: string
  private name: string
  private churchId: string
  private churchName: string

  static fromMember(member: {
    getMemberId(): string
    getName(): string
    getChurch(): { churchId: string; name: string }
  }): ContributionMemberSnapshot {
    const snapshot = new ContributionMemberSnapshot()
    snapshot.memberId = member.getMemberId()
    snapshot.name = member.getName()
    const church = member.getChurch()
    snapshot.churchId = church.churchId
    snapshot.churchName = church.name
    return snapshot
  }

  static fromPrimitives(plainData: any): ContributionMemberSnapshot {
    const snapshot = new ContributionMemberSnapshot()
    snapshot.memberId = plainData.memberId
    snapshot.name = plainData.name
    snapshot.churchId = plainData.churchId
    snapshot.churchName = plainData.churchName
    return snapshot
  }

  getMemberId(): string {
    return this.memberId
  }

  getName(): string {
    return this.name
  }

  getChurchId(): string {
    return this.churchId
  }

  getChurchName(): string {
    return this.churchName
  }

  toPrimitives(): any {
    return {
      memberId: this.memberId,
      name: this.name,
      churchId: this.churchId,
      churchName: this.churchName,
    }
  }
}

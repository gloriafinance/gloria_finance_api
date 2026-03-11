import {
  DevotionalAgent,
  type PromptUserRequest,
} from "@/Church/infrastructure/agents/Devotional.agent.ts"

export class DevotionalGeneratorJob {
  async handler(request: PromptUserRequest) {
    return await new DevotionalAgent().execute(request)
  }
}

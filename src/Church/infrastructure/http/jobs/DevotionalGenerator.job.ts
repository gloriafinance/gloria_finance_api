import {
  DevotionalAgent,
  type PromptUserRequest,
} from "@/Church/applications/devotional/agents/Devotional.agent.ts"

export class DevotionalGeneratorJob {
  async handler(request: PromptUserRequest) {
    return await new DevotionalAgent().execute(request)
  }
}

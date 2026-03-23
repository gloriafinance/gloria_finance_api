import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { SupportAnalysisTarget } from "@/Support/domain/requests/SupportAssistant.request"
import type { SupportAssistantIntent } from "@/Support/domain/types/SupportAssistant.response"

type ProductOverviewKnowledge = {
  id: string
  title: string
  summary: string
  capabilities: string[]
  limitations: string[]
  keywords: string[]
}

type ScreenKnowledge = {
  id: string
  title: string
  route: string
  module: string
  summary: string
  whenToUse: string[]
  avoidWhen: string[]
  requiredFields: string[]
  permissions: string[]
  keywords: string[]
}

type NavigationGuideKnowledge = {
  id: string
  title: string
  summary: string
  route: string
  steps: string[]
  keywords: string[]
}

type AccountingRuleKnowledge = {
  id: string
  title: string
  summary: string
  guidance: string[]
  keywords: string[]
}

type ReportDefinitionKnowledge = {
  id: string
  title: string
  route: string
  summary: string
  useCases: string[]
  analysisFocus: string[]
  managementQuestions: string[]
  keywords: string[]
}

type FinancialConceptRuleKnowledge = {
  id: string
  title: string
  summary: string
  guidance: string[]
  keywords: string[]
}

type SupportKnowledgeContext = {
  contextText: string
  sourceIds: string[]
  routes: string[]
  screenTitles: string[]
}

type SupportKnowledgeEntry = {
  id: string
  title: string
  route?: string
  keywords: string[]
  text: string
}

const KNOWLEDGE_DIR = resolve(
  process.cwd(),
  "src/Support/infrastructure/knowledge"
)

export class SupportKnowledgeRetrieverService {
  private static cache:
    | {
        productOverview: ProductOverviewKnowledge
        screens: ScreenKnowledge[]
        navigationGuides: NavigationGuideKnowledge[]
        accountingRules: AccountingRuleKnowledge[]
        reportDefinitions: ReportDefinitionKnowledge[]
        financialConceptRules: FinancialConceptRuleKnowledge[]
      }
    | undefined

  retrieve(params: {
    question: string
    intent: SupportAssistantIntent
    analysisTarget?: SupportAnalysisTarget
  }): SupportKnowledgeContext {
    const knowledge = this.loadKnowledge()
    const searchText = this.buildSearchText(
      params.question,
      params.analysisTarget
    )
    const routeHint = this.extractRouteHint(params.analysisTarget)
    const reportTypeHint = this.extractReportTypeHint(params.analysisTarget)
    const entries = this.selectEntries(knowledge, params.intent)
    const ranked = entries
      .map((entry) => ({
        entry,
        score: this.scoreEntry(
          entry,
          searchText,
          params.intent,
          routeHint,
          reportTypeHint
        ),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
    const contextualRanked = routeHint
      ? ranked.filter((item) => item.entry.route === routeHint)
      : []
    const merged = [...contextualRanked]

    for (const item of ranked) {
      if (merged.some((candidate) => candidate.entry.id === item.entry.id)) {
        continue
      }

      merged.push(item)
    }

    const limited = merged.slice(0, 8)

    if (limited.length === 0) {
      limited.push({
        entry: this.toProductEntry(knowledge.productOverview),
        score: 1,
      })
    }

    return {
      sourceIds: limited.map((item) => item.entry.id),
      routes: limited
        .map((item) => item.entry.route)
        .filter((route): route is string => Boolean(route)),
      screenTitles: limited.map((item) => item.entry.title),
      contextText: limited
        .map((item) => `Source ${item.entry.id}\n${item.entry.text}`)
        .join("\n\n"),
    }
  }

  private loadKnowledge() {
    if (SupportKnowledgeRetrieverService.cache) {
      return SupportKnowledgeRetrieverService.cache
    }

    SupportKnowledgeRetrieverService.cache = {
      productOverview: this.readJson<ProductOverviewKnowledge>(
        "product-overview.json"
      ),
      screens: this.readJson<ScreenKnowledge[]>("screens.json"),
      navigationGuides: this.readJson<NavigationGuideKnowledge[]>(
        "navigation-guides.json"
      ),
      accountingRules: this.readJson<AccountingRuleKnowledge[]>(
        "accounting-rules.json"
      ),
      reportDefinitions: this.readJson<ReportDefinitionKnowledge[]>(
        "report-definitions.json"
      ),
      financialConceptRules: this.readJson<FinancialConceptRuleKnowledge[]>(
        "financial-concept-rules.json"
      ),
    }

    return SupportKnowledgeRetrieverService.cache
  }

  private selectEntries(
    knowledge: NonNullable<typeof SupportKnowledgeRetrieverService.cache>,
    intent: SupportAssistantIntent
  ): SupportKnowledgeEntry[] {
    const entries: SupportKnowledgeEntry[] = [
      this.toProductEntry(knowledge.productOverview),
    ]

    if (
      intent === "product_overview" ||
      intent === "general_support" ||
      intent === "navigation_help" ||
      intent === "configuration_help" ||
      intent === "register_financial_movement" ||
      intent === "document_guidance"
    ) {
      entries.push(...knowledge.screens.map((item) => this.toScreenEntry(item)))
      entries.push(
        ...knowledge.navigationGuides.map((item) => this.toGuideEntry(item))
      )
    }

    if (
      intent === "register_financial_movement" ||
      intent === "document_guidance" ||
      intent === "configuration_help" ||
      intent === "general_support"
    ) {
      entries.push(
        ...knowledge.accountingRules.map((item) => this.toRuleEntry(item))
      )
    }

    if (
      intent === "register_financial_movement" ||
      intent === "configuration_help" ||
      intent === "general_support"
    ) {
      entries.push(
        ...knowledge.financialConceptRules.map((item) =>
          this.toFinancialConceptRuleEntry(item)
        )
      )
    }

    if (
      intent === "report_analysis" ||
      intent === "navigation_help" ||
      intent === "general_support"
    ) {
      entries.push(
        ...knowledge.reportDefinitions.map((item) => this.toReportEntry(item))
      )
    }

    return entries
  }

  private toProductEntry(
    item: ProductOverviewKnowledge
  ): SupportKnowledgeEntry {
    return {
      id: item.id,
      title: item.title,
      keywords: item.keywords,
      text: [
        `Title: ${item.title}`,
        `Summary: ${item.summary}`,
        `Capabilities: ${item.capabilities.join("; ")}`,
        `Limitations: ${item.limitations.join("; ")}`,
      ].join("\n"),
    }
  }

  private toScreenEntry(item: ScreenKnowledge): SupportKnowledgeEntry {
    return {
      id: item.id,
      title: item.title,
      route: item.route,
      keywords: item.keywords,
      text: [
        `Screen: ${item.title}`,
        `Route: ${item.route}`,
        `Module: ${item.module}`,
        `Summary: ${item.summary}`,
        `WhenToUse: ${item.whenToUse.join("; ")}`,
        `AvoidWhen: ${item.avoidWhen.join("; ")}`,
        `RequiredFields: ${item.requiredFields.join("; ")}`,
        `Permissions: ${item.permissions.join("; ")}`,
      ].join("\n"),
    }
  }

  private toGuideEntry(item: NavigationGuideKnowledge): SupportKnowledgeEntry {
    return {
      id: item.id,
      title: item.title,
      route: item.route,
      keywords: item.keywords,
      text: [
        `Guide: ${item.title}`,
        `Route: ${item.route}`,
        `Summary: ${item.summary}`,
        `Steps: ${item.steps.join("; ")}`,
      ].join("\n"),
    }
  }

  private toRuleEntry(item: AccountingRuleKnowledge): SupportKnowledgeEntry {
    return {
      id: item.id,
      title: item.title,
      keywords: item.keywords,
      text: [
        `AccountingRule: ${item.title}`,
        `Summary: ${item.summary}`,
        `Guidance: ${item.guidance.join("; ")}`,
      ].join("\n"),
    }
  }

  private toReportEntry(
    item: ReportDefinitionKnowledge
  ): SupportKnowledgeEntry {
    return {
      id: item.id,
      title: item.title,
      route: item.route,
      keywords: item.keywords,
      text: [
        `Report: ${item.title}`,
        `Route: ${item.route}`,
        `Summary: ${item.summary}`,
        `UseCases: ${item.useCases.join("; ")}`,
        `AnalysisFocus: ${item.analysisFocus.join("; ")}`,
        `ManagementQuestions: ${item.managementQuestions.join("; ")}`,
      ].join("\n"),
    }
  }

  private toFinancialConceptRuleEntry(
    item: FinancialConceptRuleKnowledge
  ): SupportKnowledgeEntry {
    return {
      id: item.id,
      title: item.title,
      keywords: item.keywords,
      text: [
        `FinancialConceptRule: ${item.title}`,
        `Summary: ${item.summary}`,
        `Guidance: ${item.guidance.join("; ")}`,
      ].join("\n"),
    }
  }

  private scoreEntry(
    entry: SupportKnowledgeEntry,
    normalizedSearchText: string,
    intent: SupportAssistantIntent,
    routeHint?: string,
    reportTypeHint?: string
  ): number {
    let score = 0

    if (routeHint && entry.route === routeHint) {
      score += 50
    }

    if (
      reportTypeHint &&
      entry.id === this.mapReportTypeToKnowledgeId(reportTypeHint)
    ) {
      score += 40
    }

    for (const keyword of entry.keywords) {
      if (normalizedSearchText.includes(this.normalize(keyword))) {
        score += 5
      }
    }

    if (normalizedSearchText.includes(this.normalize(entry.title))) {
      score += 4
    }

    if (
      entry.route &&
      normalizedSearchText.includes(this.normalize(entry.route))
    ) {
      score += 3
    }

    if (intent === "product_overview" && entry.id === "product-overview") {
      score += 10
    }

    return score
  }

  private buildSearchText(
    question: string,
    analysisTarget?: SupportAnalysisTarget
  ): string {
    const parts = [question]
    if (analysisTarget) {
      parts.push(analysisTarget.title)
      if (typeof analysisTarget.data === "string") {
        parts.push(analysisTarget.data)
      } else {
        parts.push(JSON.stringify(analysisTarget.data))
      }
    }

    return this.normalize(parts.join(" "))
  }

  private extractRouteHint(target?: SupportAnalysisTarget): string | undefined {
    if (!target || typeof target.data !== "object" || target.data === null) {
      return undefined
    }

    const route = (target.data as Record<string, unknown>).route
    return typeof route === "string" && route.trim().length > 0
      ? route.trim()
      : undefined
  }

  private extractReportTypeHint(
    target?: SupportAnalysisTarget
  ): string | undefined {
    if (!target || typeof target.data !== "object" || target.data === null) {
      return undefined
    }

    const reportType = (target.data as Record<string, unknown>).reportType
    return typeof reportType === "string" && reportType.trim().length > 0
      ? reportType.trim()
      : undefined
  }

  private mapReportTypeToKnowledgeId(reportType: string): string | undefined {
    switch (reportType) {
      case "income_statement":
        return "report:income-statement"
      case "monthly_tithes":
        return "report:monthly-tithes"
      case "dre":
        return "report:dre"
      default:
        return undefined
    }
  }

  private readJson<T>(fileName: string): T {
    return JSON.parse(
      readFileSync(resolve(KNOWLEDGE_DIR, fileName), "utf8")
    ) as T
  }

  private normalize(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
  }
}

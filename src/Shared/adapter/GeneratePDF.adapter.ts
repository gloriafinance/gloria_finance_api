import { IStorageService } from "@/Shared/domain"
import puppeteer, { Browser, LaunchOptions } from "puppeteer"
import { v4 } from "uuid"
import * as path from "path"
import { promises as fs } from "node:fs"
import { IHTMLAdapter } from "@/Shared/domain/interfaces/GenerateHTML.interface"
import { Logger } from "@/Shared/adapter/CustomLogger"

export abstract class GeneratePDFAdapter {
  protected htmlString: string

  constructor(
    protected readonly htmlAdapter: IHTMLAdapter,
    protected readonly storeService: IStorageService
  ) {}

  abstract htmlTemplate(template: string, data: any): this

  abstract toPDF(upload: boolean): Promise<string>
}

export class PuppeteerAdapter extends GeneratePDFAdapter {
  private logger = Logger(PuppeteerAdapter.name)

  constructor(htmlAdapter: IHTMLAdapter, storeService: IStorageService) {
    super(htmlAdapter, storeService)
  }

  htmlTemplate(template: string, data: any) {
    this.htmlString = this.htmlAdapter.generateHTML(template, data)

    return this
  }

  async toPDF(upload: boolean = true): Promise<string> {
    this.logger.info("Generating PDF from HTML string")

    const browser = await this.launchBrowser()
    const page = await browser.newPage()

    await page.setContent(this.htmlString)

    const pdfName = `${v4()}.pdf`
    const tempDir = path.join(process.cwd(), "tmp")
    await fs.mkdir(tempDir, { recursive: true })
    const pdfPath = path.join(tempDir, pdfName)

    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      margin: {
        top: "0.5in",
        bottom: "0.5in",
        left: "0.5in",
        right: "0.5in",
      },
    })

    await browser.close()

    if (!upload) {
      return pdfPath
    }

    return await this.storeService.uploadFile({
      tempFilePath: pdfPath,
      name: pdfName,
      mimetype: "application/pdf",
    })
  }

  private async launchBrowser(): Promise<Browser> {
    const disableSandbox = this.shouldDisableSandbox()
    const launchOptions = this.buildLaunchOptions(disableSandbox)

    try {
      return await puppeteer.launch(launchOptions)
    } catch (error) {
      const message = error instanceof Error ? error.message : ""

      if (!disableSandbox && message.includes("No usable sandbox")) {
        this.logger.error(
          "Retrying Puppeteer launch without sandbox due to environment restrictions"
        )

        return await puppeteer.launch(this.buildLaunchOptions(true))
      }

      throw error
    }
  }

  private buildLaunchOptions(disableSandbox: boolean): LaunchOptions {
    const options: LaunchOptions = {
      headless: true,
    }

    if (disableSandbox) {
      options.args = [
        ...(options.args ?? []),
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ]
    }

    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH

    if (executablePath) {
      options.executablePath = executablePath
    }

    return options
  }

  private shouldDisableSandbox(): boolean {
    const envValue =
      process.env.PUPPETEER_DISABLE_SANDBOX ??
      process.env.DISABLE_CHROMIUM_SANDBOX

    if (!envValue) {
      return false
    }

    return ["true", "1", "yes", "on"].includes(envValue.toLowerCase())
  }
}

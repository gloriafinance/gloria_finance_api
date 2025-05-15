import { IStorageService } from "@/Shared/domain"
import puppeteer from "puppeteer"
import { v4 } from "uuid"
import path from "node:path"
import { IHTMLAdapter } from "@/Shared/domain/interfaces/GenerateHTML.interface"

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
  constructor(htmlAdapter: IHTMLAdapter, storeService: IStorageService) {
    super(htmlAdapter, storeService)
  }

  htmlTemplate(template: string, data: any) {
    this.htmlString = this.htmlAdapter.generateHTML(template, data)

    return this
  }

  async toPDF(upload: boolean = true): Promise<string> {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()

    await page.setContent(this.htmlString)

    const pdfName = `${v4()}.pdf`
    const pdfPath = path.join("/tmp/", pdfName)

    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      margin: {
        top: "0.5in",
        bottom: "0.5in",
        left: "1in",
        right: "1in",
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
}

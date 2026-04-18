import fs from "fs";
import { PDFParse } from "pdf-parse";

export async function parseResume(filePath: string): Promise<string> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error parsing PDF:", message);
    throw error;
  }
}

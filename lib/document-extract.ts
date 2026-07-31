import { PDFParse } from "pdf-parse";

const MAX_CHARS = 4000;

/**
 * Best-effort text extraction for the Classificador de Documentos and Agente
 * de Extração de Indicadores. PDF, plain-text and XML (NF-e/NFS-e are almost
 * always XML) are supported — images, spreadsheets and Office docs return
 * null so the caller can honestly report "conteúdo não pôde ser lido"
 * instead of guessing from the filename alone.
 */
export async function extractDocumentText(buffer: Buffer, mimeType: string): Promise<string | null> {
  try {
    if (mimeType === "application/pdf") {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        const text = result.text.trim();
        return text ? text.slice(0, MAX_CHARS) : null;
      } finally {
        await parser.destroy();
      }
    }

    if (mimeType.startsWith("text/") || mimeType === "application/xml") {
      const text = buffer.toString("utf-8").trim();
      return text ? text.slice(0, MAX_CHARS) : null;
    }

    return null;
  } catch (error) {
    console.error("extractDocumentText failed:", error);
    return null;
  }
}

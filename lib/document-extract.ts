const MAX_CHARS = 4000;

// pdf-parse usa pdfjs-dist por baixo, que tenta polyfillar DOMMatrix/
// ImageData/Path2D via @napi-rs/canvas pra suportar renderização — pacote
// que não instalamos (não precisamos renderizar página, só extrair texto).
// Sem ele, o pdfjs-dist só *avisa* que não conseguiu polyfillar e segue,
// mas em algum ponto da inicialização do módulo referencia o identificador
// global sem checar — e isso quebra com "ReferenceError: DOMMatrix is not
// defined" na função serverless da Vercel. Como não usamos nenhum caminho
// de renderização (só getText()), classes vazias bastam pra satisfazer a
// referência. Import de pdf-parse tem que ser dinâmico e vir DEPOIS disso —
// import estático é hoisted pro topo do módulo e rodaria antes do stub.
function ensurePdfJsGlobals() {
  const g = globalThis as Record<string, unknown>;
  if (typeof g.DOMMatrix === "undefined") g.DOMMatrix = class DOMMatrix {};
  if (typeof g.ImageData === "undefined") g.ImageData = class ImageData {};
  if (typeof g.Path2D === "undefined") g.Path2D = class Path2D {};
}

// Formatos que o pdf-parse não lê (imagem, PDF escaneado) mas o Gemini lê
// direto como multimodal — usado por classifyDocument como fallback quando
// extractDocumentText devolve null.
export const OCR_CAPABLE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

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
      ensurePdfJsGlobals();
      const { PDFParse } = await import("pdf-parse");
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

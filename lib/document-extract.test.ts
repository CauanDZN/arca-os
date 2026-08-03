import { describe, it, expect } from "vitest";
import React from "react";
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import { extractDocumentText } from "@/lib/document-extract";

describe("extractDocumentText", () => {
  // Regressão do crash "ReferenceError: DOMMatrix is not defined" em
  // produção (pdfjs-dist, dependência do pdf-parse, sem @napi-rs/canvas
  // instalado pro polyfill) — só pega esse caminho de verdade com um PDF
  // real, não com texto/xml.
  it("reads a real PDF without crashing on DOMMatrix", async () => {
    const buffer = await renderToBuffer(
      React.createElement(
        Document,
        null,
        React.createElement(
          Page,
          null,
          React.createElement(Text, null, "conteudo de teste do pdf")
        )
      )
    );
    const result = await extractDocumentText(buffer, "application/pdf");
    expect(result).toContain("conteudo de teste do pdf");
  });
  it("reads plain text files", async () => {
    const result = await extractDocumentText(Buffer.from("extrato bancário de teste"), "text/plain");
    expect(result).toBe("extrato bancário de teste");
  });

  it("reads text/xml (NF-e/NFS-e are almost always XML)", async () => {
    const xml = "<nfeProc><NFe><vNF>1234.56</vNF></NFe></nfeProc>";
    const result = await extractDocumentText(Buffer.from(xml), "text/xml");
    expect(result).toBe(xml);
  });

  it("reads application/xml too — some browsers/systems label NF-e that way instead", async () => {
    const xml = "<nfeProc><NFe><vNF>1234.56</vNF></NFe></nfeProc>";
    const result = await extractDocumentText(Buffer.from(xml), "application/xml");
    expect(result).toBe(xml);
  });

  it("returns null for an unsupported format instead of guessing", async () => {
    const result = await extractDocumentText(Buffer.from([0xff, 0xd8, 0xff]), "image/jpeg");
    expect(result).toBeNull();
  });

  it("returns null for empty content instead of an empty string", async () => {
    const result = await extractDocumentText(Buffer.from("   "), "text/plain");
    expect(result).toBeNull();
  });

  it("truncates very long text to keep the AI prompt bounded", async () => {
    const long = "a".repeat(10000);
    const result = await extractDocumentText(Buffer.from(long), "text/plain");
    expect(result?.length).toBe(4000);
  });
});

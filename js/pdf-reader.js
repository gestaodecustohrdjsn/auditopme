import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

export async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    // PDF.js devolve fragmentos posicionados. Para o parser, preservamos quebras
    // quando a coordenada vertical muda de forma perceptível.
    const lines = [];
    let currentLine = [];
    let lastY = null;

    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform?.[5] ?? null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2.2) {
        if (currentLine.length) lines.push(currentLine.join(" ").replace(/\s+/g, " ").trim());
        currentLine = [];
      }
      const text = String(item.str || "").trim();
      if (text) currentLine.push(text);
      lastY = y;
    }
    if (currentLine.length) lines.push(currentLine.join(" ").replace(/\s+/g, " ").trim());
    pages.push(lines.join("\n"));
  }

  return {
    text: pages.join("\n\n"),
    pages: pdf.numPages,
  };
}

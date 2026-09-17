import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

function toPositionedItems(items) {
  return items
    .filter(item => "str" in item && String(item.str || "").trim())
    .map((item, index) => ({
      text: String(item.str || "").trim(),
      x: Number(item.transform?.[4] ?? 0),
      y: Number(item.transform?.[5] ?? 0),
      width: Number(item.width ?? 0),
      height: Number(item.height ?? 0),
      index,
    }));
}

function buildPageText(positioned) {
  const sorted = [...positioned].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 2.2) return b.y - a.y;
    return a.x - b.x;
  });

  const lines = [];
  const tolerance = 2.2;

  for (const item of sorted) {
    let line = lines.find(candidate => Math.abs(candidate.y - item.y) <= tolerance);
    if (!line) {
      line = { y: item.y, items: [] };
      lines.push(line);
    }
    line.items.push(item);
  }

  lines.sort((a, b) => b.y - a.y);

  return lines
    .map(line => line.items
      .sort((a, b) => a.x - b.x)
      .map(item => item.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim())
    .filter(Boolean)
    .join("\n");
}

export async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts = [];
  const positionedPages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = toPositionedItems(content.items);

    pageTexts.push(buildPageText(items));
    positionedPages.push({ pageNumber, items });
  }

  return {
    text: pageTexts.join("\n\n"),
    pages: pdf.numPages,
    positionedPages,
  };
}

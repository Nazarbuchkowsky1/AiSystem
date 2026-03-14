/**
 * Extract text only from a PDF file (no images). Use for large PDFs to upload
 * a small .txt instead of the full file (e.g. 154 MB presentation → few KB of text).
 * PDF.js is loaded from CDN on first use so it does not bloat the deploy bundle (5MB limit).
 */

const PDF_SIZE_THRESHOLD_MB = 10;
const PDF_SIZE_THRESHOLD = PDF_SIZE_THRESHOLD_MB * 1024 * 1024;
const PDFJS_CDN_VERSION = "4.0.379";

let pdfjsLib = null;

async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  if (typeof window === "undefined") return null;
  try {
    pdfjsLib = await import(
      /* @vite-ignore */
      `https://unpkg.com/pdfjs-dist@${PDFJS_CDN_VERSION}/build/pdf.mjs`
    );
    if (pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_CDN_VERSION}/build/pdf.worker.min.mjs`;
    }
  } catch (e) {
    console.warn("PDF.js failed to load from CDN:", e?.message || e);
  }
  return pdfjsLib;
}

/**
 * @param {File} file - PDF file
 * @returns {Promise<File|null>} - New File with extracted text (name: originalName.txt), or null on error / small file
 */
export async function extractTextFromPdfIfLarge(file) {
  if (!file || typeof file.name !== "string") return null;
  const name = file.name.toLowerCase();
  if (!name.endsWith(".pdf")) return null;
  if (file.size < PDF_SIZE_THRESHOLD) return null;

  try {
    const lib = await getPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const doc = await lib.getDocument({ data: arrayBuffer }).promise;
    const numPages = doc.numPages;
    const parts = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = (textContent.items || [])
        .map((item) => (item && typeof item.str === "string" ? item.str : ""))
        .join(" ");
      if (pageText.trim()) parts.push(pageText.trim());
    }

    const fullText = parts.join("\n\n");
    const baseName = file.name.replace(/\.pdf$/i, "");
    const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
    return new File([blob], `${baseName}-text.txt`, { type: "text/plain" });
  } catch (e) {
    console.warn("PDF text extraction failed, uploading original file:", e?.message || e);
    return null;
  }
}

export function shouldExtractPdfText(file) {
  if (!file || file.size < PDF_SIZE_THRESHOLD) return false;
  const name = (file.name || "").toLowerCase();
  return name.endsWith(".pdf");
}

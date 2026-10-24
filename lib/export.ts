export function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "论文图表";
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}

export function downloadFile(data: BlobPart, filename: string, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function copyRichText(html: string, plainText: string) {
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plainText], { type: "text/plain" }),
      })]);
      return;
    }
  } catch {
    // Word-compatible selection fallback below.
  }
  const staging = document.createElement("div");
  staging.contentEditable = "true";
  staging.style.cssText = "position:fixed;left:-10000px;top:0;width:900px;background:#fff;";
  staging.innerHTML = html;
  document.body.appendChild(staging);
  const range = document.createRange();
  range.selectNodeContents(staging);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  const copied = document.execCommand("copy");
  selection?.removeAllRanges();
  staging.remove();
  if (!copied) await navigator.clipboard.writeText(plainText);
}

const MAX_PNG_SIDE = 16384;
const MAX_PNG_PIXELS = 100_000_000;

export function buildSvgMarkup(element: SVGSVGElement, options: { monochrome: boolean; scale: number }) {
  const copy = element.cloneNode(true) as SVGSVGElement;
  copy.querySelectorAll("[data-export-ignore]").forEach((node) => node.remove());
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const viewBox = (copy.getAttribute("viewBox") || "0 0 1200 800").split(/\s+/);
  const width = Math.round(Number(viewBox[2]) * options.scale);
  const height = Math.round(Number(viewBox[3]) * options.scale);
  copy.setAttribute("width", String(width));
  copy.setAttribute("height", String(height));
  if (options.monochrome) {
    copy.setAttribute("style", "background:#fff;color:#000");
    copy.querySelectorAll("text").forEach((node) => {
      node.setAttribute("fill", "#000000");
    });
    copy.querySelectorAll("[stroke]").forEach((node) => {
      if (node.tagName.toLowerCase() === "text") node.setAttribute("stroke", "#ffffff");
      else if (node.getAttribute("stroke") !== "none") node.setAttribute("stroke", "#000000");
    });
    copy.querySelectorAll("rect, circle, ellipse, path, polygon").forEach((node) => {
      if (node.closest("defs") || node.hasAttribute("data-bw-preserve")) return;
      const fill = node.getAttribute("fill");
      if (fill && fill !== "none") node.setAttribute("fill", "#ffffff");
    });
  }
  return new XMLSerializer().serializeToString(copy);
}

export function diagramSvgMarkup(scale = 1, monochrome = false) {
  const element = document.getElementById("diagram-canvas") as unknown as SVGSVGElement | null;
  if (!element) return "";
  return buildSvgMarkup(element, { monochrome, scale });
}

export type PngExportOutcome = "ok" | "missing-canvas" | "too-large" | "render-failed";

export function canvasPixelSize(element: SVGSVGElement, scale: number) {
  const viewBox = (element.getAttribute("viewBox") || "0 0 1200 800").split(/\s+/);
  return { width: Math.round(Number(viewBox[2]) * scale), height: Math.round(Number(viewBox[3]) * scale) };
}

export function exportPngFromSvg(markup: string, options: { filename: string; width: number; height: number }): Promise<PngExportOutcome> {
  if (options.width > MAX_PNG_SIDE || options.height > MAX_PNG_SIDE || options.width * options.height > MAX_PNG_PIXELS) {
    return Promise.resolve("too-large");
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    const finish = (outcome: PngExportOutcome) => {
      URL.revokeObjectURL(url);
      resolve(outcome);
    };
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context || !canvas.width || !canvas.height) {
        finish("render-failed");
        return;
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((png) => {
        if (!png) {
          finish("render-failed");
          return;
        }
        downloadFile(png, options.filename, "image/png");
        finish("ok");
      }, "image/png");
    };
    image.onerror = () => finish("render-failed");
    image.src = url;
  });
}

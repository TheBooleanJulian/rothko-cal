import { toPng, toJpeg, toSvg } from "html-to-image";

const EXPORTERS = { png: toPng, jpg: toJpeg, svg: toSvg };

export async function exportElement(el, format, filename) {
  const exporter = EXPORTERS[format];
  const dataUrl = await exporter(el, { backgroundColor: "#050508", pixelRatio: 2 });
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

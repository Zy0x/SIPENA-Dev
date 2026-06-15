import html2canvas from "html2canvas";
import { reportExportProgress, type ExportProgressReporter } from "@/lib/exportProgress";

function getPngTargetWidthPx(quality: "hd" | "4k") {
  return quality === "4k" ? 3840 : 1920;
}

export async function exportElementToPng(
  element: HTMLElement,
  quality: "hd" | "4k" = "hd",
  fileName = `export-${quality}.png`,
  progress?: ExportProgressReporter,
) {
  await reportExportProgress(progress, 14, "Menyiapkan PNG", "Mengukur area preview yang akan diekspor.");
  const targetWidthPx = getPngTargetWidthPx(quality);
  const scale = Math.max(targetWidthPx / Math.max(element.scrollWidth, 1), quality === "4k" ? 4 : 2);
  await reportExportProgress(progress, 34, "Render PNG", "Merender preview ke canvas resolusi tinggi.");
  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale,
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  await reportExportProgress(progress, 84, "Encode PNG", "Mengubah canvas menjadi file PNG.");
  const dataUrl = canvas.toDataURL("image/png");
  await reportExportProgress(progress, 94, "Download", "File PNG selesai dibuat.");
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.click();
  await reportExportProgress(progress, 100, "Download", "File PNG siap, download dimulai.");
}

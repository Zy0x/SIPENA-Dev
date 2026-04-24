import html2canvas from "html2canvas";

function getPngTargetWidthPx(quality: "hd" | "4k") {
  return quality === "4k" ? 3840 : 1920;
}

export async function exportElementToPng(
  element: HTMLElement,
  quality: "hd" | "4k" = "hd",
  fileName = `export-${quality}.png`,
) {
  const targetWidthPx = getPngTargetWidthPx(quality);
  const scale = Math.max(targetWidthPx / Math.max(element.scrollWidth, 1), quality === "4k" ? 4 : 2);
  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale,
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = fileName;
  link.click();
}

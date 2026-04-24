import html2canvas from "html2canvas";

export async function exportElementToPng(
  element: HTMLElement,
  quality: "hd" | "4k" = "hd",
  fileName = `export-${quality}.png`,
) {
  const scale = quality === "4k" ? 4 : 2;
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

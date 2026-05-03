const COARSE_POINTER_QUERY = "(hover: none), (pointer: coarse)";
const KEYBOARD_KEYS = new Set([
  "Tab",
  "Enter",
  " ",
  "Spacebar",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

function isButtonLikeElement(element: Element | null): element is HTMLElement {
  return !!element && element instanceof HTMLElement && !!element.closest(
    [
      "button",
      "a[href]",
      "[role='button']",
      "[role='tab']",
      "[data-radix-collection-item]",
      "[aria-pressed]",
      "[data-state]",
    ].join(","),
  );
}

export function isCoarsePointerDevice() {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia(COARSE_POINTER_QUERY).matches;
}

export function initInputModality() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const root = document.documentElement;
  const setModality = (value: "keyboard" | "pointer") => {
    root.dataset.inputModality = value;
  };
  const syncPointerProfile = () => {
    root.dataset.pointerType = isCoarsePointerDevice() ? "coarse" : "fine";
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.altKey || event.ctrlKey) return;
    if (!KEYBOARD_KEYS.has(event.key)) return;
    setModality("keyboard");
  };

  const handlePointerDown = () => {
    setModality("pointer");
    syncPointerProfile();
  };

  const clearTouchFocus = (event: Event) => {
    if (!isCoarsePointerDevice()) return;

    const target = event.target instanceof Element ? event.target : null;
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (!isButtonLikeElement(target) && !isButtonLikeElement(activeElement)) {
      return;
    }

    const elementToBlur = isButtonLikeElement(activeElement)
      ? activeElement
      : target instanceof HTMLElement
        ? target.closest("button, a[href], [role='button'], [role='tab']") as HTMLElement | null
        : null;

    if (!elementToBlur) return;
    window.requestAnimationFrame(() => {
      if (document.activeElement === elementToBlur) {
        elementToBlur.blur();
      }
    });
  };

  syncPointerProfile();
  setModality("pointer");

  window.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("pointerdown", handlePointerDown, true);
  window.addEventListener("pointerup", clearTouchFocus, true);
  window.addEventListener("pointercancel", clearTouchFocus, true);
  window.addEventListener("touchend", clearTouchFocus, true);
  window.addEventListener("resize", syncPointerProfile);
}

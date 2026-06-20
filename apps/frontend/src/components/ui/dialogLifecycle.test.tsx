import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AlertDialog } from "./alert-dialog";
import { Dialog, getDialogStack } from "./dialog";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("dialog history lifecycle", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    getDialogStack().splice(0);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    getDialogStack().splice(0);
    vi.restoreAllMocks();
  });

  it("registers one dialog entry across callback and content rerenders", () => {
    const pushState = vi.spyOn(window.history, "pushState").mockImplementation(() => undefined);
    const latestClose = vi.fn();

    act(() => root.render(<Dialog open onOpenChange={() => undefined} />));
    for (let index = 0; index < 100; index += 1) {
      act(() => root.render(<Dialog open onOpenChange={latestClose} data-render={index} />));
    }

    expect(pushState).toHaveBeenCalledTimes(1);
    expect(getDialogStack()).toHaveLength(1);

    act(() => getDialogStack()[0].close());
    expect(latestClose).toHaveBeenCalledWith(false);
  });

  it("reuses the same registration when StrictMode replays effects", () => {
    const pushState = vi.spyOn(window.history, "pushState").mockImplementation(() => undefined);

    act(() => root.render(
      <StrictMode>
        <Dialog open onOpenChange={() => undefined} />
      </StrictMode>,
    ));

    expect(pushState).toHaveBeenCalledTimes(1);
    expect(getDialogStack()).toHaveLength(1);
  });

  it("keeps AlertDialog registration stable across callback rerenders", () => {
    const pushState = vi.spyOn(window.history, "pushState").mockImplementation(() => undefined);

    act(() => root.render(<AlertDialog open onOpenChange={() => undefined} />));
    for (let index = 0; index < 50; index += 1) {
      act(() => root.render(<AlertDialog open onOpenChange={() => undefined} data-render={index} />));
    }

    expect(pushState).toHaveBeenCalledTimes(1);
    expect(getDialogStack()).toHaveLength(1);
  });

  it("keeps nested confirmation registered above its parent without duplicating either entry", () => {
    const pushState = vi.spyOn(window.history, "pushState").mockImplementation(() => undefined);
    const closeParent = vi.fn();
    const closeConfirmation = vi.fn();

    const renderNestedDialogs = (renderIndex: number) => (
      <Dialog open onOpenChange={closeParent} data-render={renderIndex}>
        <AlertDialog open onOpenChange={closeConfirmation} data-render={renderIndex} />
      </Dialog>
    );

    act(() => root.render(renderNestedDialogs(0)));
    for (let index = 1; index <= 50; index += 1) {
      act(() => root.render(renderNestedDialogs(index)));
    }

    expect(pushState).toHaveBeenCalledTimes(2);
    expect(getDialogStack()).toHaveLength(2);

    act(() => getDialogStack()[1].close());
    expect(closeConfirmation).toHaveBeenCalledWith(false);
    expect(closeParent).not.toHaveBeenCalled();
  });
});

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

// ── Global dialog stack: only the topmost dialog responds to back gesture ──
export interface DialogStackEntry {
  id: number;
  depth: number;
  close: () => void;
}

const dialogStack: DialogStackEntry[] = [];
let dialogCounter = 0;
let globalPopstateHandler: ((e: PopStateEvent) => void) | null = null;
export const DialogStackDepthContext = React.createContext(0);

export function registerDialogStackEntry(entry: DialogStackEntry) {
  if (dialogStack.some((item) => item.id === entry.id)) return;
  const nextDeeperIndex = dialogStack.findIndex((item) => item.depth > entry.depth);
  if (nextDeeperIndex === -1) dialogStack.push(entry);
  else dialogStack.splice(nextDeeperIndex, 0, entry);
}

function ensureGlobalPopstateHandler() {
  if (globalPopstateHandler) return;
  globalPopstateHandler = () => {
    // Only close the topmost dialog in the stack
    const top = dialogStack[dialogStack.length - 1];
    if (top) {
      top.close();
    }
  };
  window.addEventListener("popstate", globalPopstateHandler);
}

export function getDialogStack() {
  return dialogStack;
}

const Dialog = ({ open, onOpenChange, ...props }: DialogPrimitive.DialogProps) => {
  const parentStackDepth = React.useContext(DialogStackDepthContext);
  const stackDepth = parentStackDepth + 1;
  const dialogIdRef = React.useRef<number | null>(null);
  const stackEntryRef = React.useRef<DialogStackEntry | null>(null);
  const onOpenChangeRef = React.useRef(onOpenChange);
  const closedByPopstateRef = React.useRef(false);
  onOpenChangeRef.current = onOpenChange;

  React.useEffect(() => {
    if (!open) return undefined;

    ensureGlobalPopstateHandler();

    if (dialogIdRef.current === null || stackEntryRef.current === null) {
      const myId = ++dialogCounter;
      dialogIdRef.current = myId;
      stackEntryRef.current = {
        id: myId,
        depth: stackDepth,
        close: () => {
          closedByPopstateRef.current = true;
          onOpenChangeRef.current?.(false);
        },
      };
      window.history.pushState({ dialogId: myId }, "");
    }

    const entry = stackEntryRef.current;
    registerDialogStackEntry(entry);

    return () => {
      const idx = dialogStack.findIndex((item) => item.id === entry.id);
      if (idx !== -1) dialogStack.splice(idx, 1);
    };
  }, [open, stackDepth]);

  // Handle close NOT triggered by popstate (e.g. X button, overlay click)
  React.useEffect(() => {
    if (!open && dialogIdRef.current !== null) {
      const myId = dialogIdRef.current;
      dialogIdRef.current = null;
      stackEntryRef.current = null;

      // Remove from stack
      const idx = dialogStack.findIndex((e) => e.id === myId);
      if (idx !== -1) dialogStack.splice(idx, 1);

      if (!closedByPopstateRef.current) {
        if (window.history.state?.dialogId === myId) {
          if (dialogStack.length === 0) {
            // Tidak ada dialog lain tersisa → aman panggil back()
            window.history.back();
          } else {
            // Masih ada dialog lain terbuka (parent dialog).
            // Jangan panggil back() — itu akan memicu popstate dan
            // menutup parent. Cukup replace state ke parent dialog.
            const parentId = dialogStack[dialogStack.length - 1].id;
            window.history.replaceState({ dialogId: parentId }, "");
          }
        }
      }
      closedByPopstateRef.current = false;
    }
  }, [open]);

  return (
    <DialogStackDepthContext.Provider value={stackDepth}>
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} {...props} />
    </DialogStackDepthContext.Provider>
  );
};

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & { motionProfile?: "default" | "adaptive" }
>(({ className, style, motionProfile = "default", ...props }, ref) => {
  const stackDepth = React.useContext(DialogStackDepthContext);
  const stackOffset = Math.max(stackDepth - 1, 0) * 20;

  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-[10080] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        motionProfile === "adaptive" && "sipena-dialog-overlay-adaptive",
        className,
      )}
      style={{ zIndex: 10080 + stackOffset, ...style }}
      {...props}
    />
  );
});
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    motionProfile?: "default" | "adaptive";
    fullScreenMobile?: boolean;
  }
>(({ className, children, style, motionProfile = "default", fullScreenMobile = false, ...props }, ref) => {
  const stackDepth = React.useContext(DialogStackDepthContext);
  const stackOffset = Math.max(stackDepth - 1, 0) * 20;

  return (
    <DialogPortal>
      <DialogOverlay motionProfile={motionProfile} />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "sipena-scroll-isolated fixed left-[50%] top-[50%] z-[10090] grid translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto scrollbar-thin border border-border bg-background text-foreground shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          fullScreenMobile
            ? "w-screen h-[100dvh] max-h-[100dvh] max-w-none rounded-none border-0 p-0 lg:w-[calc(100vw-3rem)] lg:max-w-lg lg:max-h-[calc(100dvh-1.5rem)] lg:border lg:rounded-2xl"
            : "w-[calc(100vw-1.5rem)] max-w-lg max-h-[calc(100dvh-1.5rem)] rounded-2xl p-5 border sm:w-[calc(100vw-3rem)] sm:p-6",
          motionProfile === "adaptive" && "sipena-dialog-motion-adaptive",
          className,
        )}
        style={{ zIndex: 10090 + stackOffset, ...style }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Tutup dialog"
          className={cn(
            "sipena-danger-icon-button absolute z-50 inline-flex h-9 w-9 items-center justify-center rounded-full ring-offset-background transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none",
            fullScreenMobile
              ? "right-3 top-3 lg:right-3 lg:top-3 lg:h-8 lg:w-8"
              : "right-2 top-2 sm:right-3 sm:top-3 sm:h-8 sm:w-8"
          )}
        >
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Tutup</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

// PERBAIKAN: Tambah gap-2 untuk layout vertikal di mobile.
// sm:gap-0 me-reset gap agar sm:space-x-2 yang mengatur jarak horizontal di desktop.
const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2",
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};

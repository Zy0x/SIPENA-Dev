import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

// ── Global dialog stack: only the topmost dialog responds to back gesture ──
const dialogStack: Array<{ id: number; close: () => void }> = [];
let dialogCounter = 0;
let globalPopstateHandler: ((e: PopStateEvent) => void) | null = null;

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
  const dialogIdRef = React.useRef<number | null>(null);
  const closedByPopstateRef = React.useRef(false);

  React.useEffect(() => {
    if (open) {
      ensureGlobalPopstateHandler();
      
      const myId = ++dialogCounter;
      dialogIdRef.current = myId;
      window.history.pushState({ dialogId: myId }, "");

      const entry = {
        id: myId,
        close: () => {
          closedByPopstateRef.current = true;
          onOpenChange?.(false);
        },
      };
      dialogStack.push(entry);

      return () => {
        // Remove from stack on cleanup
        const idx = dialogStack.findIndex((e) => e.id === myId);
        if (idx !== -1) dialogStack.splice(idx, 1);
      };
    }
  }, [open, onOpenChange]);

  // Handle close NOT triggered by popstate (e.g. X button, overlay click)
  React.useEffect(() => {
    if (!open && dialogIdRef.current !== null) {
      const myId = dialogIdRef.current;
      dialogIdRef.current = null;

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

  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} {...props} />;
};

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-[calc(100vw-1.5rem)] max-w-lg max-h-[calc(100dvh-1.5rem)] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto border bg-background p-5 shadow-lg duration-200 rounded-2xl sm:w-[calc(100vw-3rem)] sm:p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
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

import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  DialogStackDepthContext,
  getDialogStack,
  registerDialogStackEntry,
  type DialogStackEntry,
} from "@/components/ui/dialog";

// Reuse the global dialog stack from dialog.tsx
let alertDialogCounter = 1000000; // offset to avoid ID collision

const AlertDialog = ({ open, onOpenChange, ...props }: AlertDialogPrimitive.AlertDialogProps) => {
  const parentStackDepth = React.useContext(DialogStackDepthContext);
  const stackDepth = parentStackDepth + 1;
  const dialogIdRef = React.useRef<number | null>(null);
  const stackEntryRef = React.useRef<DialogStackEntry | null>(null);
  const onOpenChangeRef = React.useRef(onOpenChange);
  const closedByPopstateRef = React.useRef(false);
  onOpenChangeRef.current = onOpenChange;

  React.useEffect(() => {
    if (!open) return undefined;

    const stack = getDialogStack();
    if (dialogIdRef.current === null || stackEntryRef.current === null) {
      const myId = ++alertDialogCounter;
      dialogIdRef.current = myId;
      window.history.pushState({ dialogId: myId }, "");
      stackEntryRef.current = {
        id: myId,
        depth: stackDepth,
        close: () => {
          closedByPopstateRef.current = true;
          onOpenChangeRef.current?.(false);
        },
      };
    }

    const entry = stackEntryRef.current;
    registerDialogStackEntry(entry);

    return () => {
      const idx = stack.findIndex((item) => item.id === entry.id);
      if (idx !== -1) stack.splice(idx, 1);
    };
  }, [open, stackDepth]);

  React.useEffect(() => {
    if (!open && dialogIdRef.current !== null) {
      const myId = dialogIdRef.current;
      dialogIdRef.current = null;
      stackEntryRef.current = null;

      const stack = getDialogStack();
      const idx = stack.findIndex((e) => e.id === myId);
      if (idx !== -1) stack.splice(idx, 1);

      if (!closedByPopstateRef.current) {
        if (window.history.state?.dialogId === myId) {
          if (stack.length === 0) {
            window.history.back();
          } else {
            const parentId = stack[stack.length - 1].id;
            window.history.replaceState({ dialogId: parentId }, "");
          }
        }
      }
      closedByPopstateRef.current = false;
    }
  }, [open]);

  return (
    <DialogStackDepthContext.Provider value={stackDepth}>
      <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange} {...props} />
    </DialogStackDepthContext.Provider>
  );
};

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-[10100] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "sipena-scroll-isolated fixed left-[50%] top-[50%] z-[10110] grid w-[calc(100vw-1.5rem)] max-w-lg max-h-[calc(100dvh-1.5rem)] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto scrollbar-thin border border-border bg-background text-foreground p-6 shadow-lg duration-200 rounded-2xl sm:w-full data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
        className,
      )}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

// PERBAIKAN: Tambah gap-2 untuk layout vertikal di mobile.
// sm:gap-0 me-reset gap agar sm:space-x-2 yang mengatur jarak horizontal di desktop.
const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2",
      className
    )}
    {...props}
  />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold", className)} {...props} />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className)}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};

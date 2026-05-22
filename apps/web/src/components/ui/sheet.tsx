import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"

// Bottom sheet built on Base UI Dialog. Used by the Profile page to host
// per-field editors (see ADR 0001 / Q2 — per-field bottom sheets back a
// single PATCH /api/profile endpoint).

function Sheet({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/40 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  style,
  ...props
}: DialogPrimitive.Popup.Props) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        // `max-h-[85svh]` caps the sheet so it can never exceed the visible
        // viewport. svh (small-viewport-height) is accurate on iOS even
        // when the URL bar is showing or the soft keyboard is open.
        //
        // `overflow-y-auto` scrolls long content INSIDE the sheet instead
        // of pushing the sheet past the screen edge — the original bug
        // that forced users to pinch-zoom-out to find the buttons.
        //
        // `overscroll-contain` keeps a flick at the top of the sheet from
        // chaining into the underlying page scroll.
        //
        // Bottom padding uses `max()` against `env(safe-area-inset-bottom)`
        // so the iPhone home-indicator never overlaps the sheet's bottom
        // buttons.
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85svh] max-w-md flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-2xl bg-popover px-5 pt-5 text-popover-foreground shadow-xl ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom",
          className,
        )}
        style={{
          paddingBottom:
            "max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))",
          ...style,
        }}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-heading text-lg font-semibold", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
}

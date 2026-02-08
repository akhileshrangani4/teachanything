"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { DashboardSidebar } from "./DashboardSidebar";
import { useSidebar } from "@/components/dashboard/sidebar-context";

export function MobileSidebarOverlay() {
  const { isOpen, setIsOpen } = useSidebar();

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50 lg:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-64 overflow-hidden lg:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left duration-300">
          <DialogPrimitive.Title className="sr-only">
            Navigation menu
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Main navigation sidebar for the dashboard
          </DialogPrimitive.Description>
          <DialogPrimitive.Close className="absolute right-2 top-2 z-10 rounded-md p-1.5 hover:bg-sidebar-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring">
            <X className="h-4 w-4 text-sidebar-foreground" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
          <DashboardSidebar onNavigate={() => setIsOpen(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

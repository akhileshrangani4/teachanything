"use client";

import { createContext, useContext } from "react";

interface SidebarContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

const fallbackSidebar: SidebarContextValue = {
  isOpen: false,
  setIsOpen: () => {},
};

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  return ctx ?? fallbackSidebar;
}

export function SidebarProvider({
  children,
  isOpen,
  setIsOpen,
}: {
  children: React.ReactNode;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) {
  return (
    <SidebarContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

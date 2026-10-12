"use client";

import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth-store";

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  useEffect(() => useAuth.subscribe((current, previous) => {
    if (current.version !== previous.version || current.usuario?.id !== previous.usuario?.id ||
        current.usuario?.clinica.id !== previous.usuario?.clinica.id) {
      // Não reaproveitar dados da clínica anterior no login seguinte.
      qc.clear();
    }
  }), [qc]);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryClientProvider client={qc}>
        <TooltipProvider delayDuration={300} skipDelayDuration={500}>
          {children}
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

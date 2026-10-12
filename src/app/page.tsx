"use client";

import { restaurarSessao, useAuth } from "@/lib/auth-store";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LoginScreen } from "@/components/auth/login-screen";
import { AppShell } from "@/components/app/app-shell";
import { ThemeApplier } from "@/components/app/theme-applier";

export default function Home() {
  const usuario = useAuth((s) => s.usuario);
  const status = useAuth((s) => s.status);
  useEffect(() => { void restaurarSessao(); }, []);

  return (
    <>
      <ThemeApplier />
      <main className="min-h-screen flex flex-col bg-[var(--bg-app)] text-[var(--text-app)]">
        {status === "loading" ? <p className="m-auto p-6" role="status">Conferindo seu acesso...</p> :
          status === "error" ? <div className="m-auto p-6 text-center"><p>Não foi possível conferir seu acesso.</p><Button className="mt-4" onClick={() => void restaurarSessao()}>Tentar novamente</Button></div> :
          usuario ? <AppShell /> : <LoginScreen />}
      </main>
    </>
  );
}

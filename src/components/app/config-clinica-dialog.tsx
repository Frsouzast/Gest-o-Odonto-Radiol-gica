"use client";

import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/auth-store";
import { dataBR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Settings, Loader2, Building2, Save } from "lucide-react";

interface ClinicaData {
  id: string;
  nome: string;
  cnpj: string | null;
  criadoEm: string;
}

interface ConfigClinicaDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onClinicaAtualizada?: (nomeAtualizado: string) => void;
}

// Máscara CNPJ: 00.000.000/0000-00
function mascararCNPJ(v: string) {
  const digitos = v.replace(/\D/g, "").slice(0, 14);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 5) return `${digitos.slice(0, 2)}.${digitos.slice(2)}`;
  if (digitos.length <= 8)
    return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5)}`;
  if (digitos.length <= 12)
    return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8)}`;
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`;
}

export function ConfigClinicaDialog({
  open,
  onOpenChange,
  onClinicaAtualizada,
}: ConfigClinicaDialogProps) {
  const qc = useQueryClient();
  const nomeRef = useRef<HTMLInputElement>(null);
  const cnpjRef = useRef<HTMLInputElement>(null);

  const clinicaQ = useQuery<ClinicaData>({
    queryKey: ["clinica"],
    queryFn: () => apiFetch(`/api/clinica`),
    enabled: open,
  });

  const salvarMut = useMutation({
    mutationFn: () =>
      apiFetch<ClinicaData>(`/api/clinica`, {
        method: "PUT",
        body: JSON.stringify({
          nome: (nomeRef.current?.value ?? "").trim(),
          cnpj: (cnpjRef.current?.value ?? "").trim() || null,
        }),
      }),
    onSuccess: (data) => {
      toast.success("Dados da clínica atualizados");
      qc.invalidateQueries({ queryKey: ["clinica"] });
      onClinicaAtualizada?.(data.nome);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-app)] border-[var(--border-app)] text-[var(--text-app)] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings size={18} className="text-[var(--accent-app-text)]" />
            Configurações da clínica
          </DialogTitle>
          <DialogDescription className="text-[var(--text-app-muted)]">
            Edite o nome e o CNPJ usados em documentos e relatórios.
          </DialogDescription>
        </DialogHeader>

        {clinicaQ.isLoading ? (
          <div className="py-8 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-[var(--text-app-faint)]" />
          </div>
        ) : clinicaQ.isError ? (
          <p className="text-sm text-[var(--danger-app)] py-4 text-center">
            {clinicaQ.error instanceof Error
              ? clinicaQ.error.message
              : "Erro ao carregar dados"}
          </p>
        ) : clinicaQ.data ? (
          <div className="space-y-3">
            {/* Preview card */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-app-alt-strong)] border border-[var(--border-app)]">
              <div className="w-10 h-10 rounded-lg bg-[var(--brand-navy)] text-white grid place-items-center shrink-0">
                <Building2 size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--text-app)] truncate">
                  {clinicaQ.data.nome}
                </div>
                <div className="text-[11px] text-[var(--text-app-muted)]">
                  Desde {dataBR(clinicaQ.data.criadoEm.slice(0, 10))}
                </div>
              </div>
            </div>

            {/* Form remounted on clinicaQ.data?.id so uncontrolled inputs pick up fresh defaults */}
            <FormularioClinica
              key={clinicaQ.data.id}
              nomeInicial={clinicaQ.data.nome}
              cnpjInicial={clinicaQ.data.cnpj ?? ""}
              nomeRef={nomeRef}
              cnpjRef={cnpjRef}
            />
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-[var(--text-app-muted)] hover:bg-[var(--bg-app-alt-strong)]"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => salvarMut.mutate()}
            disabled={!clinicaQ.data || salvarMut.isPending}
            className="bg-[var(--accent-app)] hover:bg-[var(--accent-app-hover)] text-white"
          >
            {salvarMut.isPending ? (
              <Loader2 className="size-4 animate-spin mr-1.5" />
            ) : (
              <Save size={14} className="mr-1.5" />
            )}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Sub-component remounted on `key` so uncontrolled inputs get fresh `defaultValue`
function FormularioClinica({
  nomeInicial,
  cnpjInicial,
  nomeRef,
  cnpjRef,
}: {
  nomeInicial: string;
  cnpjInicial: string;
  nomeRef: React.RefObject<HTMLInputElement | null>;
  cnpjRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs text-[var(--text-app-secondary)]">
          Nome da clínica
        </Label>
        <Input
          ref={nomeRef}
          defaultValue={nomeInicial}
          placeholder="Ex.: Clínica Sorriso LTDA"
          className="bg-[var(--bg-app)] border-[var(--border-app)]"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-[var(--text-app-secondary)]">
          CNPJ
        </Label>
        <Input
          ref={cnpjRef}
          defaultValue={mascararCNPJ(cnpjInicial)}
          onChange={(e) => {
            const mascarado = mascararCNPJ(e.target.value);
            e.target.value = mascarado;
          }}
          placeholder="00.000.000/0000-00"
          className="bg-[var(--bg-app)] border-[var(--border-app)] font-mono"
        />
        <p className="text-[10px] text-[var(--text-app-faint)]">
          Opcional — usado em exportações e relatórios impressos.
        </p>
      </div>
    </>
  );
}

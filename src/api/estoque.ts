import { api } from "./client";

export interface EntradaPayload {
  produtoId: number;
  quantidade: number;
  codigoLote?: string;
  validade?: string;
  custoUnitario?: number;
  observacao?: string;
}

export interface AjustePayload {
  produtoId: number;
  loteId: number;
  quantidadeNova: number;
  motivo: string;
}

export interface BloqueioPayload {
  loteId: number;
  status: "QUARENTENA" | "BLOQUEADO";
  motivo: string;
}

export interface TransferenciaPayload {
  loteId: number;
  localizacaoOrigemId: number;
  localizacaoDestinoId: number;
  quantidade: number;
  motivo: string;
}

export const EstoqueAPI = {
  async entrada(payload: EntradaPayload): Promise<void> {
    await api.post("/api/estoque/lote/entrada", payload);
  },

  async ajuste(payload: AjustePayload): Promise<void> {
    await api.post("/api/estoque/ajuste", payload);
  },

  async bloquear(payload: BloqueioPayload): Promise<void> {
    await api.post("/api/estoque/lote/bloquear", payload);
  },

  async transferir(payload: TransferenciaPayload): Promise<void> {
    await api.post("/api/estoque/transferencia", payload);
  },
};

import { api } from "./client";

export interface AlertaLote {
  loteId: number;
  numeroLote: string;
  validade: string;
  produto: string;
  codigo: string;
  quantidade: number;
  localizacao: string;
}

export interface AlertaEstoqueMinimo {
  id: number;
  descricao: string;
  codigoInterno: string;
  estoqueMinimo: number;
  estoqueAtual: number;
  diferenca: number;
  categoria: string;
}

export interface AlertasResponse {
  vencendo: AlertaLote[];
  vencidos: AlertaLote[];
  abaixoMinimo: AlertaEstoqueMinimo[];
  valorEmRisco: number;
  totais: {
    vencendo: number;
    vencidos: number;
    abaixoMinimo: number;
  };
}

export const AlertasAPI = {
  async buscar(dias: 30 | 60 | 90 = 30): Promise<AlertasResponse> {
    const response = await api.get<AlertasResponse>("/api/estoque/alertas", {
      params: { dias },
    });
    return response.data;
  },
};

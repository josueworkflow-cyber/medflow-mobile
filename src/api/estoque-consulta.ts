import { api } from "./client";

export interface ProdutoResumo {
  id: number;
  codigoInterno: string | null;
  descricao: string;
  categoria: string | null;
  qtdDisponivel: number;
  qtdReservada: number;
  qtdTotal: number;
  estoqueMinimo: number;
  percentual: number;
  status: "OK" | "CRITICO" | "ESGOTADO";
}

export interface KpisEstoque {
  totalSKUs: number;
  totalItens: number;
  criticos: number;
  esgotados: number;
}

export interface ProdutosResumoResponse {
  produtos: ProdutoResumo[];
  kpis: KpisEstoque;
}

export interface Movimentacao {
  id: number;
  tipo: string;
  quantidade: number;
  usuario: string;
  observacao: string | null;
  createdAt: string;
  estornado: boolean;
  isEstorno: boolean;
  produto: { descricao: string; codigoInterno: string | null };
  lote: { numeroLote: string; validade: string | null } | null;
  localizacao: { nome: string } | null;
  usuarioRef: { nome: string } | null;
}

export interface TotaisMovimentacoes {
  entradasMes: number;
  saidasMes: number;
  reservasMes: number;
  ajustesMes: number;
  movDia: number;
}

export interface MovimentacoesResponse {
  movimentacoes: Movimentacao[];
  totais: TotaisMovimentacoes;
}

export interface LoteResumo {
  id: number;
  produtoId: number;
  numeroLote: string;
  validade: string | null;
  status: "DISPONIVEL" | "QUARENTENA" | "BLOQUEADO" | "VENCIDO";
  produto: {
    id: number;
    descricao: string;
    registroAnvisa: string | null;
    fabricante: string | null;
  };
  estoqueAtual: {
    quantidadeDisponivel: number;
    quantidadeReservada: number;
    quantidadeBloqueada: number;
  }[];
}

// ── Pedidos / Funil Operacional ──────────────────────────────

export interface PedidoItem {
  id: number;
  quantidade: number;
  precoVenda: number;
  subtotal: number;
  produto: {
    descricao: string;
    codigoInterno: string | null;
  };
}

export interface PedidoEstoque {
  id: number;
  numero: string;
  status: string;
  tipoPedido: string;
  valorTotal: number;
  createdAt: string;
  cliente: { razaoSocial: string };
  vendedor: { nome: string } | null;
  empresaFiscal: { nomeFantasia: string | null; razaoSocial: string } | null;
  itens: PedidoItem[];
  separacao: { status: string } | null;
}

export interface PedidosResponse {
  pedidos: PedidoEstoque[];
  filtro: string;
}

export type FiltroFunil = "separacao" | "despacho";

export const EstoqueConsultaAPI = {
  async getProdutosResumo(): Promise<ProdutosResumoResponse> {
    const response = await api.get<ProdutosResumoResponse>("/api/estoque/produtos-resumo");
    return response.data;
  },

  async getMovimentacoes(params?: {
    tipo?: string;
    produto?: string;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<MovimentacoesResponse> {
    const response = await api.get<MovimentacoesResponse>("/api/estoque/movimentacoes", { params });
    return response.data;
  },

  async getLotes(params?: {
    search?: string;
    status?: string;
  }): Promise<LoteResumo[]> {
    const response = await api.get<LoteResumo[]>("/api/estoque/lotes", { params });
    return response.data;
  },

  getPedidosFunil: async (filtro: "separacao" | "despacho"): Promise<PedidosResponse> => {
    const response = await api.get<PedidosResponse>("/api/estoque/pedidos", {
      params: { filtro },
    });
    return response.data;
  },

  transicionarPedido: async (
    pedidoId: number,
    acao: "iniciar_separacao" | "finalizar_separacao" | "despachar"
  ): Promise<void> => {
    await api.post(`/api/vendas/${pedidoId}/transicao`, { acao });
  },
};

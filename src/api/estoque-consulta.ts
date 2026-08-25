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
  saldoAnterior: number | null;
  saldoResultante: number | null;
  motivoCodigo: string | null;
  origem: string | null;
  destino: string | null;
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

// ── Pedidos operacionais do estoque ─────────────────────────

export interface PedidoItem {
  id: number;
  quantidade: number;
  precoVenda: number;
  subtotal: number;
  produto: {
    id: number;
    descricao: string;
    codigoInterno: string | null;
    codigoBarras: string | null;
    unidadeVenda: string | null;
  };
}

export interface DisponibilidadeEstoqueItem {
  produto: PedidoItem["produto"];
  quantidadeSolicitada: number;
  quantidadeDisponivel: number;
  quantidadeAtendida: number;
  quantidadeFaltante: number;
  status: "DISPONIVEL" | "PARCIAL" | "INDISPONIVEL";
}

export type StatusPedido =
  | "APROVADO"
  | "EM_SEPARACAO"
  | "AGUARDANDO_COMPRA"
  | "ENTRADA_MERCADORIA"
  | "FATURAMENTO"
  | "AGUARDANDO_FINANCEIRO"
  | "EXPEDICAO"
  | "EM_ROTA"
  | "FINALIZADO"
  | "CANCELADO";

export type MotivoStatusPedido =
  | "AGUARDANDO_ESTOQUE_ASSUMIR"
  | "CONFERINDO_ITENS"
  | "FALTA_PRODUTO"
  | "AGUARDANDO_ENTRADA"
  | "AGUARDANDO_FATURAMENTO"
  | "FATURADO"
  | "AGUARDANDO_BOLETO_BAIXA"
  | "AGUARDANDO_EXPEDICAO"
  | "EM_ROTA"
  | "ENTREGA_CONCLUIDA"
  | "CANCELADO_PELO_CLIENTE"
  | "CANCELADO_INTERNAMENTE";

export type StatusPendenciaEstoque =
  | "AGUARDANDO_VALIDACAO"
  | "AGUARDANDO_DECISAO_COMERCIAL"
  | "AGUARDANDO_COMPRA"
  | "AGUARDANDO_MERCADORIA"
  | "AGUARDANDO_ENTRADA"
  | "RESOLVIDA"
  | "CANCELADA";

export interface PendenciaEstoquePedido {
  id: number;
  quantidadeSolicitada: number;
  quantidadeDisponivel: number;
  quantidadePendente: number;
  status: StatusPendenciaEstoque;
  previsaoEntrega: string | null;
  observacao: string | null;
  resolucao: string | null;
  resolvidoEm: string | null;
  produto: {
    id: number;
    descricao: string;
    codigoInterno: string | null;
    unidadeVenda: string | null;
  };
}

export interface PedidoEstoque {
  id: number;
  numero: string;
  status: StatusPedido;
  motivoStatus: MotivoStatusPedido | null;
  detalheStatus: string | null;
  statusAtualizadoEm: string;
  tipoPedido: string;
  valorTotal: number;
  createdAt: string;
  cliente: {
    razaoSocial: string;
    nomeFantasia?: string | null;
    cnpjCpf?: string | null;
    cidade?: string | null;
    estado?: string | null;
    telefone?: string | null;
  };
  vendedor: { nome: string } | null;
  empresaFiscal: { nomeFantasia: string | null; razaoSocial: string } | null;
  itens: PedidoItem[];
  disponibilidadeEstoque: DisponibilidadeEstoqueItem[];
  pendenciasEstoque: PendenciaEstoquePedido[];
  separacao: { status: string } | null;
  motivoStatusLabel?: string | null;
}

export interface EtapaFunilResumo {
  id: string;
  label: string;
  contexto: string;
  color: string;
  responsavel: string;
  ordem: number | null;
}

export interface PedidosResponse {
  pedidos: PedidoEstoque[];
  filtro: string;
}

export type FiltroFunil =
  | "verificacao"
  | "acompanhamento"
  | "separacao"
  | "despacho"
  | "finalizados"
  | "todos";

export type AcaoTransicaoEstoque =
  | "reverificar_estoque"
  | "confirmar_falta_estoque"
  | "iniciar_separacao"
  | "finalizar_separacao"
  | "despachar"
  | "finalizar";

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
    usuario?: string;
    localizacao?: string;
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

  getPedidosFunil: async (filtro: FiltroFunil): Promise<PedidosResponse> => {
    const response = await api.get<PedidosResponse>("/api/estoque/pedidos", {
      params: { filtro },
    });
    return response.data;
  },

  transicionarPedido: async (
    pedidoId: number,
    acao: AcaoTransicaoEstoque,
    observacao?: string
  ): Promise<void> => {
    await api.post(`/api/vendas/${pedidoId}/transicao`, {
      acao,
      ...(observacao ? { dados: { observacao } } : {}),
    });
  },

  async getGiro(): Promise<any> {
    const response = await api.get("/api/estoque/giro");
    return response.data;
  },

  async getValidadeRelatorio(): Promise<any> {
    const response = await api.get("/api/relatorios/validade");
    return response.data;
  },

  async getPosicaoRelatorio(): Promise<any> {
    const response = await api.get("/api/relatorios/posicao-estoque");
    return response.data;
  },

  async getAlertas(): Promise<any> {
    const response = await api.get("/api/estoque/alertas");
    return response.data;
  },
};


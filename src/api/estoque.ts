import { api } from "./client";

export interface EntradaPayload {
  produtoId: number;
  quantidade: number;
  codigoLote?: string;
  validade?: string;
  custoUnitario?: number;
  observacao?: string;
  fornecedorId?: number;
  localizacaoId?: number;
}

export interface AjustePayload {
  produtoId: number;
  estoqueAtualId: number;
  loteId?: number | null;
  localizacaoId?: number | null;
  quantidadeNova: number;
  motivoCodigo: "PERDA" | "AVARIA" | "ERRO_CONTAGEM" | "INVENTARIO" | "VALIDADE" | "OUTRO";
  motivo: string;
  confirmarAjusteRelevante?: boolean;
}

export interface BloqueioPayload {
  loteId: number;
  status: "DISPONIVEL" | "QUARENTENA" | "BLOQUEADO";
  motivo: string;
  previsaoResolucao?: string;
}

export interface TransferenciaPayload {
  produtoId: number;
  loteId?: number | null;
  localizacaoOrigemId: number;
  localizacaoDestinoId: number;
  quantidade: number;
  motivo: string;
}

export interface InventarioItem {
  id: number;
  quantidadeEsperada: number;
  quantidadeContada: number | null;
  divergencia: number | null;
  produto: { descricao: string; codigoInterno: string | null; codigoBarras: string | null };
  lote: { numeroLote: string; status: string; validade: string | null } | null;
  localizacao: { nome: string } | null;
}

export interface Inventario {
  id: number;
  status: "ABERTO" | "APLICADO" | "CANCELADO";
  escopo: "PRODUTO" | "LOCALIZACAO";
  itens: InventarioItem[];
}

export const EstoqueAPI = {
  async entrada(payload: EntradaPayload): Promise<void> {
    await api.post("/api/estoque/lote/entrada", payload);
  },

  async ajuste(payload: AjustePayload) {
    const response = await api.post("/api/estoque/ajuste", payload);
    return response.data;
  },

  async bloquear(payload: BloqueioPayload): Promise<void> {
    await api.post("/api/estoque/lote/bloquear", payload);
  },

  async transferir(payload: TransferenciaPayload): Promise<void> {
    await api.post("/api/estoque/transferencia", payload);
  },

  async localizacoes(): Promise<{ id: number; nome: string }[]> {
    const response = await api.get("/api/estoque/localizacoes");
    return response.data;
  },

  async fornecedores(): Promise<{ id: number; razaoSocial: string }[]> {
    const response = await api.get("/api/fornecedores");
    return response.data;
  },

  async listarInventarios(): Promise<{
    id: number;
    status: "ABERTO" | "APLICADO" | "CANCELADO";
    escopo: "PRODUTO" | "LOCALIZACAO";
    motivo: string;
    iniciadoEm: string;
    aplicadoEm: string | null;
    criadoPor?: { nome: string } | null;
    aplicadoPor?: { nome: string } | null;
    produto?: { descricao: string; codigoInterno: string | null } | null;
    localizacao?: { nome: string } | null;
    _count?: { itens: number };
    totalItens?: number;
    itensDivergentes?: number;
  }[]> {
    const response = await api.get("/api/estoque/inventarios");
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.inventarios)) return data.inventarios;
    return [];
  },

  async iniciarInventario(payload: { produtoId?: number; localizacaoId?: number }): Promise<{ id: number }> {
    const response = await api.post("/api/estoque/inventarios", payload);
    return response.data;
  },

  async inventario(id: number): Promise<Inventario> {
    const response = await api.get(`/api/estoque/inventarios/${id}`);
    return response.data;
  },

  async salvarContagens(id: number, contagens: { itemId: number; quantidadeContada: number }[]): Promise<void> {
    await api.patch(`/api/estoque/inventarios/${id}`, { contagens });
  },

  async aplicarInventario(id: number): Promise<{ ajustes: number }> {
    const response = await api.post(`/api/estoque/inventarios/${id}/aplicar`);
    return response.data;
  },

  async obterVisaoGeral(): Promise<VisaoGeralEstoqueResponse> {
    const response = await api.get("/api/estoque/produtos-resumo");
    return response.data;
  },
};

export interface LoteItemResumo {
  id: number;
  loteId: number | null;
  numeroLote: string;
  validade: string | null;
  isVencido: boolean;
  isVencendo30d: boolean;
  endereco: string;
  localizacaoNome: string;
  qtdDisponivel: number;
  qtdReservada: number;
  qtdBloqueada: number;
  statusEstoque: string;
  custoUnitario: number;
}

export interface ProdutoResumoEstoque {
  id: number;
  codigoInterno: string;
  codigoBarras: string | null;
  descricao: string;
  categoria: string;
  fabricante: string;
  unidadeVenda: string;
  precoCustoBase: number;
  precoVendaBase: number;
  registroAnvisa: string | null;
  temperaturaArmazenamento: string | null;
  localizacaoEstoque: string | null;
  qtdDisponivel: number;
  qtdReservada: number;
  qtdIndisponivel: number;
  qtdTotal: number;
  estoqueMinimo: number;
  hasEstoqueMinimo: boolean;
  percentual: number;
  status: "OK" | "CRITICO" | "ESGOTADO";
  valorTotal: number;
  lotesVencendoCount: number;
  lotes: LoteItemResumo[];
}

export interface KpisVisaoGeralEstoque {
  totalSKUs: number;
  skusComEstoque: number;
  totalItens: number;
  totalDisponivel: number;
  totalReservado: number;
  totalIndisponivel: number;
  criticos: number;
  esgotados: number;
  ok: number;
  lotesVencendo30d: number;
  valorTotalEstoque: number;
  categorias: string[];
}

export interface VisaoGeralEstoqueResponse {
  produtos: ProdutoResumoEstoque[];
  kpis: KpisVisaoGeralEstoque;
}



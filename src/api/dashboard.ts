import { api } from "./client";

export interface TopProduto {
  produtoId: number;
  descricao: string;
  qtdVendida: number;
  valorTotal: number;
}

export interface VendaCliente {
  clienteId: number;
  razaoSocial: string;
  totalVendas: number;
  qtdPedidos: number;
}

export interface DashboardData {
  skusAtivos: number;
  itensEstoque: number;
  valorEstoque: number;
  proximosVencer: number;
  vencidos: number;
  faturamentoMes?: number;
  qtdVendasMes?: number;
  pedidosAbertos?: number;
  aguardandoEstoque?: number;
  aguardandoComercial?: number;
  aguardandoFinanceiro?: number;
  emSeparacao?: number;
  margemMedia?: number;
  topProdutos?: TopProduto[];
  vendasPorCliente?: VendaCliente[];
}

export interface EmpresaOption {
  id: string;
  label: string;
}

export interface LancamentoSemana {
  id: number;
  pedido: string;
  cliente: string;
  valor: number;
  data: string;
}

export interface WeekItem {
  id: string;
  name: string;
  label: string;
  range: string;
  entradas: number;
  saidas: number;
  lancamentos?: LancamentoSemana[];
}

export interface DespesaCategoria {
  nome: string;
  valor: number;
}

export interface TransportadorItem {
  nome: string;
  valor: number;
  count: number;
}

export interface MesAnualItem {
  mes: string;
  nome: string;
  valor: number;
}

export interface FinancialDashboardData {
  ano: number;
  mes: number;
  empresaFiscalId: string;
  empresas: EmpresaOption[];
  mesesDisponiveis: { key: string; label: string; short: string }[];
  entradasSemanais: {
    semanaDestaque: { nome: string; periodo: string; valor: number };
    weeks: WeekItem[];
  };
  despesasVariaveis: DespesaCategoria[];
  transporteTerceirizado: {
    totalMes: number;
    lancamentosMes: number;
    acumuladoAno: number;
    transportadores: TransportadorItem[];
  };
  desempenhoFinanceiro: WeekItem[];
  acompanhamentoAnual: {
    ano: number;
    totalAnual: number;
    tetoMeta: number;
    percentualAtingido: number;
    mesAtivo: string;
    meses: MesAnualItem[];
  };
}

export interface EstoqueResumoData {
  fisicoTotal: number;
  reservados: number;
  vencendo: number;
  semAlocacaoFiscal: number;
  faturadoNoMes: number;
}

export const DashboardAPI = {
  async obterDados(): Promise<DashboardData> {
    try {
      const response = await api.get<DashboardData>("/api/dashboard");
      return response.data;
    } catch (err) {
      // Se der erro de rede/permissão, tenta buscar o resumo focado do estoque
      const fallback = await this.obterResumoEstoque();
      return {
        skusAtivos: 0,
        itensEstoque: fallback.fisicoTotal,
        valorEstoque: 0,
        proximosVencer: fallback.vencendo,
        vencidos: 0,
        faturamentoMes: fallback.faturadoNoMes,
        qtdVendasMes: 0,
        pedidosAbertos: 0,
        aguardandoEstoque: 0,
        aguardandoComercial: 0,
        aguardandoFinanceiro: 0,
        emSeparacao: 0,
        margemMedia: 0,
        topProdutos: [],
        vendasPorCliente: [],
      };
    }
  },

  async obterGraficosFinanceiros(params?: {
    ano?: number;
    mes?: string;
    empresaFiscalId?: string;
    origem?: string;
  }): Promise<FinancialDashboardData> {
    const response = await api.get<FinancialDashboardData>(
      "/api/dashboard/graficos-financeiros",
      { params }
    );
    return response.data;
  },

  async obterResumoEstoque(): Promise<EstoqueResumoData> {
    const response = await api.get<EstoqueResumoData>("/api/estoque/resumo");
    return response.data;
  },
};

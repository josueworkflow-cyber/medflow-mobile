import { api } from "./client";

export interface TopProduto {
  produtoId: number;
  descricao: string;
  qtdVendida: number;
  valorTotal: number;
}

export interface DashboardData {
  skusAtivos: number;
  itensEstoque: number;
  valorEstoque: number;
  proximosVencer: number;
  vencidos: number;
  pedidosAbertos?: number;
  aguardandoEstoque?: number;
  autorizadosSeparacao?: number;
  margemMedia?: number;
  faturamentoMes?: number;
  qtdVendasMes?: number;
  topProdutos?: TopProduto[];
  vendasPorCliente?: {
    clienteId: number;
    razaoSocial: string;
    totalVendas: number;
    qtdPedidos: number;
  }[];
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
      // Se der erro de permissão ou outro, tenta buscar o resumo focado do estoque
      const fallback = await this.obterResumoEstoque();
      return {
        skusAtivos: 0, // Fallback
        itensEstoque: fallback.fisicoTotal,
        valorEstoque: 0,
        proximosVencer: fallback.vencendo,
        vencidos: 0,
        faturamentoMes: fallback.faturadoNoMes,
      };
    }
  },

  async obterResumoEstoque(): Promise<EstoqueResumoData> {
    const response = await api.get<EstoqueResumoData>("/api/estoque/resumo");
    return response.data;
  },
};

export interface Lote {
  id: number;
  codigo: string;
  dataValidade: string | null;
  status: string;
  estoqueAtual: {
    quantidadeDisponivel: number;
    localizacao: {
      nome: string;
    } | null;
  }[];
}

export interface Produto {
  id: number;
  nome: string;
  codigoBarras: string | null;
  codigoInterno: string | null;
  unidade: string;
  lotes?: Lote[];
}

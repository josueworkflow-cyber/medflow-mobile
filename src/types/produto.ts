export type StatusLote = "DISPONIVEL" | "QUARENTENA" | "BLOQUEADO" | "VENCIDO";

export interface SaldoLote {
  id: number;
  quantidadeDisponivel: number;
  quantidadeReservada: number;
  quantidadeBloqueada: number;
  status: StatusLote;
  localizacao: {
    id: number;
    nome: string;
  } | null;
}

export interface Lote {
  id: number;
  numeroLote: string;
  validade: string | null;
  status: StatusLote;
  estoqueAtual: SaldoLote[];
}

export interface Produto {
  id: number;
  nome: string;
  codigoBarras: string | null;
  codigoInterno: string | null;
  unidade: string;
  categoria?: { id?: number; nome?: string } | string | null;
  estoqueMinimo?: number | null;
  estoqueMaximo?: number | null;
  pontoReposicao?: number | null;
  localizacaoEstoque?: string | null;
  precoCustoBase?: number | null;
  precoVendaBase?: number | null;

  fabricante?: string | null;
  cnpjFabricante?: string | null;
  codigoFabricante?: string | null;
  marca?: string | null;
  unidadeCompra?: string | null;
  fatorConversao?: number | null;

  registroAnvisa?: string | null;
  temperaturaArmazenamento?: string | null;
  principioAtivo?: string | null;
  concentracaoValor?: number | null;
  concentracaoUnidade?: string | null;
  conteudoEmbalagem?: number | null;
  apresentacao?: string | null;
  classeRisco?: string | null;
  tamanho?: string | null;
  observacoes?: string | null;

  imagemUrl?: string | null;
  controlaLote?: boolean;
  controlaValidade?: boolean;
  estoqueAtual?: SaldoLote[];
  lotes?: Lote[];
}

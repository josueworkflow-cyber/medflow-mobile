import { Produto, Lote, SaldoLote } from "./produto";

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  VisaoGeral: undefined;
  Movimentacoes: undefined;
  Scanner: { action?: keyof RootStackParamList } | undefined;
  ProdutoDetalhe: { produto: Produto; action?: keyof RootStackParamList; loteSugerido?: string; validadeSugerida?: string };
  EntradaEstoque: { produto?: Produto; loteSugerido?: string; validadeSugerida?: string } | undefined;
  AjusteInventario: { produto?: Produto; lote?: Lote; saldo?: SaldoLote; loteSugerido?: string; validadeSugerida?: string } | undefined;
  BloqueioLote: { produto?: Produto; lote?: Lote; loteSugerido?: string; validadeSugerida?: string } | undefined;
  Transferencia: { produto?: Produto; lote?: Lote; saldo?: SaldoLote; loteSugerido?: string; validadeSugerida?: string } | undefined;
  CadastroProduto: { codigoBarrasSugerido?: string } | undefined;
  Alertas: { tabInicial?: "validade" | "minimo" | "esgotado" } | undefined;
  AuditoriaEstoque: undefined;
  RelatoriosEstoque: undefined;
  Lotes: undefined;
  Inventario: undefined;
  Configuracoes: undefined;
};

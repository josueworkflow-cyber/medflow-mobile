import { Produto, Lote } from "./produto";

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Scanner: { action?: keyof RootStackParamList } | undefined;
  ProdutoDetalhe: { produto: Produto; action?: keyof RootStackParamList; loteSugerido?: string; validadeSugerida?: string };
  EntradaEstoque: { produto: Produto; loteSugerido?: string; validadeSugerida?: string };
  AjusteInventario: { produto: Produto; lote: Lote; loteSugerido?: string; validadeSugerida?: string };
  BloqueioLote: { produto: Produto; lote: Lote; loteSugerido?: string; validadeSugerida?: string };
  Transferencia: { produto: Produto; lote: Lote; loteSugerido?: string; validadeSugerida?: string };
  CadastroProduto: undefined;
  Alertas: undefined;
  Configuracoes: undefined;
  Movimentacoes: undefined;
  Lotes: undefined;
};

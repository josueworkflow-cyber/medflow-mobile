import { api } from "./client";
import { Lote, Produto, SaldoLote, StatusLote } from "../types/produto";

const STATUS_LOTE: readonly StatusLote[] = [
  "DISPONIVEL",
  "QUARENTENA",
  "BLOQUEADO",
  "VENCIDO",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const nullableString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const isStatusLote = (value: unknown): value is StatusLote =>
  typeof value === "string" && STATUS_LOTE.includes(value as StatusLote);

const mapSaldoLote = (value: unknown): SaldoLote | null => {
  if (!isRecord(value)) return null;

  const quantidadeDisponivel = Number(value.quantidadeDisponivel);
  const id = Number(value.id);
  if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(quantidadeDisponivel)) return null;

  const quantidadeReservada = Number(value.quantidadeReservada) || 0;
  const quantidadeBloqueada = Number(value.quantidadeBloqueada) || 0;
  const status = isStatusLote(value.status) ? value.status : "DISPONIVEL";

  const localizacaoId = isRecord(value.localizacao) ? Number(value.localizacao.id) : NaN;
  const localizacao = isRecord(value.localizacao) && typeof value.localizacao.nome === "string" && Number.isInteger(localizacaoId)
    ? { id: localizacaoId, nome: value.localizacao.nome }
    : null;

  return { id, quantidadeDisponivel, quantidadeReservada, quantidadeBloqueada, status, localizacao };
};

/**
 * A listagem de produtos traz apenas uma prévia do lote (sem id, status e
 * saldos). Somente lotes completos, como os retornados por /api/produto/:id,
 * podem alimentar as ações operacionais do aplicativo.
 */
const mapLoteDetalhado = (value: unknown): Lote | null => {
  if (!isRecord(value)) return null;

  const id = Number(value.id);
  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    typeof value.numeroLote !== "string" ||
    !isStatusLote(value.status)
  ) {
    return null;
  }

  const estoqueAtual = Array.isArray(value.estoqueAtual)
    ? value.estoqueAtual
        .map(mapSaldoLote)
        .filter((saldo): saldo is SaldoLote => saldo !== null)
    : [];

  return {
    id,
    numeroLote: value.numeroLote,
    validade: nullableString(value.validade),
    status: value.status,
    estoqueAtual,
  };
};

const mapProduto = (value: unknown): Produto => {
  if (!isRecord(value)) {
    throw new Error("Resposta inválida ao carregar produto.");
  }

  const id = Number(value.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Produto retornado sem identificador válido.");
  }

  const lotes = Array.isArray(value.lotes)
    ? value.lotes
        .map(mapLoteDetalhado)
        .filter((lote): lote is Lote => lote !== null)
    : undefined;
  const estoqueAtual = Array.isArray(value.estoqueAtual)
    ? value.estoqueAtual.map(mapSaldoLote).filter((saldo): saldo is SaldoLote => saldo !== null)
    : undefined;

  return {
    id,
    nome:
      (typeof value.descricao === "string" && value.descricao) ||
      (typeof value.nome === "string" && value.nome) ||
      "",
    codigoBarras: nullableString(value.codigoBarras),
    codigoInterno: nullableString(value.codigoInterno),
    imagemUrl: nullableString(value.imagemUrl),
    controlaLote: value.controlaLote === true,
    controlaValidade: value.controlaValidade === true,
    unidade:
      (typeof value.unidadeVenda === "string" && value.unidadeVenda) ||
      (typeof value.unidade === "string" && value.unidade) ||
      "UN",
    categoria: (isRecord(value.categoriaRef) ? (value.categoriaRef as any).nome : value.categoria) as any,
    estoqueMinimo: typeof value.estoqueMinimo === "number" ? value.estoqueMinimo : null,
    estoqueMaximo: typeof value.estoqueMaximo === "number" ? value.estoqueMaximo : null,
    pontoReposicao: typeof value.pontoReposicao === "number" ? value.pontoReposicao : null,
    localizacaoEstoque: nullableString(value.localizacaoEstoque),
    precoCustoBase: typeof value.precoCustoBase === "number" ? value.precoCustoBase : null,
    precoVendaBase: typeof value.precoVendaBase === "number" ? value.precoVendaBase : null,

    fabricante: nullableString(value.fabricante),
    cnpjFabricante: nullableString(value.cnpjFabricante),
    codigoFabricante: nullableString(value.codigoFabricante),
    marca: nullableString(value.marca),
    unidadeCompra: nullableString(value.unidadeCompra),
    fatorConversao: typeof value.fatorConversao === "number" ? value.fatorConversao : null,

    registroAnvisa: nullableString(value.registroAnvisa),
    temperaturaArmazenamento: nullableString(value.temperaturaArmazenamento),
    principioAtivo: nullableString(value.principioAtivo),
    concentracaoValor: typeof value.concentracaoValor === "number" ? value.concentracaoValor : null,
    concentracaoUnidade: nullableString(value.concentracaoUnidade),
    conteudoEmbalagem: typeof value.conteudoEmbalagem === "number" ? value.conteudoEmbalagem : null,
    apresentacao: nullableString(value.apresentacao),
    classeRisco: nullableString(value.classeRisco),
    tamanho: nullableString(value.tamanho),
    observacoes: nullableString(value.observacoes),

    ...(lotes !== undefined ? { lotes } : {}),
    ...(estoqueAtual !== undefined ? { estoqueAtual } : {}),
  };
};

export const ProdutosAPI = {
  async buscarPorCodigoBarras(codigoBarras: string): Promise<{ produtos: Produto[]; inativos: number }> {
    const response = await api.get<{ items: any[]; inativos?: number }>("/api/produto/codigo-barras", {
      params: { codigo: codigoBarras },
    });
    const items = response.data.items || [];
    return {
      produtos: items.map(mapProduto),
      inativos: Number(response.data.inativos) || 0,
    };
  },

  async buscarPorId(id: number): Promise<Produto | null> {
    const response = await api.get<unknown>(`/api/produto/${id}`);
    return mapProduto(response.data);
  },

  async buscarPorTexto(texto: string): Promise<Produto[]> {
    const response = await api.get<{ items: any[] }>("/api/produto", {
      params: { search: texto },
    });
    const items = response.data.items || [];
    return items.map(mapProduto);
  },

  async criar(payload: any): Promise<Produto> {
    const response = await api.post<any>("/api/produto", payload);
    return mapProduto(response.data);
  },

  async buscarCategorias(): Promise<{ flat: { id: number; nome: string }[] }> {
    const response = await api.get("/api/produto/categoria");
    return response.data;
  },

  async uploadImagem(base64OrUri: string): Promise<string> {
    const response = await api.post<{ url: string }>("/api/upload", {
      base64: base64OrUri,
    });
    return response.data.url;
  },
};

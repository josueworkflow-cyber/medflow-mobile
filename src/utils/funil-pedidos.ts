import {
  EtapaFunilResumo,
  MotivoStatusPedido,
  PedidoEstoque,
  StatusPedido,
  StatusPendenciaEstoque,
} from "../api/estoque-consulta";

export type AbaFunilEstoque =
  | "validacao_estoque"
  | "separacao"
  | "despacho_rota"
  | "acompanhamento"
  | "historico";

export const ETAPAS_FUNIL_PADRAO: EtapaFunilResumo[] = [
  { id: "ORCAMENTO", label: "Orçamento", contexto: "Cotação comercial inicial", color: "#C41230", responsavel: "Comercial", ordem: 1 },
  { id: "APROVADO", label: "Aprovado", contexto: "Aguardando estoque assumir", color: "#C41230", responsavel: "Comercial / Estoque", ordem: 2 },
  { id: "SEPARACAO", label: "Separação", contexto: "Conferência física dos itens", color: "#1D4ED8", responsavel: "Estoque", ordem: 3 },
  { id: "AGUARDANDO_COMPRA", label: "Aguardando compra", contexto: "Falta de produto sinalizada", color: "#B45309", responsavel: "Estoque / Comercial", ordem: 4 },
  { id: "ENTRADA_MERCADORIA", label: "Entrada mercadoria", contexto: "Dar entrada em produtos recebidos", color: "#B45309", responsavel: "Estoque", ordem: 5 },
  { id: "FATURAMENTO", label: "Faturamento", contexto: "Saldo positivo e emissão de nota", color: "#8B0C21", responsavel: "Estoque / Fiscal", ordem: 6 },
  { id: "FINANCEIRO", label: "Financeiro", contexto: "Emissão de boleto e baixa no sistema", color: "#0369A1", responsavel: "Financeiro", ordem: 7 },
  { id: "EXPEDICAO", label: "Expedição", contexto: "Embalado aguardando coleta", color: "#1E40AF", responsavel: "Estoque", ordem: 8 },
  { id: "ROTA_ENTREGA", label: "Rota de entrega", contexto: "Em transporte com motorista", color: "#B45309", responsavel: "Logística", ordem: 9 },
  { id: "FINALIZADO", label: "Finalizado", contexto: "Entrega concluída no cliente", color: "#15803D", responsavel: "Concluído", ordem: 10 },
];

const ETAPA_POR_STATUS = new Map(
  ETAPAS_FUNIL_PADRAO.map((etapa) => [etapa.id, etapa])
);

export const ETAPA_CANCELADA: EtapaFunilResumo = {
  id: "CANCELADO",
  label: "Cancelado",
  contexto: "Registro mantido no histórico",
  color: "#64748B",
  responsavel: "—",
  ordem: null,
};

export const MOTIVO_STATUS_LABEL: Record<MotivoStatusPedido, string> = {
  AGUARDANDO_ESTOQUE_ASSUMIR: "Aguardando o estoque assumir o pedido",
  CONFERINDO_ITENS: "Conferindo itens na separação",
  FALTA_PRODUTO: "Falta de produto sinalizada na separação",
  AGUARDANDO_ENTRADA: "Aguardando entrada da mercadoria comprada",
  AGUARDANDO_FATURAMENTO: "Conferência concluída; aguardando faturamento",
  FATURADO: "Pedido faturado / NF emitida",
  AGUARDANDO_BOLETO_BAIXA: "Aguardando emissão de boleto ou baixa pelo Financeiro",
  AGUARDANDO_EXPEDICAO: "Aguardando expedição / coleta",
  EM_ROTA: "Mercadoria em rota de entrega ao cliente",
  ENTREGA_CONCLUIDA: "Entrega confirmada no cliente",
  CANCELADO_PELO_CLIENTE: "Cancelado pelo cliente",
  CANCELADO_INTERNAMENTE: "Cancelado internamente",
};

export const PENDENCIA_STATUS_LABEL: Record<StatusPendenciaEstoque, string> = {
  AGUARDANDO_VALIDACAO: "Aguardando validação do estoque",
  AGUARDANDO_DECISAO_COMERCIAL: "Aguardando decisão comercial",
  AGUARDANDO_COMPRA: "Aguardando compra",
  AGUARDANDO_MERCADORIA: "Aguardando mercadoria",
  AGUARDANDO_ENTRADA: "Aguardando entrada no estoque",
  RESOLVIDA: "Resolvida",
  CANCELADA: "Cancelada",
};

export const FILAS_ESTOQUE: ReadonlyArray<{
  key: AbaFunilEstoque;
  label: string;
  descricao: string;
  statuses: readonly StatusPedido[];
}> = [
  {
    key: "validacao_estoque",
    label: "Aprovados & Faltas",
    descricao: "Pedidos aprovados aguardando início de separação ou aguardando compra.",
    statuses: ["APROVADO", "AGUARDANDO_COMPRA", "ENTRADA_MERCADORIA"],
  },
  {
    key: "separacao",
    label: "Separação",
    descricao: "Pedidos em processo de separação e conferência física.",
    statuses: ["EM_SEPARACAO"],
  },
  {
    key: "despacho_rota",
    label: "Expedição & Rota",
    descricao: "Pedidos faturados na expedição ou em rota de entrega.",
    statuses: ["EXPEDICAO", "EM_ROTA"],
  },
  {
    key: "acompanhamento",
    label: "Faturamento & Fin.",
    descricao: "Pedidos em faturamento ou aguardando liberação financeira.",
    statuses: ["FATURAMENTO", "AGUARDANDO_FINANCEIRO"],
  },
  {
    key: "historico",
    label: "Histórico",
    descricao: "Pedidos entregues ao cliente ou cancelados.",
    statuses: ["FINALIZADO", "CANCELADO"],
  },
];

export function obterEtapaPedido(pedido: PedidoEstoque): EtapaFunilResumo {
  if (pedido.status === "CANCELADO") return ETAPA_CANCELADA;
  return ETAPA_POR_STATUS.get(pedido.status) || ETAPA_CANCELADA;
}

export function obterMotivoPedido(pedido: PedidoEstoque): string | null {
  if (pedido.motivoStatusLabel) return pedido.motivoStatusLabel;
  if (!pedido.motivoStatus) return null;
  return MOTIVO_STATUS_LABEL[pedido.motivoStatus];
}

export function formatarNomeCliente(cliente?: { razaoSocial?: string | null; nomeFantasia?: string | null; nome?: string | null } | null): string {
  if (!cliente) return "Cliente não informado";
  const nome = cliente.nomeFantasia || cliente.nome || cliente.razaoSocial || "Cliente";
  // Remove todos os dígitos, pontuações e códigos no início da string até encontrar a primeira letra
  const nomeLimpo = nome.replace(/^[^\p{L}]+/u, "").trim();
  return nomeLimpo || nome || "Cliente";
}

export function enxugarFraseMotivo(texto: string | null | undefined): string {
  if (!texto) return "";
  return texto
    .replace(" da falta pelo estoque", "")
    .replace(" da mercadoria no sistema", "")
    .replace(" da mercadoria", "")
    .replace(" do estoque", "")
    .replace("Verificação automática", "Verificação")
    .trim();
}

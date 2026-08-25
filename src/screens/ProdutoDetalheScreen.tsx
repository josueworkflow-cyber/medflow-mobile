import React, { useCallback, useState } from "react";
import { StyleSheet, View, ScrollView, Alert, Platform, Image, TouchableOpacity, StatusBar } from "react-native";
import { Button, Text, Card, Divider, Surface, IconButton, ActivityIndicator, Badge } from "react-native-paper";
import { useRoute, useNavigation, RouteProp, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { ProdutosAPI } from "../api/produtos";
import { StatusLote, Lote } from "../types/produto";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type RoutePropType = RouteProp<RootStackParamList, "ProdutoDetalhe">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, "ProdutoDetalhe">;

const C = {
  headerBg: "#8B0C21",
  bg: "#F8FAFC",
  white: "#FFFFFF",
  slate100: "#F1F5F9",
  slate200: "#E2E8F0",
  slate300: "#CBD5E1",
  slate500: "#64748B",
  slate700: "#334155",
  slate900: "#0F172A",
  border: "#E2E8F0",

  primaryColor: "#C41230",
  successColor: "#16A34A",
  warningColor: "#D97706",
  dangerColor: "#DC2626",
  infoColor: "#2563EB",
};

const STATUS_LOTE_VISUAL: Record<StatusLote, { label: string; backgroundColor: string; color: string }> = {
  DISPONIVEL: { label: "Disponível", backgroundColor: "#DCFCE7", color: "#166534" },
  QUARENTENA: { label: "Quarentena", backgroundColor: "#FEF3C7", color: "#92400E" },
  BLOQUEADO: { label: "Bloqueado", backgroundColor: "#FEE2E2", color: "#991B1B" },
  VENCIDO: { label: "Vencido", backgroundColor: "#F3E8FF", color: "#6B21A8" },
};

export const ProdutoDetalheScreen = () => {
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavigationProp>();
  
  const { produto: initialProduto, action, loteSugerido, validadeSugerida } = route.params;

  const [produto, setProduto] = useState(initialProduto);
  const [loading, setLoading] = useState(false);
  const [selectedLoteId, setSelectedLoteId] = useState<number | null>(null);

  useFocusEffect(useCallback(() => {
    let ativo = true;
    const carregarDetalhes = async () => {
      if (!initialProduto?.id) return;
      setLoading(true);
      try {
        const res = await ProdutosAPI.buscarPorId(initialProduto.id);
        if (res && ativo) {
          setProduto(res);
        }
      } catch (err) {
        console.error("Erro ao carregar detalhes do produto:", err);
      } finally {
        if (ativo) setLoading(false);
      }
    };
    carregarDetalhes();
    return () => { ativo = false; };
  }, [initialProduto?.id]));

  const actionLabels: Record<string, string> = {
    AjusteInventario: "ajustar o saldo",
    BloqueioLote: "bloquear o lote",
    Transferencia: "transferir o lote",
  };
  const actionLabel = action ? actionLabels[action] : null;

  const formatValidade = (dateStr: string | null): string => {
    if (!dateStr) return "Sem validade";
    try {
      const cleanDate = dateStr.split("T")[0];
      const parts = cleanDate.split("-");
      if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
      }
    } catch (e) {
      console.error("Erro ao formatar data:", e);
    }
    return dateStr;
  };

  const categoriaNome = typeof produto.categoria === "object" && produto.categoria ? produto.categoria.nome : produto.categoria;

  // Cálculos de saldo total
  const lotes = produto.lotes || [];
  const totalDisponivel = lotes.reduce((acc, l) => {
    if (l.status !== "DISPONIVEL") return acc;
    return acc + l.estoqueAtual.reduce((sAcc, s) => sAcc + (Number(s.quantidadeDisponivel) || 0), 0);
  }, 0);

  const totalBloqueado = lotes.reduce((acc, l) => {
    if (l.status === "DISPONIVEL") return acc;
    return acc + l.estoqueAtual.reduce((sAcc, s) => sAcc + (Number(s.quantidadeDisponivel) || 0), 0);
  }, 0);

  const estoqueMin = Number(produto.estoqueMinimo || 0);
  const statusEstoque = totalDisponivel === 0 ? "ESGOTADO" : (totalDisponivel < estoqueMin ? "CRÍTICO" : "OK");

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.headerBg} />

      {/* ── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Detalhes do Produto</Text>
          <Text style={styles.headerSubtitle}>Ficha Técnica e Operações</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate("Scanner")}>
          <MaterialCommunityIcons name="barcode-scan" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {loading && !produto.nome ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.primaryColor} />
          <Text style={{ marginTop: 12, color: C.slate500, fontWeight: "600" }}>
            Carregando especificações completas...
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {actionLabel && (
            <Surface style={styles.actionWarning} elevation={0}>
              <MaterialCommunityIcons name="information-outline" size={18} color={C.primaryColor} />
              <Text style={styles.actionWarningText}>
                Selecione o lote desejado abaixo para {actionLabel}.
              </Text>
            </Surface>
          )}

          {/* Card Principal: Nome, Imagem e Identificação */}
          <Surface style={styles.card} elevation={1}>
            {produto.imagemUrl && (
              <Image
                source={{ uri: produto.imagemUrl }}
                style={styles.productImage}
                resizeMode="contain"
                accessibilityLabel={`Foto de ${produto.nome}`}
              />
            )}
            <Text style={styles.productName}>{produto.nome}</Text>

            <View style={styles.badgeRow}>
              {categoriaNome && (
                <Badge style={styles.catBadge}>{categoriaNome}</Badge>
              )}
              {produto.marca && (
                <Badge style={styles.marcaBadge}>{produto.marca}</Badge>
              )}
            </View>

            <Divider style={{ marginVertical: 12 }} />

            <View style={styles.infoGrid}>
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>CÓD. INTERNO (SKU)</Text>
                <Text style={styles.infoValue}>{produto.codigoInterno || "—"}</Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>UNID. VENDA</Text>
                <Text style={styles.infoValue}>{produto.unidade || "UN"}</Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>EAN / BARRAS</Text>
                <Text style={styles.infoValue}>{produto.codigoBarras || "—"}</Text>
              </View>
            </View>
          </Surface>

          {/* ── PAINEL DE SALDO & AÇÕES DE ESTOQUE ─── */}
          <Surface style={styles.actionsCard} elevation={2}>
            <View style={styles.sectionHeaderRow}>
              <MaterialCommunityIcons name="lightning-bolt" size={18} color={C.primaryColor} />
              <Text style={styles.sectionTitle}>AÇÕES RÁPIDAS DE ESTOQUE</Text>
            </View>

            {/* Resumo de Saldos */}
            <View style={styles.saldoResumoBox}>
              <View style={styles.saldoItem}>
                <Text style={styles.saldoLabel}>DISPONÍVEL</Text>
                <Text style={[styles.saldoValue, { color: totalDisponivel > 0 ? C.successColor : C.dangerColor }]}>
                  {totalDisponivel} <Text style={styles.saldoUnit}>{produto.unidade || "UN"}</Text>
                </Text>
              </View>
              <View style={styles.saldoDivider} />
              <View style={styles.saldoItem}>
                <Text style={styles.saldoLabel}>MÍNIMO</Text>
                <Text style={styles.saldoValue}>
                  {estoqueMin} <Text style={styles.saldoUnit}>{produto.unidade || "UN"}</Text>
                </Text>
              </View>
              <View style={styles.saldoDivider} />
              <View style={styles.saldoItem}>
                <Text style={styles.saldoLabel}>STATUS</Text>
                <View
                  style={[
                    styles.statusPill,
                    statusEstoque === "OK" && { backgroundColor: "#DCFCE7" },
                    statusEstoque === "CRÍTICO" && { backgroundColor: "#FEF3C7" },
                    statusEstoque === "ESGOTADO" && { backgroundColor: "#FEE2E2" },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      statusEstoque === "OK" && { color: "#166534" },
                      statusEstoque === "CRÍTICO" && { color: "#92400E" },
                      statusEstoque === "ESGOTADO" && { color: "#991B1B" },
                    ]}
                  >
                    {statusEstoque}
                  </Text>
                </View>
              </View>
            </View>

            {/* Botão Primário: Entrada de Estoque */}
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={() =>
                navigation.navigate("EntradaEstoque", {
                  produto,
                  loteSugerido,
                  validadeSugerida,
                })
              }
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="tray-arrow-down" size={20} color="#FFFFFF" />
              <Text style={styles.primaryActionBtnText}>Dar Entrada de Estoque</Text>
            </TouchableOpacity>

            {/* Grid de Ações Secundárias */}
            <View style={styles.secondaryActionsGrid}>
              <TouchableOpacity
                style={styles.secActionBtn}
                onPress={() => navigation.navigate("AjusteInventario", { produto })}
              >
                <MaterialCommunityIcons name="tune-vertical" size={20} color={C.primaryColor} />
                <Text style={styles.secActionText}>Ajustar Saldo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secActionBtn}
                onPress={() => navigation.navigate("Transferencia", { produto })}
              >
                <MaterialCommunityIcons name="archive-arrow-down-outline" size={20} color={C.infoColor} />
                <Text style={styles.secActionText}>Transferir</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secActionBtn}
                onPress={() => navigation.navigate("BloqueioLote", { produto })}
              >
                <MaterialCommunityIcons name="shield-lock-outline" size={20} color={C.warningColor} />
                <Text style={styles.secActionText}>Bloquear Lote</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secActionBtn}
                onPress={() => navigation.navigate("Movimentacoes")}
              >
                <MaterialCommunityIcons name="history" size={20} color={C.slate700} />
                <Text style={styles.secActionText}>Movimentações</Text>
              </TouchableOpacity>
            </View>
          </Surface>

          {/* Card: Especificações Técnicas e Clínicas */}
          {(produto.registroAnvisa || produto.principioAtivo || produto.concentracaoValor || produto.apresentacao || produto.classeRisco || produto.temperaturaArmazenamento || produto.observacoes) && (
            <Surface style={styles.card} elevation={1}>
              <View style={styles.sectionHeaderRow}>
                <MaterialCommunityIcons name="medical-bag" size={18} color={C.primaryColor} />
                <Text style={styles.sectionTitle}>ESPECIFICAÇÕES TÉCNICAS E CLÍNICAS</Text>
              </View>
              <Divider style={{ marginVertical: 10 }} />

              <View style={styles.infoGrid}>
                {produto.registroAnvisa && (
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>REGISTRO ANVISA</Text>
                    <Text style={styles.infoValue}>{produto.registroAnvisa}</Text>
                  </View>
                )}
                {produto.principioAtivo && (
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>PRINCÍPIO ATIVO</Text>
                    <Text style={styles.infoValue}>{produto.principioAtivo}</Text>
                  </View>
                )}
                {(produto.concentracaoValor || produto.concentracaoUnidade) && (
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>CONCENTRAÇÃO</Text>
                    <Text style={styles.infoValue}>
                      {produto.concentracaoValor ? `${produto.concentracaoValor} ` : ""}{produto.concentracaoUnidade || ""}
                    </Text>
                  </View>
                )}
                {produto.apresentacao && (
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>APRESENTAÇÃO</Text>
                    <Text style={styles.infoValue}>{produto.apresentacao}</Text>
                  </View>
                )}
                {produto.classeRisco && (
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>CLASSE DE RISCO</Text>
                    <Text style={styles.infoValue}>Classe {produto.classeRisco}</Text>
                  </View>
                )}
                {produto.temperaturaArmazenamento && (
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>TEMPERATURA</Text>
                    <Text style={styles.infoValue}>{produto.temperaturaArmazenamento}</Text>
                  </View>
                )}
                {produto.conteudoEmbalagem && (
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>CONTEÚDO EMBALAGEM</Text>
                    <Text style={styles.infoValue}>{produto.conteudoEmbalagem} un</Text>
                  </View>
                )}
                {produto.tamanho && (
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>TAMANHO</Text>
                    <Text style={styles.infoValue}>{produto.tamanho}</Text>
                  </View>
                )}
              </View>

              {produto.observacoes && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.infoLabel}>OBSERVAÇÕES CLÍNICAS / MANUSEIO</Text>
                  <Text style={[styles.infoValue, { fontSize: 12, marginTop: 2 }]}>{produto.observacoes}</Text>
                </View>
              )}
            </Surface>
          )}

          {/* Card: Parâmetros de Estoque e Fabricação */}
          <Surface style={styles.card} elevation={1}>
            <View style={styles.sectionHeaderRow}>
              <MaterialCommunityIcons name="tune-vertical" size={18} color={C.primaryColor} />
              <Text style={styles.sectionTitle}>PARÂMETROS DE ESTOQUE E FABRICAÇÃO</Text>
            </View>
            <Divider style={{ marginVertical: 10 }} />

            <View style={styles.infoGrid}>
              {produto.fabricante && (
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>FABRICANTE</Text>
                  <Text style={styles.infoValue}>{produto.fabricante}</Text>
                </View>
              )}
              {produto.cnpjFabricante && (
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>CNPJ FABRICANTE</Text>
                  <Text style={styles.infoValue}>{produto.cnpjFabricante}</Text>
                </View>
              )}
              {produto.codigoFabricante && (
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>CÓD. FABRICANTE</Text>
                  <Text style={styles.infoValue}>{produto.codigoFabricante}</Text>
                </View>
              )}
              {produto.unidadeCompra && (
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>UNID. COMPRA (FATOR)</Text>
                  <Text style={styles.infoValue}>
                    {produto.unidadeCompra} {produto.fatorConversao ? `(${produto.fatorConversao}x)` : ""}
                  </Text>
                </View>
              )}
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>ESTOQUE MÍNIMO</Text>
                <Text style={[styles.infoValue, { color: C.warningColor }]}>
                  {produto.estoqueMinimo ?? 0} {produto.unidade}
                </Text>
              </View>
              {produto.estoqueMaximo !== null && produto.estoqueMaximo !== undefined && (
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>ESTOQUE MÁXIMO</Text>
                  <Text style={styles.infoValue}>{produto.estoqueMaximo} {produto.unidade}</Text>
                </View>
              )}
              {produto.pontoReposicao !== null && produto.pontoReposicao !== undefined && (
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>PONTO DE REPOSIÇÃO</Text>
                  <Text style={styles.infoValue}>{produto.pontoReposicao} {produto.unidade}</Text>
                </View>
              )}
              {produto.localizacaoEstoque && (
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>LOCALIZAÇÃO PADRÃO</Text>
                  <Text style={styles.infoValue}>{produto.localizacaoEstoque}</Text>
                </View>
              )}
            </View>
          </Surface>

          {/* Lotes do Estoque */}
          <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 8 }]}>
            LOTES REGISTRADOS ({lotes.length})
          </Text>

          {lotes.length === 0 ? (
            <Surface style={styles.emptyLotes} elevation={0}>
              <MaterialCommunityIcons name="package-variant-closed" size={36} color={C.slate500} />
              <Text style={{ color: C.slate700, fontWeight: "700", marginTop: 8 }}>
                Nenhum lote com saldo cadastrado.
              </Text>
              <Text style={{ color: C.slate500, fontSize: 12, textAlign: "center", marginTop: 4, marginBottom: 12 }}>
                Faça uma entrada de estoque para criar o primeiro lote deste produto.
              </Text>
              <TouchableOpacity
                style={styles.emptyLoteBtn}
                onPress={() =>
                  navigation.navigate("EntradaEstoque", {
                    produto,
                    loteSugerido,
                    validadeSugerida,
                  })
                }
              >
                <MaterialCommunityIcons name="plus-circle-outline" size={16} color="#FFFFFF" />
                <Text style={styles.emptyLoteBtnText}>Dar Entrada do 1º Lote</Text>
              </TouchableOpacity>
            </Surface>
          ) : (
            lotes.map((lote) => {
              const totalQtd = lote.estoqueAtual.reduce(
                (acc, curr) => acc + (Number(curr.quantidadeDisponivel) || 0), 0
              );
              const localizacoes = lote.estoqueAtual
                .map(e => e.localizacao?.nome)
                .filter(Boolean)
                .join(", ") || "Geral";

              const isSelected = selectedLoteId === lote.id;
              const statusVisual = STATUS_LOTE_VISUAL[lote.status] || STATUS_LOTE_VISUAL.DISPONIVEL;

              return (
                <Surface
                  key={lote.id}
                  style={[styles.loteCard, isSelected && styles.loteCardSelected]}
                  elevation={1}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setSelectedLoteId(isSelected ? null : lote.id)}
                  >
                    <View style={styles.loteHeader}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <MaterialCommunityIcons name="tag-outline" size={16} color={C.slate700} />
                        <Text style={styles.loteCodigo}>Lote: {lote.numeroLote}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: statusVisual.backgroundColor }]}>
                        <Text style={[styles.statusText, { color: statusVisual.color }]}>
                          {statusVisual.label}
                        </Text>
                      </View>
                    </View>

                    <Divider style={{ marginVertical: 8 }} />

                    <View style={styles.loteInfoGrid}>
                      <View style={styles.infoCol}>
                        <Text style={styles.infoLabel}>Validade</Text>
                        <Text style={styles.loteInfoValue}>{formatValidade(lote.validade)}</Text>
                      </View>
                      <View style={styles.infoCol}>
                        <Text style={styles.infoLabel}>Localização</Text>
                        <Text style={styles.loteInfoValue} numberOfLines={1}>{localizacoes}</Text>
                      </View>
                      <View style={styles.infoCol}>
                        <Text style={styles.infoLabel}>Disponível</Text>
                        <Text style={[styles.loteInfoValue, { color: C.successColor, fontWeight: "800" }]}>
                          {totalQtd} {produto.unidade || "UN"}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Ações contextuais de lote */}
                  <View style={styles.loteActionsArea}>
                    <Divider style={{ marginVertical: 8 }} />
                    <View style={styles.actionBtnGrid}>
                      <TouchableOpacity
                        style={styles.loteActionBtn}
                        onPress={() => navigation.navigate("AjusteInventario", { produto, lote })}
                      >
                        <MaterialCommunityIcons name="tune-vertical" size={15} color={C.primaryColor} />
                        <Text style={[styles.loteActionText, { color: C.primaryColor }]}>Ajustar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.loteActionBtn}
                        onPress={() => navigation.navigate("BloqueioLote", { produto, lote })}
                      >
                        <MaterialCommunityIcons name="shield-lock-outline" size={15} color={C.warningColor} />
                        <Text style={[styles.loteActionText, { color: C.warningColor }]}>Bloquear</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.loteActionBtn, { backgroundColor: C.primaryColor, borderColor: C.primaryColor }]}
                        onPress={() =>
                          navigation.navigate("Transferencia", {
                            produto,
                            lote,
                            saldo: lote.estoqueAtual[0],
                          })
                        }
                      >
                        <MaterialCommunityIcons name="archive-arrow-down-outline" size={15} color="#FFFFFF" />
                        <Text style={[styles.loteActionText, { color: "#FFFFFF" }]}>Transferir</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Surface>
              );
            })
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    backgroundColor: C.headerBg,
    paddingTop: Platform.OS === "android" ? 45 : 55,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 11, color: "rgba(255, 255, 255, 0.8)", marginTop: 1 },

  scrollContent: {
    padding: 16,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  actionWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  actionWarningText: {
    flex: 1,
    fontSize: 12,
    color: C.dangerColor,
    fontWeight: "700",
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  productImage: {
    width: "100%",
    height: 140,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: C.slate100,
  },
  productName: {
    fontSize: 18,
    fontWeight: "800",
    color: C.slate900,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  catBadge: {
    backgroundColor: C.slate100,
    color: C.slate700,
    fontWeight: "700",
    fontSize: 11,
  },
  marcaBadge: {
    backgroundColor: "#DBEAFE",
    color: C.infoColor,
    fontWeight: "700",
    fontSize: 11,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: C.slate700,
    letterSpacing: 0.5,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 12,
  },
  infoCol: {
    width: "50%",
    paddingRight: 8,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.slate500,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "700",
    color: C.slate900,
    marginTop: 2,
  },

  /* Card de Ações Rápidas */
  actionsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  saldoResumoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },
  saldoItem: {
    flex: 1,
    alignItems: "center",
  },
  saldoDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#CBD5E1",
  },
  saldoLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: C.slate500,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  saldoValue: {
    fontSize: 14,
    fontWeight: "800",
    color: C.slate900,
  },
  saldoUnit: {
    fontSize: 10,
    fontWeight: "600",
    color: C.slate500,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#16A34A",
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 10,
    elevation: 2,
  },
  primaryActionBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "800",
  },
  secondaryActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  secActionBtn: {
    flex: 1,
    minWidth: "45%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingVertical: 10,
  },
  secActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.slate700,
  },

  /* Lotes */
  emptyLotes: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyLoteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.primaryColor,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyLoteBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  loteCard: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
  },
  loteCardSelected: {
    borderColor: C.primaryColor,
    borderWidth: 1.5,
  },
  loteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  loteCodigo: {
    fontSize: 13,
    fontWeight: "700",
    color: C.slate900,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  loteInfoGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  loteInfoValue: {
    fontSize: 12,
    fontWeight: "600",
    color: C.slate700,
    marginTop: 2,
  },
  loteActionsArea: {
    marginTop: 4,
  },
  actionBtnGrid: {
    flexDirection: "row",
    gap: 6,
  },
  loteActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  loteActionText: {
    fontSize: 11,
    fontWeight: "700",
  },
});

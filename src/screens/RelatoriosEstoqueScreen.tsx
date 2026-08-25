import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Text, Surface, Card, Divider, Badge } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { EstoqueConsultaAPI } from "../api/estoque-consulta";
import { DashboardAPI, DashboardData } from "../api/dashboard";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "RelatoriosEstoque">;

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
  purpleColor: "#7C3AED",
};

export const RelatoriosEstoqueScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  const [aba, setAba] = useState<"validade" | "posicao" | "giro">("validade");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estados de dados dos relatórios
  const [dadosValidade, setDadosValidade] = useState<any>(null);
  const [dadosPosicao, setDadosPosicao] = useState<any>(null);
  const [dadosGiro, setDadosGiro] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  const carregarRelatorios = async () => {
    setIsLoading(true);
    try {
      const [valRes, posRes, giroRes, dashRes] = await Promise.all([
        EstoqueConsultaAPI.getValidadeRelatorio().catch(() => null),
        EstoqueConsultaAPI.getPosicaoRelatorio().catch(() => null),
        EstoqueConsultaAPI.getGiro().catch(() => null),
        DashboardAPI.obterDados().catch(() => null),
      ]);

      setDadosValidade(valRes);
      setDadosPosicao(posRes);
      setDadosGiro(giroRes);
      setDashboardData(dashRes);
    } catch (err) {
      console.error("Erro ao carregar relatórios:", err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    carregarRelatorios();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    carregarRelatorios();
  };

  // Lista unificada de validade
  const itensValidade = useMemo(() => {
    if (!dadosValidade) return [];
    const vencidos = Array.isArray(dadosValidade.vencidos)
      ? dadosValidade.vencidos.map((item: any) => ({ ...item, isVencido: true }))
      : [];
    const vencendo = Array.isArray(dadosValidade.vencendo)
      ? dadosValidade.vencendo.map((item: any) => ({ ...item, isVencido: false }))
      : [];
    return [...vencidos, ...vencendo];
  }, [dadosValidade]);

  // Lista de posição por categoria / produto
  const produtosPosicao = useMemo(() => {
    if (Array.isArray(dadosPosicao)) return dadosPosicao;
    if (Array.isArray(dadosPosicao?.posicao)) return dadosPosicao.posicao;
    return [];
  }, [dadosPosicao]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.headerBg} />

      {/* ── HEADER ─── */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Relatórios de Estoque</Text>
          <Text style={s.headerSubtitle}>Validade, Posição Física e Giro Operacional</Text>
        </View>
        <TouchableOpacity style={s.headerBtn} onPress={onRefresh}>
          <MaterialCommunityIcons name="refresh" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ── ABAS SUPERIORES ─── */}
      <View style={s.tabsRow}>
        <TouchableOpacity
          style={[s.tabButton, aba === "validade" && s.tabButtonActive]}
          onPress={() => setAba("validade")}
        >
          <MaterialCommunityIcons
            name="calendar-alert"
            size={18}
            color={aba === "validade" ? C.primaryColor : C.slate500}
          />
          <Text style={[s.tabButtonText, aba === "validade" && s.tabButtonTextActive]}>Validades</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.tabButton, aba === "posicao" && s.tabButtonActive]}
          onPress={() => setAba("posicao")}
        >
          <MaterialCommunityIcons
            name="chart-pie"
            size={18}
            color={aba === "posicao" ? C.primaryColor : C.slate500}
          />
          <Text style={[s.tabButtonText, aba === "posicao" && s.tabButtonTextActive]}>Posição</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.tabButton, aba === "giro" && s.tabButtonActive]}
          onPress={() => setAba("giro")}
        >
          <MaterialCommunityIcons
            name="trending-up"
            size={18}
            color={aba === "giro" ? C.primaryColor : C.slate500}
          />
          <Text style={[s.tabButtonText, aba === "giro" && s.tabButtonTextActive]}>Giro & Curva</Text>
        </TouchableOpacity>
      </View>

      {isLoading && !refreshing ? (
        <View style={s.centerContainer}>
          <ActivityIndicator size="large" color={C.primaryColor} />
          <Text style={s.loadingText}>Compilando dados analíticos...</Text>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primaryColor]} />}
        >
          {/* ── ABA 1: VALIDADE & VENCIMENTOS ─── */}
          {aba === "validade" && (
            <View style={{ gap: 14 }}>
              {/* KPIs de Validade */}
              <View style={s.kpiRow}>
                <Surface style={[s.kpiCard, { borderLeftColor: C.dangerColor }]} elevation={1}>
                  <Text style={s.kpiLabel}>Lotes Vencidos</Text>
                  <Text style={[s.kpiValue, { color: C.dangerColor }]}>
                    {dadosValidade?.vencidos?.length ?? dashboardData?.vencidos ?? 0}
                  </Text>
                  <Text style={s.kpiSub}>Bloqueio imediato</Text>
                </Surface>

                <Surface style={[s.kpiCard, { borderLeftColor: C.warningColor }]} elevation={1}>
                  <Text style={s.kpiLabel}>A Vencer em 30 Dias</Text>
                  <Text style={[s.kpiValue, { color: C.warningColor }]}>
                    {dadosValidade?.vencendo?.length ?? dashboardData?.proximosVencer ?? 0}
                  </Text>
                  <Text style={s.kpiSub}>Atenção prioritária</Text>
                </Surface>
              </View>

              <Text style={s.sectionTitle}>LOTES COM VENCIMENTO PRÓXIMO OU EXPIRADO</Text>

              {itensValidade.length === 0 ? (
                <Surface style={s.emptyCard} elevation={0}>
                  <MaterialCommunityIcons name="check-decagram-outline" size={40} color={C.successColor} />
                  <Text style={s.emptyCardTitle}>Nenhum lote crítico no momento</Text>
                  <Text style={s.emptyCardSub}>Todos os lotes possuem validades dentro da margem de segurança.</Text>
                </Surface>
              ) : (
                itensValidade.map((item: any, idx: number) => (
                  <Surface key={idx} style={s.itemCard} elevation={1}>
                    <View style={s.itemHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemTitle}>{item.produto || item.descricao || "Item sem descrição"}</Text>
                        <Text style={s.itemSub}>
                          Lote: <Text style={{ fontWeight: "700" }}>{item.numeroLote}</Text>
                          {item.codigo ? ` • SKU: ${item.codigo}` : ""}
                        </Text>
                      </View>
                      <Badge
                        style={{
                          backgroundColor: item.isVencido ? "#FEE2E2" : "#FEF3C7",
                          color: item.isVencido ? "#991B1B" : "#92400E",
                          fontWeight: "700",
                        }}
                      >
                        {item.isVencido ? "VENCIDO" : "A VENCER"}
                      </Badge>
                    </View>
                    <Divider style={{ marginVertical: 8 }} />
                    <View style={s.itemFooter}>
                      <Text style={s.itemFooterText}>
                        Validade: <Text style={{ fontWeight: "700" }}>{item.validade ? new Date(item.validade).toLocaleDateString("pt-BR") : "N/A"}</Text>
                      </Text>
                      <Text style={s.itemFooterText}>
                        Saldo: <Text style={{ fontWeight: "800", color: C.slate900 }}>{item.quantidade || 0} un</Text>
                      </Text>
                    </View>
                  </Surface>
                ))
              )}
            </View>
          )}

          {/* ── ABA 2: POSIÇÃO DE ESTOQUE ─── */}
          {aba === "posicao" && (
            <View style={{ gap: 14 }}>
              <View style={s.kpiRow}>
                <Surface style={[s.kpiCard, { borderLeftColor: C.infoColor }]} elevation={1}>
                  <Text style={s.kpiLabel}>Total SKUs</Text>
                  <Text style={s.kpiValue}>{produtosPosicao.length || dashboardData?.skusAtivos || 0}</Text>
                  <Text style={s.kpiSub}>Linha de produtos</Text>
                </Surface>

                <Surface style={[s.kpiCard, { borderLeftColor: C.purpleColor }]} elevation={1}>
                  <Text style={s.kpiLabel}>Total Físico</Text>
                  <Text style={s.kpiValue}>
                    {produtosPosicao.reduce((acc: number, p: any) => acc + (p.disponivel || p.quantidadeTotal || 0), 0).toLocaleString("pt-BR") ||
                      (dashboardData?.itensEstoque ?? 0).toLocaleString("pt-BR")}
                  </Text>
                  <Text style={s.kpiSub}>Peças estocadas</Text>
                </Surface>
              </View>

              <Text style={s.sectionTitle}>POSIÇÃO INDIVIDUAL POR PRODUTO</Text>

              {produtosPosicao.length === 0 ? (
                <Surface style={s.emptyCard} elevation={0}>
                  <MaterialCommunityIcons name="package-variant-closed" size={40} color={C.slate500} />
                  <Text style={s.emptyCardTitle}>Nenhum item com saldo registrado</Text>
                </Surface>
              ) : (
                produtosPosicao.slice(0, 30).map((prod: any, i: number) => (
                  <Surface key={i} style={s.itemCard} elevation={1}>
                    <View style={s.itemHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemTitle}>{prod.descricao}</Text>
                        <Text style={s.itemSub}>
                          SKU: {prod.codigoInterno || "—"} • Categoria: {prod.categoria || "Geral"}
                        </Text>
                      </View>
                    </View>
                    <Divider style={{ marginVertical: 8 }} />
                    <View style={s.itemFooter}>
                      <Text style={s.itemFooterText}>
                        Disponível: <Text style={{ fontWeight: "800", color: C.successColor }}>{prod.disponivel ?? 0} un</Text>
                      </Text>
                      <Text style={s.itemFooterText}>
                        Total: <Text style={{ fontWeight: "800", color: C.slate900 }}>{(prod.disponivel ?? 0) + (prod.reservado ?? 0)} un</Text>
                      </Text>
                    </View>
                  </Surface>
                ))
              )}
            </View>
          )}

          {/* ── ABA 3: GIRO & TOP MOVIMENTADOS ─── */}
          {aba === "giro" && (
            <View style={{ gap: 14 }}>
              <Text style={s.sectionTitle}>PRODUTOS COM MAIOR VOLUME DE SAÍDA (TOP GIRO)</Text>

              {(!dashboardData?.topProdutos || dashboardData.topProdutos.length === 0) ? (
                <Surface style={s.emptyCard} elevation={0}>
                  <MaterialCommunityIcons name="chart-line" size={40} color={C.slate500} />
                  <Text style={s.emptyCardTitle}>Aguardando movimentações do período</Text>
                  <Text style={s.emptyCardSub}>Conforme as ordens de saída forem finalizadas, o ranking aparecerá aqui.</Text>
                </Surface>
              ) : (
                dashboardData.topProdutos.map((prod, idx) => (
                  <Surface key={idx} style={s.itemCard} elevation={1}>
                    <View style={s.itemHeader}>
                      <View style={s.rankBadge}>
                        <Text style={s.rankBadgeText}>#{idx + 1}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={s.itemTitle}>{prod.descricao}</Text>
                        <Text style={s.itemSub}>
                          Quantidade Vendida: <Text style={{ fontWeight: "800", color: C.primaryColor }}>{prod.qtdVendida} un</Text>
                        </Text>
                      </View>
                    </View>
                    <Divider style={{ marginVertical: 8 }} />
                    <View style={s.itemFooter}>
                      <Text style={s.itemFooterText}>Volume Financeiro:</Text>
                      <Text style={[s.itemFooterText, { fontWeight: "800", color: C.slate900 }]}>
                        R$ {(prod.valorTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                  </Surface>
                ))
              )}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  root: {
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
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 1,
  },
  tabsRow: {
    flexDirection: "row",
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabButtonActive: {
    borderBottomColor: C.primaryColor,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.slate500,
  },
  tabButtonTextActive: {
    color: C.primaryColor,
    fontWeight: "700",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: C.slate500,
    fontWeight: "600",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: C.slate700,
    letterSpacing: 0.5,
    marginTop: 6,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: C.slate500,
    textTransform: "uppercase",
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "800",
    color: C.slate900,
    marginVertical: 2,
  },
  kpiSub: {
    fontSize: 10,
    color: C.slate500,
  },
  itemCard: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: C.slate900,
  },
  itemSub: {
    fontSize: 11,
    color: C.slate500,
    marginTop: 2,
  },
  itemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemFooterText: {
    fontSize: 12,
    color: C.slate700,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.slate100,
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: C.slate700,
  },
  emptyCard: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: C.slate900,
    marginTop: 10,
  },
  emptyCardSub: {
    fontSize: 12,
    color: C.slate500,
    textAlign: "center",
    marginTop: 4,
  },
});

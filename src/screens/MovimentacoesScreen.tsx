import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Text, Surface } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { EstoqueConsultaAPI, Movimentacao, TotaisMovimentacoes } from "../api/estoque-consulta";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Movimentacoes">;

const C = {
  headerBg: "#1B2A4A",
  bg: "#F0F2F5",
  white: "#FFFFFF",
  textDark: "#1E293B",
  textGray: "#6B7280",
  chevron: "#C5CAD0",
  border: "#E5E7EB",
  
  primaryColor: "#3B5998",
  successColor: "#22A85A",
  warningColor: "#F97316",
  dangerColor: "#EF4444",
  infoColor: "#3B82F6",
};

export const MovimentacoesScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  
  // Estados de controle de dados
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [totais, setTotais] = useState<TotaisMovimentacoes | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Filtros
  const [tipoFiltro, setTipoFiltro] = useState<"" | "ENTRADA" | "SAIDA" | "AJUSTE">("");
  const [busca, setBusca] = useState("");

  const handleRefresh = () => setRefreshTrigger((prev) => prev + 1);

  useEffect(() => {
    let cancelled = false;
    const carregar = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = tipoFiltro ? { tipo: tipoFiltro } : undefined;
        const res = await EstoqueConsultaAPI.getMovimentacoes(params);
        if (!cancelled) {
          setMovimentacoes(res.movimentacoes || []);
          setTotais(res.totais);
        }
      } catch (err: any) {
        console.error(err);
        if (!cancelled) {
          setError("Erro ao carregar movimentações. Verifique sua conexão.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    carregar();
    return () => {
      cancelled = true;
    };
  }, [tipoFiltro, refreshTrigger]);

  // Filtragem local por produto.descricao
  const filtrados = movimentacoes.filter((m) => {
    if (busca.trim()) {
      const term = busca.toLowerCase();
      const descricaoMatch = (m.produto?.descricao || "").toLowerCase().includes(term);
      const codigoMatch = (m.produto?.codigoInterno || "").toLowerCase().includes(term);
      return descricaoMatch || codigoMatch;
    }
    return true;
  });

  const getBadgeConfig = (tipo: string) => {
    switch (tipo) {
      case "ENTRADA":
        return { color: C.successColor, label: "ENTRADA", sign: "+" };
      case "SAIDA":
        return { color: C.dangerColor, label: "SAÍDA", sign: "-" };
      case "AJUSTE":
        return { color: C.infoColor, label: "AJUSTE", sign: "~" };
      case "RESERVA":
        return { color: C.warningColor, label: "RESERVA", sign: "~" };
      case "BLOQUEIO":
        return { color: C.textGray, label: "BLOQUEIO", sign: "~" };
      default:
        return { color: "#9B59B6", label: tipo, sign: "~" };
    }
  };

  const formatData = (dateStr: string): string => {
    if (!dateStr) return "-";
    try {
      const localDate = new Date(dateStr);
      if (!isNaN(localDate.getTime())) {
        const d = String(localDate.getDate()).padStart(2, "0");
        const m = String(localDate.getMonth() + 1).padStart(2, "0");
        const y = localDate.getFullYear();
        const h = String(localDate.getHours()).padStart(2, "0");
        const min = String(localDate.getMinutes()).padStart(2, "0");
        return `${d}/${m}/${y} ${h}:${min}`;
      }
    } catch (e) {
      console.error(e);
    }
    return dateStr;
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.headerBg} />

      {/* ── Header ─── */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerLeftBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Movimentações</Text>
        <TouchableOpacity style={s.headerRightBtn} onPress={handleRefresh} disabled={isLoading}>
          <MaterialCommunityIcons name="sync" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {isLoading && movimentacoes.length === 0 ? (
        <View style={s.centerContainer}>
          <ActivityIndicator size="large" color={C.primaryColor} />
          <Text style={s.loadingText}>Carregando histórico...</Text>
        </View>
      ) : error && movimentacoes.length === 0 ? (
        <View style={s.centerContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={C.dangerColor} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={handleRefresh}>
            <Text style={s.retryText}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── KPIs em Linha ─── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.kpiScroll}
            contentContainerStyle={s.kpiScrollContent}
          >
            <Surface style={[s.kpiCard, { borderLeftColor: C.successColor }]} elevation={1}>
              <Text style={s.kpiLabel}>Entradas/mês</Text>
              <Text style={[s.kpiValue, { color: C.successColor }]}>
                {totais?.entradasMes ?? 0}
              </Text>
            </Surface>
            <Surface style={[s.kpiCard, { borderLeftColor: C.dangerColor }]} elevation={1}>
              <Text style={s.kpiLabel}>Saídas/mês</Text>
              <Text style={[s.kpiValue, { color: C.dangerColor }]}>
                {totais?.saidasMes ?? 0}
              </Text>
            </Surface>
            <Surface style={[s.kpiCard, { borderLeftColor: C.infoColor }]} elevation={1}>
              <Text style={s.kpiLabel}>Ajustes/mês</Text>
              <Text style={[s.kpiValue, { color: C.infoColor }]}>
                {totais?.ajustesMes ?? 0}
              </Text>
            </Surface>
            <Surface style={[s.kpiCard, { borderLeftColor: C.primaryColor }]} elevation={1}>
              <Text style={s.kpiLabel}>Mov. do Dia</Text>
              <Text style={[s.kpiValue, { color: C.primaryColor }]}>
                {totais?.movDia ?? 0}
              </Text>
            </Surface>
          </ScrollView>

          {/* ── Campo de busca ─── */}
          <View style={s.searchContainer}>
            <MaterialCommunityIcons name="magnify" size={20} color={C.textGray} style={s.searchIcon} />
            <TextInput
              style={s.searchInput}
              placeholder="Buscar por descrição de produto..."
              placeholderTextColor={C.textGray}
              value={busca}
              onChangeText={setBusca}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
          </View>

          {/* ── Filtro de tipo ─── */}
          <View style={s.filterRow}>
            {(["", "ENTRADA", "SAIDA", "AJUSTE"] as const).map((tipo) => (
              <TouchableOpacity
                key={tipo}
                style={[
                  s.filterTab,
                  tipoFiltro === tipo && s.filterTabActive,
                ]}
                onPress={() => setTipoFiltro(tipo)}
              >
                <Text
                  style={[
                    s.filterTabText,
                    tipoFiltro === tipo && s.filterTabTextActive,
                  ]}
                >
                  {tipo === "" ? "Todos" : tipo === "ENTRADA" ? "Entrada" : tipo === "SAIDA" ? "Saída" : "Ajuste"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Histórico de Movimentações ─── */}
          <Text style={s.listTitle}>MOVIMENTAÇÕES ({filtrados.length})</Text>

          {filtrados.length === 0 ? (
            <View style={s.emptyContainer}>
              <MaterialCommunityIcons name="history" size={48} color={C.textGray} />
              <Text style={s.emptyText}>Nenhuma movimentação registrada.</Text>
            </View>
          ) : (
            filtrados.map((m) => {
              const badge = getBadgeConfig(m.tipo);
              const opSign = m.estornado ? "Estornado" : `${badge.sign} ${m.quantidade}`;

              return (
                <Surface key={m.id} style={s.card} elevation={1}>
                  <View style={s.cardHeader}>
                    <View style={[s.badge, { backgroundColor: badge.color + "15" }]}>
                      <Text style={[s.badgeText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                    <Text style={s.dateText}>{formatData(m.createdAt)}</Text>
                  </View>

                  <Text style={s.productName}>{m.produto?.descricao}</Text>

                  {m.produto?.codigoInterno && (
                    <Text style={s.productCode}>Cód: {m.produto.codigoInterno}</Text>
                  )}

                  {m.lote?.numeroLote && (
                    <View style={s.loteRow}>
                      <MaterialCommunityIcons name="tag-outline" size={14} color={C.textGray} />
                      <Text style={s.loteText}>Lote: {m.lote.numeroLote}</Text>
                    </View>
                  )}

                  <View style={s.divider} />

                  <View style={s.footerRow}>
                    <View style={s.userCol}>
                      <Text style={s.footerLabel}>Operador</Text>
                      <Text style={s.footerValue}>{m.usuarioRef?.nome || m.usuario}</Text>
                    </View>
                    <View style={s.valueCol}>
                      <Text style={s.footerLabel}>Quantidade</Text>
                      <Text
                        style={[
                          s.quantityText,
                          { color: m.estornado ? C.textGray : badge.color },
                          m.estornado && s.strikeThrough,
                        ]}
                      >
                        {opSign}
                      </Text>
                    </View>
                  </View>
                </Surface>
              );
            })
          )}
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

  /* Header */
  header: {
    backgroundColor: C.headerBg,
    paddingTop: Platform.OS === "android" ? 50 : 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerLeftBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRightBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Scroll */
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },

  /* KPIs Scroll */
  kpiScroll: {
    marginBottom: 16,
    maxHeight: 70,
  },
  kpiScrollContent: {
    gap: 10,
    paddingRight: 16,
  },
  kpiCard: {
    width: 130,
    backgroundColor: C.white,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderLeftWidth: 4,
    justifyContent: "center",
  },
  kpiLabel: {
    fontSize: 10,
    color: C.textGray,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "800",
  },

  /* Busca */
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: C.textDark,
    paddingVertical: 8,
  },

  /* Filtros */
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 6,
  },
  filterTab: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },
  filterTabActive: {
    backgroundColor: C.primaryColor,
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.textGray,
  },
  filterTabTextActive: {
    color: C.white,
  },

  /* Título da Lista */
  listTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textGray,
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 2,
  },

  /* Card Movimentação */
  card: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  dateText: {
    fontSize: 11,
    color: C.textGray,
  },
  productName: {
    fontSize: 15,
    fontWeight: "700",
    color: C.textDark,
    marginBottom: 2,
  },
  productCode: {
    fontSize: 11,
    color: C.textGray,
    marginBottom: 4,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  loteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  loteText: {
    fontSize: 12,
    color: C.textGray,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 12,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  userCol: {
    flex: 1,
  },
  valueCol: {
    alignItems: "flex-end",
  },
  footerLabel: {
    fontSize: 9,
    color: C.textGray,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  footerValue: {
    fontSize: 13,
    fontWeight: "600",
    color: C.textDark,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: "800",
  },
  strikeThrough: {
    textDecorationLine: "line-through",
  },

  /* States */
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: C.bg,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: C.textGray,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: C.textGray,
    textAlign: "center",
    marginBottom: 20,
  },
  retryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: C.primaryColor,
    borderRadius: 8,
  },
  retryText: {
    color: C.white,
    fontWeight: "600",
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: C.textGray,
  },
});

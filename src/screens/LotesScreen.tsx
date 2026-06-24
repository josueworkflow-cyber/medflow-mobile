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
import { EstoqueConsultaAPI, LoteResumo } from "../api/estoque-consulta";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Lotes">;

const C = {
  headerBg: "#1B2A4A",
  bg: "#F0F2F5",
  white: "#FFFFFF",
  textDark: "#1E293B",
  textGray: "#6B7280",
  chevron: "#C5CAD0",
  border: "#E5E7EB",
  
  successColor: "#22A85A",
  warningColor: "#F97316",
  dangerColor: "#EF4444",
  primaryColor: "#3B5998",
};

export const LotesScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  // Estados de dados
  const [lotes, setLotes] = useState<LoteResumo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Estados de busca (com dequeue) e filtros
  const [busca, setBusca] = useState("");
  const [debouncedBusca, setDebouncedBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "DISPONIVEL" | "BLOQUEADO" | "QUARENTENA" | "VENCIDO">("TODOS");

  const handleRefresh = () => setRefreshTrigger((prev) => prev + 1);

  // Efeito de Debounce para a busca textual (500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedBusca(busca);
    }, 500);
    return () => clearTimeout(timer);
  }, [busca]);

  // Efeito de carregamento baseado na busca debounced e trigger de recarga
  useEffect(() => {
    let cancelled = false;
    const carregar = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const queryParam = debouncedBusca.trim() ? { search: debouncedBusca.trim() } : undefined;
        const res = await EstoqueConsultaAPI.getLotes(queryParam);
        if (!cancelled) {
          setLotes(res || []);
        }
      } catch (err: any) {
        console.error(err);
        if (!cancelled) {
          setError("Erro ao carregar lotes. Verifique sua conexão.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    carregar();
    return () => {
      cancelled = true;
    };
  }, [debouncedBusca, refreshTrigger]);

  // Filtragem local baseada no status selecionado
  const filtrados = lotes.filter((l) => {
    if (filtroStatus !== "TODOS" && l.status !== filtroStatus) {
      return false;
    }
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DISPONIVEL":
        return C.successColor;
      case "QUARENTENA":
        return C.warningColor;
      case "BLOQUEADO":
        return C.dangerColor;
      case "VENCIDO":
        return C.textGray;
      default:
        return C.textGray;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "DISPONIVEL":
        return "DISPONÍVEL";
      case "QUARENTENA":
        return "QUARENTENA";
      case "BLOQUEADO":
        return "BLOQUEADO";
      case "VENCIDO":
        return "VENCIDO";
      default:
        return status;
    }
  };

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
        <Text style={s.headerTitle}>Lotes</Text>
        <TouchableOpacity style={s.headerRightBtn} onPress={handleRefresh} disabled={isLoading}>
          <MaterialCommunityIcons name="sync" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {isLoading && lotes.length === 0 ? (
        <View style={s.centerContainer}>
          <ActivityIndicator size="large" color={C.primaryColor} />
          <Text style={s.loadingText}>Carregando lotes...</Text>
        </View>
      ) : error && lotes.length === 0 ? (
        <View style={s.centerContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={C.dangerColor} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={handleRefresh}>
            <Text style={s.retryText}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* ── Campo de busca ─── */}
          <View style={s.searchSection}>
            <View style={s.searchContainer}>
              <MaterialCommunityIcons name="magnify" size={20} color={C.textGray} style={s.searchIcon} />
              <TextInput
                style={s.searchInput}
                placeholder="Buscar por lote ou nome de produto..."
                placeholderTextColor={C.textGray}
                value={busca}
                onChangeText={setBusca}
                autoCapitalize="none"
                clearButtonMode="while-editing"
              />
              {isLoading && (
                <ActivityIndicator size="small" color={C.primaryColor} style={{ marginLeft: 8 }} />
              )}
            </View>
          </View>

          {/* ── Filtro rápido de status ─── */}
          <View style={s.filterContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.filterScrollContent}
            >
              {(["TODOS", "DISPONIVEL", "BLOQUEADO", "QUARENTENA", "VENCIDO"] as const).map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    s.filterTab,
                    filtroStatus === status && s.filterTabActive,
                  ]}
                  onPress={() => setFiltroStatus(status)}
                >
                  <Text
                    style={[
                      s.filterTabText,
                      filtroStatus === status && s.filterTabTextActive,
                    ]}
                  >
                    {status === "TODOS" ? "Todos" : status === "DISPONIVEL" ? "Disponível" : status === "BLOQUEADO" ? "Bloqueado" : status === "QUARENTENA" ? "Quarentena" : "Vencido"}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Lista de Lotes ─── */}
            <Text style={s.listTitle}>LOTES CADASTRADOS ({filtrados.length})</Text>

            {filtrados.length === 0 ? (
              <View style={s.emptyContainer}>
                <MaterialCommunityIcons name="tag-multiple-outline" size={48} color={C.textGray} />
                <Text style={s.emptyText}>Nenhum lote correspondente.</Text>
              </View>
            ) : (
              filtrados.map((l) => {
                const totalDisp = l.estoqueAtual?.reduce((acc, e) => acc + e.quantidadeDisponivel, 0) ?? 0;
                const totalRes  = l.estoqueAtual?.reduce((acc, e) => acc + e.quantidadeReservada, 0) ?? 0;
                const totalBloq = l.estoqueAtual?.reduce((acc, e) => acc + e.quantidadeBloqueada, 0) ?? 0;
                
                const badgeColor = getStatusColor(l.status);

                return (
                  <Surface key={l.id} style={s.card} elevation={1}>
                    <View style={s.cardHeader}>
                      <View style={s.loteBadge}>
                        <MaterialCommunityIcons name="tag-outline" size={14} color={C.textDark} />
                        <Text style={s.loteTitle}>{l.numeroLote}</Text>
                      </View>
                      <View style={[s.badge, { backgroundColor: badgeColor + "15" }]}>
                        <Text style={[s.badgeText, { color: badgeColor }]}>
                          {getStatusLabel(l.status)}
                        </Text>
                      </View>
                    </View>

                    <Text style={s.productName}>{l.produto?.descricao}</Text>

                    <View style={s.validadeContainer}>
                      <MaterialCommunityIcons name="calendar-outline" size={14} color={C.textGray} />
                      <Text style={s.validadeText}>Validade: {formatValidade(l.validade)}</Text>
                    </View>

                    <View style={s.divider} />

                    <View style={s.stockContainer}>
                      <View style={s.stockCol}>
                        <Text style={s.stockLabel}>Disponível</Text>
                        <Text style={[s.stockValue, { color: C.successColor }]}>{totalDisp}</Text>
                      </View>
                      <View style={s.stockDivider} />
                      <View style={s.stockCol}>
                        <Text style={s.stockLabel}>Reservado</Text>
                        <Text style={[s.stockValue, { color: C.warningColor }]}>{totalRes}</Text>
                      </View>
                      <View style={s.stockDivider} />
                      <View style={s.stockCol}>
                        <Text style={s.stockLabel}>Bloqueado</Text>
                        <Text style={[s.stockValue, { color: C.dangerColor }]}>{totalBloq}</Text>
                      </View>
                    </View>
                  </Surface>
                );
              })
            )}
          </ScrollView>
        </View>
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
    paddingBottom: 32,
  },

  /* Busca */
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    borderColor: C.border,
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

  /* Filtro de Status */
  filterContainer: {
    height: 50,
    marginBottom: 10,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  filterTab: {
    paddingHorizontal: 14,
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
    marginTop: 6,
  },

  /* Card */
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
    marginBottom: 8,
  },
  loteBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
  },
  loteTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textDark,
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
  productName: {
    fontSize: 15,
    fontWeight: "700",
    color: C.textDark,
    marginBottom: 6,
  },
  validadeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  validadeText: {
    fontSize: 12,
    color: C.textGray,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 12,
  },
  stockContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  stockCol: {
    flex: 1,
    alignItems: "center",
  },
  stockDivider: {
    width: 1,
    backgroundColor: "#E5E7EB",
    height: 24,
  },
  stockLabel: {
    fontSize: 10,
    color: C.textGray,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  stockValue: {
    fontSize: 15,
    fontWeight: "800",
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

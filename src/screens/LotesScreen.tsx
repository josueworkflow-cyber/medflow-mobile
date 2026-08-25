import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from "react-native";
import { Text, Surface, Badge } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { EstoqueConsultaAPI, LoteResumo } from "../api/estoque-consulta";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Lotes">;

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

  successColor: "#16A34A",
  warningColor: "#D97706",
  dangerColor: "#DC2626",
  primaryColor: "#C41230",
  infoColor: "#2563EB",
};

export const LotesScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  const [lotes, setLotes] = useState<LoteResumo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Busca e Filtro de Status
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "DISPONIVEL" | "BLOQUEADO" | "QUARENTENA" | "VENCIDO">("TODOS");

  const carregarLotes = async () => {
    setError(null);
    try {
      const res = await EstoqueConsultaAPI.getLotes();
      setLotes(res || []);
    } catch (err: any) {
      console.error(err);
      setError("Erro ao carregar lotes. Verifique sua conexão.");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    carregarLotes();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    carregarLotes();
  };

  // Filtragem rápida em memória (muito rápida e instantânea)
  const filtrados = useMemo(() => {
    let result = lotes;
    if (filtroStatus !== "TODOS") {
      result = result.filter((l) => l.status === filtroStatus);
    }
    if (busca.trim()) {
      const term = busca.toLowerCase();
      result = result.filter(
        (l) =>
          (l.numeroLote || "").toLowerCase().includes(term) ||
          (l.produto?.descricao || "").toLowerCase().includes(term) ||
          (l.produto?.fabricante || "").toLowerCase().includes(term)
      );
    }
    return result;
  }, [lotes, filtroStatus, busca]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "DISPONIVEL":
        return { color: C.successColor, bg: "#DCFCE7", label: "DISPONÍVEL" };
      case "QUARENTENA":
        return { color: C.warningColor, bg: "#FEF3C7", label: "QUARENTENA" };
      case "BLOQUEADO":
        return { color: C.dangerColor, bg: "#FEE2E2", label: "BLOQUEADO" };
      case "VENCIDO":
        return { color: C.slate500, bg: C.slate100, label: "VENCIDO" };
      default:
        return { color: C.slate500, bg: C.slate100, label: status };
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

  const renderItem = useCallback(
    ({ item: l }: { item: LoteResumo }) => {
      const totalDisp = l.estoqueAtual?.reduce((acc, e) => acc + e.quantidadeDisponivel, 0) ?? 0;
      const totalRes = l.estoqueAtual?.reduce((acc, e) => acc + e.quantidadeReservada, 0) ?? 0;
      const totalBloq = l.estoqueAtual?.reduce((acc, e) => acc + e.quantidadeBloqueada, 0) ?? 0;
      const badge = getStatusConfig(l.status);

      return (
        <Surface style={s.card} elevation={1}>
          <View style={s.cardHeader}>
            <View style={s.loteBadge}>
              <MaterialCommunityIcons name="tag-outline" size={14} color={C.slate700} />
              <Text style={s.loteTitle}>{l.numeroLote}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: badge.bg }]}>
              <Text style={[s.badgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
          </View>

          <Text style={s.productName}>{l.produto?.descricao}</Text>

          <View style={s.validadeContainer}>
            <MaterialCommunityIcons name="calendar-outline" size={14} color={C.slate500} />
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

          {/* Ações Rápidas do Lote */}
          <View style={s.actionsRow}>
            <TouchableOpacity
              style={s.actionBtnSecondary}
              onPress={() =>
                navigation.navigate("BloqueioLote", {
                  produto: {
                    id: l.produtoId,
                    nome: l.produto.descricao,
                    codigoInterno: null,
                    codigoBarras: null,
                    unidade: "UN",
                  },
                  lote: {
                    id: l.id,
                    numeroLote: l.numeroLote,
                    validade: l.validade,
                    status: l.status as any,
                    estoqueAtual: (l.estoqueAtual as any) || [],
                  },
                })
              }
            >
              <MaterialCommunityIcons
                name="shield-lock-outline"
                size={16}
                color={l.status === "DISPONIVEL" ? C.dangerColor : C.successColor}
              />
              <Text
                style={[
                  s.actionBtnText,
                  { color: l.status === "DISPONIVEL" ? C.dangerColor : C.successColor },
                ]}
              >
                {l.status === "DISPONIVEL" ? "Bloquear" : "Desbloquear"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.actionBtnPrimary}
              onPress={() =>
                navigation.navigate("Transferencia", {
                  produto: {
                    id: l.produtoId,
                    nome: l.produto.descricao,
                    codigoInterno: null,
                    codigoBarras: null,
                    unidade: "UN",
                  },
                  lote: {
                    id: l.id,
                    numeroLote: l.numeroLote,
                    validade: l.validade,
                    status: l.status as any,
                    estoqueAtual: (l.estoqueAtual as any) || [],
                  },
                  saldo: (l.estoqueAtual as any)?.[0],
                })
              }
            >
              <MaterialCommunityIcons name="archive-arrow-down-outline" size={16} color="#FFFFFF" />
              <Text style={[s.actionBtnText, { color: "#FFFFFF" }]}>Transferir</Text>
            </TouchableOpacity>
          </View>
        </Surface>
      );
    },
    [navigation]
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.headerBg} />

      {/* ── Header ─── */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerLeftBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Gestão de Lotes</Text>
          <Text style={s.headerSubtitle}>Validades, Quarentena e Transferência</Text>
        </View>
        <TouchableOpacity style={s.headerRightBtn} onPress={onRefresh} disabled={isLoading}>
          <MaterialCommunityIcons name="refresh" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ── Barra Superior de Busca e Filtros ─── */}
      <View style={s.topBar}>
        <View style={s.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={20} color={C.slate500} style={s.searchIcon} />
          <TextInput
            style={s.searchInput}
            placeholder="Buscar por lote, produto ou fabricante..."
            placeholderTextColor={C.slate500}
            value={busca}
            onChangeText={setBusca}
            autoCapitalize="none"
          />
          {busca.length > 0 && (
            <TouchableOpacity onPress={() => setBusca("")} style={{ padding: 4 }}>
              <MaterialCommunityIcons name="close" size={16} color={C.slate500} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filtros em Pill */}
        <View style={s.filterRow}>
          {(["TODOS", "DISPONIVEL", "BLOQUEADO", "QUARENTENA", "VENCIDO"] as const).map((st) => (
            <TouchableOpacity
              key={st}
              style={[s.filterPill, filtroStatus === st && s.filterPillActive]}
              onPress={() => setFiltroStatus(st)}
            >
              <Text style={[s.filterPillText, filtroStatus === st && s.filterPillTextActive]}>
                {st === "TODOS" ? "Todos" : st === "DISPONIVEL" ? "Disponível" : st === "BLOQUEADO" ? "Bloqueado" : st === "QUARENTENA" ? "Quarentena" : "Vencido"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Lista Virtualizada de Lotes ─── */}
      {isLoading && !refreshing ? (
        <View style={s.centerContainer}>
          <ActivityIndicator size="large" color={C.primaryColor} />
          <Text style={s.loadingText}>Carregando lotes...</Text>
        </View>
      ) : error && lotes.length === 0 ? (
        <View style={s.centerContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={44} color={C.dangerColor} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={onRefresh}>
            <Text style={s.retryText}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primaryColor]} />}
          ListHeaderComponent={
            <View style={s.listHeader}>
              <Text style={s.listHeaderTitle}>LOTES ENCONTRADOS</Text>
              <Badge style={{ backgroundColor: C.slate700, fontWeight: "700" }}>{filtrados.length}</Badge>
            </View>
          }
          ListEmptyComponent={
            <Surface style={s.emptyContainer} elevation={0}>
              <MaterialCommunityIcons name="tag-multiple-outline" size={44} color={C.slate500} />
              <Text style={s.emptyText}>Nenhum lote correspondente.</Text>
            </Surface>
          }
        />
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
  headerLeftBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerRightBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 11, color: "rgba(255, 255, 255, 0.8)", marginTop: 1 },

  topBar: {
    backgroundColor: C.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 8,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.slate100,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 13, color: C.slate900, paddingVertical: 4 },

  filterRow: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 2,
  },
  filterPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: C.slate100,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterPillActive: {
    backgroundColor: C.primaryColor,
    borderColor: C.primaryColor,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.slate700,
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },

  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  listHeaderTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: C.slate700,
    letterSpacing: 0.5,
  },

  card: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  loteBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.slate100,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
  },
  loteTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: C.slate900,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  productName: {
    fontSize: 14,
    fontWeight: "800",
    color: C.slate900,
    marginBottom: 4,
  },
  validadeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  validadeText: {
    fontSize: 11,
    color: C.slate500,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: C.slate100,
    marginVertical: 10,
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
    backgroundColor: C.slate200,
    height: 20,
  },
  stockLabel: {
    fontSize: 9,
    color: C.slate500,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  stockValue: {
    fontSize: 15,
    fontWeight: "800",
  },

  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
    gap: 4,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: C.primaryColor,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },

  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: { marginTop: 12, fontSize: 13, color: C.slate500, fontWeight: "600" },
  errorText: { fontSize: 13, color: C.dangerColor, textAlign: "center", marginTop: 8 },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: C.primaryColor, borderRadius: 8, marginTop: 12 },
  retryText: { color: C.white, fontWeight: "700", fontSize: 13 },
  emptyContainer: { backgroundColor: C.white, borderRadius: 12, padding: 32, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  emptyText: { fontSize: 13, color: C.slate500, marginTop: 6 },
});

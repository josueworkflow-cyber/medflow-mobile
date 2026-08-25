import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  TextInput,
  Modal,
} from "react-native";
import { Text, Surface, Badge, Divider, Button } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { EstoqueConsultaAPI, Movimentacao, TotaisMovimentacoes } from "../api/estoque-consulta";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Movimentacoes">;

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

export const MovimentacoesScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  // Estados de dados
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [totais, setTotais] = useState<TotaisMovimentacoes | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Filtros rápidos
  const [tipoFiltro, setTipoFiltro] = useState<
    "" | "ENTRADA" | "SAIDA" | "AJUSTE" | "RESERVA" | "BLOQUEIO" | "PERDA" | "TRANSFERENCIA" | "DEVOLUCAO" | "CANCELAMENTO_RESERVA" | "DESBLOQUEIO"
  >("");
  const [periodoFiltro, setPeriodoFiltro] = useState<"hoje" | "7d" | "30d" | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [detalheId, setDetalheId] = useState<number | null>(null);

  // Filtros avançados (Modal)
  const [modalFiltrosAberto, setModalFiltrosAberto] = useState(false);
  const [usuarioFiltro, setUsuarioFiltro] = useState("");
  const [depositoFiltro, setDepositoFiltro] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [filtrosAplicados, setFiltrosAplicados] = useState({ usuario: "", deposito: "", inicio: "", fim: "" });

  const totalFiltrosAvancadosAtivos = useMemo(() => {
    let count = 0;
    if (filtrosAplicados.usuario) count++;
    if (filtrosAplicados.deposito) count++;
    if (filtrosAplicados.inicio) count++;
    if (filtrosAplicados.fim) count++;
    return count;
  }, [filtrosAplicados]);

  const handleRefresh = () => setRefreshTrigger((prev) => prev + 1);

  useEffect(() => {
    let cancelled = false;
    const carregar = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Cálculo de datas pelo período rápido
        let inicioCalculado = filtrosAplicados.inicio;
        let fimCalculado = filtrosAplicados.fim;

        if (!inicioCalculado && periodoFiltro !== "todos") {
          const d = new Date();
          if (periodoFiltro === "hoje") {
            inicioCalculado = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
          } else if (periodoFiltro === "7d") {
            d.setDate(d.getDate() - 7);
            inicioCalculado = d.toISOString();
          } else if (periodoFiltro === "30d") {
            d.setDate(d.getDate() - 30);
            inicioCalculado = d.toISOString();
          }
        }

        const params = {
          ...(tipoFiltro ? { tipo: tipoFiltro } : {}),
          ...(filtrosAplicados.usuario ? { usuario: filtrosAplicados.usuario } : {}),
          ...(filtrosAplicados.deposito ? { localizacao: filtrosAplicados.deposito } : {}),
          ...(inicioCalculado ? { dataInicio: inicioCalculado } : {}),
          ...(fimCalculado ? { dataFim: fimCalculado } : {}),
        };

        const res = await EstoqueConsultaAPI.getMovimentacoes(params);
        if (!cancelled) {
          setMovimentacoes(res.movimentacoes || []);
          setTotais(res.totais || null);
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
  }, [tipoFiltro, periodoFiltro, refreshTrigger, filtrosAplicados]);

  // Filtragem rápida local por texto (busca por descrição ou código)
  const filtrados = useMemo(() => {
    if (!busca.trim()) return movimentacoes;
    const term = busca.toLowerCase();
    return movimentacoes.filter(
      (m) =>
        (m.produto?.descricao || "").toLowerCase().includes(term) ||
        (m.produto?.codigoInterno || "").toLowerCase().includes(term) ||
        (m.lote?.numeroLote || "").toLowerCase().includes(term)
    );
  }, [busca, movimentacoes]);

  const aplicarFiltrosModal = () => {
    setFiltrosAplicados({
      usuario: usuarioFiltro.trim(),
      deposito: depositoFiltro.trim(),
      inicio: dataInicio.trim(),
      fim: dataFim.trim(),
    });
    setModalFiltrosAberto(false);
  };

  const limparFiltrosModal = () => {
    setUsuarioFiltro("");
    setDepositoFiltro("");
    setDataInicio("");
    setDataFim("");
    setFiltrosAplicados({ usuario: "", deposito: "", inicio: "", fim: "" });
    setModalFiltrosAberto(false);
  };

  const getBadgeConfig = (tipo: string) => {
    switch (tipo) {
      case "ENTRADA":
        return { color: C.successColor, bg: "#DCFCE7", label: "ENTRADA", sign: "+" };
      case "SAIDA":
        return { color: C.dangerColor, bg: "#FEE2E2", label: "SAÍDA", sign: "-" };
      case "AJUSTE":
        return { color: C.warningColor, bg: "#FEF3C7", label: "AJUSTE", sign: "~" };
      case "RESERVA":
        return { color: C.purpleColor, bg: "#F3E8FF", label: "RESERVA", sign: "~" };
      case "BLOQUEIO":
        return { color: C.dangerColor, bg: "#FEE2E2", label: "BLOQUEIO", sign: "⊘" };
      case "DESBLOQUEIO":
        return { color: C.successColor, bg: "#DCFCE7", label: "DESBLOQ.", sign: "✓" };
      case "TRANSFERENCIA":
        return { color: C.infoColor, bg: "#DBEAFE", label: "TRANSF.", sign: "⇄" };
      case "DEVOLUCAO":
        return { color: "#059669", bg: "#D1FAE5", label: "DEVOLUÇÃO", sign: "↺" };
      case "PERDA":
        return { color: "#991B1B", bg: "#FEE2E2", label: "PERDA", sign: "✖" };
      case "CANCELAMENTO_RESERVA":
        return { color: C.slate500, bg: C.slate100, label: "CANC. RES.", sign: "↩" };
      default:
        return { color: C.primaryColor, bg: "#FEE2E2", label: tipo, sign: "~" };
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

      {/* ── HEADER ─── */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Movimentações</Text>
          <Text style={s.headerSubtitle}>Entradas, Saídas, Ajustes e Auditoria</Text>
        </View>
        <TouchableOpacity style={s.headerBtn} onPress={handleRefresh} disabled={isLoading}>
          <MaterialCommunityIcons name="refresh" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ── BARRA COMPACTA FIXA DE FILTROS SUPERIORES ─── */}
      <View style={s.compactFilterBar}>
        {/* Linha de Busca + Botão de Filtro Avançado */}
        <View style={s.searchRow}>
          <View style={s.searchContainer}>
            <MaterialCommunityIcons name="magnify" size={20} color={C.slate500} style={s.searchIcon} />
            <TextInput
              style={s.searchInput}
              placeholder="Buscar por produto, código ou lote..."
              placeholderTextColor={C.slate500}
              value={busca}
              onChangeText={setBusca}
            />
            {busca !== "" && (
              <TouchableOpacity onPress={() => setBusca("")} style={{ padding: 4 }}>
                <MaterialCommunityIcons name="close" size={16} color={C.slate500} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[s.filterToggleBtn, totalFiltrosAvancadosAtivos > 0 && s.filterToggleBtnActive]}
            onPress={() => setModalFiltrosAberto(true)}
          >
            <MaterialCommunityIcons
              name="filter-variant"
              size={20}
              color={totalFiltrosAvancadosAtivos > 0 ? "#FFFFFF" : C.slate700}
            />
            {totalFiltrosAvancadosAtivos > 0 && (
              <Badge style={s.filterCountBadge}>{totalFiltrosAvancadosAtivos}</Badge>
            )}
          </TouchableOpacity>
        </View>

        {/* Linha 1: Pills de Tipo */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillsRow}>
          {(
            [
              { id: "", label: "Todos" },
              { id: "ENTRADA", label: "Entradas" },
              { id: "SAIDA", label: "Saídas" },
              { id: "AJUSTE", label: "Ajustes" },
              { id: "RESERVA", label: "Reservas" },
              { id: "TRANSFERENCIA", label: "Transferências" },
              { id: "BLOQUEIO", label: "Bloqueios" },
              { id: "DEVOLUCAO", label: "Devoluções" },
              { id: "PERDA", label: "Perdas" },
            ] as const
          ).map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[s.pill, tipoFiltro === t.id && s.pillActive]}
              onPress={() => setTipoFiltro(t.id)}
            >
              <Text style={[s.pillText, tipoFiltro === t.id && s.pillTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Linha 2: Pills de Período Rápido */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillsRow}>
          {(
            [
              { id: "todos", label: "Todo o histórico" },
              { id: "hoje", label: "Hoje" },
              { id: "7d", label: "Últimos 7 dias" },
              { id: "30d", label: "30 dias" },
            ] as const
          ).map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[s.pillSub, periodoFiltro === p.id && s.pillSubActive]}
              onPress={() => setPeriodoFiltro(p.id)}
            >
              <Text style={[s.pillSubText, periodoFiltro === p.id && s.pillSubTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── CONTEÚDO PRINCIPAL ─── */}
      {isLoading && movimentacoes.length === 0 ? (
        <View style={s.centerContainer}>
          <ActivityIndicator size="large" color={C.primaryColor} />
          <Text style={s.loadingText}>Carregando movimentações...</Text>
        </View>
      ) : error && movimentacoes.length === 0 ? (
        <View style={s.centerContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={44} color={C.dangerColor} />
          <Text style={s.errorText}>{error}</Text>
          <Button mode="contained" onPress={handleRefresh} style={{ backgroundColor: C.primaryColor, marginTop: 10 }}>
            Tentar Novamente
          </Button>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── KPIs Compactos em Carrossel ─── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.kpiScroll}
            contentContainerStyle={s.kpiScrollContent}
          >
            <Surface style={[s.kpiCard, { borderLeftColor: C.successColor }]} elevation={1}>
              <Text style={s.kpiLabel}>Entradas / Mês</Text>
              <Text style={[s.kpiValue, { color: C.successColor }]}>{totais?.entradasMes ?? 0}</Text>
            </Surface>
            <Surface style={[s.kpiCard, { borderLeftColor: C.dangerColor }]} elevation={1}>
              <Text style={s.kpiLabel}>Saídas / Mês</Text>
              <Text style={[s.kpiValue, { color: C.dangerColor }]}>{totais?.saidasMes ?? 0}</Text>
            </Surface>
            <Surface style={[s.kpiCard, { borderLeftColor: C.warningColor }]} elevation={1}>
              <Text style={s.kpiLabel}>Ajustes / Mês</Text>
              <Text style={[s.kpiValue, { color: C.warningColor }]}>{totais?.ajustesMes ?? 0}</Text>
            </Surface>
            <Surface style={[s.kpiCard, { borderLeftColor: C.primaryColor }]} elevation={1}>
              <Text style={s.kpiLabel}>Mov. do Dia</Text>
              <Text style={[s.kpiValue, { color: C.primaryColor }]}>{totais?.movDia ?? 0}</Text>
            </Surface>
          </ScrollView>

          {/* ── Título com Totalizador ─── */}
          <View style={s.listHeaderRow}>
            <Text style={s.listTitle}>REGISTROS ENCONTRADOS</Text>
            <Badge style={{ backgroundColor: C.slate700, fontWeight: "700" }}>{filtrados.length}</Badge>
          </View>

          {/* ── Lista de Movimentações ─── */}
          {filtrados.length === 0 ? (
            <Surface style={s.emptyContainer} elevation={0}>
              <MaterialCommunityIcons name="clipboard-text-search-outline" size={44} color={C.slate500} />
              <Text style={s.emptyTitle}>Nenhuma movimentação no filtro</Text>
              <Text style={s.emptySub}>Ajuste os filtros ou o período acima para visualizar outros registros.</Text>
            </Surface>
          ) : (
            filtrados.map((m) => {
              const badge = getBadgeConfig(m.tipo);
              const isExpanded = detalheId === m.id;

              return (
                <TouchableOpacity
                  key={m.id}
                  activeOpacity={0.85}
                  onPress={() => setDetalheId(isExpanded ? null : m.id)}
                >
                  <Surface style={s.card} elevation={1}>
                    <View style={s.cardHeader}>
                      <View style={[s.badge, { backgroundColor: badge.bg }]}>
                        <Text style={[s.badgeText, { color: badge.color }]}>{badge.label}</Text>
                      </View>
                      <Text style={s.dateText}>{formatData(m.createdAt)}</Text>
                    </View>

                    <Text style={s.productName}>{m.produto?.descricao}</Text>

                    <View style={s.metaRow}>
                      {m.produto?.codigoInterno && (
                        <Text style={s.productCode}>SKU: {m.produto.codigoInterno}</Text>
                      )}
                      {m.lote?.numeroLote && (
                        <Text style={s.loteText}>• Lote: {m.lote.numeroLote}</Text>
                      )}
                    </View>

                    <Divider style={{ marginVertical: 8 }} />

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
                            { color: m.estornado ? C.slate500 : badge.color },
                            m.estornado && s.strikeThrough,
                          ]}
                        >
                          {m.estornado ? "Estornado" : `${badge.sign} ${m.quantidade}`}
                        </Text>
                      </View>
                    </View>

                    {/* Detalhes Expansíveis */}
                    {isExpanded && (
                      <View style={s.expandedBox}>
                        <Divider style={{ marginVertical: 8 }} />
                        {m.saldoAnterior !== null && m.saldoResultante !== null && (
                          <Text style={s.expandedText}>
                            Saldo: <Text style={{ fontWeight: "700" }}>{m.saldoAnterior} → {m.saldoResultante}</Text>
                          </Text>
                        )}
                        <Text style={s.expandedText}>
                          Depósito/Local: <Text style={{ fontWeight: "700" }}>{m.localizacao?.nome || "Geral"}</Text>
                        </Text>
                        {m.origem && (
                          <Text style={s.expandedText}>
                            Origem: <Text style={{ fontWeight: "700" }}>{m.origem}</Text>
                          </Text>
                        )}
                        {m.destino && (
                          <Text style={s.expandedText}>
                            Destino: <Text style={{ fontWeight: "700" }}>{m.destino}</Text>
                          </Text>
                        )}
                        {m.observacao && (
                          <Text style={s.expandedText}>
                            Observação: <Text style={{ fontWeight: "700" }}>{m.observacao}</Text>
                          </Text>
                        )}
                        <Text style={[s.expandedText, { color: C.slate500, marginTop: 4, fontSize: 10 }]}>
                          ID do Registro: #{m.id}
                        </Text>
                      </View>
                    )}
                  </Surface>
                </TouchableOpacity>
              );
            })
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── MODAL DE FILTROS AVANÇADOS ─── */}
      <Modal
        visible={modalFiltrosAberto}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalFiltrosAberto(false)}
      >
        <View style={s.modalOverlay}>
          <Surface style={s.modalContainer} elevation={4}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Filtros Avançados</Text>
                <Text style={s.modalSubtitle}>Refine por operador, depósito ou datas específicas</Text>
              </View>
              <TouchableOpacity onPress={() => setModalFiltrosAberto(false)} style={s.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={22} color={C.slate700} />
              </TouchableOpacity>
            </View>

            <Divider style={{ marginVertical: 12 }} />

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              <Text style={s.inputLabel}>Operador / Usuário:</Text>
              <TextInput
                style={s.modalInput}
                placeholder="Ex: Carlos, Ana..."
                placeholderTextColor={C.slate500}
                value={usuarioFiltro}
                onChangeText={setUsuarioFiltro}
              />

              <Text style={s.inputLabel}>Depósito / Localização:</Text>
              <TextInput
                style={s.modalInput}
                placeholder="Ex: Principal, Quarentena..."
                placeholderTextColor={C.slate500}
                value={depositoFiltro}
                onChangeText={setDepositoFiltro}
              />

              <Text style={s.inputLabel}>Data Inicial (AAAA-MM-DD):</Text>
              <TextInput
                style={s.modalInput}
                placeholder="Ex: 2026-08-01"
                placeholderTextColor={C.slate500}
                value={dataInicio}
                onChangeText={setDataInicio}
              />

              <Text style={s.inputLabel}>Data Final (AAAA-MM-DD):</Text>
              <TextInput
                style={s.modalInput}
                placeholder="Ex: 2026-08-31"
                placeholderTextColor={C.slate500}
                value={dataFim}
                onChangeText={setDataFim}
              />
            </ScrollView>

            <View style={s.modalActions}>
              <Button mode="outlined" onPress={limparFiltrosModal} style={{ flex: 1 }}>
                Limpar
              </Button>
              <Button
                mode="contained"
                onPress={aplicarFiltrosModal}
                style={{ flex: 1, marginLeft: 10, backgroundColor: C.primaryColor }}
              >
                Aplicar
              </Button>
            </View>
          </Surface>
        </View>
      </Modal>
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

  /* Barra Compacta Superior */
  compactFilterBar: {
    backgroundColor: C.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 8,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.slate100,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: C.slate900,
    paddingVertical: 4,
  },
  filterToggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: C.slate100,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  filterToggleBtnActive: {
    backgroundColor: C.primaryColor,
    borderColor: C.primaryColor,
  },
  filterCountBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: C.dangerColor,
    fontSize: 10,
  },

  /* Pills */
  pillsRow: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 2,
  },
  pill: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: C.slate100,
    borderWidth: 1,
    borderColor: C.border,
  },
  pillActive: {
    backgroundColor: C.primaryColor,
    borderColor: C.primaryColor,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.slate700,
  },
  pillTextActive: {
    color: "#FFFFFF",
  },

  pillSub: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.border,
  },
  pillSubActive: {
    backgroundColor: C.slate900,
    borderColor: C.slate900,
  },
  pillSubText: {
    fontSize: 11,
    color: C.slate500,
    fontWeight: "600",
  },
  pillSubTextActive: {
    color: "#FFFFFF",
  },

  /* Scroll */
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  /* KPIs */
  kpiScroll: {
    marginBottom: 14,
    maxHeight: 65,
  },
  kpiScrollContent: {
    gap: 8,
  },
  kpiCard: {
    width: 120,
    backgroundColor: C.white,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderLeftWidth: 3,
    justifyContent: "center",
  },
  kpiLabel: {
    fontSize: 9,
    color: C.slate500,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },

  /* List Header */
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  listTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: C.slate700,
    letterSpacing: 0.5,
  },

  /* Card Movimentação */
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
  dateText: {
    fontSize: 11,
    color: C.slate500,
  },
  productName: {
    fontSize: 14,
    fontWeight: "800",
    color: C.slate900,
  },
  metaRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 2,
  },
  productCode: {
    fontSize: 11,
    color: C.slate500,
  },
  loteText: {
    fontSize: 11,
    color: C.slate500,
    fontWeight: "600",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userCol: {
    flex: 1,
  },
  valueCol: {
    alignItems: "flex-end",
  },
  footerLabel: {
    fontSize: 10,
    color: C.slate500,
    fontWeight: "600",
  },
  footerValue: {
    fontSize: 12,
    fontWeight: "700",
    color: C.slate700,
    marginTop: 1,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: "800",
  },
  strikeThrough: {
    textDecorationLine: "line-through",
  },

  expandedBox: {
    marginTop: 4,
    gap: 2,
  },
  expandedText: {
    fontSize: 11,
    color: C.slate700,
  },

  /* Empty State */
  emptyContainer: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: C.slate900,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: C.slate500,
    textAlign: "center",
    marginTop: 4,
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
  errorText: {
    fontSize: 13,
    color: C.dangerColor,
    textAlign: "center",
    marginTop: 8,
  },

  /* Modal de Filtros */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: C.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: C.slate900,
  },
  modalSubtitle: {
    fontSize: 11,
    color: C.slate500,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: C.slate700,
    marginTop: 10,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: C.slate100,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: C.border,
    fontSize: 13,
    color: C.slate900,
  },
  modalActions: {
    flexDirection: "row",
    marginTop: 16,
  },
});

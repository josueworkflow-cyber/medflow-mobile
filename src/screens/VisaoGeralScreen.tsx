import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { Text, Surface } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { RootStackParamList } from "../types/navigation";
import {
  EstoqueAPI,
  KpisVisaoGeralEstoque,
  ProdutoResumoEstoque,
} from "../api/estoque";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "VisaoGeral">;

const C = {
  headerBg: "#8B0C21",
  bg: "#F0F2F5",
  white: "#FFFFFF",
  slate50: "#F8FAFC",
  slate100: "#F1F5F9",
  slate200: "#E2E8F0",
  slate300: "#CBD5E1",
  slate400: "#94A3B8",
  slate500: "#64748B",
  slate600: "#475569",
  slate700: "#334155",
  slate800: "#1E293B",
  slate900: "#0F172A",
  border: "#E2E8F0",

  primaryColor: "#C41230",
  primaryLight: "#FDE8EB",
  successColor: "#10B981",
  successLight: "#D1FAE5",
  warningColor: "#F59E0B",
  warningLight: "#FEF3C7",
  dangerColor: "#EF4444",
  dangerLight: "#FEE2E2",
  infoColor: "#3B82F6",
  infoLight: "#DBEAFE",
  purpleColor: "#8B5CF6",
  purpleLight: "#EDE9FE",
};

function formatMoeda(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

function formatarData(dataIso: string | null): string {
  if (!dataIso) return "—";
  try {
    const d = new Date(dataIso);
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d);
  } catch {
    return dataIso;
  }
}

type StatusFiltro = "TODOS" | "OK" | "CRITICO" | "ESGOTADO";

export const VisaoGeralScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const scrollRef = useRef<ScrollView>(null);

  // Estados de dados
  const [produtos, setProdutos] = useState<ProdutoResumoEstoque[]>([]);
  const [kpis, setKpis] = useState<KpisVisaoGeralEstoque>({
    totalSKUs: 0,
    skusComEstoque: 0,
    totalItens: 0,
    totalDisponivel: 0,
    totalReservado: 0,
    totalIndisponivel: 0,
    criticos: 0,
    esgotados: 0,
    ok: 0,
    lotesVencendo30d: 0,
    valorTotalEstoque: 0,
    categorias: [],
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("TODAS");
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>("TODOS");

  // Paginação
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Expansão de cards de produto
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});

  const toggleExpand = (id: number) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const carregarDados = useCallback(async () => {
    try {
      setError(null);
      const res = await EstoqueAPI.obterVisaoGeral();
      setProdutos(res.produtos || []);
      if (res.kpis) {
        setKpis(res.kpis);
      }
    } catch (err: any) {
      console.error("[VisaoGeralEstoque] Erro ao carregar:", err);
      setError(err?.response?.data?.error || err?.message || "Não foi possível carregar a visão geral do estoque.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void carregarDados();
  }, [carregarDados]);

  // Filtragem dos produtos
  const produtosFiltrados = useMemo(() => {
    return produtos.filter((p) => {
      if (filtroStatus !== "TODOS" && p.status !== filtroStatus) return false;
      if (categoriaFiltro !== "TODAS" && p.categoria !== categoriaFiltro) return false;
      if (busca.trim()) {
        const t = busca.toLowerCase();
        const matchDesc = p.descricao.toLowerCase().includes(t);
        const matchCod = (p.codigoInterno || "").toLowerCase().includes(t);
        const matchCat = p.categoria.toLowerCase().includes(t);
        const matchFab = (p.fabricante || "").toLowerCase().includes(t);
        const matchEan = (p.codigoBarras || "").toLowerCase().includes(t);
        if (!matchDesc && !matchCod && !matchCat && !matchFab && !matchEan) return false;
      }
      return true;
    });
  }, [produtos, filtroStatus, categoriaFiltro, busca]);

  const totalPages = Math.max(1, Math.ceil(produtosFiltrados.length / pageSize));

  const produtosPaginados = useMemo(() => {
    const start = (page - 1) * pageSize;
    return produtosFiltrados.slice(start, start + pageSize);
  }, [produtosFiltrados, page, pageSize]);

  const mudarPagina = (novaPagina: number) => {
    if (novaPagina >= 1 && novaPagina <= totalPages) {
      setPage(novaPagina);
      scrollRef.current?.scrollTo({ y: 380, animated: true });
    }
  };

  const hasActiveFilters = busca !== "" || categoriaFiltro !== "TODAS" || filtroStatus !== "TODOS";

  const clearFilters = () => {
    setBusca("");
    setCategoriaFiltro("TODAS");
    setFiltroStatus("TODOS");
    setPage(1);
  };

  const handleBuscaChange = (text: string) => {
    setBusca(text);
    setPage(1);
  };

  const handleCategoriaChange = (cat: string) => {
    setCategoriaFiltro(cat);
    setPage(1);
  };

  const handleStatusChange = (st: StatusFiltro) => {
    setFiltroStatus(st);
    setPage(1);
  };

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <View style={s.headerBadge}>
            <MaterialCommunityIcons name="package-variant-closed" size={12} color="#FFD1D8" />
            <Text style={s.headerBadgeText}>SETOR DE ESTOQUE</Text>
          </View>
          <Text style={s.headerTitle}>Visão Geral do Estoque</Text>
        </View>

        <TouchableOpacity style={s.headerBtn} onPress={onRefresh}>
          <MaterialCommunityIcons name="refresh" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.centerLoading}>
          <ActivityIndicator size="large" color={C.primaryColor} />
          <Text style={s.loadingText}>Carregando inventário de estoque...</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primaryColor]} />
          }
        >
          {error && (
            <Surface style={s.errorCard} elevation={1}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={C.dangerColor} />
              <Text style={s.errorCardText}>{error}</Text>
            </Surface>
          )}

          <Text style={s.sectionTitle}>INDICADORES ESTRATÉGICOS</Text>
          <View style={s.kpiGrid}>
            <Surface style={[s.kpiCard, { borderLeftColor: C.warningColor }]} elevation={1}>
              <View style={s.kpiCardHeader}>
                <Text style={s.kpiCardLabel}>SKUs Ativos</Text>
                <View style={[s.kpiIconBox, { backgroundColor: C.warningLight }]}>
                  <MaterialCommunityIcons name="package-variant-closed" size={18} color={C.warningColor} />
                </View>
              </View>
              <Text style={s.kpiCardValue}>{kpis.totalSKUs}</Text>
              <Text style={s.kpiMetaText}>{kpis.skusComEstoque} com saldo</Text>
            </Surface>

            <Surface style={[s.kpiCard, { borderLeftColor: C.infoColor }]} elevation={1}>
              <View style={s.kpiCardHeader}>
                <Text style={s.kpiCardLabel}>Total Itens</Text>
                <View style={[s.kpiIconBox, { backgroundColor: C.infoLight }]}>
                  <MaterialCommunityIcons name="archive-outline" size={18} color={C.infoColor} />
                </View>
              </View>
              <Text style={s.kpiCardValue}>{kpis.totalItens.toLocaleString("pt-BR")}</Text>
              <Text style={s.kpiMetaText}>
                {kpis.totalDisponivel.toLocaleString("pt-BR")} disp. | {kpis.totalReservado} res.
              </Text>
            </Surface>

            <Surface style={[s.kpiCard, { borderLeftColor: C.successColor }]} elevation={1}>
              <View style={s.kpiCardHeader}>
                <Text style={s.kpiCardLabel}>Valor Total (R$)</Text>
                <View style={[s.kpiIconBox, { backgroundColor: C.successLight }]}>
                  <MaterialCommunityIcons name="currency-usd" size={18} color={C.successColor} />
                </View>
              </View>
              <Text style={[s.kpiCardValue, { color: C.successColor }]}>{formatMoeda(kpis.valorTotalEstoque)}</Text>
              <Text style={s.kpiMetaText}>Custo estimado</Text>
            </Surface>

            <Surface style={[s.kpiCard, { borderLeftColor: C.dangerColor }]} elevation={1}>
              <View style={s.kpiCardHeader}>
                <Text style={s.kpiCardLabel}>Críticos</Text>
                <View style={[s.kpiIconBox, { backgroundColor: C.dangerLight }]}>
                  <MaterialCommunityIcons name="alert-outline" size={18} color={C.dangerColor} />
                </View>
              </View>
              <Text style={[s.kpiCardValue, { color: C.dangerColor }]}>{kpis.criticos}</Text>
              <Text style={s.kpiMetaText}>Abaixo do mínimo</Text>
            </Surface>

            <Surface style={[s.kpiCard, { borderLeftColor: C.slate500 }]} elevation={1}>
              <View style={s.kpiCardHeader}>
                <Text style={s.kpiCardLabel}>Esgotados</Text>
                <View style={[s.kpiIconBox, { backgroundColor: C.slate200 }]}>
                  <MaterialCommunityIcons name="close-circle-outline" size={18} color={C.slate500} />
                </View>
              </View>
              <Text style={[s.kpiCardValue, { color: C.slate700 }]}>{kpis.esgotados}</Text>
              <Text style={s.kpiMetaText}>Saldo zerado</Text>
            </Surface>

            <Surface style={[s.kpiCard, { borderLeftColor: "#D97706" }]} elevation={1}>
              <View style={s.kpiCardHeader}>
                <Text style={s.kpiCardLabel}>Vencendo (30d)</Text>
                <View style={[s.kpiIconBox, { backgroundColor: "#FEF3C7" }]}>
                  <MaterialCommunityIcons name="calendar-alert" size={18} color="#D97706" />
                </View>
              </View>
              <Text style={[s.kpiCardValue, { color: "#D97706" }]}>{kpis.lotesVencendo30d}</Text>
              <Text style={s.kpiMetaText}>Lotes em risco</Text>
            </Surface>
          </View>

          <Surface style={s.filterContainer} elevation={1}>
            <View style={s.searchBar}>
              <MaterialCommunityIcons name="magnify" size={20} color={C.slate500} style={{ marginRight: 6 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Buscar por nome, código, fabricante, EAN..."
                placeholderTextColor={C.slate400}
                value={busca}
                onChangeText={handleBuscaChange}
              />
              {busca.length > 0 && (
                <TouchableOpacity onPress={() => handleBuscaChange("")} style={{ padding: 4 }}>
                  <MaterialCommunityIcons name="close" size={18} color={C.slate500} />
                </TouchableOpacity>
              )}
            </View>

            <View style={s.categoryScrollWrapper}>
              <Text style={s.filterSmallLabel}>CATEGORIA:</Text>
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.categoryChipsRow}
              >
                <TouchableOpacity
                  style={[s.categoryChip, categoriaFiltro === "TODAS" && s.categoryChipActive]}
                  onPress={() => handleCategoriaChange("TODAS")}
                >
                  <Text style={[s.categoryChipText, categoriaFiltro === "TODAS" && s.categoryChipTextActive]}>
                    Todas
                  </Text>
                </TouchableOpacity>
                {kpis.categorias.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[s.categoryChip, categoriaFiltro === cat && s.categoryChipActive]}
                    onPress={() => handleCategoriaChange(cat)}
                  >
                    <Text style={[s.categoryChipText, categoriaFiltro === cat && s.categoryChipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={s.statusTabsRow}>
              {(
                [
                  { id: "TODOS", label: "Todos", count: kpis.totalSKUs },
                  { id: "OK", label: "OK", count: kpis.ok },
                  { id: "CRITICO", label: "Críticos", count: kpis.criticos },
                  { id: "ESGOTADO", label: "Esgotados", count: kpis.esgotados },
                ] as const
              ).map((tab) => {
                const isActive = filtroStatus === tab.id;
                let activeColor = C.primaryColor;
                if (tab.id === "OK") activeColor = C.successColor;
                if (tab.id === "CRITICO") activeColor = C.dangerColor;
                if (tab.id === "ESGOTADO") activeColor = C.slate600;

                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[s.statusTab, isActive && { backgroundColor: activeColor, borderColor: activeColor }]}
                    onPress={() => handleStatusChange(tab.id)}
                  >
                    <Text style={[s.statusTabLabel, isActive && { color: C.white }]}>{tab.label}</Text>
                    <View style={[s.statusTabBadge, isActive ? { backgroundColor: "rgba(255,255,255,0.25)" } : {}]}>
                      <Text style={[s.statusTabBadgeText, isActive && { color: C.white }]}>{tab.count}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {hasActiveFilters && (
              <TouchableOpacity style={s.clearFiltersBtn} onPress={clearFilters}>
                <MaterialCommunityIcons name="filter-remove-outline" size={16} color={C.primaryColor} />
                <Text style={s.clearFiltersText}>Limpar Filtros Ativos</Text>
              </TouchableOpacity>
            )}
          </Surface>

          <View style={s.listHeaderRow}>
            <View>
              <Text style={s.sectionTitle}>
                PRODUTOS ({produtosFiltrados.length})
              </Text>
              <Text style={s.pageIndicatorSub}>
                Página {page} de {totalPages} • Exibindo {produtosPaginados.length} de {produtosFiltrados.length}
              </Text>
            </View>

            <View style={s.pageSizeSelector}>
              {[15, 25, 50].map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[s.pageSizeBtn, pageSize === size && s.pageSizeBtnActive]}
                  onPress={() => {
                    setPageSize(size);
                    setPage(1);
                  }}
                >
                  <Text style={[s.pageSizeBtnText, pageSize === size && s.pageSizeBtnTextActive]}>
                    {size}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {produtosFiltrados.length === 0 ? (
            <Surface style={s.emptyCard} elevation={1}>
              <MaterialCommunityIcons name="package-variant" size={42} color={C.slate300} />
              <Text style={s.emptyTitle}>Nenhum produto encontrado</Text>
              <Text style={s.emptySubtitle}>Tente ajustar seus termos de busca ou filtros de status/categoria.</Text>
              {hasActiveFilters && (
                <TouchableOpacity style={s.emptyClearBtn} onPress={clearFilters}>
                  <Text style={s.emptyClearBtnText}>Limpar todos os filtros</Text>
                </TouchableOpacity>
              )}
            </Surface>
          ) : (
            produtosPaginados.map((p) => {
              const isExpanded = !!expandedCards[p.id];
              const statusConfig = {
                OK: { label: "Em Estoque (OK)", color: C.successColor, bg: C.successLight },
                CRITICO: { label: "Estoque Crítico", color: C.dangerColor, bg: C.dangerLight },
                ESGOTADO: { label: "Esgotado", color: C.slate600, bg: C.slate200 },
              }[p.status];

              return (
                <Surface key={p.id} style={[s.prodCard, { borderLeftColor: statusConfig.color }]} elevation={1}>
                  <TouchableOpacity style={s.prodCardTouch} onPress={() => toggleExpand(p.id)} activeOpacity={0.7}>
                    <View style={s.prodCardTop}>
                      <View style={s.codeBadge}>
                        <Text style={s.codeBadgeText}>CÓD: {p.codigoInterno}</Text>
                      </View>
                      <View style={[s.statusPill, { backgroundColor: statusConfig.bg }]}>
                        <Text style={[s.statusPillText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                      </View>
                    </View>

                    <Text style={s.prodDesc}>{p.descricao}</Text>

                    <View style={s.prodMetaRow}>
                      <Text style={s.prodMetaText} numberOfLines={1}>
                        <MaterialCommunityIcons name="office-building" size={12} color={C.slate500} /> {p.fabricante}
                      </Text>
                      <Text style={s.metaDot}>•</Text>
                      <Text style={s.prodMetaText} numberOfLines={1}>{p.categoria}</Text>
                      <Text style={s.metaDot}>•</Text>
                      <Text style={s.prodMetaText}>Unid: {p.unidadeVenda}</Text>
                    </View>

                    <View style={s.stockLevelContainer}>
                      <View style={s.stockLevelHeader}>
                        <Text style={s.stockLevelLabel}>
                          Nível de Estoque: <Text style={s.bold}>{p.percentual}%</Text>
                        </Text>
                        <Text style={s.stockLevelMeta}>
                          {p.hasEstoqueMinimo ? `Mín: ${p.estoqueMinimo} ${p.unidadeVenda}` : "Sem mín. definido"}
                        </Text>
                      </View>
                      <View style={s.stockLevelTrack}>
                        <View style={[s.stockLevelFill, { width: `${Math.min(p.percentual, 100)}%`, backgroundColor: statusConfig.color }]} />
                      </View>
                    </View>

                    <View style={s.quickQtyGrid}>
                      <View style={s.quickQtyBox}>
                        <Text style={s.quickQtyLabel}>DISPONÍVEL</Text>
                        <Text style={[s.quickQtyVal, { color: C.successColor }]}>{p.qtdDisponivel}</Text>
                      </View>
                      <View style={s.quickQtyBox}>
                        <Text style={s.quickQtyLabel}>RESERVADO</Text>
                        <Text style={[s.quickQtyVal, { color: C.warningColor }]}>{p.qtdReservada}</Text>
                      </View>
                      <View style={s.quickQtyBox}>
                        <Text style={s.quickQtyLabel}>TOTAL FÍSICO</Text>
                        <Text style={s.quickQtyVal}>{p.qtdTotal}</Text>
                      </View>
                      <View style={s.quickQtyBox}>
                        <Text style={s.quickQtyLabel}>VALOR TOTAL</Text>
                        <Text style={[s.quickQtyVal, { fontSize: 11 }]}>{formatMoeda(p.valorTotal)}</Text>
                      </View>
                    </View>

                    <View style={s.cardFooterRow}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <MaterialCommunityIcons name="layers-outline" size={15} color={C.primaryColor} />
                        <Text style={s.lotesCountText}>
                          {p.lotes.length} {p.lotes.length === 1 ? "lote cadastrado" : "lotes cadastrados"}
                        </Text>
                        {p.lotesVencendoCount > 0 && (
                          <View style={s.vencendoWarningBadge}>
                            <MaterialCommunityIcons name="alert" size={12} color={C.dangerColor} />
                            <Text style={s.vencendoWarningText}>{p.lotesVencendoCount} a vencer</Text>
                          </View>
                        )}
                      </View>
                      <MaterialCommunityIcons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={C.slate600} />
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={s.expandedArea}>
                      <View style={s.techDetailsBox}>
                        <Text style={s.techDetailsTitle}>INFORMAÇÕES ADICIONAIS</Text>
                        <View style={s.techGrid}>
                          <View style={s.techRow}>
                            <Text style={s.techLabel}>Código de Barras:</Text>
                            <Text style={s.techVal}>{p.codigoBarras || "Não informado"}</Text>
                          </View>
                          {p.registroAnvisa && (
                            <View style={s.techRow}>
                              <Text style={s.techLabel}>Reg. ANVISA:</Text>
                              <Text style={s.techVal}>{p.registroAnvisa}</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <Text style={s.lotesSectionTitle}>LOTES EM ESTOQUE ({p.lotes.length})</Text>
                      {p.lotes.length === 0 ? (
                        <View style={s.noLotesBox}>
                          <Text style={s.noLotesText}>Nenhum lote físico com saldo registrado.</Text>
                        </View>
                      ) : (
                        p.lotes.map((lote) => (
                          <View key={lote.id} style={s.loteCard}>
                            <View style={s.loteHeader}>
                              <View style={s.loteNumberBadge}>
                                <MaterialCommunityIcons name="barcode" size={14} color={C.slate700} />
                                <Text style={s.loteNumberText}>Lote: {lote.numeroLote}</Text>
                              </View>
                              <View style={[s.loteValidadeBadge, lote.isVencido ? s.badgeVencido : lote.isVencendo30d ? s.badgeVencendo : s.badgeOk]}>
                                <MaterialCommunityIcons name={lote.isVencido || lote.isVencendo30d ? "alert-circle" : "calendar-check"} size={12} color={lote.isVencido ? C.dangerColor : lote.isVencendo30d ? "#D97706" : C.successColor} />
                                <Text style={[s.loteValidadeText, { color: lote.isVencido ? C.dangerColor : lote.isVencendo30d ? "#D97706" : C.successColor }]}>
                                  Val: {formatarData(lote.validade)}
                                </Text>
                              </View>
                            </View>
                            <View style={s.loteBody}>
                              <Text style={s.loteEndereco}><MaterialCommunityIcons name="map-marker-outline" size={13} color={C.slate500} /> {lote.endereco}</Text>
                              <View style={s.loteSaldosRow}>
                                <Text style={s.loteSaldoItem}>Disp: <Text style={[s.bold, { color: C.successColor }]}>{lote.qtdDisponivel}</Text></Text>
                                <Text style={s.metaDot}>•</Text>
                                <Text style={s.loteSaldoItem}>Res: <Text style={[s.bold, { color: C.warningColor }]}>{lote.qtdReservada}</Text></Text>
                              </View>
                            </View>
                          </View>
                        ))
                      )}

                      <TouchableOpacity
                        style={s.viewFullProdBtn}
                        onPress={() => navigation.navigate("ProdutoDetalhe", { produto: { id: p.id, nome: p.descricao, codigoInterno: p.codigoInterno, codigoBarras: p.codigoBarras, unidade: p.unidadeVenda } })}
                      >
                        <MaterialCommunityIcons name="information-outline" size={16} color="#FFFFFF" />
                        <Text style={s.viewFullProdBtnText}>Ver Ficha Completa do Produto</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </Surface>
              );
            })
          )}

          {produtosFiltrados.length > 0 && (
            <Surface style={s.paginationBar} elevation={1}>
              <TouchableOpacity
                style={[s.pageBtn, page === 1 && s.pageBtnDisabled]}
                onPress={() => mudarPagina(page - 1)}
                disabled={page === 1}
              >
                <MaterialCommunityIcons name="chevron-left" size={18} color={page === 1 ? C.slate300 : C.slate700} />
                <Text style={[s.pageBtnText, page === 1 && s.pageBtnTextDisabled]}>Anterior</Text>
              </TouchableOpacity>
              <View style={s.pageInfoBox}>
                <Text style={s.pageInfoText}>Página <Text style={s.bold}>{page}</Text> de <Text style={s.bold}>{totalPages}</Text></Text>
              </View>
              <TouchableOpacity
                style={[s.pageBtn, page === totalPages && s.pageBtnDisabled]}
                onPress={() => mudarPagina(page + 1)}
                disabled={page === totalPages}
              >
                <Text style={[s.pageBtnText, page === totalPages && s.pageBtnTextDisabled]}>Próxima</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color={page === totalPages ? C.slate300 : C.slate700} />
              </TouchableOpacity>
            </Surface>
          )}
          <View style={{ height: 36 }} />
        </ScrollView>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.headerBg, paddingTop: Platform.OS === "android" ? 44 : 54, paddingBottom: 16, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerBtn: { width: 38, height: 38, borderRadius: 8, backgroundColor: "rgba(255, 255, 255, 0.15)", alignItems: "center", justifyContent: "center" },
  headerCenter: { alignItems: "center" },
  headerBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255, 255, 255, 0.12)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginBottom: 3 },
  headerBadgeText: { color: "#FFD1D8", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  headerTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", letterSpacing: 0.3 },
  centerLoading: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { marginTop: 12, fontSize: 13, color: C.slate500, fontWeight: "600" },
  errorCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 12, padding: 12, marginBottom: 16 },
  errorCardText: { flex: 1, fontSize: 12, color: C.dangerColor, fontWeight: "600" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  sectionTitle: { fontSize: 11, fontWeight: "800", color: C.slate500, letterSpacing: 0.8, marginBottom: 10 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  kpiCard: { width: "48.4%", backgroundColor: C.white, borderRadius: 12, padding: 12, borderLeftWidth: 4, borderWidth: 1, borderColor: C.border },
  kpiCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  kpiCardLabel: { fontSize: 11, fontWeight: "700", color: C.slate500, flex: 1, paddingRight: 4 },
  kpiIconBox: { width: 28, height: 28, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  kpiCardValue: { fontSize: 17, fontWeight: "900", color: C.slate900, letterSpacing: -0.3 },
  kpiMetaText: { fontSize: 10, color: C.slate500, fontWeight: "600", marginTop: 4 },
  filterContainer: { backgroundColor: C.white, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 16, gap: 10 },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: C.slate50, borderRadius: 8, paddingHorizontal: 10, height: 40, borderWidth: 1, borderColor: C.slate200 },
  searchInput: { flex: 1, fontSize: 12, color: C.slate800 },
  categoryScrollWrapper: { gap: 4 },
  filterSmallLabel: { fontSize: 9.5, fontWeight: "800", color: C.slate400, letterSpacing: 0.5 },
  categoryChipsRow: { flexDirection: "row", gap: 6, paddingVertical: 2 },
  categoryChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: C.slate100, borderWidth: 1, borderColor: C.slate200 },
  categoryChipActive: { backgroundColor: C.primaryColor, borderColor: C.primaryColor },
  categoryChipText: { fontSize: 11, fontWeight: "700", color: C.slate600 },
  categoryChipTextActive: { color: C.white },
  statusTabsRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  statusTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 6, borderRadius: 8, backgroundColor: C.slate100, borderWidth: 1, borderColor: C.slate200 },
  statusTabLabel: { fontSize: 10.5, fontWeight: "800", color: C.slate700 },
  statusTabBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8, backgroundColor: C.slate200 },
  statusTabBadgeText: { fontSize: 9, fontWeight: "900", color: C.slate700 },
  clearFiltersBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.slate100, marginTop: 2 },
  clearFiltersText: { fontSize: 11, fontWeight: "700", color: C.primaryColor },
  listHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 },
  pageIndicatorSub: { fontSize: 10.5, color: C.slate500, fontWeight: "600", marginTop: -4 },
  pageSizeSelector: { flexDirection: "row", gap: 4, backgroundColor: C.slate100, padding: 2, borderRadius: 8, borderWidth: 1, borderColor: C.slate200 },
  pageSizeBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pageSizeBtnActive: { backgroundColor: C.white, elevation: 1 },
  pageSizeBtnText: { fontSize: 10.5, fontWeight: "700", color: C.slate500 },
  pageSizeBtnTextActive: { color: C.slate900, fontWeight: "900" },
  emptyCard: { backgroundColor: C.white, borderRadius: 14, padding: 28, alignItems: "center", borderWidth: 1, borderColor: C.border, marginTop: 8 },
  emptyTitle: { fontSize: 14, fontWeight: "800", color: C.slate800, marginTop: 10 },
  emptySubtitle: { fontSize: 11, color: C.slate500, textAlign: "center", marginTop: 4 },
  emptyClearBtn: { marginTop: 14, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: C.slate100, borderWidth: 1, borderColor: C.slate200 },
  emptyClearBtnText: { fontSize: 11, fontWeight: "700", color: C.slate700 },
  prodCard: { backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 12, borderLeftWidth: 4, borderWidth: 1, borderColor: C.border },
  prodCardTouch: { margin: -14, padding: 14 },
  prodCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  codeBadge: { backgroundColor: C.slate100, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: C.slate200 },
  codeBadgeText: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 10.5, fontWeight: "800", color: C.slate700 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 6 },
  statusPillText: { fontSize: 10, fontWeight: "800" },
  prodDesc: { fontSize: 14, fontWeight: "800", color: C.slate900, lineHeight: 18, marginBottom: 4 },
  prodMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 10 },
  prodMetaText: { fontSize: 10.5, color: C.slate500, fontWeight: "600" },
  metaDot: { fontSize: 10, color: C.slate300 },
  stockLevelContainer: { backgroundColor: C.slate50, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: C.slate200, marginBottom: 10 },
  stockLevelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  stockLevelLabel: { fontSize: 10, color: C.slate600 },
  stockLevelMeta: { fontSize: 10, color: C.slate500, fontWeight: "600" },
  stockLevelTrack: { height: 6, backgroundColor: C.slate200, borderRadius: 3, overflow: "hidden" },
  stockLevelFill: { height: "100%", borderRadius: 3 },
  quickQtyGrid: { flexDirection: "row", backgroundColor: C.slate50, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: C.slate200, marginBottom: 10 },
  quickQtyBox: { flex: 1, alignItems: "center" },
  quickQtyLabel: { fontSize: 8.5, fontWeight: "800", color: C.slate400, letterSpacing: 0.3, marginBottom: 2 },
  quickQtyVal: { fontSize: 13, fontWeight: "900", color: C.slate900 },
  cardFooterRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lotesCountText: { fontSize: 11, fontWeight: "700", color: C.slate700 },
  vencendoWarningBadge: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#FEE2E2", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, marginLeft: 4 },
  vencendoWarningText: { fontSize: 9.5, fontWeight: "800", color: C.dangerColor },
  expandedArea: { marginTop: 12, borderTopWidth: 1, borderTopColor: C.slate100, paddingTop: 12, gap: 10 },
  techDetailsBox: { backgroundColor: C.slate50, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.slate200 },
  techDetailsTitle: { fontSize: 9.5, fontWeight: "800", color: C.slate500, letterSpacing: 0.5, marginBottom: 6 },
  techGrid: { gap: 4 },
  techRow: { flexDirection: "row", justifyContent: "space-between" },
  techLabel: { fontSize: 10.5, color: C.slate500, fontWeight: "600" },
  techVal: { fontSize: 10.5, color: C.slate800, fontWeight: "700" },
  lotesSectionTitle: { fontSize: 10, fontWeight: "800", color: C.slate600, letterSpacing: 0.5 },
  noLotesBox: { padding: 12, backgroundColor: C.slate50, borderRadius: 8, alignItems: "center", borderWidth: 1, borderStyle: "dashed", borderColor: C.slate300 },
  noLotesText: { fontSize: 11, color: C.slate500, fontStyle: "italic" },
  loteCard: { backgroundColor: C.slate50, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.slate200 },
  loteHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  loteNumberBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  loteNumberText: { fontSize: 11.5, fontWeight: "800", color: C.slate800 },
  loteValidadeBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeOk: { backgroundColor: C.successLight },
  badgeVencendo: { backgroundColor: "#FEF3C7" },
  badgeVencido: { backgroundColor: C.dangerLight },
  loteValidadeText: { fontSize: 10, fontWeight: "800" },
  loteBody: { gap: 4 },
  loteEndereco: { fontSize: 10.5, color: C.slate600, fontWeight: "600" },
  loteSaldosRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4, marginTop: 2 },
  loteSaldoItem: { fontSize: 10.5, color: C.slate600 },
  viewFullProdBtn: { backgroundColor: C.primaryColor, borderRadius: 8, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 },
  viewFullProdBtnText: { color: C.white, fontSize: 11.5, fontWeight: "800" },
  bold: { fontWeight: "800" },
  paginationBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.white, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: C.border, marginTop: 8 },
  pageBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: C.slate100, borderWidth: 1, borderColor: C.slate200 },
  pageBtnDisabled: { opacity: 0.45, backgroundColor: C.slate50 },
  pageBtnText: { fontSize: 11, fontWeight: "800", color: C.slate700 },
  pageBtnTextDisabled: { color: C.slate400 },
  pageInfoBox: { alignItems: "center" },
  pageInfoText: { fontSize: 11, color: C.slate600 },
});

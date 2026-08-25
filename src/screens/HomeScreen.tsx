import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Alert,
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  Animated,
  RefreshControl,
  Modal,
  Image,
  TextInput,
} from "react-native";
import { Text, Surface } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../hooks/useAuth";
import { RootStackParamList } from "../types/navigation";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { DashboardAPI, DashboardData } from "../api/dashboard";
import {
  AcaoTransicaoEstoque,
  EstoqueConsultaAPI,
  KpisEstoque,
  PedidoEstoque,
} from "../api/estoque-consulta";
import { DisponibilidadeEstoqueModal } from "../components/DisponibilidadeEstoqueModal";
import { ConfirmarFaltaEstoqueModal } from "../components/ConfirmarFaltaEstoqueModal";
import {
  AbaFunilEstoque,
  FILAS_ESTOQUE,
  PENDENCIA_STATUS_LABEL,
  enxugarFraseMotivo,
  formatarNomeCliente,
  obterEtapaPedido,
  obterMotivoPedido,
} from "../utils/funil-pedidos";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Home">;

const DRAWER_WIDTH = 280;

const C = {
  headerBg: "#8B0C21",
  bg: "#F0F2F5",
  white: "#FFFFFF",
  textDark: "#1E293B",
  textGray: "#6B7280",
  chevron: "#C5CAD0",
  border: "#E5E7EB",
  slate700: "#334155",
  slate900: "#0F172A",
  
  primaryColor: "#C41230",
  successColor: "#22A85A",
  warningColor: "#F97316",
  dangerColor: "#EF4444",
  infoColor: "#3B82F6",
};

function formatMoeda(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}
const moeda = formatMoeda;

function formatarQuantidade(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);
}

function obterMensagemErro(error: any): string {
  return error?.response?.data?.error || error?.message || "Não foi possível atualizar o pedido.";
}

export const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { signOut, state } = useAuth();

  // Estados de dados
  const [metrics, setMetrics] = useState<DashboardData | null>(null);
  const [kpisEstoque, setKpisEstoque] = useState<KpisEstoque | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Filas de trabalho do estoque
  const [abaFunil, setAbaFunil] = useState<AbaFunilEstoque>("validacao_estoque");
  const [buscaPedido, setBuscaPedido] = useState("");
  const [pedidosTodos, setPedidosTodos] = useState<PedidoEstoque[]>([]);
  const [loadingFunil, setLoadingFunil] = useState(false);
  const [loadingTransicao, setLoadingTransicao] = useState<number | null>(null);
  const [erroFunil, setErroFunil] = useState<string | null>(null);
  const [disponibilidadePedido, setDisponibilidadePedido] = useState<PedidoEstoque | null>(null);
  const [faltaPedido, setFaltaPedido] = useState<PedidoEstoque | null>(null);

  const filaAtual = FILAS_ESTOQUE.find(fila => fila.key === abaFunil) || FILAS_ESTOQUE[0];
  const pedidosFunil = useMemo(() => {
    const list = pedidosTodos.filter(pedido => filaAtual.statuses.includes(pedido.status));
    if (!buscaPedido.trim()) return list;
    const term = buscaPedido.toLowerCase();
    return list.filter(p => {
      const num = String(p.numero || p.id).toLowerCase();
      const cli = (p.cliente?.razaoSocial || p.cliente?.nomeFantasia || "").toLowerCase();
      const cnpj = (p.cliente?.cnpjCpf || "").toLowerCase();
      const vend = (p.vendedor?.nome || "").toLowerCase();
      const itens = (p.itens || []).map(i => i.produto?.descricao || "").join(" ").toLowerCase();
      return num.includes(term) || cli.includes(term) || cnpj.includes(term) || vend.includes(term) || itens.includes(term);
    });
  }, [filaAtual, pedidosTodos, buscaPedido]);

  const contagemPorFila = useMemo(
    () => Object.fromEntries(
      FILAS_ESTOQUE.map(fila => [
        fila.key,
        pedidosTodos.filter(pedido => fila.statuses.includes(pedido.status)).length,
      ])
    ) as Record<AbaFunilEstoque, number>,
    [pedidosTodos]
  );

  // Estados para o modal de Conferência/Separação de Itens
  const [conferenciaPedido, setConferenciaPedido] = useState<PedidoEstoque | null>(null);
  const [conferenciaChecks, setConferenciaChecks] = useState<Record<number, Record<number, boolean>>>({});

  const toggleCheckItem = (pedidoId: number, itemId: number) => {
    setConferenciaChecks(prev => {
      const pedidoChecks = prev[pedidoId] || {};
      return {
        ...prev,
        [pedidoId]: {
          ...pedidoChecks,
          [itemId]: !pedidoChecks[itemId],
        },
      };
    });
  };

  const abrirConferencia = (pedido: PedidoEstoque) => {
    setConferenciaPedido(pedido);
  };

  // Estado para controle de expansão de pedidos (acordeão)
  const [expandedPedidos, setExpandedPedidos] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setExpandedPedidos({});
  }, [abaFunil]);

  // Estado do Drawer Menu
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;



  const togglePedidoExpand = (id: number) => {
    setExpandedPedidos(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    let cancelled = false;
    const carregar = async () => {
      if (refreshTrigger === 0) setIsLoading(true);
      setError(null);
      try {
        const [dashRes, prodRes] = await Promise.all([
          DashboardAPI.obterDados(),
          EstoqueConsultaAPI.getProdutosResumo()
        ]);
        if (!cancelled) {
          setMetrics(dashRes);
          setKpisEstoque(prodRes.kpis);
        }
      } catch (err: any) {
        console.error(err);
        if (!cancelled) {
          setError("Erro ao carregar o dashboard. Verifique sua conexão.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setRefreshing(false);
        }
      }
    };

    carregar();
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  // Carrega todas as macroetapas uma única vez para manter contagens e abas coerentes.
  useEffect(() => {
    let cancelled = false;
    const carregarFunil = async () => {
      setLoadingFunil(true);
      setErroFunil(null);
      try {
        const res = await EstoqueConsultaAPI.getPedidosFunil("todos");
        if (!cancelled) {
          setPedidosTodos(res.pedidos);
        }
      } catch (err: any) {
        console.error("Erro ao carregar funil:", err);
        if (!cancelled) {
          setPedidosTodos([]);
          setErroFunil(obterMensagemErro(err));
        }
      } finally {
        if (!cancelled) setLoadingFunil(false);
      }
    };
    carregarFunil();
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  // Controle de animação do Drawer Menu
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isMenuOpen ? 0 : -DRAWER_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isMenuOpen, slideAnim]);

  // Função handleTransicao para transicionar status do pedido
  const handleTransicao = async (
    pedidoId: number,
    acao: AcaoTransicaoEstoque,
    mensagemSucesso = "Pedido atualizado."
  ): Promise<boolean> => {
    setLoadingTransicao(pedidoId);
    try {
      await EstoqueConsultaAPI.transicionarPedido(pedidoId, acao);
      setRefreshTrigger(prev => prev + 1);
      Alert.alert("Operação concluída", mensagemSucesso);
      return true;
    } catch (err: any) {
      console.error("Erro na transição:", err);
      Alert.alert("Não foi possível atualizar", obterMensagemErro(err));
      return false;
    } finally {
      setLoadingTransicao(null);
    }
  };

  const confirmarTransicao = (
    titulo: string,
    mensagem: string,
    pedidoId: number,
    acao: AcaoTransicaoEstoque,
    mensagemSucesso: string
  ) => {
    Alert.alert(titulo, mensagem, [
      { text: "Voltar", style: "cancel" },
      {
        text: "Confirmar",
        onPress: () => { void handleTransicao(pedidoId, acao, mensagemSucesso); },
      },
    ]);
  };

  const finalizarSeparacaoConferida = async (pedido: PedidoEstoque) => {
    const concluido = await handleTransicao(
      pedido.id,
      "finalizar_separacao",
      "Separação conferida. O pedido está pronto para o despacho."
    );
    if (!concluido) return;
    setConferenciaPedido(null);
    setConferenciaChecks(prev => {
      const atualizado = { ...prev };
      delete atualizado[pedido.id];
      return atualizado;
    });
  };

  const confirmarFaltaSelecionada = async () => {
    if (!faltaPedido) return;
    const concluido = await handleTransicao(
      faltaPedido.id,
      "confirmar_falta_estoque",
      "Falta confirmada. Os itens foram encaminhados ao Comercial."
    );
    if (concluido) setFaltaPedido(null);
  };

  const closeMenu = () => setIsMenuOpen(false);
  const openMenu = () => setIsMenuOpen(true);

  // Navegação a partir do menu lateral
  const navigateTo = (screen: keyof RootStackParamList, params?: any) => {
    closeMenu();
    navigation.navigate(screen as any, params);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Cálculo da saúde dos SKUs
  const totalSKUs = kpisEstoque?.totalSKUs || 1;
  const criticosCount = kpisEstoque?.criticos || 0;
  const esgotadosCount = kpisEstoque?.esgotados || 0;
  const okCount = Math.max(0, totalSKUs - criticosCount - esgotadosCount);

  const pctCriticos = (criticosCount / totalSKUs) * 100;
  const pctEsgotados = (esgotadosCount / totalSKUs) * 100;
  const pctOk = (okCount / totalSKUs) * 100;

  // Maior valor do top produtos para referência do gráfico de barra
  const maxQtdVendida = metrics?.topProdutos?.reduce((max, p) => p.qtdVendida > max ? p.qtdVendida : max, 1) || 1;

  // Maior valor de vendas de clientes para referência do gráfico de barra
  const maxVendaCliente = metrics?.vendasPorCliente?.reduce((max, c) => c.totalVendas > max ? c.totalVendas : max, 1) || 1;

  // Detecção de Alertas Críticos de Validade
  const totalVencidos = metrics?.vencidos ?? 0;
  const totalVencendo = metrics?.proximosVencer ?? 0;
  const temAlertaValidade = totalVencidos > 0 || totalVencendo > 0;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.headerBg} />

      {/* ── Header ─── */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <TouchableOpacity style={s.menuBtn} onPress={openMenu}>
            <MaterialCommunityIcons name="menu" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={s.headerCenterLogoContainer}>
            <Image
              source={require("../../assets/logo-sistema.png")}
              style={s.headerCenterLogo}
              resizeMode="contain"
            />
          </View>

          <TouchableOpacity style={s.headerRightBtn} onPress={handleRefresh} disabled={isLoading}>
            <MaterialCommunityIcons name="refresh" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading && !refreshing ? (
        <View style={s.centerContainer}>
          <ActivityIndicator size="large" color={C.primaryColor} />
          <Text style={s.loadingText}>Carregando indicadores...</Text>
        </View>
      ) : error ? (
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
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[C.primaryColor]} />
          }
        >
          {/* ── Seção: Ações Rápidas ─── */}
          <Text style={s.sectionTitle}>AÇÕES RÁPIDAS</Text>
          <View style={s.quickActionsGrid}>
            <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate("Scanner")}>
              <Surface style={s.actionSurface} elevation={1}>
                <View style={[s.actionIconBox, { backgroundColor: "#E8EEF8" }]}>
                  <MaterialCommunityIcons name="barcode-scan" size={22} color={C.primaryColor} />
                </View>
                <Text style={s.actionLabel}>Escanear</Text>
              </Surface>
            </TouchableOpacity>

            <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate("Scanner", { action: "EntradaEstoque" })}>
              <Surface style={s.actionSurface} elevation={1}>
                <View style={[s.actionIconBox, { backgroundColor: "#E6F9ED" }]}>
                  <MaterialCommunityIcons name="tray-arrow-down" size={22} color={C.successColor} />
                </View>
                <Text style={s.actionLabel}>Entrada</Text>
              </Surface>
            </TouchableOpacity>

            <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate("Scanner", { action: "AjusteInventario" })}>
              <Surface style={s.actionSurface} elevation={1}>
                <View style={[s.actionIconBox, { backgroundColor: "#EAE8F8" }]}>
                  <MaterialCommunityIcons name="file-document-edit-outline" size={22} color={C.primaryColor} />
                </View>
                <Text style={s.actionLabel}>Ajustar</Text>
              </Surface>
            </TouchableOpacity>

            <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate("Lotes")}>
              <Surface style={s.actionSurface} elevation={1}>
                <View style={[s.actionIconBox, { backgroundColor: "#E0EFFC" }]}>
                  <MaterialCommunityIcons name="format-list-bulleted" size={22} color={C.infoColor} />
                </View>
                <Text style={s.actionLabel}>Lotes</Text>
              </Surface>
            </TouchableOpacity>
          </View>

          {/* ── Widget: Alertas de Validade (Dinâmico) ─── */}
          {temAlertaValidade && (
            <TouchableOpacity onPress={() => navigation.navigate("Lotes")}>
              <Surface style={[s.alertCard, { borderLeftColor: totalVencidos > 0 ? C.dangerColor : C.warningColor }]} elevation={1}>
                <View style={s.alertRow}>
                  <MaterialCommunityIcons 
                    name={totalVencidos > 0 ? "alert-decagram" : "clock-alert-outline"} 
                    size={28} 
                    color={totalVencidos > 0 ? C.dangerColor : C.warningColor} 
                  />
                  <View style={s.alertContent}>
                    <Text style={s.alertTitle}>Risco de Validade Detectado</Text>
                    <Text style={s.alertSubtitle}>
                      {totalVencidos > 0 && `${totalVencidos} lote(s) vencido(s) `}
                      {totalVencidos > 0 && totalVencendo > 0 && "e "}
                      {totalVencendo > 0 && `${totalVencendo} lote(s) vencendo em 30d.`}
                      {"\n"}Toque para bloquear ou transferir.
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={C.chevron} />
                </View>
              </Surface>
            </TouchableOpacity>
          )}

          {/* ── Seção: trabalho operacional do estoque ─── */}
          <View style={s.pedidosSectionHeader}>
            <View>
              <Text style={s.sectionTitle}>PEDIDOS DE ESTOQUE</Text>
              <Text style={s.sectionSubtitle}>Conferência de saldo, validação, separação e expedição</Text>
            </View>
          </View>

          {/* ── KPIs Interativos de Filas de Estoque ─── */}
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            style={s.funilTabsScroll}
            contentContainerStyle={s.funilTabs}
          >
            {FILAS_ESTOQUE.map(tab => {
              const isActive = abaFunil === tab.key;
              const count = contagemPorFila[tab.key] || 0;
              let iconName = "clipboard-text-outline";
              let tabColor = C.primaryColor;

              if (tab.key === "validacao_estoque") {
                iconName = "alert-circle-outline";
                tabColor = "#B45309";
              } else if (tab.key === "separacao") {
                iconName = "package-variant-closed";
                tabColor = "#C41230";
              } else if (tab.key === "despacho_rota") {
                iconName = "truck-fast-outline";
                tabColor = "#0369A1";
              } else if (tab.key === "acompanhamento") {
                iconName = "clock-alert-outline";
                tabColor = "#7C3AED";
              } else if (tab.key === "historico") {
                iconName = "history";
                tabColor = "#64748B";
              }

              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    s.queueKpiCard,
                    isActive && { borderColor: tabColor, backgroundColor: "#FFFFFF", elevation: 3 },
                  ]}
                  onPress={() => setAbaFunil(tab.key)}
                  activeOpacity={0.7}
                >
                  <View style={s.queueKpiTop}>
                    <View style={[s.queueKpiIconBox, { backgroundColor: `${tabColor}15` }]}>
                      <MaterialCommunityIcons name={iconName as any} size={18} color={tabColor} />
                    </View>
                    <View style={[s.queueKpiBadge, isActive ? { backgroundColor: tabColor } : { backgroundColor: "#E2E8F0" }]}>
                      <Text style={[s.queueKpiBadgeText, isActive && { color: "#FFFFFF" }]}>{count}</Text>
                    </View>
                  </View>
                  <Text style={[s.queueKpiTitle, isActive && { color: tabColor }]} numberOfLines={1}>
                    {tab.label}
                  </Text>
                  <Text style={s.queueKpiDesc} numberOfLines={2}>
                    {tab.descricao}
                  </Text>
                  {isActive && <View style={[s.queueKpiIndicator, { backgroundColor: tabColor }]} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── Barra de Busca Rápida de Pedidos ─── */}
          <View style={s.pedidoSearchContainer}>
            <MaterialCommunityIcons name="magnify" size={20} color={C.textGray} style={{ marginRight: 8 }} />
            <TextInput
              style={s.pedidoSearchInput}
              placeholder="Buscar por nº pedido, cliente, CNPJ, produto..."
              placeholderTextColor={C.textGray}
              value={buscaPedido}
              onChangeText={setBuscaPedido}
            />
            {buscaPedido.length > 0 && (
              <TouchableOpacity onPress={() => setBuscaPedido("")} style={{ padding: 4 }}>
                <MaterialCommunityIcons name="close" size={18} color={C.textGray} />
              </TouchableOpacity>
            )}
          </View>

          {buscaPedido.trim().length > 0 && (
            <View style={s.searchResultInfo}>
              <Text style={s.searchResultText}>
                Exibindo {pedidosFunil.length} resultado(s) para "{buscaPedido}"
              </Text>
            </View>
          )}

          {erroFunil && (
            <TouchableOpacity style={s.funilError} onPress={handleRefresh}>
              <MaterialCommunityIcons name="wifi-alert" size={20} color={C.dangerColor} />
              <View style={{ flex: 1 }}>
                <Text style={s.funilErrorTitle}>Não foi possível carregar os pedidos</Text>
                <Text style={s.funilErrorText}>{erroFunil} Toque para tentar novamente.</Text>
              </View>
            </TouchableOpacity>
          )}

          {loadingFunil ? (
            <View style={s.funilLoading}>
              <ActivityIndicator size="small" color={C.primaryColor} />
            </View>
          ) : pedidosFunil.length === 0 ? (
            <View style={s.funilEmpty}>
              <MaterialCommunityIcons name="clipboard-check-outline" size={36} color="#94A3B8" />
              <Text style={s.funilEmptyTitle}>Nenhum pedido nesta fila</Text>
              <Text style={s.funilEmptyText}>
                {buscaPedido ? "Tente ajustar o termo pesquisado." : "Todos os pedidos desta etapa foram processados."}
              </Text>
            </View>
          ) : (
            pedidosFunil.map(pedido => {
              const isExpanded = !!expandedPedidos[pedido.id];
              const etapa = obterEtapaPedido(pedido);
              const motivoAtual = obterMotivoPedido(pedido);
              const pendenciasAtivas = pedido.pendenciasEstoque.filter(
                pendencia => !["RESOLVIDA", "CANCELADA"].includes(pendencia.status)
              );
              const podeVerSaldos = true;
              const podeReverificar = [
                "AGUARDANDO_ESTOQUE_ASSUMIR",
                "FALTA_PRODUTO",
                "AGUARDANDO_ENTRADA",
              ].includes(pedido.motivoStatus || "");
              const podeConfirmarFalta = pedido.status === "EM_SEPARACAO";
              const podeIniciarSeparacao =
                pedido.status === "APROVADO" &&
                pedido.motivoStatus === "AGUARDANDO_ESTOQUE_ASSUMIR";
              const podeConferirSeparacao =
                pedido.status === "EM_SEPARACAO" &&
                pedido.motivoStatus === "CONFERINDO_ITENS";
              const podeDespachar = pedido.status === "EXPEDICAO";
              const podeFinalizar = pedido.status === "EM_ROTA";
              const possuiAcao = podeVerSaldos || podeReverificar || podeConfirmarFalta ||
                podeIniciarSeparacao || podeConferirSeparacao || podeDespachar || podeFinalizar;

              // Timeline states
              const isComercialDone = pedido.status !== "APROVADO";
              const isFinanceiroDone = ["EXPEDICAO", "EM_ROTA", "FINALIZADO"].includes(pedido.status);
              const isFinanceiroActive = ["FATURAMENTO", "AGUARDANDO_FINANCEIRO"].includes(pedido.status);
              const isEstoqueDone = ["EXPEDICAO", "EM_ROTA", "FINALIZADO"].includes(pedido.status);
              const isEstoqueActive = ["EM_SEPARACAO", "AGUARDANDO_COMPRA", "ENTRADA_MERCADORIA"].includes(pedido.status);

              return (
                <Surface key={pedido.id} style={[s.pedidoCard, { borderLeftColor: etapa.color }]} elevation={2}>
                  <TouchableOpacity
                    style={s.pedidoHeaderTouch}
                    onPress={() => togglePedidoExpand(pedido.id)}
                    activeOpacity={0.7}
                  >
                    {/* Linha 1: Número, Cliente e Badges */}
                    <View style={s.pedidoHeaderTopRow}>
                      <View style={s.pedidoNumeroBox}>
                        <Text style={s.pedidoNumeroMonospace}>#{pedido.numero}</Text>
                      </View>
                      <Text style={s.pedidoClienteName} numberOfLines={1}>
                        {formatarNomeCliente(pedido.cliente)}
                      </Text>
                      <View style={[s.pedidoStatusBadge, { backgroundColor: `${etapa.color}15`, borderColor: `${etapa.color}40` }]}>
                        <Text style={[s.pedidoStatusText, { color: etapa.color }]} numberOfLines={1}>
                          {etapa.label}
                        </Text>
                      </View>
                    </View>

                    {/* Linha 2: Mini-Timeline Horizontal */}
                    <View style={s.timelineContainer}>
                      {/* Etapa Comercial */}
                      <View style={s.timelineStepItem}>
                        <View style={[s.timelineDot, isComercialDone ? s.dotDone : s.dotAlert]}>
                          <MaterialCommunityIcons name={isComercialDone ? "check" : "alert"} size={10} color="#FFFFFF" />
                        </View>
                        <Text style={[s.timelineStepLabel, isComercialDone ? s.labelDone : s.labelAlert]}>Comercial</Text>
                      </View>

                      <View style={[s.timelineConnectingLine, isComercialDone ? s.lineDone : s.linePending]} />

                      {/* Etapa Financeiro */}
                      <View style={s.timelineStepItem}>
                        <View style={[s.timelineDot, isFinanceiroDone ? s.dotDone : isFinanceiroActive ? s.dotActive : s.dotPending]}>
                          {isFinanceiroDone ? (
                            <MaterialCommunityIcons name="check" size={10} color="#FFFFFF" />
                          ) : (
                            <View style={isFinanceiroActive ? s.dotInnerActive : s.dotInnerPending} />
                          )}
                        </View>
                        <Text style={[s.timelineStepLabel, isFinanceiroDone ? s.labelDone : isFinanceiroActive ? s.labelActive : s.labelPending]}>
                          Financeiro
                        </Text>
                      </View>

                      <View style={[s.timelineConnectingLine, isFinanceiroDone ? s.lineDone : s.linePending]} />

                      {/* Etapa Estoque */}
                      <View style={s.timelineStepItem}>
                        <View style={[s.timelineDot, isEstoqueDone ? s.dotDone : isEstoqueActive ? s.dotActive : s.dotPending]}>
                          {isEstoqueDone ? (
                            <MaterialCommunityIcons name="check" size={10} color="#FFFFFF" />
                          ) : (
                            <View style={isEstoqueActive ? s.dotInnerActive : s.dotInnerPending} />
                          )}
                        </View>
                        <Text style={[s.timelineStepLabel, isEstoqueDone ? s.labelDone : isEstoqueActive ? s.labelActive : s.labelPending]}>
                          Estoque
                        </Text>
                      </View>
                    </View>

                    {/* Linha 3: Resumo, Vendedor, Valor e Chevron */}
                    <View style={s.pedidoHeaderFooterRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.pedidoResumoHeader} numberOfLines={1}>
                          {enxugarFraseMotivo(motivoAtual || etapa.contexto || `Status: ${etapa.label}`)}
                        </Text>
                        <View style={s.pedidoMetaInfoRow}>
                          <Text style={s.pedidoMetaText}>
                            {pedido.itens.length} {pedido.itens.length === 1 ? "item" : "itens"}
                          </Text>
                          <Text style={s.pedidoMetaDot}>•</Text>
                          <Text style={s.pedidoMetaText}>
                            {pedido.vendedor?.nome ? `Vend: ${pedido.vendedor.nome.split(" ")[0]}` : "Venda direta"}
                          </Text>
                        </View>
                      </View>
                      <View style={s.expandIconBox}>
                        <MaterialCommunityIcons
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={22}
                          color={C.textDark}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* ── CONTEÚDO EXPANDIDO DO PEDIDO ─── */}
                  {isExpanded && (
                    <View style={s.pedidoExpandedContent}>
                      {/* Card com Detalhes do Cliente e Faturamento */}
                      <View style={s.pedidoClienteCard}>
                        <View style={s.pedidoClienteCardHeader}>
                          <MaterialCommunityIcons name="card-account-details-outline" size={16} color={C.primaryColor} />
                          <Text style={s.pedidoClienteCardTitle}>DADOS DO CLIENTE & EMISSÃO</Text>
                        </View>
                        <View style={s.pedidoClienteGrid}>
                          <View style={s.pedidoClienteGridItem}>
                            <Text style={s.pedidoClienteGridLabel}>Cliente:</Text>
                            <Text style={s.pedidoClienteGridVal} numberOfLines={1}>
                              {pedido.cliente?.razaoSocial || pedido.cliente?.nomeFantasia || "—"}
                            </Text>
                          </View>
                          {pedido.cliente?.cnpjCpf ? (
                            <View style={s.pedidoClienteGridItem}>
                              <Text style={s.pedidoClienteGridLabel}>CNPJ/CPF:</Text>
                              <Text style={s.pedidoClienteGridVal}>{pedido.cliente.cnpjCpf}</Text>
                            </View>
                          ) : null}
                          <View style={s.pedidoClienteGridItem}>
                            <Text style={s.pedidoClienteGridLabel}>Localização:</Text>
                            <Text style={s.pedidoClienteGridVal}>
                              {[pedido.cliente?.cidade, pedido.cliente?.estado].filter(Boolean).join(" - ") || "Não informada"}
                            </Text>
                          </View>
                          <View style={s.pedidoClienteGridItem}>
                            <Text style={s.pedidoClienteGridLabel}>Empresa Fiscal:</Text>
                            <Text style={s.pedidoClienteGridVal}>
                              {pedido.empresaFiscal?.nomeFantasia || pedido.empresaFiscal?.razaoSocial || "Padrão (DAC)"}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Lista de Itens do Pedido */}
                      <View style={s.pedidoItensHeaderRow}>
                        <MaterialCommunityIcons name="format-list-checks" size={16} color={C.slate700} />
                        <Text style={s.pedidoItemsTitle}>ITENS E DISPONIBILIDADE EM ESTOQUE ({pedido.itens.length})</Text>
                      </View>

                      {pedido.itens.length === 0 ? (
                        <View style={s.pedidoSemItensNotice}>
                          <MaterialCommunityIcons name="alert-circle-outline" size={22} color={C.dangerColor} />
                          <View style={{ flex: 1 }}>
                            <Text style={s.pedidoSemItensTitle}>Pedido sem itens vinculados</Text>
                            <Text style={s.pedidoSemItensText}>
                              Nenhum produto associado. Reavalie o estoque ou contate o Comercial.
                            </Text>
                          </View>
                        </View>
                      ) : (
                        pedido.itens.map(item => {
                          const pendenciaItem = pendenciasAtivas.find(p => p.produto.id === item.produto.id);
                          const isInteractive = ["EM_SEPARACAO", "EXPEDICAO"].includes(pedido.status);
                          const prod = {
                            id: item.produto.id,
                            nome: item.produto.descricao,
                            codigoInterno: item.produto.codigoInterno,
                            codigoBarras: item.produto.codigoBarras,
                            unidade: item.produto.unidadeVenda || "UN",
                          };

                          return (
                            <TouchableOpacity
                              key={item.id}
                              disabled={!isInteractive}
                              style={s.pedidoItemBlock}
                              onPress={() => isInteractive && navigation.navigate("ProdutoDetalhe", { produto: prod })}
                              activeOpacity={0.8}
                            >
                              <View style={s.pedidoItemRow}>
                                <View style={{ flex: 1, paddingRight: 8 }}>
                                  <Text style={isInteractive ? s.pedidoItemDescInteractive : s.pedidoItemDesc} numberOfLines={2}>
                                    {item.produto.descricao}
                                  </Text>
                                  {item.produto.codigoInterno ? (
                                    <Text style={s.pedidoItemCodeText}>Cód: {item.produto.codigoInterno}</Text>
                                  ) : null}
                                </View>
                                <View style={s.pedidoItemQtyBadge}>
                                  <Text style={s.pedidoItemQtyVal}>{item.quantidade}</Text>
                                  <Text style={s.pedidoItemQtyUnit}>{item.produto.unidadeVenda || "UN"}</Text>
                                </View>
                              </View>

                              {pendenciaItem ? (
                                <View style={s.itemPendenciaBadgeRow}>
                                  <MaterialCommunityIcons name="alert-circle-outline" size={14} color={C.dangerColor} />
                                  <Text style={s.itemPendenciaBadgeText}>
                                    Falta: {formatarQuantidade(pendenciaItem.quantidadePendente)} {item.produto.unidadeVenda || "UN"} · {PENDENCIA_STATUS_LABEL[pendenciaItem.status]}
                                  </Text>
                                </View>
                              ) : (
                                <View style={s.itemOkBadgeRow}>
                                  <MaterialCommunityIcons name="check-circle-outline" size={14} color={C.successColor} />
                                  <Text style={s.itemOkBadgeText}>Item liberado em estoque</Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        })
                      )}

                      {/* ── BOTÕES DE AÇÃO CONTEXTUAIS REDESENHADOS ─── */}
                      {possuiAcao && (
                        <View style={s.actionsContainer}>
                          {/* Ações Primárias (Grandes com Destaque) */}
                          {podeReverificar && (
                            <TouchableOpacity
                              style={[s.primaryActionBtn, { backgroundColor: C.successColor }]}
                              onPress={() => {
                                void handleTransicao(
                                  pedido.id,
                                  "reverificar_estoque",
                                  "Estoque reavaliado e pedido atualizado com sucesso."
                                );
                              }}
                              disabled={loadingTransicao === pedido.id}
                            >
                              {loadingTransicao === pedido.id ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <>
                                  <MaterialCommunityIcons name="refresh" size={18} color="#FFFFFF" />
                                  <Text style={s.primaryActionBtnText}>Reavaliar Estoque</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )}

                          {podeIniciarSeparacao && (
                            <TouchableOpacity
                              style={[s.primaryActionBtn, { backgroundColor: C.infoColor }]}
                              onPress={() =>
                                confirmarTransicao(
                                  "Iniciar separação",
                                  "O pedido entrará em separação física no estoque.",
                                  pedido.id,
                                  "iniciar_separacao",
                                  "Separação iniciada."
                                )
                              }
                              disabled={loadingTransicao === pedido.id}
                            >
                              {loadingTransicao === pedido.id ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <>
                                  <MaterialCommunityIcons name="play-circle-outline" size={18} color="#FFFFFF" />
                                  <Text style={s.primaryActionBtnText}>Iniciar Separação Física</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )}

                          {podeConferirSeparacao && (
                            <TouchableOpacity
                              style={[s.primaryActionBtn, { backgroundColor: C.primaryColor }]}
                              onPress={() => abrirConferencia(pedido)}
                            >
                              <MaterialCommunityIcons name="clipboard-check-outline" size={18} color="#FFFFFF" />
                              <Text style={s.primaryActionBtnText}>Conferir Itens e Concluir</Text>
                            </TouchableOpacity>
                          )}

                          {podeDespachar && (
                            <TouchableOpacity
                              style={[s.primaryActionBtn, { backgroundColor: C.primaryColor }]}
                              onPress={() =>
                                confirmarTransicao(
                                  "Confirmar despacho",
                                  "Confirme que o pedido foi entregue à transportadora.",
                                  pedido.id,
                                  "despachar",
                                  "Pedido despachado."
                                )
                              }
                              disabled={loadingTransicao === pedido.id}
                            >
                              {loadingTransicao === pedido.id ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <>
                                  <MaterialCommunityIcons name="truck-delivery-outline" size={18} color="#FFFFFF" />
                                  <Text style={s.primaryActionBtnText}>Marcar como Despachado</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )}

                          {podeFinalizar && (
                            <TouchableOpacity
                              style={[s.primaryActionBtn, { backgroundColor: C.successColor }]}
                              onPress={() =>
                                confirmarTransicao(
                                  "Confirmar entrega",
                                  "Confirme somente após o cliente receber os produtos.",
                                  pedido.id,
                                  "finalizar",
                                  "Entrega confirmada. Pedido finalizado."
                                )
                              }
                              disabled={loadingTransicao === pedido.id}
                            >
                              {loadingTransicao === pedido.id ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <>
                                  <MaterialCommunityIcons name="check-decagram-outline" size={18} color="#FFFFFF" />
                                  <Text style={s.primaryActionBtnText}>Confirmar Entrega ao Cliente</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )}

                          {/* Ações Secundárias (Lado a Lado) */}
                          <View style={s.secondaryActionsRow}>
                            {podeVerSaldos && (
                              <TouchableOpacity
                                style={s.secondaryActionBtn}
                                onPress={() => setDisponibilidadePedido(pedido)}
                              >
                                <MaterialCommunityIcons name="database-search-outline" size={16} color={C.slate700} />
                                <Text style={s.secondaryActionBtnText}>Consultar Saldos</Text>
                              </TouchableOpacity>
                            )}

                            {podeConfirmarFalta && (
                              <TouchableOpacity
                                style={[s.secondaryActionBtn, { borderColor: "#FECACA", backgroundColor: "#FEF2F2" }]}
                                onPress={() => setFaltaPedido(pedido)}
                                disabled={loadingTransicao === pedido.id}
                              >
                                <MaterialCommunityIcons name="alert-outline" size={16} color={C.dangerColor} />
                                <Text style={[s.secondaryActionBtnText, { color: C.dangerColor }]}>Informar Falta</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </Surface>
              );
            })
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* ── Drawer Menu Lateral Customizado ─── */}
      {isMenuOpen && (
        <View style={StyleSheet.absoluteFill}>
          {/* Overlay escuro de fundo */}
          <TouchableOpacity
            style={s.overlay}
            activeOpacity={1}
            onPress={closeMenu}
          />

          {/* Painel do menu com animação slide */}
          <Animated.View style={[s.drawerPanel, { transform: [{ translateX: slideAnim }] }]}>
            <View style={s.drawerHeader}>
              <View style={s.drawerHeaderBrand}>
                <Image
                  source={require("../../assets/logo-dac.png")}
                  style={s.drawerLogo}
                  resizeMode="contain"
                />
                <View style={s.drawerUserBadge}>
                  <Text style={s.drawerUserName}>{state.user?.nome || "Operador de Estoque"}</Text>
                  <Text style={s.drawerUserRole}>ESTOQUE • MEDFLOW ERP</Text>
                </View>
              </View>
              <TouchableOpacity onPress={closeMenu} style={s.drawerCloseBtn}>
                <MaterialCommunityIcons name="close" size={22} color={C.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView style={s.drawerScroll} showsVerticalScrollIndicator={false}>
              
              {/* Menu 0: Principais */}
              <View style={s.menuSection}>
                <Text style={s.menuSectionTitle}>0. PRINCIPAIS</Text>
                
                <TouchableOpacity style={s.menuItem} onPress={closeMenu}>
                  <MaterialCommunityIcons name="view-dashboard-outline" size={20} color={C.primaryColor} />
                  <Text style={s.menuItemLabel}>Dashboard</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>

                <TouchableOpacity style={s.menuItem} onPress={() => navigateTo("VisaoGeral")}>
                  <MaterialCommunityIcons name="chart-box-outline" size={20} color={C.infoColor} />
                  <Text style={s.menuItemLabel}>Visão Geral</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>

                <TouchableOpacity style={s.menuItem} onPress={() => navigateTo("Movimentacoes")}>
                  <MaterialCommunityIcons name="swap-horizontal" size={20} color="#7C3AED" />
                  <Text style={s.menuItemLabel}>Movimentações</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>
              </View>

              {/* Menu 1: Operações de Estoque */}
              <View style={s.menuSection}>
                <Text style={s.menuSectionTitle}>1. OPERAÇÕES DE ESTOQUE</Text>
                
                <TouchableOpacity style={s.menuItem} onPress={() => navigateTo("Scanner")}>
                  <MaterialCommunityIcons name="barcode-scan" size={20} color={C.primaryColor} />
                  <Text style={s.menuItemLabel}>Escanear Produto</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>

                <TouchableOpacity style={s.menuItem} onPress={() => navigateTo("EntradaEstoque")}>
                  <MaterialCommunityIcons name="tray-arrow-down" size={20} color={C.successColor} />
                  <Text style={s.menuItemLabel}>Dar Entrada</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>

                <TouchableOpacity style={s.menuItem} onPress={() => navigateTo("AjusteInventario")}>
                  <MaterialCommunityIcons name="tune-vertical" size={20} color={C.warningColor} />
                  <Text style={s.menuItemLabel}>Ajustar Saldo</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>
              </View>

              {/* Menu 2: Gestão de Estoque */}
              <View style={s.menuSection}>
                <Text style={s.menuSectionTitle}>2. GESTÃO DE ESTOQUE</Text>

                <TouchableOpacity style={s.menuItem} onPress={() => navigateTo("CadastroProduto")}>
                  <MaterialCommunityIcons name="cube-outline" size={20} color="#0D9488" />
                  <Text style={s.menuItemLabel}>Cadastrar Produto</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>

                <TouchableOpacity style={s.menuItem} onPress={() => navigateTo("Alertas")}>
                  <MaterialCommunityIcons name="bell-outline" size={20} color={C.warningColor} />
                  <Text style={s.menuItemLabel}>Alertas</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>

                <TouchableOpacity style={s.menuItem} onPress={() => navigateTo("BloqueioLote")}>
                  <MaterialCommunityIcons name="shield-lock-outline" size={20} color={C.dangerColor} />
                  <Text style={s.menuItemLabel}>Bloquear Lote</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>

                <TouchableOpacity style={s.menuItem} onPress={() => navigateTo("Transferencia")}>
                  <MaterialCommunityIcons name="archive-arrow-down-outline" size={20} color="#10B981" />
                  <Text style={s.menuItemLabel}>Transferir Lote</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>
              </View>

              {/* Menu 3: Auditoria & Relatórios */}
              <View style={s.menuSection}>
                <Text style={s.menuSectionTitle}>3. AUDITORIA & RELATÓRIOS</Text>

                <TouchableOpacity style={s.menuItem} onPress={() => navigateTo("AuditoriaEstoque")}>
                  <MaterialCommunityIcons name="clipboard-check-outline" size={20} color={C.successColor} />
                  <Text style={s.menuItemLabel}>Auditar Estoque</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>

                <TouchableOpacity style={s.menuItem} onPress={() => navigateTo("RelatoriosEstoque")}>
                  <MaterialCommunityIcons name="chart-pie" size={20} color={C.infoColor} />
                  <Text style={s.menuItemLabel}>Relatórios</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>
              </View>

              {/* Seção Sistema */}
              <View style={s.menuSection}>
                <Text style={s.menuSectionTitle}>SISTEMA</Text>

                <TouchableOpacity style={s.menuItem} onPress={() => navigateTo("Configuracoes")}>
                  <MaterialCommunityIcons name="cog-outline" size={20} color={C.textGray} />
                  <Text style={s.menuItemLabel}>Configurações</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>

                <TouchableOpacity style={[s.menuItem, s.logoutItem]} onPress={signOut}>
                  <MaterialCommunityIcons name="logout" size={20} color={C.dangerColor} />
                  <Text style={[s.menuItemLabel, { color: C.dangerColor, fontWeight: "600" }]}>Sair da Conta</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      )}

      <DisponibilidadeEstoqueModal
        pedido={disponibilidadePedido}
        onClose={() => setDisponibilidadePedido(null)}
        onEntradaSucesso={() => {
          setRefreshTrigger((prev) => prev + 1);
        }}
      />

      <ConfirmarFaltaEstoqueModal
        pedido={faltaPedido}
        loading={faltaPedido !== null && loadingTransicao === faltaPedido.id}
        onClose={() => setFaltaPedido(null)}
        onConfirm={() => { void confirmarFaltaSelecionada(); }}
      />

      <Modal
        visible={conferenciaPedido !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setConferenciaPedido(null)}
      >
        <View style={s.conferenciaModalOverlay}>
          <View style={s.conferenciaModalContent}>
            {conferenciaPedido && (() => {
              const pedido = conferenciaPedido;
              const checks = conferenciaChecks[pedido.id] || {};
              const totalItens = pedido.itens.length;
              const checkedCount = pedido.itens.filter(item => checks[item.id]).length;
              const progressPercentage = totalItens > 0 ? (checkedCount / totalItens) : 0;
              const isFinished = totalItens > 0 && checkedCount === totalItens;

              return (
                <>
                  <View style={s.conferenciaHeader}>
                    <Text style={s.conferenciaTitle}>Conferência da separação</Text>
                    <Text style={s.conferenciaSubtitle} numberOfLines={1}>
                      {pedido.cliente?.razaoSocial || "Cliente Não Informado"}
                    </Text>
                    <Text style={s.conferenciaMeta}>
                      Empresa: {pedido.empresaFiscal?.nomeFantasia || pedido.empresaFiscal?.razaoSocial || "—"}
                    </Text>
                  </View>

                  <View style={s.conferenciaNotice}>
                    <MaterialCommunityIcons name="shield-check-outline" size={18} color="#1D4ED8" />
                    <Text style={s.conferenciaNoticeText}>
                      Confira fisicamente todos os itens. A conclusão só será registrada no sistema após 100% da lista.
                    </Text>
                  </View>

                  {/* Barra de Progresso */}
                  <View style={s.progressContainer}>
                    <View style={s.progressTextRow}>
                      <Text style={s.progressTextLabel}>Progresso da Separação</Text>
                      <Text style={s.progressPercentText}>
                        {checkedCount} de {totalItens} ({Math.round(progressPercentage * 100)}%)
                      </Text>
                    </View>
                    <View style={s.progressBarTrack}>
                      <View style={[s.progressBarFill, { width: `${progressPercentage * 100}%` }]} />
                    </View>
                  </View>

                  <ScrollView style={s.conferenciaItemsList} contentContainerStyle={{ paddingBottom: 16 }}>
                    {pedido.itens.map(item => {
                      const isChecked = !!checks[item.id];
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            s.conferenciaItemCard,
                            isChecked && s.conferenciaItemCardChecked
                          ]}
                          activeOpacity={0.7}
                          onPress={() => toggleCheckItem(pedido.id, item.id)}
                        >
                          <View style={s.conferenciaItemRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={[s.conferenciaItemDesc, isChecked && s.conferenciaItemDescChecked]}>
                                {item.produto.descricao}
                              </Text>
                              <Text style={s.conferenciaItemSub}>
                                Código: {item.produto.codigoInterno || "—"} | Unidade: {item.produto.unidadeVenda || "UN"}
                              </Text>
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                              <Text style={s.conferenciaItemQtd}>Qtd: {item.quantidade}</Text>
                              <MaterialCommunityIcons
                                name={isChecked ? "check-circle" : "checkbox-blank-circle-outline"}
                                size={26}
                                color={isChecked ? C.successColor : "#94A3B8"}
                              />
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <View style={s.conferenciaButtons}>
                    <TouchableOpacity
                      style={[s.conferenciaBtn, s.conferenciaBtnCancel]}
                      onPress={() => setConferenciaPedido(null)}
                    >
                      <Text style={s.conferenciaBtnCancelText}>Fechar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        s.conferenciaBtn,
                        s.conferenciaBtnConfirm,
                        (!isFinished || loadingTransicao === pedido.id) && s.conferenciaBtnDisabled,
                      ]}
                      disabled={!isFinished || loadingTransicao === pedido.id}
                      onPress={() => Alert.alert(
                        "Concluir separação",
                        "Todos os itens foram conferidos. Ao confirmar, o estoque será baixado e o pedido ficará pronto para o despacho.",
                        [
                          { text: "Voltar", style: "cancel" },
                          {
                            text: "Concluir",
                            onPress: () => { void finalizarSeparacaoConferida(pedido); },
                          },
                        ]
                      )}
                    >
                      {loadingTransicao === pedido.id
                        ? <ActivityIndicator size="small" color="#FFFFFF" />
                        : <Text style={s.conferenciaBtnConfirmText}>
                            {isFinished ? "Concluir separação" : "Confira todos os itens"}
                          </Text>
                      }
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </View>
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

  /* Header */
  header: {
    backgroundColor: C.headerBg,
    paddingTop: Platform.OS === "android" ? 50 : 60,
    paddingBottom: 24,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenterLogoContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenterLogo: {
    width: 160,
    height: 38,
  },
  headerRightBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTextRight: {
    alignItems: "flex-end",
  },
  greeting: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "400",
  },
  userName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#253A5E",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  /* Scroll */
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  /* Título de Seção */
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textGray,
    letterSpacing: 1,
    marginBottom: 4,
    marginLeft: 2,
    marginTop: 14,
  },
  sectionSubtitle: {
    marginLeft: 2,
    marginBottom: 12,
    fontSize: 11,
    lineHeight: 15,
    color: C.textGray,
  },

  /* Atalhos de Ação Rápida */
  quickActionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  actionBtn: {
    width: "23%",
  },
  actionSurface: {
    backgroundColor: C.white,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: C.textDark,
  },

  /* Card de Alerta de Validade */
  alertCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    marginBottom: 6,
    borderLeftWidth: 5,
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: C.textDark,
  },
  alertSubtitle: {
    fontSize: 11,
    color: C.textGray,
    lineHeight: 14,
    marginTop: 2,
  },

  /* Card Financeiro */
  financeCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
    marginBottom: 8,
  },
  financeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  financeCol: {
    flex: 1,
    alignItems: "center",
  },
  financeDivider: {
    width: 1,
    backgroundColor: "#E5E7EB",
    height: 36,
  },
  financeLabel: {
    fontSize: 10,
    color: C.textGray,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  financeValue: {
    fontSize: 15,
    fontWeight: "800",
    color: C.textDark,
  },

  /* KPIs */
  kpiGrid: {
    gap: 10,
    marginBottom: 14,
  },
  kpiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderLeftWidth: 4,
    justifyContent: "center",
  },
  kpiLabel: {
    fontSize: 10,
    color: C.textGray,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "800",
  },

  /* Filas operacionais do estoque */
  funilTabsScroll: {
    marginBottom: 10,
  },
  funilTabs: {
    flexDirection: "row",
    paddingRight: 6,
    gap: 6,
  },
  /* ── PEDIDOS DE ESTOQUE REESTILIZADOS ─── */
  pedidosSectionHeader: {
    marginBottom: 10,
  },

  /* KPIs Interativos de Filas */
  queueKpiCard: {
    width: 145,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 10,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    position: "relative",
    overflow: "hidden",
  },
  queueKpiTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  queueKpiIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  queueKpiBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  queueKpiBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: C.textDark,
  },
  queueKpiTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: C.textDark,
    marginBottom: 2,
  },
  queueKpiDesc: {
    fontSize: 9.5,
    color: C.textGray,
    lineHeight: 13,
  },
  queueKpiIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },

  /* Barra de Busca de Pedidos */
  pedidoSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 8,
    marginBottom: 8,
  },
  pedidoSearchInput: {
    flex: 1,
    fontSize: 12,
    color: C.textDark,
  },
  searchResultInfo: {
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  searchResultText: {
    fontSize: 11,
    color: C.textGray,
    fontWeight: "600",
  },

  /* Loading & Empty Estados de Pedidos */
  funilError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  funilErrorTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#991B1B",
  },
  funilErrorText: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 14,
    color: "#B91C1C",
  },
  funilLoading: {
    paddingVertical: 24,
    alignItems: "center",
  },
  funilEmpty: {
    backgroundColor: C.white,
    borderRadius: 12,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
    gap: 4,
  },
  funilEmptyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: C.textDark,
    marginTop: 6,
  },
  funilEmptyText: {
    fontSize: 11,
    color: C.textGray,
    textAlign: "center",
  },

  /* Card de Pedido Redesenhado */
  pedidoCard: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  pedidoHeaderTouch: {
    margin: -14,
    padding: 14,
  },
  pedidoHeaderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  pedidoNumeroBox: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  pedidoNumeroMonospace: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 11,
    fontWeight: "900",
    color: C.slate900,
  },
  pedidoClienteName: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "800",
    color: C.textDark,
  },
  pedidoStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  pedidoStatusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  /* Mini-Timeline de Etapas */
  timelineContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  timelineStepItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: {
    backgroundColor: C.successColor,
  },
  dotActive: {
    backgroundColor: "#B45309",
  },
  dotPending: {
    backgroundColor: "#CBD5E1",
  },
  dotAlert: {
    backgroundColor: C.dangerColor,
  },
  dotInnerActive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  dotInnerPending: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#94A3B8",
  },
  timelineStepLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  labelDone: {
    color: C.successColor,
  },
  labelActive: {
    color: "#B45309",
  },
  labelPending: {
    color: "#94A3B8",
  },
  labelAlert: {
    color: C.dangerColor,
  },
  timelineConnectingLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
  },
  lineDone: {
    backgroundColor: C.successColor,
  },
  linePending: {
    backgroundColor: "#E2E8F0",
  },

  /* Rodapé do Header do Pedido */
  pedidoHeaderFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  pedidoResumoHeader: {
    fontSize: 11,
    color: C.textGray,
    fontWeight: "500",
  },
  pedidoMetaInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  pedidoMetaText: {
    fontSize: 10.5,
    color: C.textGray,
    fontWeight: "600",
  },
  pedidoMetaDot: {
    fontSize: 10,
    color: "#CBD5E1",
  },
  pedidoMetaValor: {
    fontSize: 11,
    fontWeight: "800",
    color: C.successColor,
  },
  expandIconBox: {
    paddingLeft: 6,
  },

  /* Conteúdo Expandido */
  pedidoExpandedContent: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
  },

  /* Card de Dados do Cliente */
  pedidoClienteCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  pedidoClienteCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 4,
  },
  pedidoClienteCardTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: C.textDark,
    letterSpacing: 0.5,
  },
  pedidoClienteGrid: {
    gap: 3,
  },
  pedidoClienteGridItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pedidoClienteGridLabel: {
    fontSize: 10.5,
    color: C.textGray,
    fontWeight: "600",
    width: 90,
  },
  pedidoClienteGridVal: {
    fontSize: 10.5,
    color: C.textDark,
    fontWeight: "700",
    flex: 1,
  },

  /* Itens do Pedido */
  pedidoItensHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  pedidoItemsTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: C.textDark,
    letterSpacing: 0.5,
  },
  pedidoSemItensNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 10,
  },
  pedidoSemItensTitle: {
    fontSize: 11.5,
    fontWeight: "800",
    color: C.dangerColor,
  },
  pedidoSemItensText: {
    fontSize: 10,
    color: "#991B1B",
    marginTop: 1,
  },
  pedidoItemBlock: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    marginBottom: 6,
  },
  pedidoItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pedidoItemDesc: {
    fontSize: 11.5,
    fontWeight: "600",
    color: C.textDark,
  },
  pedidoItemDescInteractive: {
    fontSize: 11.5,
    fontWeight: "700",
    color: C.primaryColor,
  },
  pedidoItemCodeText: {
    fontSize: 9.5,
    color: C.textGray,
    marginTop: 1,
  },
  pedidoItemQtyBadge: {
    alignItems: "flex-end",
  },
  pedidoItemQtyVal: {
    fontSize: 13,
    fontWeight: "800",
    color: C.textDark,
  },
  pedidoItemQtyUnit: {
    fontSize: 9,
    color: C.textGray,
  },
  itemPendenciaBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "#FEF2F2",
  },
  itemPendenciaBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: C.dangerColor,
  },
  itemOkBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "#F0FDF4",
  },
  itemOkBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: C.successColor,
  },

  /* Botões de Ação Redesenhados */
  actionsContainer: {
    marginTop: 10,
    gap: 8,
  },
  primaryActionBtn: {
    width: "100%",
    height: 42,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    elevation: 1,
  },
  primaryActionBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  secondaryActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryActionBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secondaryActionBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.slate700,
  },

  /* Card de Gráfico */
  chartCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.textDark,
    marginBottom: 2,
  },
  chartSubtitle: {
    fontSize: 11,
    color: C.textGray,
    lineHeight: 14,
    marginBottom: 14,
  },

  /* Segmented Bar */
  segmentedBarContainer: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E5E7EB",
    flexDirection: "row",
    overflow: "hidden",
    marginBottom: 14,
  },
  barSegment: {
    height: "100%",
  },
  chartLegendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    color: C.textGray,
  },
  legendColor: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 12,
    color: C.textGray,
  },
  legendBold: {
    fontWeight: "700",
    color: C.textDark,
  },

  /* Top Produtos */
  topProdutosContainer: {
    gap: 12,
  },
  topProdutoRow: {
    gap: 6,
  },
  topProdutoInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topProdutoName: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textDark,
    flex: 1,
    marginRight: 8,
  },
  topProdutoValue: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textGray,
  },
  barContainer: {
    height: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },

  /* Drawer Menu Lateral */
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 99,
  },
  drawerPanel: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: C.white,
    zIndex: 100,
    paddingTop: Platform.OS === "ios" ? 50 : StatusBar.currentHeight || 40,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 16,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  drawerHeaderBrand: {
    flex: 1,
    paddingRight: 8,
  },
  drawerLogo: {
    width: 140,
    height: 32,
    marginBottom: 8,
  },
  drawerUserBadge: {
    gap: 2,
  },
  drawerUserName: {
    fontSize: 14,
    fontWeight: "800",
    color: C.textDark,
  },
  drawerUserRole: {
    fontSize: 10,
    fontWeight: "700",
    color: C.primaryColor,
    letterSpacing: 0.5,
  },
  drawerCloseBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
  },
  drawerScroll: {
    flex: 1,
  },
  menuSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  menuSectionTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textGray,
    paddingHorizontal: 20,
    marginBottom: 10,
    letterSpacing: 0.8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
  },
  menuItemLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: C.textDark,
    flex: 1,
  },
  logoutItem: {
    marginTop: 10,
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

  /* Conferencia Modal Styles */
  conferenciaModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  conferenciaModalContent: {
    backgroundColor: "#FFFFFF",
    width: "100%",
    maxWidth: 480,
    height: "80%",
    borderRadius: 16,
    padding: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  conferenciaHeader: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 12,
  },
  conferenciaTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#8B0C21",
    marginBottom: 4,
  },
  conferenciaSubtitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
  },
  conferenciaMeta: {
    fontSize: 12,
    color: "#6B7280",
  },
  conferenciaNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 12,
    padding: 10,
    borderRadius: 9,
    backgroundColor: "#EFF6FF",
  },
  conferenciaNoticeText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 14,
    color: "#1D4ED8",
  },
  progressContainer: {
    marginBottom: 16,
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  progressTextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressTextLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  progressPercentText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#22A85A",
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#22A85A",
    borderRadius: 4,
  },
  conferenciaItemsList: {
    flex: 1,
    marginBottom: 16,
  },
  conferenciaItemCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  conferenciaItemCardChecked: {
    backgroundColor: "#F0FDF4",
    borderColor: "#DCFCE7",
  },
  conferenciaItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  conferenciaItemDesc: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 2,
  },
  conferenciaItemDescChecked: {
    textDecorationLine: "line-through",
    color: "#94A3B8",
  },
  conferenciaItemSub: {
    fontSize: 11,
    color: "#6B7280",
  },
  conferenciaItemQtd: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  conferenciaButtons: {
    flexDirection: "row",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 16,
  },
  conferenciaBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  conferenciaBtnCancel: {
    backgroundColor: "#F3F4F6",
  },
  conferenciaBtnCancelText: {
    color: "#4B5563",
    fontWeight: "700",
    fontSize: 14,
  },
  conferenciaBtnConfirm: {
    backgroundColor: "#8B0C21",
  },
  conferenciaBtnDisabled: {
    backgroundColor: "#94A3B8",
    opacity: 0.72,
  },
  conferenciaBtnConfirmText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});

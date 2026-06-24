import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
  RefreshControl,
} from "react-native";
import { Text, Surface } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../hooks/useAuth";
import { RootStackParamList } from "../types/navigation";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { DashboardAPI, DashboardData } from "../api/dashboard";
import { EstoqueConsultaAPI, KpisEstoque, PedidoEstoque } from "../api/estoque-consulta";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Home">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = 280;

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
  purpleColor: "#6C5FC7",
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { state, signOut } = useAuth();

  // Estados de dados
  const [metrics, setMetrics] = useState<DashboardData | null>(null);
  const [kpisEstoque, setKpisEstoque] = useState<KpisEstoque | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Estados do Funil Operacional de Pedidos
  const [abaFunil, setAbaFunil] = useState<"aguardando" | "separacao" | "despacho">("aguardando");
  const [pedidosFunil, setPedidosFunil] = useState<PedidoEstoque[]>([]);
  const [loadingFunil, setLoadingFunil] = useState(false);
  const [loadingTransicao, setLoadingTransicao] = useState<number | null>(null);

  // Estado do Drawer Menu
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  const userName = state.user?.nome ?? "Usuário";
  const firstName = userName.split(" ")[0];
  const userInitials = firstName[0]?.toUpperCase() ?? "U";

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

  // Novo useEffect para carregar a fila do funil
  useEffect(() => {
    let cancelled = false;
    const carregarFunil = async () => {
      setLoadingFunil(true);
      try {
        const filtroApi = abaFunil === "despacho" ? "despacho" : "separacao";
        const res = await EstoqueConsultaAPI.getPedidosFunil(filtroApi as any);
        let filtrados = res.pedidos;
        if (abaFunil === "aguardando") {
          filtrados = res.pedidos.filter(p =>
            ["AUTORIZADO_PARA_SEPARACAO", "FATURADO", "PEDIDO_INTERNO_AUTORIZADO"].includes(p.status)
          );
        } else if (abaFunil === "separacao") {
          filtrados = res.pedidos.filter(p => p.status === "EM_SEPARACAO");
        }
        if (!cancelled) setPedidosFunil(filtrados);
      } catch (err) {
        console.error("Erro ao carregar funil:", err);
        if (!cancelled) setPedidosFunil([]);
      } finally {
        if (!cancelled) setLoadingFunil(false);
      }
    };
    carregarFunil();
    return () => { cancelled = true; };
  }, [abaFunil, refreshTrigger]);

  // Controle de animação do Drawer Menu
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isMenuOpen ? 0 : -DRAWER_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isMenuOpen]);

  // Função handleTransicao para transicionar status do pedido
  const handleTransicao = async (
    pedidoId: number,
    acao: "iniciar_separacao" | "finalizar_separacao" | "despachar"
  ) => {
    setLoadingTransicao(pedidoId);
    try {
      await EstoqueConsultaAPI.transicionarPedido(pedidoId, acao);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error("Erro na transição:", err);
    } finally {
      setLoadingTransicao(null);
    }
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
          <Text style={s.headerTitle}>MedFlow Central</Text>
          <View style={s.headerRight}>
            <View style={s.headerTextRight}>
              <Text style={s.greeting}>{getGreeting()},</Text>
              <Text style={s.userName}>{firstName}</Text>
            </View>
            <View style={s.avatar}>
              <Text style={s.avatarLetter}>{userInitials}</Text>
            </View>
          </View>
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
                  <MaterialCommunityIcons name="file-document-edit-outline" size={22} color={C.purpleColor} />
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

          {/* ── Seção: Resumo Financeiro ─── */}
          {metrics && (metrics.valorEstoque > 0 || (metrics.faturamentoMes ?? 0) > 0) && (
            <Surface style={s.financeCard} elevation={1}>
              <View style={s.financeRow}>
                {metrics.valorEstoque > 0 && (
                  <View style={s.financeCol}>
                    <Text style={s.financeLabel}>Valor em Estoque</Text>
                    <Text style={s.financeValue}>{formatCurrency(metrics.valorEstoque)}</Text>
                  </View>
                )}
                {metrics.valorEstoque > 0 && (metrics.faturamentoMes ?? 0) > 0 && (
                  <View style={s.financeDivider} />
                )}
                {(metrics.faturamentoMes ?? 0) > 0 && (
                  <View style={s.financeCol}>
                    <Text style={s.financeLabel}>Faturamento/Mês</Text>
                    <Text style={[s.financeValue, { color: C.successColor }]}>
                      {formatCurrency(metrics.faturamentoMes ?? 0)}
                    </Text>
                  </View>
                )}
              </View>
            </Surface>
          )}

          {/* ── Seção: Funil Operacional de Pedidos ─── */}
          <Text style={s.sectionTitle}>FUNIL OPERACIONAL DE PEDIDOS</Text>

          {/* Abas */}
          <View style={s.funilTabs}>
            {([
              { key: "aguardando", label: "Aguardando" },
              { key: "separacao", label: "Em Separação" },
              { key: "despacho", label: "Despacho" },
            ] as const).map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[s.funilTab, abaFunil === tab.key && s.funilTabActive]}
                onPress={() => setAbaFunil(tab.key)}
              >
                <Text style={[s.funilTabText, abaFunil === tab.key && s.funilTabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loadingFunil ? (
            <View style={s.funilLoading}>
              <ActivityIndicator size="small" color={C.primaryColor} />
            </View>
          ) : pedidosFunil.length === 0 ? (
            <View style={s.funilEmpty}>
              <MaterialCommunityIcons name="check-circle-outline" size={32} color={C.textGray} />
              <Text style={s.funilEmptyText}>Nenhum pedido nesta fila</Text>
            </View>
          ) : (
            pedidosFunil.map(pedido => (
              <Surface key={pedido.id} style={s.pedidoCard} elevation={1}>
                <View style={s.pedidoHeader}>
                  <View>
                    <Text style={s.pedidoNumero}>#{pedido.numero}</Text>
                    <Text style={s.pedidoEmpresa}>
                      {pedido.empresaFiscal?.nomeFantasia || pedido.empresaFiscal?.razaoSocial || "—"}
                    </Text>
                  </View>
                  <View style={s.pedidoStatusBadge}>
                    <Text style={s.pedidoStatusText}>{pedido.status.replace(/_/g, " ")}</Text>
                  </View>
                </View>
                <Text style={s.pedidoCliente}>{pedido.cliente.razaoSocial}</Text>
                <Text style={s.pedidoValor}>
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(pedido.valorTotal)}
                </Text>
                <View style={s.pedidoDivider} />
                {pedido.itens.slice(0, 3).map(item => (
                  <View key={item.id} style={s.pedidoItemRow}>
                    <Text style={s.pedidoItemDesc} numberOfLines={1}>{item.produto.descricao}</Text>
                    <Text style={s.pedidoItemQtd}>x{item.quantidade}</Text>
                  </View>
                ))}
                {pedido.itens.length > 3 && (
                  <Text style={s.pedidoMaisItens}>+{pedido.itens.length - 3} item(s)</Text>
                )}
                <View style={s.pedidoDivider} />
                {abaFunil === "aguardando" && (
                  <TouchableOpacity
                    style={[s.pedidoBtn, { backgroundColor: C.primaryColor }]}
                    onPress={() => handleTransicao(pedido.id, "iniciar_separacao")}
                    disabled={loadingTransicao === pedido.id}
                  >
                    {loadingTransicao === pedido.id
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={s.pedidoBtnText}>▶ Iniciar Separação</Text>
                    }
                  </TouchableOpacity>
                )}
                {abaFunil === "separacao" && (
                  <TouchableOpacity
                    style={[s.pedidoBtn, { backgroundColor: C.successColor }]}
                    onPress={() => handleTransicao(pedido.id, "finalizar_separacao")}
                    disabled={loadingTransicao === pedido.id}
                  >
                    {loadingTransicao === pedido.id
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={s.pedidoBtnText}>✓ Finalizar Separação</Text>
                    }
                  </TouchableOpacity>
                )}
                {abaFunil === "despacho" && (
                  <TouchableOpacity
                    style={[s.pedidoBtn, { backgroundColor: C.warningColor }]}
                    onPress={() => handleTransicao(pedido.id, "despachar")}
                    disabled={loadingTransicao === pedido.id}
                  >
                    {loadingTransicao === pedido.id
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={s.pedidoBtnText}>🚚 Marcar Despachado</Text>
                    }
                  </TouchableOpacity>
                )}
              </Surface>
            ))
          )}

          {/* ── Seção: Indicadores Gerais ─── */}
          <Text style={s.sectionTitle}>INDICADORES GERAIS</Text>
          <View style={s.kpiGrid}>
            <View style={s.kpiRow}>
              <Surface style={[s.kpiCard, { borderLeftColor: C.primaryColor }]} elevation={1}>
                <Text style={s.kpiLabel}>SKUs Cadastrados</Text>
                <Text style={[s.kpiValue, { color: C.primaryColor }]}>{totalSKUs}</Text>
              </Surface>
              <Surface style={[s.kpiCard, { borderLeftColor: C.successColor }]} elevation={1}>
                <Text style={s.kpiLabel}>Qtd Itens Físicos</Text>
                <Text style={[s.kpiValue, { color: C.successColor }]}>{metrics?.itensEstoque ?? 0}</Text>
              </Surface>
            </View>
          </View>

          {/* ── Seção: Saúde dos SKUs (Gráfico Horizontal Segmentado) ─── */}
          <Surface style={s.chartCard} elevation={1}>
            <Text style={s.chartTitle}>Saúde dos SKUs</Text>
            <Text style={s.chartSubtitle}>Proporção de produtos ativos de acordo com estoque mínimo</Text>
            
            {/* Barra segmentada */}
            <View style={s.segmentedBarContainer}>
              <View style={[s.barSegment, { width: `${pctOk}%`, backgroundColor: C.successColor }]} />
              <View style={[s.barSegment, { width: `${pctCriticos}%`, backgroundColor: C.warningColor }]} />
              <View style={[s.barSegment, { width: `${pctEsgotados}%`, backgroundColor: C.dangerColor }]} />
            </View>

            {/* Legendas */}
            <View style={s.chartLegendRow}>
              <View style={s.legendItem}>
                <View style={[s.legendColor, { backgroundColor: C.successColor }]} />
                <Text style={s.legendLabel}>OK: <Text style={s.legendBold}>{okCount}</Text></Text>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendColor, { backgroundColor: C.warningColor }]} />
                <Text style={s.legendLabel}>Crítico: <Text style={s.legendBold}>{criticosCount}</Text></Text>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendColor, { backgroundColor: C.dangerColor }]} />
                <Text style={s.legendLabel}>Zerado: <Text style={s.legendBold}>{esgotadosCount}</Text></Text>
              </View>
            </View>
          </Surface>

          {/* ── Seção: Top Produtos Vendidos ─── */}
          {metrics?.topProdutos && metrics.topProdutos.length > 0 && (
            <Surface style={s.chartCard} elevation={1}>
              <Text style={s.chartTitle}>Top 5 Produtos (Mais Vendidos)</Text>
              <Text style={s.chartSubtitle}>Itens com maior quantidade de saídas acumuladas</Text>

              <View style={s.topProdutosContainer}>
                {metrics.topProdutos.map((item, idx) => {
                  const pctBar = (item.qtdVendida / maxQtdVendida) * 100;
                  return (
                    <View key={item.produtoId || idx} style={s.topProdutoRow}>
                      <View style={s.topProdutoInfo}>
                        <Text style={s.topProdutoName} numberOfLines={1}>
                          {idx + 1}. {item.descricao}
                        </Text>
                        <Text style={s.topProdutoValue}>{item.qtdVendida} un</Text>
                      </View>
                      <View style={s.barContainer}>
                        <View style={[s.barFill, { width: `${pctBar}%`, backgroundColor: C.primaryColor }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </Surface>
          )}

          {/* ── Seção: Top 3 Clientes Compradores (Novo BI!) ─── */}
          {metrics?.vendasPorCliente && metrics.vendasPorCliente.length > 0 && (
            <Surface style={s.chartCard} elevation={1}>
              <Text style={s.chartTitle}>Top Clientes do Mês (Faturamento)</Text>
              <Text style={s.chartSubtitle}>Maiores compradores e volume de pedidos</Text>

              <View style={s.topProdutosContainer}>
                {metrics.vendasPorCliente.slice(0, 3).map((item, idx) => {
                  const pctBar = (item.totalVendas / maxVendaCliente) * 100;
                  return (
                    <View key={item.clienteId || idx} style={s.topProdutoRow}>
                      <View style={s.topProdutoInfo}>
                        <Text style={s.topProdutoName} numberOfLines={1}>
                          {idx + 1}. {item.razaoSocial}
                        </Text>
                        <Text style={s.topProdutoValue}>
                          {item.qtdPedidos} ped. • <Text style={s.legendBold}>{formatCurrency(item.totalVendas)}</Text>
                        </Text>
                      </View>
                      <View style={s.barContainer}>
                        <View style={[s.barFill, { width: `${pctBar}%`, backgroundColor: C.purpleColor }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </Surface>
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
              <Text style={s.drawerHeaderTitle}>Navegação</Text>
              <TouchableOpacity onPress={closeMenu} style={s.drawerCloseBtn}>
                <MaterialCommunityIcons name="close" size={24} color={C.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView style={s.drawerScroll} showsVerticalScrollIndicator={false}>
              
              {/* Seção 1: Operações */}
              <View style={s.menuSection}>
                <Text style={s.menuSectionTitle}>📦 OPERAÇÕES DE ESTOQUE</Text>
                
                <TouchableOpacity style={s.menuItem} onPress={() => navigateTo("Scanner")}>
                  <MaterialCommunityIcons name="barcode-scan" size={20} color={C.primaryColor} />
                  <Text style={s.menuItemLabel}>Escanear Produto</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>

                <TouchableOpacity style={s.menuItem} onPress={() => navigateTo("Scanner", { action: "EntradaEstoque" })}>
                  <MaterialCommunityIcons name="tray-arrow-down" size={20} color={C.successColor} />
                  <Text style={s.menuItemLabel}>Dar Entrada</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>

                <TouchableOpacity style={s.menuItem} onPress={() => navigateTo("Scanner", { action: "AjusteInventario" })}>
                  <MaterialCommunityIcons name="file-document-edit-outline" size={20} color={C.purpleColor} />
                  <Text style={s.menuItemLabel}>Ajustar Saldo</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>

                <TouchableOpacity style={s.menuItem} onPress={() => navigateTo("Scanner", { action: "BloqueioLote" })}>
                  <MaterialCommunityIcons name="lock-outline" size={20} color="#3B82F6" />
                  <Text style={s.menuItemLabel}>Bloquear Lote</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>

                <TouchableOpacity style={s.menuItem} onPress={() => navigateTo("Scanner", { action: "Transferencia" })}>
                  <MaterialCommunityIcons name="swap-horizontal" size={20} color="#10B981" />
                  <Text style={s.menuItemLabel}>Transferir Lote</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>
              </View>

              {/* Seção 2: Consultas */}
              <View style={s.menuSection}>
                <Text style={s.menuSectionTitle}>📊 CONSULTAS E GESTÃO</Text>

                <TouchableOpacity style={s.menuItem} onPress={() => navigateTo("Movimentacoes")}>
                  <MaterialCommunityIcons name="swap-horizontal" size={20} color={C.primaryColor} />
                  <Text style={s.menuItemLabel}>Movimentações</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>

                <TouchableOpacity style={s.menuItem} onPress={() => navigateTo("Lotes")}>
                  <MaterialCommunityIcons name="format-list-bulleted" size={20} color="#3B82F6" />
                  <Text style={s.menuItemLabel}>Lotes</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>

                <TouchableOpacity style={s.menuItem} onPress={() => navigateTo("Alertas")}>
                  <MaterialCommunityIcons name="bell-outline" size={20} color={C.warningColor} />
                  <Text style={s.menuItemLabel}>Alertas</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>

                <TouchableOpacity style={s.menuItem} onPress={() => navigateTo("CadastroProduto")}>
                  <MaterialCommunityIcons name="cube-outline" size={20} color="#0D9488" />
                  <Text style={s.menuItemLabel}>Cadastrar Produto</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.chevron} />
                </TouchableOpacity>
              </View>

              {/* Seção 3: Sistema */}
              <View style={s.menuSection}>
                <Text style={s.menuSectionTitle}>⚙️ SISTEMA</Text>

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
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    flex: 1,
    marginLeft: 8,
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
    marginBottom: 12,
    marginLeft: 2,
    marginTop: 14,
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

  /* Funil Operacional */
  funilTabs: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 6,
  },
  funilTab: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },
  funilTabActive: {
    backgroundColor: C.primaryColor,
  },
  funilTabText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.textGray,
  },
  funilTabTextActive: {
    color: C.white,
  },
  funilLoading: {
    paddingVertical: 24,
    alignItems: "center",
  },
  funilEmpty: {
    paddingVertical: 24,
    alignItems: "center",
    gap: 8,
  },
  funilEmptyText: {
    fontSize: 13,
    color: C.textGray,
  },
  pedidoCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  pedidoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  pedidoNumero: {
    fontSize: 14,
    fontWeight: "800",
    color: C.textDark,
  },
  pedidoEmpresa: {
    fontSize: 11,
    color: C.textGray,
    marginTop: 2,
  },
  pedidoStatusBadge: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pedidoStatusText: {
    fontSize: 9,
    fontWeight: "700",
    color: C.primaryColor,
  },
  pedidoCliente: {
    fontSize: 15,
    fontWeight: "700",
    color: C.textDark,
    marginBottom: 2,
  },
  pedidoValor: {
    fontSize: 13,
    fontWeight: "600",
    color: C.successColor,
    marginBottom: 4,
  },
  pedidoDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 10,
  },
  pedidoItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  pedidoItemDesc: {
    flex: 1,
    fontSize: 12,
    color: C.textGray,
    marginRight: 8,
  },
  pedidoItemQtd: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textDark,
  },
  pedidoMaisItens: {
    fontSize: 11,
    color: C.primaryColor,
    fontWeight: "600",
    marginTop: 4,
  },
  pedidoBtn: {
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pedidoBtnText: {
    color: C.white,
    fontSize: 14,
    fontWeight: "700",
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
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  drawerHeaderTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: C.textDark,
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
});

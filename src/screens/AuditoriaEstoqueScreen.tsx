import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
  TextInput as RNTextInput,
  RefreshControl,
} from "react-native";
import { Text, Surface, Card, Divider, Button, Menu, SegmentedButtons, Badge, TextInput } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { EstoqueAPI, Inventario } from "../api/estoque";
import { ProdutosAPI } from "../api/produtos";
import { Produto } from "../types/produto";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "AuditoriaEstoque">;

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

export const AuditoriaEstoqueScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  const [abaAtiva, setAbaAtiva] = useState<"contagem" | "historico">("contagem");

  // Estado para Nova Auditoria
  const [escopo, setEscopo] = useState<"PRODUTO" | "LOCALIZACAO">("PRODUTO");
  const [buscaProduto, setBuscaProduto] = useState("");
  const [produtosEncontrados, setProdutosEncontrados] = useState<Produto[]>([]);
  const [produtoId, setProdutoId] = useState<number | null>(null);
  const [localizacoes, setLocalizacoes] = useState<{ id: number; nome: string }[]>([]);
  const [localizacaoId, setLocalizacaoId] = useState<number | null>(null);
  const [menuLocal, setMenuLocal] = useState(false);
  const [inventarioAtivo, setInventarioAtivo] = useState<Inventario | null>(null);
  const [contagens, setContagens] = useState<Record<number, string>>({});
  const [loadingAcao, setLoadingAcao] = useState(false);

  // Estado para Histórico de Auditorias
  const [historicoInventarios, setHistoricoInventarios] = useState<any[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    EstoqueAPI.localizacoes().then(setLocalizacoes).catch(() => undefined);
    carregarHistorico();
  }, []);

  const carregarHistorico = async () => {
    setLoadingHistorico(true);
    try {
      const lista = await EstoqueAPI.listarInventarios();
      const itens = Array.isArray(lista) ? lista : (lista as any)?.inventarios || [];
      setHistoricoInventarios(itens);
    } catch (err) {
      console.error("Erro ao carregar histórico de inventários:", err);
      setHistoricoInventarios([]);
    } finally {
      setLoadingHistorico(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    carregarHistorico();
  };

  const buscarProdutos = async () => {
    if (buscaProduto.trim().length < 2) {
      return Alert.alert("Busca", "Digite ao menos 2 caracteres para pesquisar o produto.");
    }
    setLoadingAcao(true);
    try {
      const res = await ProdutosAPI.buscarPorTexto(buscaProduto.trim());
      setProdutosEncontrados(res || []);
      if (res.length === 0) {
        Alert.alert("Busca", "Nenhum produto encontrado.");
      }
    } catch {
      Alert.alert("Erro", "Não foi possível buscar produtos.");
    } finally {
      setLoadingAcao(false);
    }
  };

  const iniciarAuditoria = async () => {
    if (escopo === "PRODUTO" && !produtoId) {
      return Alert.alert("Auditoria", "Selecione um produto para realizar a conferência.");
    }
    if (escopo === "LOCALIZACAO" && !localizacaoId) {
      return Alert.alert("Auditoria", "Selecione um depósito/localização para conferir.");
    }

    setLoadingAcao(true);
    try {
      const payload = escopo === "PRODUTO" ? { produtoId: produtoId! } : { localizacaoId: localizacaoId! };
      const criado = await EstoqueAPI.iniciarInventario(payload);
      const detalhe = await EstoqueAPI.inventario(criado.id);
      setInventarioAtivo(detalhe);
      setContagens(
        Object.fromEntries(
          detalhe.itens.map((item) => [item.id, item.quantidadeContada !== null ? item.quantidadeContada.toString() : ""])
        )
      );
      Alert.alert("Auditoria Iniciada", `Conferência criada com sucesso! ${detalhe.itens.length} saldo(s) a verificar.`);
    } catch (err: any) {
      console.error(err);
      Alert.alert("Erro", err.response?.data?.error || "Não foi possível iniciar a conferência física.");
    } finally {
      setLoadingAcao(false);
    }
  };

  const salvarAuditoria = async (aplicar: boolean) => {
    if (!inventarioAtivo) return;

    const itensVazios = inventarioAtivo.itens.filter((item) => (contagens[item.id] ?? "").trim() === "");
    if (itensVazios.length > 0 && aplicar) {
      return Alert.alert(
        "Contagem Incompleta",
        `Existem ${itensVazios.length} item(ns) sem contagem informada. Preencha todos antes de aplicar os ajustes.`
      );
    }

    const payload = inventarioAtivo.itens
      .filter((item) => (contagens[item.id] ?? "").trim() !== "")
      .map((item) => ({
        itemId: item.id,
        quantidadeContada: Number(contagens[item.id].replace(",", ".")),
      }));

    if (payload.some((item) => !Number.isFinite(item.quantidadeContada) || item.quantidadeContada < 0)) {
      return Alert.alert("Valor Inválido", "Existem quantidades contadas inválidas ou negativas.");
    }

    setLoadingAcao(true);
    try {
      await EstoqueAPI.salvarContagens(inventarioAtivo.id, payload);
      if (aplicar) {
        const res = await EstoqueAPI.aplicarInventario(inventarioAtivo.id);
        Alert.alert(
          "Auditoria Concluída e Aplicada",
          `Ajustes de estoque processados com sucesso! ${res.ajustes} movimentação(ões) gerada(s).`,
          [
            {
              text: "OK",
              onPress: () => {
                setInventarioAtivo(null);
                setAbaAtiva("historico");
                carregarHistorico();
              },
            },
          ]
        );
      } else {
        const atualizado = await EstoqueAPI.inventario(inventarioAtivo.id);
        setInventarioAtivo(atualizado);
        Alert.alert("Salvo com Sucesso", "Contagens físicas registradas como rascunho. Revise antes de aplicar.");
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert("Erro", err.response?.data?.error || "Não foi possível processar a auditoria.");
    } finally {
      setLoadingAcao(false);
    }
  };

  const abrirAuditoriaHistorico = async (id: number) => {
    setLoadingAcao(true);
    try {
      const detalhe = await EstoqueAPI.inventario(id);
      setInventarioAtivo(detalhe);
      setContagens(
        Object.fromEntries(
          detalhe.itens.map((item) => [item.id, item.quantidadeContada !== null ? item.quantidadeContada.toString() : ""])
        )
      );
      setAbaAtiva("contagem");
    } catch (err) {
      Alert.alert("Erro", "Não foi possível carregar a auditoria selecionada.");
    } finally {
      setLoadingAcao(false);
    }
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
          <Text style={s.headerTitle}>Auditoria de Estoque</Text>
          <Text style={s.headerSubtitle}>Conferência Física Cega e Divergências</Text>
        </View>
        <TouchableOpacity style={s.headerBtn} onPress={onRefresh}>
          <MaterialCommunityIcons name="refresh" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ── ABAS DE NAVEGAÇÃO ─── */}
      <View style={s.tabsRow}>
        <TouchableOpacity
          style={[s.tabButton, abaAtiva === "contagem" && s.tabButtonActive]}
          onPress={() => setAbaAtiva("contagem")}
        >
          <MaterialCommunityIcons
            name="clipboard-check-outline"
            size={18}
            color={abaAtiva === "contagem" ? C.primaryColor : C.slate500}
          />
          <Text style={[s.tabButtonText, abaAtiva === "contagem" && s.tabButtonTextActive]}>
            {inventarioAtivo ? "Auditoria em Andamento" : "Nova Auditoria"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.tabButton, abaAtiva === "historico" && s.tabButtonActive]}
          onPress={() => {
            setAbaAtiva("historico");
            carregarHistorico();
          }}
        >
          <MaterialCommunityIcons
            name="history"
            size={18}
            color={abaAtiva === "historico" ? C.primaryColor : C.slate500}
          />
          <Text style={[s.tabButtonText, abaAtiva === "historico" && s.tabButtonTextActive]}>
            Histórico ({historicoInventarios.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primaryColor]} />}
      >
        {/* ── ABA 1: CONTAGEM / AUDITORIA ATIVA ─── */}
        {abaAtiva === "contagem" && (
          <View>
            {!inventarioAtivo ? (
              <Surface style={s.setupCard} elevation={1}>
                <Text style={s.setupTitle}>Configurar Nova Conferência Física</Text>
                <Text style={s.setupDesc}>
                  Selecione o escopo da auditoria física para conferência item a item no chão de fábrica:
                </Text>

                <SegmentedButtons
                  value={escopo}
                  onValueChange={(val) => {
                    setEscopo(val as typeof escopo);
                    setProdutoId(null);
                    setLocalizacaoId(null);
                  }}
                  buttons={[
                    { value: "PRODUTO", label: "Por Produto Específico", icon: "cube-outline" },
                    { value: "LOCALIZACAO", label: "Depósito / Prateleira", icon: "archive-marker-outline" },
                  ]}
                  style={{ marginVertical: 14 }}
                />

                {escopo === "PRODUTO" ? (
                  <View style={{ gap: 10 }}>
                    <Text style={s.fieldLabel}>Pesquisar Produto:</Text>
                    <View style={s.searchRow}>
                      <TextInput
                        mode="outlined"
                        placeholder="Nome ou código do produto..."
                        value={buscaProduto}
                        onChangeText={setBuscaProduto}
                        style={{ flex: 1, backgroundColor: C.white }}
                      />
                      <Button mode="contained" onPress={buscarProdutos} loading={loadingAcao} style={s.searchBtn}>
                        Buscar
                      </Button>
                    </View>

                    {produtosEncontrados.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={[s.productSelectCard, produtoId === p.id && s.productSelectCardActive]}
                        onPress={() => setProdutoId(p.id)}
                      >
                        <MaterialCommunityIcons
                          name={produtoId === p.id ? "radiobox-marked" : "radiobox-blank"}
                          size={20}
                          color={produtoId === p.id ? C.primaryColor : C.slate500}
                        />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={s.productSelectTitle}>{p.nome}</Text>
                          <Text style={s.productSelectSub}>SKU: {p.codigoInterno || "N/A"} • Un: {p.unidade}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    <Text style={s.fieldLabel}>Selecione o Depósito / Localização:</Text>
                    <Menu
                      visible={menuLocal}
                      onDismiss={() => setMenuLocal(false)}
                      anchor={
                        <Button mode="outlined" onPress={() => setMenuLocal(true)} style={s.menuAnchor}>
                          {localizacoes.find((l) => l.id === localizacaoId)?.nome || "Toque para escolher o depósito *"}
                        </Button>
                      }
                    >
                      {localizacoes.map((loc) => (
                        <Menu.Item
                          key={loc.id}
                          title={loc.nome}
                          onPress={() => {
                            setLocalizacaoId(loc.id);
                            setMenuLocal(false);
                          }}
                        />
                      ))}
                    </Menu>
                  </View>
                )}

                <Button
                  mode="contained"
                  icon="play-circle-outline"
                  onPress={iniciarAuditoria}
                  loading={loadingAcao}
                  disabled={loadingAcao}
                  style={[s.iniciarBtn, { backgroundColor: C.primaryColor }]}
                >
                  Iniciar Conferência
                </Button>
              </Surface>
            ) : (
              <View style={{ gap: 12 }}>
                {/* Header da Auditoria em Aberto */}
                <Surface style={s.activeHeaderCard} elevation={1}>
                  <View style={s.activeHeaderRow}>
                    <View>
                      <Text style={s.activeHeaderTitle}>
                        Auditoria #{inventarioAtivo.id} • {inventarioAtivo.escopo === "PRODUTO" ? "Por Produto" : "Depósito"}
                      </Text>
                      <Text style={s.activeHeaderSub}>
                        Status: <Text style={{ fontWeight: "700", color: C.infoColor }}>{inventarioAtivo.status}</Text> • {inventarioAtivo.itens.length} saldo(s) esperados
                      </Text>
                    </View>
                    <Button
                      mode="text"
                      textColor={C.dangerColor}
                      onPress={() => setInventarioAtivo(null)}
                      compact
                    >
                      Fechar
                    </Button>
                  </View>
                </Surface>

                {/* Lista de Itens a Contar */}
                {inventarioAtivo.itens.map((item) => {
                  const textoContado = contagens[item.id] ?? "";
                  const valorContado = textoContado === "" ? null : Number(textoContado.replace(",", "."));
                  const divergencia =
                    valorContado === null || !Number.isFinite(valorContado)
                      ? null
                      : valorContado - item.quantidadeEsperada;

                  const isConfere = divergencia === 0;
                  const isDivergente = divergencia !== null && divergencia !== 0;

                  return (
                    <Surface
                      key={item.id}
                      style={[
                        s.itemCard,
                        isConfere && { borderColor: C.successColor, borderWidth: 1.5 },
                        isDivergente && { borderColor: C.dangerColor, borderWidth: 1.5 },
                      ]}
                      elevation={1}
                    >
                      <View style={s.itemCardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.itemDescricao}>{item.produto.descricao}</Text>
                          <Text style={s.itemSub}>
                            SKU: {item.produto.codigoInterno || "N/A"} • Lote: {item.lote?.numeroLote || "Sem Lote"}
                          </Text>
                          <Text style={s.itemSub}>Localização: {item.localizacao?.nome || "Geral"}</Text>
                        </View>
                        <View style={s.itemSaldoBox}>
                          <Text style={s.itemSaldoLabel}>Esperado</Text>
                          <Text style={s.itemSaldoValue}>{item.quantidadeEsperada}</Text>
                        </View>
                      </View>

                      <Divider style={{ marginVertical: 8 }} />

                      <View style={s.itemInputRow}>
                        <Text style={s.itemInputLabel}>Contagem Física:</Text>
                        <TextInput
                          mode="outlined"
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          value={textoContado}
                          onChangeText={(val) => setContagens((prev) => ({ ...prev, [item.id]: val }))}
                          style={s.itemInput}
                        />
                      </View>

                      {divergencia !== null && (
                        <View
                          style={[
                            s.divergenciaBanner,
                            { backgroundColor: isConfere ? "#DCFCE7" : "#FEE2E2" },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={isConfere ? "check-circle-outline" : "alert-circle-outline"}
                            size={16}
                            color={isConfere ? "#166534" : "#991B1B"}
                          />
                          <Text style={[s.divergenciaText, { color: isConfere ? "#166534" : "#991B1B" }]}>
                            {isConfere
                              ? "Contagem confere com o sistema."
                              : `Divergência de ${divergencia > 0 ? "+" : ""}${divergencia} unidade(s).`}
                          </Text>
                        </View>
                      )}
                    </Surface>
                  );
                })}

                {/* Botões de Ação */}
                <View style={s.actionRow}>
                  <Button
                    mode="outlined"
                    icon="content-save-outline"
                    onPress={() => salvarAuditoria(false)}
                    loading={loadingAcao}
                    disabled={loadingAcao}
                    style={s.actionBtn}
                  >
                    Salvar Rascunho
                  </Button>
                  <Button
                    mode="contained"
                    icon="check-all"
                    onPress={() => salvarAuditoria(true)}
                    loading={loadingAcao}
                    disabled={loadingAcao}
                    style={[s.actionBtn, { backgroundColor: C.primaryColor }]}
                  >
                    Aplicar Ajustes
                  </Button>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── ABA 2: HISTÓRICO DE AUDITORIAS ─── */}
        {abaAtiva === "historico" && (
          <View style={{ gap: 10 }}>
            {loadingHistorico && !refreshing ? (
              <View style={{ padding: 24, alignItems: "center" }}>
                <ActivityIndicator color={C.primaryColor} />
                <Text style={{ marginTop: 8, color: C.slate500 }}>Carregando histórico de auditorias...</Text>
              </View>
            ) : (!Array.isArray(historicoInventarios) || historicoInventarios.length === 0) ? (
              <Surface style={s.emptyHistoryCard} elevation={0}>
                <MaterialCommunityIcons name="clipboard-text-search-outline" size={40} color={C.slate500} />
                <Text style={s.emptyHistoryTitle}>Nenhuma auditoria registrada</Text>
                <Text style={s.emptyHistorySub}>As conferências físicas finalizadas aparecerão aqui com o log de ajustes.</Text>
              </Surface>
            ) : (
              historicoInventarios.map((inv) => (
                <Surface key={inv.id} style={s.historyItemCard} elevation={1}>
                  <View style={s.historyItemTop}>
                    <View>
                      <Text style={s.historyItemId}>Auditoria #{inv.id}</Text>
                      <Text style={s.historyItemDate}>
                        Iniciado em: {new Date(inv.iniciadoEm).toLocaleString("pt-BR")}
                      </Text>
                    </View>
                    <Badge
                      style={{
                        backgroundColor:
                          inv.status === "APLICADO"
                            ? "#DCFCE7"
                            : inv.status === "ABERTO"
                            ? "#FEF3C7"
                            : "#F1F5F9",
                        color:
                          inv.status === "APLICADO"
                            ? "#166534"
                            : inv.status === "ABERTO"
                            ? "#92400E"
                            : C.slate700,
                        fontWeight: "700",
                      }}
                    >
                      {inv.status}
                    </Badge>
                  </View>

                  <Divider style={{ marginVertical: 8 }} />

                  <Text style={s.historyItemDetail}>
                    Escopo: <Text style={{ fontWeight: "700" }}>{inv.escopo === "PRODUTO" ? "Por Produto" : "Depósito Geral"}</Text>
                    {inv.produto?.descricao ? ` (${inv.produto.descricao})` : ""}
                    {inv.localizacao?.nome ? ` (${inv.localizacao.nome})` : ""}
                  </Text>
                  <Text style={s.historyItemDetail}>
                    Responsável: {inv.criadoPor?.nome || "Administrador"}
                    {inv.aplicadoEm ? ` • Aplicado em: ${new Date(inv.aplicadoEm).toLocaleDateString("pt-BR")}` : ""}
                  </Text>

                  {inv.status === "ABERTO" && (
                    <Button
                      mode="contained-tonal"
                      icon="clipboard-edit-outline"
                      onPress={() => abrirAuditoriaHistorico(inv.id)}
                      style={{ marginTop: 10 }}
                    >
                      Retomar Esta Contagem
                    </Button>
                  )}
                </Surface>
              ))
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  /* Setup Card */
  setupCard: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  setupTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: C.slate900,
  },
  setupDesc: {
    fontSize: 12,
    color: C.slate500,
    marginTop: 4,
    lineHeight: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: C.slate700,
  },
  searchRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  searchBtn: {
    borderRadius: 8,
    backgroundColor: C.primaryColor,
  },
  productSelectCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.slate100,
  },
  productSelectCardActive: {
    borderColor: C.primaryColor,
    backgroundColor: "#FEF2F2",
  },
  productSelectTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: C.slate900,
  },
  productSelectSub: {
    fontSize: 11,
    color: C.slate500,
  },
  menuAnchor: {
    borderRadius: 8,
  },
  iniciarBtn: {
    marginTop: 18,
    borderRadius: 8,
  },

  /* Active Header */
  activeHeaderCard: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: C.primaryColor,
  },
  activeHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  activeHeaderTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: C.slate900,
  },
  activeHeaderSub: {
    fontSize: 11,
    color: C.slate500,
    marginTop: 2,
  },

  /* Item Card */
  itemCard: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  itemCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemDescricao: {
    fontSize: 14,
    fontWeight: "800",
    color: C.slate900,
  },
  itemSub: {
    fontSize: 11,
    color: C.slate500,
    marginTop: 2,
  },
  itemSaldoBox: {
    alignItems: "flex-end",
    backgroundColor: C.slate100,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  itemSaldoLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: C.slate500,
    textTransform: "uppercase",
  },
  itemSaldoValue: {
    fontSize: 14,
    fontWeight: "800",
    color: C.slate900,
  },
  itemInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemInputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: C.slate700,
  },
  itemInput: {
    width: 110,
    backgroundColor: C.white,
    height: 40,
    textAlign: "right",
  },
  divergenciaBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 10,
  },
  divergenciaText: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
  },

  /* History */
  emptyHistoryCard: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyHistoryTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: C.slate900,
    marginTop: 10,
  },
  emptyHistorySub: {
    fontSize: 12,
    color: C.slate500,
    textAlign: "center",
    marginTop: 4,
  },
  historyItemCard: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  historyItemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  historyItemId: {
    fontSize: 14,
    fontWeight: "800",
    color: C.slate900,
  },
  historyItemDate: {
    fontSize: 11,
    color: C.slate500,
    marginTop: 2,
  },
  historyItemDetail: {
    fontSize: 12,
    color: C.slate700,
    marginTop: 2,
  },
});

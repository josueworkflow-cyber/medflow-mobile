import React, { useState, useEffect } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, Surface } from "react-native-paper";
import { DisponibilidadeEstoqueItem, PedidoEstoque } from "../api/estoque-consulta";
import { EstoqueAPI } from "../api/estoque";
import { formatarNomeCliente } from "../utils/funil-pedidos";

interface DisponibilidadeEstoqueModalProps {
  pedido: PedidoEstoque | null;
  onClose: () => void;
  onEntradaSucesso?: () => void;
}

const COLORS = {
  primary: "#8B0C21",
  primaryLight: "#FDE8EB",
  text: "#1E293B",
  muted: "#64748B",
  border: "#E2E8F0",
  success: "#15803D",
  successSoft: "#F0FDF4",
  successBorder: "#BBF7D0",
  warning: "#D97706",
  warningSoft: "#FFFBEB",
  warningBorder: "#FDE68A",
  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
  dangerBorder: "#FECACA",
  info: "#2563EB",
  infoSoft: "#EFF6FF",
  slate100: "#F1F5F9",
  slate200: "#E2E8F0",
  slate700: "#334155",
};

function formatarQtd(valor: number): string {
  if (isNaN(valor) || valor === null || valor === undefined) return "0";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);
}

export function DisponibilidadeEstoqueModal({
  pedido,
  onClose,
  onEntradaSucesso,
}: DisponibilidadeEstoqueModalProps) {
  // Itens calculados e mantidos em estado local para atualização em tempo real após entrada
  const [itensLocais, setItensLocais] = useState<DisponibilidadeEstoqueItem[]>([]);

  // Estado para submodal de Entrada Rápida
  const [itemEntradaRapida, setItemEntradaRapida] = useState<DisponibilidadeEstoqueItem | null>(null);
  const [quantidadeEntrada, setQuantidadeEntrada] = useState("");
  const [loteEntrada, setLoteEntrada] = useState("");
  const [validadeEntrada, setValidadeEntrada] = useState("");
  const [custoEntrada, setCustoEntrada] = useState("");
  const [observacaoEntrada, setObservacaoEntrada] = useState("");
  const [localizacaoId, setLocalizacaoId] = useState<number | null>(null);
  const [localizacoes, setLocalizacoes] = useState<{ id: number; nome: string }[]>([]);

  const [loadingEntrada, setLoadingEntrada] = useState(false);
  const [sucessoEntrada, setSucessoEntrada] = useState<string | null>(null);
  const [erroEntrada, setErroEntrada] = useState<string | null>(null);

  // Inicializa os itens com base no pedido
  useEffect(() => {
    if (!pedido) {
      setItensLocais([]);
      return;
    }

    const calculados: DisponibilidadeEstoqueItem[] = (pedido.disponibilidadeEstoque && pedido.disponibilidadeEstoque.length > 0)
      ? pedido.disponibilidadeEstoque
      : (pedido.itens || []).map((item) => {
          const pendencia = pedido.pendenciasEstoque?.find(
            (p) => p.produto.id === item.produto.id && !["RESOLVIDA", "CANCELADA"].includes(p.status)
          );
          const qtdFalta = pendencia ? Number(pendencia.quantidadePendente || 0) : 0;
          const qtdDisp = pendencia ? Number(pendencia.quantidadeDisponivel || 0) : Number(item.quantidade || 0);
          return {
            produto: item.produto,
            quantidadeSolicitada: Number(item.quantidade || 0),
            quantidadeDisponivel: qtdDisp,
            quantidadeAtendida: Number(item.quantidade || 0) - qtdFalta,
            quantidadeFaltante: qtdFalta,
            status: qtdFalta === 0 ? "DISPONIVEL" : (qtdDisp > 0 ? "PARCIAL" : "INDISPONIVEL"),
          };
        });

    setItensLocais(calculados);
  }, [pedido]);

  // Carrega localizações para o select
  useEffect(() => {
    if (pedido) {
      EstoqueAPI.localizacoes()
        .then((locais) => {
          setLocalizacoes(locais || []);
          if (locais && locais.length > 0) {
            setLocalizacaoId(locais[0].id);
          }
        })
        .catch((e) => console.warn("Erro ao buscar localizações:", e));
    }
  }, [pedido]);

  const abrirEntradaRapida = (item: DisponibilidadeEstoqueItem) => {
    setItemEntradaRapida(item);
    const qtdFalta = Number(item.quantidadeFaltante) || 0;
    setQuantidadeEntrada(qtdFalta > 0 ? String(qtdFalta) : "1");
    setLoteEntrada(`LOTE-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}`);
    setValidadeEntrada("");
    setCustoEntrada("");
    setObservacaoEntrada(`Entrada rápida para suprir Pedido #${pedido?.numero || pedido?.id}`);
    setErroEntrada(null);
    setSucessoEntrada(null);
  };

  const fecharEntradaRapida = () => {
    setItemEntradaRapida(null);
    setErroEntrada(null);
    setSucessoEntrada(null);
  };

  const handleValidadeChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    let formatted = cleaned;
    if (cleaned.length > 2 && cleaned.length <= 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    } else if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
    }
    setValidadeEntrada(formatted);
  };

  const submeterEntradaRapida = async () => {
    if (!itemEntradaRapida || !itemEntradaRapida.produto?.id) return;

    const qtdNum = Number(quantidadeEntrada.replace(",", "."));
    if (isNaN(qtdNum) || qtdNum <= 0) {
      setErroEntrada("Informe uma quantidade válida e maior que zero.");
      return;
    }

    let validadeIso: string | undefined = undefined;
    if (validadeEntrada.trim()) {
      const parts = validadeEntrada.split("/").map(Number);
      if (parts.length === 3) {
        const [day, month, year] = parts;
        const d = new Date(year, month - 1, day);
        if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) {
          validadeIso = d.toISOString();
        } else {
          setErroEntrada("Data de validade inválida. Use DD/MM/AAAA.");
          return;
        }
      } else {
        setErroEntrada("Data de validade incompleta. Use DD/MM/AAAA.");
        return;
      }
    }

    setLoadingEntrada(true);
    setErroEntrada(null);
    setSucessoEntrada(null);

    try {
      await EstoqueAPI.entrada({
        produtoId: itemEntradaRapida.produto.id,
        quantidade: qtdNum,
        codigoLote: loteEntrada.trim() || undefined,
        validade: validadeIso,
        custoUnitario: custoEntrada.trim() ? Number(custoEntrada.replace(",", ".")) : undefined,
        observacao: observacaoEntrada.trim() || undefined,
        localizacaoId: localizacaoId || undefined,
      });

      // Atualiza os saldos locais na visualização do modal
      setItensLocais((prev) =>
        prev.map((it) => {
          if (it.produto?.id === itemEntradaRapida.produto.id) {
            const novaDisp = (Number(it.quantidadeDisponivel) || 0) + qtdNum;
            const novaFalta = Math.max(0, (Number(it.quantidadeSolicitada) || 0) - novaDisp);
            return {
              ...it,
              quantidadeDisponivel: novaDisp,
              quantidadeFaltante: novaFalta,
              quantidadeAtendida: Math.min(Number(it.quantidadeSolicitada) || 0, novaDisp),
              status: novaFalta === 0 ? "DISPONIVEL" : (novaDisp > 0 ? "PARCIAL" : "INDISPONIVEL"),
            };
          }
          return it;
        })
      );

      setSucessoEntrada(`Entrada de ${qtdNum} ${itemEntradaRapida.produto.unidadeVenda || "UN"} registrada com sucesso!`);
      
      // Notifica o HomeScreen para recarregar em background
      if (onEntradaSucesso) {
        onEntradaSucesso();
      }

      // Fecha o submodal após breve delay
      setTimeout(() => {
        fecharEntradaRapida();
      }, 1200);
    } catch (err: any) {
      console.error("[EntradaRapida] Erro ao registrar:", err);
      setErroEntrada(err?.response?.data?.error || err?.message || "Erro ao processar entrada de estoque.");
    } finally {
      setLoadingEntrada(false);
    }
  };

  const itensEmFalta = itensLocais.filter((item) => (Number(item.quantidadeFaltante) || 0) > 0);
  const itensDisponiveis = itensLocais.filter((item) => (Number(item.quantidadeFaltante) || 0) <= 0);

  const renderItemCard = (item: DisponibilidadeEstoqueItem, index: number) => {
    const prodId = item.produto?.id || index;
    const prodDesc = item.produto?.descricao || "Item sem descrição";
    const prodCod = item.produto?.codigoInterno || item.produto?.codigoBarras || null;
    const unidade = item.produto?.unidadeVenda || "UN";

    const qtdSolicitada = Number(item.quantidadeSolicitada ?? 0);
    const qtdDisponivel = Number(item.quantidadeDisponivel ?? 0);
    const qtdFaltante = Number(item.quantidadeFaltante ?? 0);

    const temFalta = qtdFaltante > 0;
    const excedente = qtdDisponivel - qtdSolicitada;
    const temExcedente = excedente > 0 && !temFalta;

    let badgeText = "DISPONÍVEL";
    let badgeBg = COLORS.successSoft;
    let badgeColor = COLORS.success;
    let cardBorderColor = COLORS.successBorder;

    if (temFalta) {
      if (qtdDisponivel > 0) {
        badgeText = "PARCIAL";
        badgeBg = COLORS.warningSoft;
        badgeColor = COLORS.warning;
        cardBorderColor = COLORS.warningBorder;
      } else {
        badgeText = "INDISPONÍVEL";
        badgeBg = COLORS.dangerSoft;
        badgeColor = COLORS.danger;
        cardBorderColor = COLORS.dangerBorder;
      }
    }

    return (
      <View
        key={prodId}
        style={[styles.itemCard, { borderColor: cardBorderColor, borderLeftColor: badgeColor }]}
      >
        {/* Cabeçalho do Item */}
        <View style={styles.itemCardHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.itemName}>{prodDesc}</Text>
            {prodCod && (
              <Text style={styles.itemCode}>Cód: {prodCod}</Text>
            )}
          </View>
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeText}</Text>
          </View>
        </View>

        {/* Grade de Saldos e Quantidades */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCol}>
            <Text style={styles.metricLabel}>PRECISA</Text>
            <Text style={styles.metricValue}>
              {formatarQtd(qtdSolicitada)} <Text style={styles.unitText}>{unidade}</Text>
            </Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricCol}>
            <Text style={styles.metricLabel}>EM ESTOQUE</Text>
            <Text style={[styles.metricValue, { color: qtdDisponivel > 0 ? COLORS.text : COLORS.danger }]}>
              {formatarQtd(qtdDisponivel)} <Text style={styles.unitText}>{unidade}</Text>
            </Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricCol}>
            <Text style={styles.metricLabel}>{temFalta ? "FALTA" : "SOBRANDO"}</Text>
            <Text
              style={[
                styles.metricValue,
                { color: temFalta ? COLORS.danger : temExcedente ? COLORS.success : COLORS.muted },
              ]}
            >
              {temFalta
                ? `${formatarQtd(qtdFaltante)} ${unidade}`
                : temExcedente
                ? `+${formatarQtd(excedente)} ${unidade}`
                : `0 ${unidade}`}
            </Text>
          </View>
        </View>

        {/* ── BOTÃO DE ENTRADA RÁPIDA ─── */}
        <TouchableOpacity
          style={[
            styles.entradaRapidaBtn,
            temFalta ? styles.entradaRapidaBtnFalta : styles.entradaRapidaBtnNormal,
          ]}
          onPress={() => abrirEntradaRapida(item)}
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons
            name="package-variant-plus"
            size={16}
            color={temFalta ? "#FFFFFF" : COLORS.primary}
          />
          <Text
            style={[
              styles.entradaRapidaBtnText,
              temFalta ? { color: "#FFFFFF" } : { color: COLORS.primary },
            ]}
          >
            {temFalta
              ? `Fazer Entrada Rápida (+${qtdFaltante} ${unidade})`
              : "Fazer Entrada deste Produto"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={pedido !== null}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          {pedido && (
            <View style={styles.mainContainer}>
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text style={styles.title}>Consulta de Saldos</Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {formatarNomeCliente(pedido.cliente)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeIcon}
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Fechar detalhes de estoque"
                >
                  <MaterialCommunityIcons name="close" size={22} color={COLORS.muted} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.itemsList}
                contentContainerStyle={styles.itemsContent}
                showsVerticalScrollIndicator={true}
              >
                {itensLocais.length === 0 ? (
                  <View style={styles.emptyState}>
                    <MaterialCommunityIcons name="database-alert-outline" size={40} color="#94A3B8" />
                    <Text style={styles.emptyTitle}>Saldos não encontrados</Text>
                    <Text style={styles.emptyText}>Este pedido não possui itens cadastrados.</Text>
                  </View>
                ) : (
                  <>
                    {itensEmFalta.length > 0 && (
                      <>
                        <View style={styles.sectionHeaderRow}>
                          <MaterialCommunityIcons name="alert-circle" size={16} color={COLORS.danger} />
                          <Text style={[styles.sectionTitle, { color: COLORS.danger }]}>
                            ITENS COM FALTA EM ESTOQUE ({itensEmFalta.length})
                          </Text>
                        </View>
                        {itensEmFalta.map(renderItemCard)}
                      </>
                    )}

                    {itensDisponiveis.length > 0 && (
                      <>
                        <View style={styles.sectionHeaderRow}>
                          <MaterialCommunityIcons name="check-circle" size={16} color={COLORS.success} />
                          <Text style={[styles.sectionTitle, { color: COLORS.success }]}>
                            ITENS COM SALDO DISPONÍVEL ({itensDisponiveis.length})
                          </Text>
                        </View>
                        {itensDisponiveis.map(renderItemCard)}
                      </>
                    )}
                  </>
                )}
              </ScrollView>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                accessibilityRole="button"
              >
                <Text style={styles.closeButtonText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* ── SUB-MODAL: ENTRADA RÁPIDA DE PRODUTO FALTANTE ─── */}
      <Modal
        visible={itemEntradaRapida !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={fecharEntradaRapida}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.subModalOverlay}
        >
          <View style={styles.subModalContent}>
            {itemEntradaRapida && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header do Sub-modal */}
                <View style={styles.subModalHeader}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={styles.subModalBadgeRow}>
                      <MaterialCommunityIcons name="plus-box" size={14} color={COLORS.primary} />
                      <Text style={styles.subModalBadgeText}>ENTRADA RÁPIDA</Text>
                    </View>
                    <Text style={styles.subModalTitle} numberOfLines={2}>
                      {itemEntradaRapida.produto.descricao}
                    </Text>
                    {itemEntradaRapida.produto.codigoInterno && (
                      <Text style={styles.subModalCode}>
                        Cód: {itemEntradaRapida.produto.codigoInterno}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity style={styles.subModalCloseBtn} onPress={fecharEntradaRapida}>
                    <MaterialCommunityIcons name="close" size={20} color={COLORS.muted} />
                  </TouchableOpacity>
                </View>

                {/* Banner de Falta */}
                {Number(itemEntradaRapida.quantidadeFaltante) > 0 && (
                  <View style={styles.faltaBanner}>
                    <MaterialCommunityIcons name="information" size={16} color={COLORS.danger} />
                    <Text style={styles.faltaBannerText}>
                      Quantidade faltante no pedido:{" "}
                      <Text style={{ fontWeight: "800" }}>
                        {itemEntradaRapida.quantidadeFaltante} {itemEntradaRapida.produto.unidadeVenda || "UN"}
                      </Text>
                    </Text>
                  </View>
                )}

                {/* Mensagens de feedback */}
                {erroEntrada && (
                  <View style={styles.errorAlert}>
                    <MaterialCommunityIcons name="alert-circle" size={16} color={COLORS.danger} />
                    <Text style={styles.errorAlertText}>{erroEntrada}</Text>
                  </View>
                )}
                {sucessoEntrada && (
                  <View style={styles.successAlert}>
                    <MaterialCommunityIcons name="check-circle" size={16} color={COLORS.success} />
                    <Text style={styles.successAlertText}>{sucessoEntrada}</Text>
                  </View>
                )}

                {/* Formulário de Entrada */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    QUANTIDADE A ENTRAR * ({itemEntradaRapida.produto.unidadeVenda || "UN"})
                  </Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="Ex: 10"
                    placeholderTextColor={COLORS.muted}
                    value={quantidadeEntrada}
                    onChangeText={setQuantidadeEntrada}
                  />

                  {/* Atalhos Rápidos de Quantidade */}
                  <View style={styles.quickQtyChipsRow}>
                    {Number(itemEntradaRapida.quantidadeFaltante) > 0 && (
                      <TouchableOpacity
                        style={[styles.quickQtyChip, styles.quickQtyChipHighlight]}
                        onPress={() => setQuantidadeEntrada(String(itemEntradaRapida.quantidadeFaltante))}
                      >
                        <Text style={styles.quickQtyChipHighlightText}>
                          Falta: {itemEntradaRapida.quantidadeFaltante}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {[5, 10, 20, 50, 100].map((q) => (
                      <TouchableOpacity
                        key={q}
                        style={styles.quickQtyChip}
                        onPress={() => setQuantidadeEntrada(String(q))}
                      >
                        <Text style={styles.quickQtyChipText}>+{q}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>LOTE (OPCIONAL)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: LOTE-001"
                    placeholderTextColor={COLORS.muted}
                    value={loteEntrada}
                    onChangeText={setLoteEntrada}
                  />
                </View>

                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.formLabel}>VALIDADE (DD/MM/AAAA)</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="DD/MM/AAAA"
                      placeholderTextColor={COLORS.muted}
                      maxLength={10}
                      value={validadeEntrada}
                      onChangeText={handleValidadeChange}
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>CUSTO UNIT. (R$)</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="0,00"
                      placeholderTextColor={COLORS.muted}
                      value={custoEntrada}
                      onChangeText={setCustoEntrada}
                    />
                  </View>
                </View>

                {localizacoes.length > 0 && (
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>LOCALIZAÇÃO DE ESTOQUE</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.locChipsRow}>
                      {localizacoes.map((loc) => (
                        <TouchableOpacity
                          key={loc.id}
                          style={[
                            styles.locChip,
                            localizacaoId === loc.id && styles.locChipActive,
                          ]}
                          onPress={() => setLocalizacaoId(loc.id)}
                        >
                          <Text
                            style={[
                              styles.locChipText,
                              localizacaoId === loc.id && styles.locChipTextActive,
                            ]}
                          >
                            {loc.nome}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>OBSERVAÇÃO</Text>
                  <TextInput
                    style={[styles.input, styles.inputMulti]}
                    placeholder="Observação da movimentação..."
                    placeholderTextColor={COLORS.muted}
                    multiline
                    numberOfLines={2}
                    value={observacaoEntrada}
                    onChangeText={setObservacaoEntrada}
                  />
                </View>

                {/* Ações do Sub-modal */}
                <View style={styles.subModalActionsRow}>
                  <TouchableOpacity
                    style={styles.subModalCancelBtn}
                    onPress={fecharEntradaRapida}
                    disabled={loadingEntrada}
                  >
                    <Text style={styles.subModalCancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.subModalConfirmBtn, loadingEntrada && { opacity: 0.7 }]}
                    onPress={submeterEntradaRapida}
                    disabled={loadingEntrada}
                  >
                    {loadingEntrada ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" />
                        <Text style={styles.subModalConfirmBtnText}>Confirmar Entrada</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  content: {
    width: "100%",
    maxWidth: 480,
    height: "82%",
    minHeight: 380,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    elevation: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
  },
  mainContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerText: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.primary,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.muted,
  },
  closeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  itemsList: {
    flex: 1,
    marginTop: 12,
    marginBottom: 12,
  },
  itemsContent: {
    paddingBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  itemCard: {
    padding: 12,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderLeftWidth: 5,
    elevation: 1,
  },
  itemCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  itemName: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
    lineHeight: 18,
  },
  itemCode: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  metricsGrid: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    marginBottom: 10,
  },
  metricCol: {
    flex: 1,
    alignItems: "center",
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.border,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: COLORS.muted,
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
  },
  unitText: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.muted,
  },
  entradaRapidaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  entradaRapidaBtnFalta: {
    backgroundColor: "#16A34A",
  },
  entradaRapidaBtnNormal: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: "#FECDD3",
  },
  entradaRapidaBtnText: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  emptyState: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  emptyText: {
    marginTop: 4,
    fontSize: 11,
    textAlign: "center",
    color: COLORS.muted,
  },
  closeButton: {
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  /* Submodal de Entrada Rápida */
  subModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  subModalContent: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "90%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    elevation: 16,
  },
  subModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 10,
  },
  subModalBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  subModalBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  subModalTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
    lineHeight: 18,
  },
  subModalCode: {
    fontSize: 10.5,
    color: COLORS.muted,
    marginTop: 1,
  },
  subModalCloseBtn: {
    padding: 4,
  },
  faltaBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  faltaBannerText: {
    fontSize: 11,
    color: COLORS.danger,
  },
  errorAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  errorAlertText: {
    fontSize: 11,
    color: COLORS.danger,
    fontWeight: "600",
    flex: 1,
  },
  successAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  successAlertText: {
    fontSize: 11,
    color: COLORS.success,
    fontWeight: "700",
    flex: 1,
  },
  formGroup: {
    marginBottom: 10,
  },
  formRow: {
    flexDirection: "row",
  },
  formLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: COLORS.slate700,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12.5,
    color: COLORS.text,
  },
  inputMulti: {
    minHeight: 48,
    textAlignVertical: "top",
  },
  quickQtyChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  quickQtyChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: COLORS.slate100,
    borderWidth: 1,
    borderColor: COLORS.slate200,
  },
  quickQtyChipText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: COLORS.slate700,
  },
  quickQtyChipHighlight: {
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC",
  },
  quickQtyChipHighlightText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#15803D",
  },
  locChipsRow: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 2,
  },
  locChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: COLORS.slate100,
    borderWidth: 1,
    borderColor: COLORS.slate200,
  },
  locChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  locChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.slate700,
  },
  locChipTextActive: {
    color: "#FFFFFF",
  },
  subModalActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  subModalCancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.slate100,
    borderWidth: 1,
    borderColor: COLORS.slate200,
  },
  subModalCancelBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.slate700,
  },
  subModalConfirmBtn: {
    flex: 1.5,
    height: 42,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#16A34A",
  },
  subModalConfirmBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});


import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput as RNTextInput,
  Modal,
  FlatList,
  StatusBar,
} from "react-native";
import { Button, Text, Surface, Divider } from "react-native-paper";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { EstoqueAPI } from "../api/estoque";
import { ProdutosAPI } from "../api/produtos";
import { Produto } from "../types/produto";
import { parseDecimalInput } from "../utils/number-parser";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type RoutePropType = RouteProp<RootStackParamList, "EntradaEstoque">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, "EntradaEstoque">;

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
  border: "#CBD5E1",

  primaryColor: "#C41230",
  successColor: "#16A34A",
  warningColor: "#D97706",
  warningBg: "#FEF3C7",
  dangerColor: "#DC2626",
  dangerBg: "#FEF2F2",
  infoColor: "#2563EB",
};

export const EntradaEstoqueScreen = () => {
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavigationProp>();

  const [produto, setProduto] = useState<Produto | undefined>(route.params?.produto);

  // Estados de busca caso o produto não tenha vindo por parâmetro
  const [buscaProduto, setBuscaProduto] = useState("");
  const [produtosEncontrados, setProdutosEncontrados] = useState<Produto[]>([]);
  const [loadingBusca, setLoadingBusca] = useState(false);

  // Estados do Formulário
  const [quantidade, setQuantidade] = useState("");
  const [codigoLote, setCodigoLote] = useState(route.params?.loteSugerido || "");
  const [validade, setValidade] = useState(route.params?.validadeSugerida || "");
  const [custoUnitario, setCustoUnitario] = useState("");
  const [observacao, setObservacao] = useState("");
  const [localizacoes, setLocalizacoes] = useState<{ id: number; nome: string }[]>([]);
  const [fornecedores, setFornecedores] = useState<{ id: number; razaoSocial: string }[]>([]);
  const [localizacaoId, setLocalizacaoId] = useState<number | null>(null);
  const [fornecedorId, setFornecedorId] = useState<number | null>(null);

  // Modais de Seleção
  const [showLocalizacaoModal, setShowLocalizacaoModal] = useState(false);
  const [showFornecedorModal, setShowFornecedorModal] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([EstoqueAPI.localizacoes(), EstoqueAPI.fornecedores()])
      .then(([locais, fornecedoresAtivos]) => {
        setLocalizacoes(locais || []);
        setFornecedores(fornecedoresAtivos || []);
      })
      .catch((err) => {
        console.warn("Informações opcionais de depósitos/fornecedores não carregadas:", err);
      });
  }, []);

  const clearFieldError = (fieldName: string) => {
    if (errors[fieldName]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[fieldName];
        return copy;
      });
    }
  };

  const buscarProdutos = async () => {
    if (buscaProduto.trim().length < 2) {
      return Alert.alert("Busca", "Digite ao menos 2 caracteres para pesquisar o produto.");
    }
    setLoadingBusca(true);
    try {
      const res = await ProdutosAPI.buscarPorTexto(buscaProduto.trim());
      setProdutosEncontrados(res || []);
      if (!res || res.length === 0) {
        Alert.alert("Busca", "Nenhum produto encontrado.");
      }
    } catch {
      Alert.alert("Erro", "Erro ao buscar produtos.");
    } finally {
      setLoadingBusca(false);
    }
  };

  const handleValidadeChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    let formatted = cleaned;
    if (cleaned.length > 2 && cleaned.length <= 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    } else if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
    }
    setValidade(formatted);
    clearFieldError("validade");
  };

  const convertToISODate = (val: string): string => {
    const [day, month, year] = val.split("/");
    return `${year}-${month}-${day}`;
  };

  const handleSubmeter = async () => {
    const newErrors: Record<string, string> = {};

    if (!produto) {
      Alert.alert("Produto Obrigatório", "Selecione o produto antes de dar entrada no estoque.");
      return;
    }

    // 1. Quantidade (Obrigatório)
    const parsedQtd = parseDecimalInput(quantidade);
    if (!quantidade.trim() || parsedQtd === undefined || parsedQtd <= 0) {
      newErrors.quantidade = "Informe uma quantidade válida maior que zero.";
    }

    // 2. Lote (Obrigatório apenas se produto.controlaLote === true)
    if (produto.controlaLote && !codigoLote.trim()) {
      newErrors.codigoLote = "Código do lote é obrigatório para este produto.";
    }

    // 3. Validade (Obrigatório apenas se produto.controlaValidade === true)
    if (produto.controlaValidade && !validade.trim()) {
      newErrors.validade = "Data de validade é obrigatória para este produto.";
    } else if (validade.trim()) {
      const regex = /^\d{2}\/\d{2}\/\d{4}$/;
      if (!regex.test(validade.trim())) {
        newErrors.validade = "Formato de data inválido. Use DD/MM/AAAA.";
      } else {
        const [day, month, year] = validade.split("/").map(Number);
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
          newErrors.validade = "Data de validade inválida.";
        } else {
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          if (date < hoje) {
            newErrors.validade = `Este lote venceu em ${validade}. Entrada não permitida para produtos vencidos.`;
          }
        }
      }
    }

    // 4. Custo unitário (Opcional)
    let parsedCusto: number | undefined;
    if (custoUnitario.trim()) {
      parsedCusto = parseDecimalInput(custoUnitario);
      if (parsedCusto === undefined || parsedCusto < 0) {
        newErrors.custoUnitario = "O custo unitário deve ser um número não negativo.";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const bulletList = Object.values(newErrors)
        .map((msg) => `• ${msg}`)
        .join("\n");
      Alert.alert(
        "Campos com Pendências",
        `Por favor, preencha os dados necessários antes de confirmar:\n\n${bulletList}`
      );
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const payload = {
        produtoId: produto.id,
        quantidade: parsedQtd!,
        codigoLote: codigoLote.trim() || undefined,
        validade: validade.trim() ? convertToISODate(validade.trim()) : undefined,
        custoUnitario: parsedCusto,
        observacao: observacao.trim() || undefined,
        fornecedorId: fornecedorId ?? undefined,
        localizacaoId: localizacaoId ?? undefined,
      };

      await EstoqueAPI.entrada(payload);

      Alert.alert(
        "Entrada Confirmada",
        `Entrada de ${parsedQtd} ${produto.unidade || "UN"} realizada com sucesso no estoque!`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      console.error("Erro na entrada de estoque:", err);
      if (err.response?.data?.details?.fieldErrors) {
        const backendErrors = err.response.data.details.fieldErrors;
        const newErrObj: Record<string, string> = {};
        const bulletList: string[] = [];
        Object.entries(backendErrors).forEach(([field, msgs]: any) => {
          const message = Array.isArray(msgs) ? msgs.join(", ") : String(msgs);
          newErrObj[field] = message;
          bulletList.push(`• ${field}: ${message}`);
        });
        setErrors(newErrObj);
        Alert.alert("Campos Inválidos no Servidor", `O ERP rejeitou a entrada:\n\n${bulletList.join("\n")}`);
      } else {
        const msg =
          err.response?.data?.error ||
          err.message ||
          "Ocorreu um erro ao registrar a entrada no ERP. Verifique os dados e tente novamente.";
        Alert.alert("Erro ao Dar Entrada", msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const selectedLocalNome = localizacoes.find((l) => l.id === localizacaoId)?.nome;
  const selectedFornecedorNome = fornecedores.find((f) => f.id === fornecedorId)?.razaoSocial;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.headerBg} />

      {/* ── Header ─── */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Dar Entrada no Estoque</Text>
          <Text style={s.headerSubtitle}>Registro Físico e Lançamento de Saldo</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!produto ? (
          <Surface style={s.card} elevation={1}>
            <Text style={s.cardTitle}>Selecione o Produto para Entrada</Text>
            <Text style={s.cardSub}>Pesquise por nome, SKU ou use o leitor de código de barras:</Text>

            <View style={s.searchRow}>
              <RNTextInput
                style={[s.input, { flex: 1 }]}
                placeholder="Nome, código interno ou EAN..."
                placeholderTextColor={C.slate500}
                value={buscaProduto}
                onChangeText={setBuscaProduto}
              />
              <Button mode="contained" onPress={buscarProdutos} loading={loadingBusca} style={s.btnPrimary}>
                Buscar
              </Button>
            </View>

            <Button
              mode="contained-tonal"
              icon="barcode-scan"
              onPress={() => navigation.navigate("Scanner", { action: "EntradaEstoque" })}
              style={{ marginTop: 12 }}
            >
              Escanear Código com a Câmera
            </Button>

            {produtosEncontrados.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={s.productSelectCard}
                onPress={() => {
                  setProduto(p);
                  setProdutosEncontrados([]);
                }}
              >
                <MaterialCommunityIcons name="package-variant" size={24} color={C.primaryColor} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.productSelectTitle}>{p.nome}</Text>
                  <Text style={s.productSelectSub}>
                    SKU: {p.codigoInterno || "N/A"} • Un: {p.unidade || "UN"}
                    {p.controlaLote ? " • [Exige Lote]" : ""}
                    {p.controlaValidade ? " • [Exige Validade]" : ""}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={C.slate500} />
              </TouchableOpacity>
            ))}
          </Surface>
        ) : (
          <Surface style={s.card} elevation={1}>
            {/* Produto Selecionado */}
            <View style={s.selectedProductBox}>
              <View style={{ flex: 1 }}>
                <Text style={s.selectedProductName}>{produto.nome}</Text>
                <Text style={s.selectedProductSub}>
                  SKU: {produto.codigoInterno || "N/A"} • Unidade: {produto.unidade || "UN"}
                </Text>
                <View style={s.rulesRow}>
                  <View style={[s.ruleTag, produto.controlaLote ? s.ruleTagActive : s.ruleTagInactive]}>
                    <MaterialCommunityIcons
                      name={produto.controlaLote ? "check-circle" : "close-circle"}
                      size={12}
                      color={produto.controlaLote ? C.primaryColor : C.slate500}
                    />
                    <Text style={[s.ruleTagText, produto.controlaLote ? { color: C.primaryColor } : { color: C.slate500 }]}>
                      {produto.controlaLote ? "Lote Obrigatório" : "Lote Opcional"}
                    </Text>
                  </View>
                  <View style={[s.ruleTag, produto.controlaValidade ? s.ruleTagActive : s.ruleTagInactive, { marginLeft: 6 }]}>
                    <MaterialCommunityIcons
                      name={produto.controlaValidade ? "calendar-check" : "calendar-remove"}
                      size={12}
                      color={produto.controlaValidade ? C.primaryColor : C.slate500}
                    />
                    <Text style={[s.ruleTagText, produto.controlaValidade ? { color: C.primaryColor } : { color: C.slate500 }]}>
                      {produto.controlaValidade ? "Validade Obrigatória" : "Validade Opcional"}
                    </Text>
                  </View>
                </View>
              </View>
              <Button mode="text" compact onPress={() => setProduto(undefined)} textColor={C.dangerColor}>
                Trocar
              </Button>
            </View>

            <Divider style={{ marginVertical: 14 }} />

            {/* Quantidade */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>
                Quantidade ({produto.unidade || "UN"}) <Text style={s.requiredMark}>* (Obrigatório)</Text>
              </Text>
              <RNTextInput
                style={[s.input, errors.quantidade ? s.inputError : null]}
                placeholder="Ex: 50 ou 12,5"
                placeholderTextColor={C.slate500}
                value={quantidade}
                onChangeText={(t) => {
                  setQuantidade(t);
                  clearFieldError("quantidade");
                }}
                keyboardType="numeric"
                editable={!isLoading}
              />
              {errors.quantidade && <Text style={s.errorText}>⚠️ {errors.quantidade}</Text>}
            </View>

            {/* Código do Lote */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>
                Código do Lote{" "}
                {produto.controlaLote ? (
                  <Text style={s.requiredMark}>* (Obrigatório para este produto)</Text>
                ) : (
                  <Text style={s.optionalLabel}>(Opcional)</Text>
                )}
              </Text>
              <RNTextInput
                style={[s.input, errors.codigoLote ? s.inputError : null]}
                placeholder="Ex: LOTE-2026-X1"
                placeholderTextColor={C.slate500}
                value={codigoLote}
                onChangeText={(t) => {
                  setCodigoLote(t);
                  clearFieldError("codigoLote");
                }}
                autoCapitalize="characters"
                editable={!isLoading}
              />
              {errors.codigoLote && <Text style={s.errorText}>⚠️ {errors.codigoLote}</Text>}
            </View>

            {/* Data de Validade */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>
                Data de Validade{" "}
                {produto.controlaValidade ? (
                  <Text style={s.requiredMark}>* (Obrigatório - DD/MM/AAAA)</Text>
                ) : (
                  <Text style={s.optionalLabel}>(Opcional - DD/MM/AAAA)</Text>
                )}
              </Text>
              <RNTextInput
                style={[s.input, errors.validade ? s.inputError : null]}
                placeholder="Ex: 31/12/2026"
                placeholderTextColor={C.slate500}
                value={validade}
                onChangeText={handleValidadeChange}
                keyboardType="numeric"
                maxLength={10}
                editable={!isLoading}
              />
              {errors.validade && <Text style={s.errorText}>⚠️ {errors.validade}</Text>}
            </View>

            {/* Depósito / Localização (Opcional) */}
            {localizacoes.length > 0 && (
              <View style={s.fieldGroup}>
                <Text style={s.label}>
                  Depósito / Localização <Text style={s.optionalLabel}>(Opcional)</Text>
                </Text>
                <TouchableOpacity
                  style={s.selectBtn}
                  onPress={() => setShowLocalizacaoModal(true)}
                  disabled={isLoading}
                >
                  <Text style={[s.selectBtnText, !selectedLocalNome && { color: C.slate500 }]}>
                    {selectedLocalNome || "Nenhum / Padrão (Opcional)"}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={C.slate700} />
                </TouchableOpacity>
              </View>
            )}

            {/* Fornecedor (Opcional) */}
            {fornecedores.length > 0 && (
              <View style={s.fieldGroup}>
                <Text style={s.label}>
                  Fornecedor <Text style={s.optionalLabel}>(Opcional)</Text>
                </Text>
                <TouchableOpacity
                  style={s.selectBtn}
                  onPress={() => setShowFornecedorModal(true)}
                  disabled={isLoading}
                >
                  <Text style={[s.selectBtnText, !selectedFornecedorNome && { color: C.slate500 }]}>
                    {selectedFornecedorNome || "Nenhum selecionado (Opcional)"}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={C.slate700} />
                </TouchableOpacity>
              </View>
            )}

            {/* Custo Unitário */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>
                Custo Unitário de Entrada (R$) <Text style={s.optionalLabel}>(Opcional)</Text>
              </Text>
              <RNTextInput
                style={[s.input, errors.custoUnitario ? s.inputError : null]}
                placeholder="0,00"
                placeholderTextColor={C.slate500}
                value={custoUnitario}
                onChangeText={(t) => {
                  setCustoUnitario(t);
                  clearFieldError("custoUnitario");
                }}
                keyboardType="numeric"
                editable={!isLoading}
              />
              {errors.custoUnitario && <Text style={s.errorText}>⚠️ {errors.custoUnitario}</Text>}
            </View>

            {/* Observações */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>
                Observações da Entrada <Text style={s.optionalLabel}>(Opcional)</Text>
              </Text>
              <RNTextInput
                style={[s.input, { minHeight: 65, textAlignVertical: "top" }]}
                placeholder="Ex: Recebimento físico, nota fiscal ou observações adicionais..."
                placeholderTextColor={C.slate500}
                value={observacao}
                onChangeText={setObservacao}
                multiline
                numberOfLines={2}
                editable={!isLoading}
              />
            </View>

            {/* Botões */}
            <View style={s.btnRow}>
              <Button mode="outlined" onPress={() => navigation.goBack()} disabled={isLoading} style={{ flex: 1 }}>
                Cancelar
              </Button>
              <Button
                mode="contained"
                onPress={handleSubmeter}
                loading={isLoading}
                disabled={isLoading}
                style={[s.btnPrimary, { flex: 1, marginLeft: 10 }]}
              >
                Confirmar Entrada
              </Button>
            </View>
          </Surface>
        )}
      </ScrollView>

      {/* Modal de Localização / Depósito */}
      <Modal visible={showLocalizacaoModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <Surface style={s.modalContainer} elevation={4}>
            <Text style={s.modalTitle}>Selecione o Depósito (Opcional)</Text>
            <Divider style={{ marginVertical: 10 }} />
            <FlatList
              data={localizacoes}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.modalItem}
                  onPress={() => {
                    setLocalizacaoId(item.id);
                    clearFieldError("localizacaoId");
                    setShowLocalizacaoModal(false);
                  }}
                >
                  <Text style={s.modalItemText}>{item.nome}</Text>
                  {localizacaoId === item.id && (
                    <MaterialCommunityIcons name="check" size={20} color={C.primaryColor} />
                  )}
                </TouchableOpacity>
              )}
            />
            <Button
              mode="outlined"
              onPress={() => {
                setLocalizacaoId(null);
                setShowLocalizacaoModal(false);
              }}
              style={{ marginTop: 8 }}
            >
              Nenhum / Não Utilizar
            </Button>
            <Button
              mode="contained"
              onPress={() => setShowLocalizacaoModal(false)}
              style={[s.btnPrimary, { marginTop: 6 }]}
            >
              Fechar
            </Button>
          </Surface>
        </View>
      </Modal>

      {/* Modal de Fornecedor */}
      <Modal visible={showFornecedorModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <Surface style={s.modalContainer} elevation={4}>
            <Text style={s.modalTitle}>Selecione o Fornecedor (Opcional)</Text>
            <Divider style={{ marginVertical: 10 }} />
            <FlatList
              data={fornecedores}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.modalItem}
                  onPress={() => {
                    setFornecedorId(item.id);
                    setShowFornecedorModal(false);
                  }}
                >
                  <Text style={s.modalItemText}>{item.razaoSocial}</Text>
                  {fornecedorId === item.id && (
                    <MaterialCommunityIcons name="check" size={20} color={C.primaryColor} />
                  )}
                </TouchableOpacity>
              )}
            />
            <Button
              mode="outlined"
              onPress={() => {
                setFornecedorId(null);
                setShowFornecedorModal(false);
              }}
              style={{ marginTop: 8 }}
            >
              Nenhum / Não Informar
            </Button>
            <Button
              mode="contained"
              onPress={() => setShowFornecedorModal(false)}
              style={[s.btnPrimary, { marginTop: 6 }]}
            >
              Fechar
            </Button>
          </Surface>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.headerBg,
    paddingTop: Platform.OS === "android" ? 45 : 55,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 11, color: "rgba(255, 255, 255, 0.8)", marginTop: 1 },
  scrollContent: { padding: 16 },
  card: { backgroundColor: C.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.border },
  cardTitle: { fontSize: 16, fontWeight: "800", color: C.slate900 },
  cardSub: { fontSize: 12, color: C.slate500, marginTop: 4, marginBottom: 14 },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  btnPrimary: { backgroundColor: C.primaryColor, borderRadius: 8 },
  productSelectCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.slate100,
    marginTop: 8,
  },
  productSelectTitle: { fontSize: 13, fontWeight: "700", color: C.slate900 },
  productSelectSub: { fontSize: 11, color: C.slate500, marginTop: 2 },
  selectedProductBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.slate100,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  selectedProductName: { fontSize: 14, fontWeight: "800", color: C.slate900 },
  selectedProductSub: { fontSize: 11, color: C.slate500, marginTop: 2 },
  rulesRow: { flexDirection: "row", marginTop: 6 },
  ruleTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
  },
  ruleTagActive: {
    borderColor: "rgba(196, 18, 48, 0.2)",
    backgroundColor: "rgba(196, 18, 48, 0.05)",
  },
  ruleTagInactive: {
    borderColor: C.border,
    backgroundColor: C.slate100,
  },
  ruleTagText: { fontSize: 10, fontWeight: "700" },
  fieldGroup: {
    gap: 4,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: C.slate700,
  },
  requiredMark: {
    color: C.dangerColor,
    fontWeight: "800",
  },
  optionalLabel: {
    color: C.slate500,
    fontWeight: "400",
  },
  input: {
    backgroundColor: C.slate100,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1.5,
    borderColor: C.border,
    fontSize: 13,
    color: C.slate900,
  },
  inputError: {
    borderColor: C.dangerColor,
    backgroundColor: C.dangerBg,
  },
  errorText: {
    fontSize: 11,
    fontWeight: "600",
    color: C.dangerColor,
    marginTop: 2,
  },
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.slate100,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  selectBtnText: {
    fontSize: 13,
    color: C.slate900,
  },
  btnRow: { flexDirection: "row", marginTop: 16 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: C.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: "75%",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: C.slate900,
  },
  modalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.slate100,
  },
  modalItemText: {
    fontSize: 14,
    color: C.slate700,
    fontWeight: "600",
  },
});

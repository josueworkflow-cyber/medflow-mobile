import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput as RNTextInput,
  Switch,
  Modal,
  FlatList,
} from "react-native";
import { Text, ActivityIndicator, IconButton, Surface } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
import { RootStackParamList } from "../types/navigation";
import { ProdutosAPI } from "../api/produtos";
import { z } from "zod";
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "CadastroProduto">;

// Design tokens slate
const C = {
  bg: "#F8FAFC",          // slate-50
  white: "#FFFFFF",
  slate100: "#F1F5F9",    // slate-100
  slate200: "#E2E8F0",    // slate-200
  slate300: "#CBD5E1",    // slate-300
  slate400: "#94A3B8",    // slate-400
  slate500: "#64748B",    // slate-500
  slate700: "#334155",    // slate-700
  slate900: "#0F172A",    // slate-900
  blue50: "#EFF6FF",
  blue100: "#DBEAFE",
  blue600: "#2563EB",
  red50: "#FEF2F2",
  red100: "#FEE2E2",
  red600: "#DC2626",
};

// Opções estáticas
const OPCOES_APRESENTACAO = [
  "AMPOLA", "FRASCO", "CAIXA", "SACHE", "BOLSA", 
  "SERINGA", "TUBO", "BLISTER", "BOMBONA", 
  "LATA", "GALERIA", "UNIDADE", "OUTRA"
];

const OPCOES_CLASSE_RISCO = ["I", "II", "III", "IV"];

const onlyDigits = (value: string | null | undefined) => {
  return value ? value.replace(/\D/g, "") : "";
};

const optionalFiscalCodeSchema = (size: number, label: string) =>
  z.string().nullable().optional().refine((value) => {
    if (!value) return true;
    const clean = onlyDigits(value);
    return clean.length === 0 || clean.length === size;
  }, `${label} deve conter exatamente ${size} dígitos numéricos.`);

const cadastroSchema = z.object({
  descricao: z.string().min(3, "A descrição deve ter pelo menos 3 caracteres."),
  codigoBarras: z.string().optional(),
  codigoInterno: z.string().optional(),
  fabricante: z.string().optional(),
  cnpjFabricante: z.string().optional(),
  codigoFabricante: z.string().optional(),
  marca: z.string().optional(),
  unidadeVenda: z.string().optional(),
  unidadeCompra: z.string().optional(),
  fatorConversao: z.coerce.number().optional().default(1),

  registroAnvisa: z.string().optional(),
  temperaturaArmazenamento: z.string().optional(),
  principioAtivo: z.string().optional(),
  concentracaoValor: z.coerce.number().nullable().optional(),
  concentracaoUnidade: z.string().optional(),
  conteudoEmbalagem: z.coerce.number().int().nullable().optional(),
  apresentacao: z.string().nullable().optional(),
  classeRisco: z.string().nullable().optional(),
  tamanho: z.string().optional(),
  observacoes: z.string().optional(),

  precoCustoBase: z.coerce.number().optional().default(0),
  precoVendaBase: z.coerce.number().optional().default(0),
  estoqueMinimo: z.coerce.number().optional().default(0),
  estoqueMaximo: z.coerce.number().nullable().optional(),
  pontoReposicao: z.coerce.number().nullable().optional(),
  localizacaoEstoque: z.string().optional(),
  controlaValidade: z.boolean().optional(),
  controlaLote: z.boolean().optional(),
  categoriaId: z.coerce.number().int().nullable().optional(),

  ncm: optionalFiscalCodeSchema(8, "NCM"),
  cfop: optionalFiscalCodeSchema(4, "CFOP"),
  cst: z.string().optional(),
  csosn: z.string().optional(),
  cest: optionalFiscalCodeSchema(7, "CEST"),
  origemMercadoria: z.string().optional(),
  unidadeFiscal: z.string().optional(),
  tipoClassificacaoFiscal: z.string().optional(),
  aliquotaIcms: z.coerce.number().nullable().optional(),
  aliquotaIpi: z.coerce.number().nullable().optional(),
  aliquotaPis: z.coerce.number().nullable().optional(),
  aliquotaCofins: z.coerce.number().nullable().optional(),
  codigoBeneficioFiscal: z.string().optional(),
});

type TabType = "geral" | "tecnico" | "estoque" | "fiscal";

export const CadastroProdutoScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [permission, requestPermission] = useCameraPermissions();

  const [activeTab, setActiveTab] = useState<TabType>("geral");

  // --- Estados do Formulário ---
  // Geral
  const [descricao, setDescricao] = useState("");
  const [codigoBarras, setCodigoBarras] = useState("");
  const [codigoInterno, setCodigoInterno] = useState("");
  const [fabricante, setFabricante] = useState("");
  const [cnpjFabricante, setCnpjFabricante] = useState("");
  const [codigoFabricante, setCodigoFabricante] = useState("");
  const [marca, setMarca] = useState("");
  const [unidadeVenda, setUnidadeVenda] = useState("UN");
  const [unidadeCompra, setUnidadeCompra] = useState("");
  const [fatorConversao, setFatorConversao] = useState("1");

  // Técnico
  const [registroAnvisa, setRegistroAnvisa] = useState("");
  const [temperaturaArmazenamento, setTemperaturaArmazenamento] = useState("");
  const [principioAtivo, setPrincipioAtivo] = useState("");
  const [concentracaoValor, setConcentracaoValor] = useState("");
  const [concentracaoUnidade, setConcentracaoUnidade] = useState("");
  const [conteudoEmbalagem, setConteudoEmbalagem] = useState("");
  const [apresentacao, setApresentacao] = useState<string | null>(null);
  const [classeRisco, setClasseRisco] = useState<string | null>(null);
  const [tamanho, setTamanho] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Estoque
  const [precoCustoBase, setPrecoCustoBase] = useState("");
  const [precoVendaBase, setPrecoVendaBase] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState("");
  const [estoqueMaximo, setEstoqueMaximo] = useState("");
  const [pontoReposicao, setPontoReposicao] = useState("");
  const [localizacaoEstoque, setLocalizacaoEstoque] = useState("");
  const [controlaValidade, setControlaValidade] = useState(false);
  const [controlaLote, setControlaLote] = useState(false);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);

  // Fiscal
  const [ncm, setNcm] = useState("");
  const [cfop, setCfop] = useState("");
  const [cst, setCst] = useState("");
  const [csosn, setCsosn] = useState("");
  const [cest, setCest] = useState("");
  const [origemMercadoria, setOrigemMercadoria] = useState("");
  const [unidadeFiscal, setUnidadeFiscal] = useState("");
  const [tipoClassificacaoFiscal, setTipoClassificacaoFiscal] = useState("");
  const [aliquotaIcms, setAliquotaIcms] = useState("");
  const [aliquotaIpi, setAliquotaIpi] = useState("");
  const [aliquotaPis, setAliquotaPis] = useState("");
  const [aliquotaCofins, setAliquotaCofins] = useState("");
  const [codigoBeneficioFiscal, setCodigoBeneficioFiscal] = useState("");

  // Controladores de UI
  const [isLoading, setIsLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Categorias vindas do ERP
  const [categorias, setCategorias] = useState<{ id: number; nome: string }[]>([]);
  const [selectedCategoriaNome, setSelectedCategoriaNome] = useState<string | null>(null);

  // Modais de Seleção
  const [showCategoriaModal, setShowCategoriaModal] = useState(false);
  const [showApresentacaoModal, setShowApresentacaoModal] = useState(false);
  const [showClasseRiscoModal, setShowClasseRiscoModal] = useState(false);

  useEffect(() => {
    ProdutosAPI.buscarCategorias()
      .then((res) => {
        setCategorias(res.flat || []);
      })
      .catch((err) => console.error("Erro ao carregar categorias do ERP:", err));
  }, []);

  const handleOpenScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert(
          "Acesso Negado",
          "Precisamos de permissão de câmera para ler códigos de barras."
        );
        return;
      }
    }
    setShowCamera(true);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    setCodigoBarras(data);
    setShowCamera(false);
  };

  const handleSalvar = async () => {
    const fields = {
      descricao: descricao.trim(),
      codigoBarras: codigoBarras.trim() || undefined,
      codigoInterno: codigoInterno.trim() || undefined,
      fabricante: fabricante.trim() || undefined,
      cnpjFabricante: cnpjFabricante.trim() || undefined,
      codigoFabricante: codigoFabricante.trim() || undefined,
      marca: marca.trim() || undefined,
      unidadeVenda: unidadeVenda.trim() || "UN",
      unidadeCompra: unidadeCompra.trim() || undefined,
      fatorConversao: fatorConversao ? Number(fatorConversao) : 1,

      registroAnvisa: registroAnvisa.trim() || undefined,
      temperaturaArmazenamento: temperaturaArmazenamento.trim() || undefined,
      principioAtivo: principioAtivo.trim() || undefined,
      concentracaoValor: concentracaoValor ? Number(concentracaoValor) : undefined,
      concentracaoUnidade: concentracaoUnidade.trim() || undefined,
      conteudoEmbalagem: conteudoEmbalagem ? Number(conteudoEmbalagem) : undefined,
      apresentacao: apresentacao || undefined,
      classeRisco: classeRisco || undefined,
      tamanho: tamanho.trim() || undefined,
      observacoes: observacoes.trim() || undefined,

      precoCustoBase: precoCustoBase ? Number(precoCustoBase) : 0,
      precoVendaBase: precoVendaBase ? Number(precoVendaBase) : 0,
      estoqueMinimo: estoqueMinimo ? Number(estoqueMinimo) : 0,
      estoqueMaximo: estoqueMaximo ? Number(estoqueMaximo) : undefined,
      pontoReposicao: pontoReposicao ? Number(pontoReposicao) : undefined,
      localizacaoEstoque: localizacaoEstoque.trim() || undefined,
      controlaValidade,
      controlaLote,
      categoriaId: categoriaId || undefined,

      ncm: ncm.trim() || undefined,
      cfop: cfop.trim() || undefined,
      cst: cst.trim() || undefined,
      csosn: csosn.trim() || undefined,
      cest: cest.trim() || undefined,
      origemMercadoria: origemMercadoria.trim() || undefined,
      unidadeFiscal: unidadeFiscal.trim() || undefined,
      tipoClassificacaoFiscal: tipoClassificacaoFiscal.trim() || undefined,
      aliquotaIcms: aliquotaIcms ? Number(aliquotaIcms) : undefined,
      aliquotaIpi: aliquotaIpi ? Number(aliquotaIpi) : undefined,
      aliquotaPis: aliquotaPis ? Number(aliquotaPis) : undefined,
      aliquotaCofins: aliquotaCofins ? Number(aliquotaCofins) : undefined,
      codigoBeneficioFiscal: codigoBeneficioFiscal.trim() || undefined,
    };

    const parsed = cadastroSchema.safeParse(fields);
    if (!parsed.success) {
      const formattedErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) {
          formattedErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(formattedErrors);
      
      // Muda a aba para a aba que contém o primeiro erro para guiar o usuário
      const errorKeys = Object.keys(formattedErrors);
      if (errorKeys.includes("descricao") || errorKeys.includes("codigoBarras")) {
        setActiveTab("geral");
      } else if (errorKeys.includes("ncm") || errorKeys.includes("cfop") || errorKeys.includes("cest")) {
        setActiveTab("fiscal");
      }
      
      Alert.alert("Erro de Validação", "Alguns campos foram preenchidos incorretamente. Verifique as abas.");
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      await ProdutosAPI.criar(fields);
      Alert.alert("Sucesso", "Produto cadastrado com sucesso no ERP!", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      console.error(err);
      const apiError =
        err.response?.data?.error ||
        "Não foi possível cadastrar o produto no ERP. Verifique os dados e tente novamente.";
      Alert.alert("Erro ao Cadastrar", apiError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <IconButton icon="arrow-left" iconColor={C.slate900} size={24} onPress={() => navigation.goBack()} />
        <Text style={s.headerTitle}>Novo Produto (Completo)</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Tabs horizontais */}
      <View style={s.tabBarArea}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBarScroll}>
          {(["geral", "tecnico", "estoque", "fiscal"] as TabType[]).map((tab) => {
            const active = activeTab === tab;
            const labels: Record<TabType, string> = {
              geral: "1. Geral",
              tecnico: "2. Técnico",
              estoque: "3. Estoque",
              fiscal: "4. Fiscal",
            };
            return (
              <TouchableOpacity
                key={tab}
                style={[s.tabButton, active && s.tabButtonActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text style={[s.tabText, active && s.tabTextActive]}>
                  {labels[tab]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.card}>
            {/* ─── ABA GERAL ─── */}
            {activeTab === "geral" && (
              <View>
                <Text style={s.tabSectionHeader}>Informações Gerais</Text>

                <View style={s.fieldGroup}>
                  <Text style={s.label}>Descrição do Produto *</Text>
                  <RNTextInput
                    style={[s.input, errors.descricao ? s.inputError : null]}
                    placeholder="Ex: Amoxicilina 500mg"
                    placeholderTextColor={C.slate400}
                    value={descricao}
                    onChangeText={(t) => { setDescricao(t); setErrors(p => ({ ...p, descricao: "" })); }}
                    editable={!isLoading}
                  />
                  {errors.descricao && <Text style={s.errorText}>{errors.descricao}</Text>}
                </View>

                <View style={s.fieldGroup}>
                  <Text style={s.label}>Código de Barras (EAN)</Text>
                  <View style={s.searchRow}>
                    <RNTextInput
                      style={[s.input, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                      placeholder="Código de barras EAN"
                      placeholderTextColor={C.slate400}
                      value={codigoBarras}
                      onChangeText={setCodigoBarras}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                    <TouchableOpacity style={s.scanBtn} onPress={handleOpenScanner} disabled={isLoading} activeOpacity={0.7}>
                      <Icon name="barcode-scan" size={20} color={C.white} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>Código Interno</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="MED-102"
                      placeholderTextColor={C.slate400}
                      value={codigoInterno}
                      onChangeText={setCodigoInterno}
                      autoCapitalize="characters"
                      editable={!isLoading}
                    />
                  </View>
                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 12 }]}>
                    <Text style={s.label}>Marca</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="Ex: Medley"
                      placeholderTextColor={C.slate400}
                      value={marca}
                      onChangeText={setMarca}
                      editable={!isLoading}
                    />
                  </View>
                </View>

                <View style={s.fieldGroup}>
                  <Text style={s.label}>Fabricante</Text>
                  <RNTextInput
                    style={s.input}
                    placeholder="Nome do Fabricante/Laboratório"
                    placeholderTextColor={C.slate400}
                    value={fabricante}
                    onChangeText={setFabricante}
                    editable={!isLoading}
                  />
                </View>

                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>CNPJ Fabricante</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="00.000.000/0000-00"
                      placeholderTextColor={C.slate400}
                      value={cnpjFabricante}
                      onChangeText={setCnpjFabricante}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                  </View>
                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 12 }]}>
                    <Text style={s.label}>Cód. Fabricante</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="Ex: FAB-998"
                      placeholderTextColor={C.slate400}
                      value={codigoFabricante}
                      onChangeText={setCodigoFabricante}
                      autoCapitalize="characters"
                      editable={!isLoading}
                    />
                  </View>
                </View>

                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>Unid. Venda</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="UN"
                      placeholderTextColor={C.slate400}
                      value={unidadeVenda}
                      onChangeText={setUnidadeVenda}
                      autoCapitalize="characters"
                      editable={!isLoading}
                    />
                  </View>
                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 12 }]}>
                    <Text style={s.label}>Unid. Compra</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="CX"
                      placeholderTextColor={C.slate400}
                      value={unidadeCompra}
                      onChangeText={setUnidadeCompra}
                      autoCapitalize="characters"
                      editable={!isLoading}
                    />
                  </View>
                </View>

                <View style={s.fieldGroup}>
                  <Text style={s.label}>Fator de Conversão de Compra</Text>
                  <RNTextInput
                    style={s.input}
                    placeholder="1"
                    placeholderTextColor={C.slate400}
                    value={fatorConversao}
                    onChangeText={setFatorConversao}
                    keyboardType="numeric"
                    editable={!isLoading}
                  />
                  <Text style={s.helper}>Quantas unidades de venda vem na unidade de compra (ex: Caixa com 12 = 12)</Text>
                </View>
              </View>
            )}

            {/* ─── ABA TÉCNICO ─── */}
            {activeTab === "tecnico" && (
              <View>
                <Text style={s.tabSectionHeader}>Especificações Clínicas / Técnicas</Text>

                <View style={s.fieldGroup}>
                  <Text style={s.label}>Registro ANVISA</Text>
                  <RNTextInput
                    style={s.input}
                    placeholder="Número do Registro Anvisa"
                    placeholderTextColor={C.slate400}
                    value={registroAnvisa}
                    onChangeText={setRegistroAnvisa}
                    keyboardType="numeric"
                    editable={!isLoading}
                  />
                </View>

                <View style={s.fieldGroup}>
                  <Text style={s.label}>Princípio Ativo</Text>
                  <RNTextInput
                    style={s.input}
                    placeholder="Ex: Paracetamol"
                    placeholderTextColor={C.slate400}
                    value={principioAtivo}
                    onChangeText={setPrincipioAtivo}
                    editable={!isLoading}
                  />
                </View>

                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>Concentração (Valor)</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="Ex: 500"
                      placeholderTextColor={C.slate400}
                      value={concentracaoValor}
                      onChangeText={setConcentracaoValor}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                  </View>
                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 12 }]}>
                    <Text style={s.label}>Concentração (Unidade)</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="Ex: mg, ml, %"
                      placeholderTextColor={C.slate400}
                      value={concentracaoUnidade}
                      onChangeText={setConcentracaoUnidade}
                      editable={!isLoading}
                    />
                  </View>
                </View>

                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>Apresentação</Text>
                    <TouchableOpacity style={s.selectBtn} onPress={() => setShowApresentacaoModal(true)}>
                      <Text style={[s.selectBtnText, !apresentacao && { color: C.slate400 }]}>
                        {apresentacao || "Selecionar..."}
                      </Text>
                      <Icon name="chevron-down" size={16} color={C.slate500} />
                    </TouchableOpacity>
                  </View>

                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 12 }]}>
                    <Text style={s.label}>Classe de Risco</Text>
                    <TouchableOpacity style={s.selectBtn} onPress={() => setShowClasseRiscoModal(true)}>
                      <Text style={[s.selectBtnText, !classeRisco && { color: C.slate400 }]}>
                        {classeRisco ? `Classe ${classeRisco}` : "Selecionar..."}
                      </Text>
                      <Icon name="chevron-down" size={16} color={C.slate500} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>Conteúdo Embalagem</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="Qtd itens na caixa (Ex: 30)"
                      placeholderTextColor={C.slate400}
                      value={conteudoEmbalagem}
                      onChangeText={setConteudoEmbalagem}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                  </View>
                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 12 }]}>
                    <Text style={s.label}>Tamanho</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="Ex: P, M, G, 10cm"
                      placeholderTextColor={C.slate400}
                      value={tamanho}
                      onChangeText={setTamanho}
                      editable={!isLoading}
                    />
                  </View>
                </View>

                <View style={s.fieldGroup}>
                  <Text style={s.label}>Temperatura de Armazenamento</Text>
                  <RNTextInput
                    style={s.input}
                    placeholder="Ex: 15°C a 30°C"
                    placeholderTextColor={C.slate400}
                    value={temperaturaArmazenamento}
                    onChangeText={setTemperaturaArmazenamento}
                    editable={!isLoading}
                  />
                </View>

                <View style={s.fieldGroup}>
                  <Text style={s.label}>Observações</Text>
                  <RNTextInput
                    style={[s.input, { minHeight: 60 }]}
                    placeholder="Observações adicionais do produto"
                    placeholderTextColor={C.slate400}
                    value={observacoes}
                    onChangeText={setObservacoes}
                    multiline
                    numberOfLines={3}
                    editable={!isLoading}
                  />
                </View>
              </View>
            )}

            {/* ─── ABA ESTOQUE ─── */}
            {activeTab === "estoque" && (
              <View>
                <Text style={s.tabSectionHeader}>Controles de Estoque e Valores</Text>

                <View style={s.fieldGroup}>
                  <Text style={s.label}>Categoria no ERP</Text>
                  <TouchableOpacity style={s.selectBtn} onPress={() => setShowCategoriaModal(true)}>
                    <Text style={[s.selectBtnText, !selectedCategoriaNome && { color: C.slate400 }]}>
                      {selectedCategoriaNome || "Selecionar Categoria..."}
                    </Text>
                    <Icon name="chevron-down" size={16} color={C.slate500} />
                  </TouchableOpacity>
                </View>

                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>Preço de Custo (R$)</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="0.00"
                      placeholderTextColor={C.slate400}
                      value={precoCustoBase}
                      onChangeText={setPrecoCustoBase}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                  </View>
                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 12 }]}>
                    <Text style={s.label}>Preço de Venda (R$)</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="0.00"
                      placeholderTextColor={C.slate400}
                      value={precoVendaBase}
                      onChangeText={setPrecoVendaBase}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                  </View>
                </View>

                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>Estoque Mínimo</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="0"
                      placeholderTextColor={C.slate400}
                      value={estoqueMinimo}
                      onChangeText={setEstoqueMinimo}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                  </View>
                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 12 }]}>
                    <Text style={s.label}>Estoque Máximo</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="Opcional"
                      placeholderTextColor={C.slate400}
                      value={estoqueMaximo}
                      onChangeText={setEstoqueMaximo}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                  </View>
                </View>

                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>Ponto de Reposição</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="Opcional"
                      placeholderTextColor={C.slate400}
                      value={pontoReposicao}
                      onChangeText={setPontoReposicao}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                  </View>
                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 12 }]}>
                    <Text style={s.label}>Localiz. Padrão</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="Ex: Prateleira B"
                      placeholderTextColor={C.slate400}
                      value={localizacaoEstoque}
                      onChangeText={setLocalizacaoEstoque}
                      editable={!isLoading}
                    />
                  </View>
                </View>

                <View style={s.switchGroup}>
                  <View style={s.switchRow}>
                    <View style={s.switchLabelArea}>
                      <Text style={s.switchTitle}>Controlar Lote</Text>
                      <Text style={s.switchDescription}>Rastrear movimentações de lote do produto</Text>
                    </View>
                    <Switch
                      value={controlaLote}
                      onValueChange={setControlaLote}
                      trackColor={{ false: C.slate200, true: C.slate900 }}
                      thumbColor={C.white}
                      disabled={isLoading}
                    />
                  </View>

                  <View style={s.separator} />

                  <View style={s.switchRow}>
                    <View style={s.switchLabelArea}>
                      <Text style={s.switchTitle}>Controlar Validade</Text>
                      <Text style={s.switchDescription}>Exigir validade nos lotes desse produto</Text>
                    </View>
                    <Switch
                      value={controlaValidade}
                      onValueChange={setControlaValidade}
                      trackColor={{ false: C.slate200, true: C.slate900 }}
                      thumbColor={C.white}
                      disabled={isLoading}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* ─── ABA FISCAL ─── */}
            {activeTab === "fiscal" && (
              <View>
                <Text style={s.tabSectionHeader}>Parametrização Tributária</Text>

                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>NCM</Text>
                    <RNTextInput
                      style={[s.input, errors.ncm ? s.inputError : null]}
                      placeholder="8 dígitos"
                      placeholderTextColor={C.slate400}
                      value={ncm}
                      onChangeText={(t) => { setNcm(t); setErrors(p => ({ ...p, ncm: "" })); }}
                      keyboardType="numeric"
                      maxLength={8}
                      editable={!isLoading}
                    />
                    {errors.ncm && <Text style={s.errorText}>{errors.ncm}</Text>}
                  </View>
                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 12 }]}>
                    <Text style={s.label}>CFOP</Text>
                    <RNTextInput
                      style={[s.input, errors.cfop ? s.inputError : null]}
                      placeholder="4 dígitos"
                      placeholderTextColor={C.slate400}
                      value={cfop}
                      onChangeText={(t) => { setCfop(t); setErrors(p => ({ ...p, cfop: "" })); }}
                      keyboardType="numeric"
                      maxLength={4}
                      editable={!isLoading}
                    />
                    {errors.cfop && <Text style={s.errorText}>{errors.cfop}</Text>}
                  </View>
                </View>

                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>CST</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="Ex: 00"
                      placeholderTextColor={C.slate400}
                      value={cst}
                      onChangeText={setCst}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                  </View>
                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 12 }]}>
                    <Text style={s.label}>CSOSN</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="Ex: 101"
                      placeholderTextColor={C.slate400}
                      value={csosn}
                      onChangeText={setCsosn}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                  </View>
                </View>

                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>CEST</Text>
                    <RNTextInput
                      style={[s.input, errors.cest ? s.inputError : null]}
                      placeholder="7 dígitos"
                      placeholderTextColor={C.slate400}
                      value={cest}
                      onChangeText={(t) => { setCest(t); setErrors(p => ({ ...p, cest: "" })); }}
                      keyboardType="numeric"
                      maxLength={7}
                      editable={!isLoading}
                    />
                    {errors.cest && <Text style={s.errorText}>{errors.cest}</Text>}
                  </View>
                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 12 }]}>
                    <Text style={s.label}>Origem Mercadoria</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="Ex: 0 (Nacional)"
                      placeholderTextColor={C.slate400}
                      value={origemMercadoria}
                      onChangeText={setOrigemMercadoria}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                  </View>
                </View>

                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>Unidade Fiscal</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="Ex: UN"
                      placeholderTextColor={C.slate400}
                      value={unidadeFiscal}
                      onChangeText={setUnidadeFiscal}
                      autoCapitalize="characters"
                      editable={!isLoading}
                    />
                  </View>
                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 12 }]}>
                    <Text style={s.label}>Classificação Fiscal</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="Tipo Classif."
                      placeholderTextColor={C.slate400}
                      value={tipoClassificacaoFiscal}
                      onChangeText={setTipoClassificacaoFiscal}
                      editable={!isLoading}
                    />
                  </View>
                </View>

                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>ICMS (%)</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="0.00"
                      placeholderTextColor={C.slate400}
                      value={aliquotaIcms}
                      onChangeText={setAliquotaIcms}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                  </View>
                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 12 }]}>
                    <Text style={s.label}>IPI (%)</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="0.00"
                      placeholderTextColor={C.slate400}
                      value={aliquotaIpi}
                      onChangeText={setAliquotaIpi}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                  </View>
                </View>

                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>PIS (%)</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="0.00"
                      placeholderTextColor={C.slate400}
                      value={aliquotaPis}
                      onChangeText={setAliquotaPis}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                  </View>
                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 12 }]}>
                    <Text style={s.label}>COFINS (%)</Text>
                    <RNTextInput
                      style={s.input}
                      placeholder="0.00"
                      placeholderTextColor={C.slate400}
                      value={aliquotaCofins}
                      onChangeText={setAliquotaCofins}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                  </View>
                </View>

                <View style={s.fieldGroup}>
                  <Text style={s.label}>Código Benefício Fiscal</Text>
                  <RNTextInput
                    style={s.input}
                    placeholder="Opcional"
                    placeholderTextColor={C.slate400}
                    value={codigoBeneficioFiscal}
                    onChangeText={setCodigoBeneficioFiscal}
                    editable={!isLoading}
                  />
                </View>
              </View>
            )}

            {/* Botão de Submissão final */}
            <TouchableOpacity
              style={[s.btn, isLoading && s.btnDisabled]}
              onPress={handleSalvar}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color={C.white} size="small" />
              ) : (
                <Text style={s.btnText}>Cadastrar no Sistema</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal da Câmera para Scanner rápido */}
      <Modal visible={showCamera} animationType="slide" transparent={false}>
        <View style={s.cameraContainer}>
          <View style={s.cameraHeader}>
            <IconButton icon="close" size={24} iconColor={C.slate900} onPress={() => setShowCamera(false)} />
            <Text style={s.cameraHeaderTitle}>Escanear Código</Text>
            <View style={{ width: 48 }} />
          </View>
          <CameraView
            style={s.camera}
            facing="back"
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["ean13", "ean8", "qr"],
            }}
          />
          <View style={s.cameraFooter}>
            <Text style={s.cameraInstruction}>Aponte para o código de barras do produto</Text>
          </View>
        </View>
      </Modal>

      {/* ── Modais de Seleção Nativa ── */}
      {/* Modal de Categorias */}
      <Modal visible={showCategoriaModal} animationType="fade" transparent={true}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Selecionar Categoria</Text>
              <IconButton icon="close" size={20} iconColor={C.slate900} onPress={() => setShowCategoriaModal(false)} />
            </View>
            <FlatList
              data={categorias}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.modalItem}
                  onPress={() => {
                    setCategoriaId(item.id);
                    setSelectedCategoriaNome(item.nome);
                    setShowCategoriaModal(false);
                  }}
                >
                  <Text style={s.modalItemText}>{item.nome}</Text>
                  {categoriaId === item.id && <Icon name="check" size={16} color={C.slate900} />}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={s.modalSeparator} />}
              style={{ maxHeight: 300 }}
              ListEmptyComponent={
                <Text style={s.modalEmptyText}>Nenhuma categoria disponível.</Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Modal de Apresentação */}
      <Modal visible={showApresentacaoModal} animationType="fade" transparent={true}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Apresentação</Text>
              <IconButton icon="close" size={20} iconColor={C.slate900} onPress={() => setShowApresentacaoModal(false)} />
            </View>
            <FlatList
              data={OPCOES_APRESENTACAO}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.modalItem}
                  onPress={() => {
                    setApresentacao(item);
                    setShowApresentacaoModal(false);
                  }}
                >
                  <Text style={s.modalItemText}>{item}</Text>
                  {apresentacao === item && <Icon name="check" size={16} color={C.slate900} />}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={s.modalSeparator} />}
              style={{ maxHeight: 300 }}
            />
          </View>
        </View>
      </Modal>

      {/* Modal de Classe de Risco */}
      <Modal visible={showClasseRiscoModal} animationType="fade" transparent={true}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Classe de Risco</Text>
              <IconButton icon="close" size={20} iconColor={C.slate900} onPress={() => setShowClasseRiscoModal(false)} />
            </View>
            <FlatList
              data={OPCOES_CLASSE_RISCO}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.modalItem}
                  onPress={() => {
                    setClasseRisco(item);
                    setShowClasseRiscoModal(false);
                  }}
                >
                  <Text style={s.modalItemText}>Classe {item}</Text>
                  {classeRisco === item && <Icon name="check" size={16} color={C.slate900} />}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={s.modalSeparator} />}
              style={{ maxHeight: 300 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.white,
    paddingTop: Platform.OS === "android" ? 36 : 48,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: C.slate200,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.slate900,
    textAlign: "center",
  },

  // Tabs
  tabBarArea: {
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.slate200,
  },
  tabBarScroll: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.slate200,
  },
  tabButtonActive: {
    backgroundColor: C.slate900,
    borderColor: C.slate900,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.slate500,
  },
  tabTextActive: {
    color: C.white,
  },

  scroll: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: C.slate200,
  },
  tabSectionHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: C.slate900,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: C.slate900,
    paddingLeft: 8,
  },

  fieldGroup: { marginBottom: 16 },
  rowFields: { flexDirection: "row", justifyContent: "space-between" },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: C.slate500,
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    borderColor: C.slate200,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: C.slate900,
    backgroundColor: C.white,
  },
  inputError: { borderColor: C.red600 },
  errorText: { color: C.red600, fontSize: 11, marginTop: 4, fontWeight: "500" },
  helper: { fontSize: 10, color: C.slate400, marginTop: 4, lineHeight: 14 },

  searchRow: { flexDirection: "row", alignItems: "center" },
  scanBtn: {
    backgroundColor: C.slate900,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    height: 48,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  // Seletores / Botões de Dropdown
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: C.slate200,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    backgroundColor: C.white,
  },
  selectBtnText: {
    fontSize: 14,
    color: C.slate900,
  },

  // Switches
  switchGroup: {
    backgroundColor: C.bg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: C.slate200,
    marginVertical: 8,
    marginBottom: 20,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchLabelArea: { flex: 1, marginRight: 16 },
  switchTitle: { fontSize: 13, fontWeight: "600", color: C.slate900, marginBottom: 2 },
  switchDescription: { fontSize: 11, color: C.slate500 },
  separator: { height: 1, backgroundColor: C.slate200, marginVertical: 12 },

  // Botões
  btn: {
    backgroundColor: C.slate900,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.55 },
  btnText: { color: C.white, fontSize: 14, fontWeight: "600" },

  // Câmera Modal
  cameraContainer: { flex: 1, backgroundColor: C.white },
  cameraHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "android" ? 36 : 48,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.slate200,
  },
  cameraHeaderTitle: { fontSize: 16, fontWeight: "700", color: C.slate900 },
  camera: { flex: 1 },
  cameraFooter: {
    backgroundColor: C.slate900,
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraInstruction: { color: C.white, fontSize: 13, fontWeight: "500" },

  // Modais de Seleção Listas
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: C.white,
    borderRadius: 14,
    width: "100%",
    padding: 20,
    borderWidth: 1,
    borderColor: C.slate200,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.slate100,
    paddingBottom: 8,
  },
  modalTitle: { fontSize: 15, fontWeight: "700", color: C.slate900 },
  modalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  modalItemText: { fontSize: 14, color: C.slate700 },
  modalSeparator: { height: 1, backgroundColor: C.slate100 },
  modalEmptyText: {
    textAlign: "center",
    color: C.slate400,
    paddingVertical: 16,
    fontSize: 13,
  },
});

import React, { useRef, useState, useEffect, useMemo } from "react";
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
  StatusBar,
  Image,
} from "react-native";
import { Text, ActivityIndicator, Surface, Divider, Button } from "react-native-paper";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { RootStackParamList } from "../types/navigation";
import { ProdutosAPI } from "../api/produtos";
import { parseGS1 } from "../utils/gs1Parser";
import { parseDecimalInput, parseIntegerInput } from "../utils/number-parser";
import { z } from "zod";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "CadastroProduto">;
type RouteType = RouteProp<RootStackParamList, "CadastroProduto">;
type TabType = "geral" | "tecnico" | "estoque";

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
  dangerColor: "#DC2626",
  dangerBg: "#FEF2F2",
  infoColor: "#2563EB",
};

const OPCOES_APRESENTACAO = [
  "AMPOLA", "FRASCO", "CAIXA", "SACHE", "BOLSA", 
  "SERINGA", "TUBO", "BLISTER", "BOMBONA", 
  "LATA", "GALERIA", "UNIDADE", "OUTRA"
];

const OPCOES_CLASSE_RISCO = ["I", "II", "III", "IV"];

const FIELD_TAB_MAP: Record<string, TabType> = {
  descricao: "geral",
  codigoBarras: "geral",
  codigoInterno: "geral",
  marca: "geral",
  fabricante: "geral",
  cnpjFabricante: "geral",
  codigoFabricante: "geral",
  unidadeVenda: "geral",
  unidadeCompra: "geral",
  fatorConversao: "geral",

  registroAnvisa: "tecnico",
  temperaturaArmazenamento: "tecnico",
  principioAtivo: "tecnico",
  concentracaoValor: "tecnico",
  concentracaoUnidade: "tecnico",
  apresentacao: "tecnico",
  classeRisco: "tecnico",
  conteudoEmbalagem: "tecnico",
  tamanho: "tecnico",
  observacoes: "tecnico",

  categoriaId: "estoque",
  precoCustoBase: "estoque",
  precoVendaBase: "estoque",
  estoqueMinimo: "estoque",
  estoqueMaximo: "estoque",
  pontoReposicao: "estoque",
  localizacaoEstoque: "estoque",
};

const FIELD_FRIENDLY_NAMES: Record<string, string> = {
  descricao: "Descrição do Produto",
  codigoBarras: "Código de Barras",
  codigoInterno: "Código Interno (SKU)",
  marca: "Marca Comercial",
  fabricante: "Fabricante / Laboratório",
  cnpjFabricante: "CNPJ do Fabricante",
  codigoFabricante: "Código do Fabricante",
  unidadeVenda: "Unidade de Venda",
  unidadeCompra: "Unidade de Compra",
  fatorConversao: "Fator de Conversão",

  registroAnvisa: "Registro ANVISA",
  temperaturaArmazenamento: "Temperatura de Armazenamento",
  principioAtivo: "Princípio Ativo",
  concentracaoValor: "Concentração (Valor)",
  concentracaoUnidade: "Concentração (Unidade)",
  apresentacao: "Apresentação",
  classeRisco: "Classe de Risco",
  conteudoEmbalagem: "Conteúdo da Embalagem",
  tamanho: "Tamanho / Calibre",
  observacoes: "Observações",

  categoriaId: "Categoria no ERP",
  precoCustoBase: "Preço de Custo",
  precoVendaBase: "Preço de Venda",
  estoqueMinimo: "Estoque Mínimo",
  estoqueMaximo: "Estoque Máximo",
  pontoReposicao: "Ponto de Reposição",
  localizacaoEstoque: "Localização Padrão",
};

const cadastroSchema = z.object({
  descricao: z
    .string({ required_error: "Descrição do produto é obrigatória." })
    .trim()
    .min(3, "A descrição do produto deve conter pelo menos 3 caracteres."),
  codigoBarras: z.string().optional(),
  imagemUrl: z.string().optional(),
  codigoInterno: z.string().optional(),
  fabricante: z.string().optional(),
  cnpjFabricante: z.string().optional(),
  codigoFabricante: z.string().optional(),
  marca: z.string().optional(),
  unidadeVenda: z
    .string({ required_error: "Unidade de venda é obrigatória." })
    .trim()
    .min(1, "Informe a unidade de venda (ex: UN, CX, AMP).")
    .default("UN"),
  unidadeCompra: z.string().optional(),
  fatorConversao: z.number().positive("Fator de conversão deve ser maior que zero.").optional().default(1),

  registroAnvisa: z.string().optional(),
  temperaturaArmazenamento: z.string().optional(),
  principioAtivo: z.string().optional(),
  concentracaoValor: z.number().positive("Concentração deve ser maior que zero.").nullable().optional(),
  concentracaoUnidade: z.string().optional(),
  conteudoEmbalagem: z.number().int("Conteúdo deve ser um número inteiro.").positive("Conteúdo deve ser maior que zero.").nullable().optional(),
  apresentacao: z.string().nullable().optional(),
  classeRisco: z.string().nullable().optional(),
  tamanho: z.string().optional(),
  observacoes: z.string().optional(),

  precoCustoBase: z.number().min(0, "Preço de custo não pode ser negativo.").optional().default(0),
  precoVendaBase: z.number().min(0, "Preço de venda não pode ser negativo.").optional().default(0),
  estoqueMinimo: z.number().min(0, "Estoque mínimo não pode ser negativo.").optional().default(0),
  estoqueMaximo: z.number().min(0, "Estoque máximo não pode ser negativo.").nullable().optional(),
  pontoReposicao: z.number().min(0, "Ponto de reposição não pode ser negativo.").nullable().optional(),
  localizacaoEstoque: z.string().optional(),
  controlaValidade: z.boolean().optional(),
  controlaLote: z.boolean().optional(),
  categoriaId: z.number().int().nullable().optional(),
});

export const CadastroProdutoScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const [permission, requestPermission] = useCameraPermissions();

  const [activeTab, setActiveTab] = useState<TabType>("geral");

  // 1. Geral
  const [descricao, setDescricao] = useState("");
  const [codigoBarras, setCodigoBarras] = useState(route.params?.codigoBarrasSugerido || "");
  const [imagemUrl, setImagemUrl] = useState("");
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [codigoInterno, setCodigoInterno] = useState("");
  const [fabricante, setFabricante] = useState("");
  const [cnpjFabricante, setCnpjFabricante] = useState("");
  const [codigoFabricante, setCodigoFabricante] = useState("");
  const [marca, setMarca] = useState("");
  const [unidadeVenda, setUnidadeVenda] = useState("UN");
  const [unidadeCompra, setUnidadeCompra] = useState("");
  const [fatorConversao, setFatorConversao] = useState("1");

  // 2. Técnico
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

  // 3. Estoque
  const [precoCustoBase, setPrecoCustoBase] = useState("");
  const [precoVendaBase, setPrecoVendaBase] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState("0");
  const [estoqueMaximo, setEstoqueMaximo] = useState("");
  const [pontoReposicao, setPontoReposicao] = useState("");
  const [localizacaoEstoque, setLocalizacaoEstoque] = useState("");
  const [controlaValidade, setControlaValidade] = useState(true);
  const [controlaLote, setControlaLote] = useState(true);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);

  // Controladores de UI
  const [isLoading, setIsLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const cadastroScanLockRef = useRef(false);

  // Categorias do ERP
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

  const tabErrorCounts = useMemo(() => {
    const counts: Record<TabType, number> = { geral: 0, tecnico: 0, estoque: 0 };
    Object.keys(errors).forEach((key) => {
      if (errors[key]) {
        const tab = FIELD_TAB_MAP[key] || "geral";
        counts[tab] = (counts[tab] || 0) + 1;
      }
    });
    return counts;
  }, [errors]);

  const clearFieldError = (fieldName: string) => {
    if (errors[fieldName]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[fieldName];
        return copy;
      });
    }
  };

  const handleOpenScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert("Acesso Negado", "Precisamos de permissão de câmera para ler códigos de barras.");
        return;
      }
    }
    cadastroScanLockRef.current = false;
    setShowCamera(true);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (cadastroScanLockRef.current) return;
    const codigoLido = data.trim();
    if (!codigoLido) return;

    cadastroScanLockRef.current = true;
    setCodigoBarras(parseGS1(codigoLido).gtin);
    clearFieldError("codigoBarras");
    setShowCamera(false);
  };

  // 📷 Tirar foto com a câmera do celular
  const handleTirarFoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Câmera", "Permissão para acessar a câmera é necessária para fotografar o produto.");
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        await processarUploadFoto(asset);
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Erro", "Não foi possível abrir a câmera.");
    }
  };

  // 🖼️ Escolher foto da galeria do celular
  const handleEscolherGaleria = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Galeria", "Permissão para acessar a galeria de fotos é necessária.");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        await processarUploadFoto(asset);
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Erro", "Não foi possível selecionar foto da galeria.");
    }
  };

  const processarUploadFoto = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploadingFoto(true);
    try {
      if (asset.base64) {
        const uploadedUrl = await ProdutosAPI.uploadImagem(`data:image/jpeg;base64,${asset.base64}`);
        setImagemUrl(uploadedUrl);
      } else {
        setImagemUrl(asset.uri);
      }
    } catch (err) {
      console.warn("Upload no servidor falhou, utilizando URI local:", err);
      setImagemUrl(asset.uri);
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleSalvar = async () => {
    // Parsing seguro de números (aceita formato com vírgula e ponto)
    const fields = {
      descricao: descricao.trim(),
      codigoBarras: codigoBarras.trim() ? parseGS1(codigoBarras).gtin : undefined,
      imagemUrl: imagemUrl.trim() || undefined,
      codigoInterno: codigoInterno.trim() || undefined,
      fabricante: fabricante.trim() || undefined,
      cnpjFabricante: cnpjFabricante.trim() || undefined,
      codigoFabricante: codigoFabricante.trim() || undefined,
      marca: marca.trim() || undefined,
      unidadeVenda: (unidadeVenda || "UN").trim().toUpperCase(),
      unidadeCompra: unidadeCompra.trim().toUpperCase() || undefined,
      fatorConversao: parseDecimalInput(fatorConversao) ?? 1,

      registroAnvisa: registroAnvisa.trim() || undefined,
      temperaturaArmazenamento: temperaturaArmazenamento.trim() || undefined,
      principioAtivo: principioAtivo.trim() || undefined,
      concentracaoValor: parseDecimalInput(concentracaoValor) ?? undefined,
      concentracaoUnidade: concentracaoUnidade.trim() || undefined,
      conteudoEmbalagem: parseIntegerInput(conteudoEmbalagem) ?? undefined,
      apresentacao: apresentacao || undefined,
      classeRisco: classeRisco || undefined,
      tamanho: tamanho.trim() || undefined,
      observacoes: observacoes.trim() || undefined,

      precoCustoBase: parseDecimalInput(precoCustoBase) ?? 0,
      precoVendaBase: parseDecimalInput(precoVendaBase) ?? 0,
      estoqueMinimo: parseDecimalInput(estoqueMinimo) ?? 0,
      estoqueMaximo: parseDecimalInput(estoqueMaximo) ?? undefined,
      pontoReposicao: parseDecimalInput(pontoReposicao) ?? undefined,
      localizacaoEstoque: localizacaoEstoque.trim() || undefined,
      controlaValidade,
      controlaLote,
      categoriaId: categoriaId || undefined,
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

      const firstErrorKey = Object.keys(formattedErrors)[0];
      const targetTab = FIELD_TAB_MAP[firstErrorKey] || "geral";
      setActiveTab(targetTab);

      const bulletList = Object.entries(formattedErrors)
        .map(([key, msg]) => `• ${FIELD_FRIENDLY_NAMES[key] || key}: ${msg}`)
        .join("\n");

      Alert.alert(
        "Campos com Pendências",
        `Por favor, preencha corretamente os campos destacados:\n\n${bulletList}`
      );
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
      console.error("Erro ao cadastrar produto:", err);
      if (err.response?.data?.details?.fieldErrors) {
        const backendErrors = err.response.data.details.fieldErrors;
        const newErrObj: Record<string, string> = {};
        const bulletList: string[] = [];
        Object.entries(backendErrors).forEach(([field, msgs]: any) => {
          const message = Array.isArray(msgs) ? msgs.join(", ") : String(msgs);
          newErrObj[field] = message;
          const friendly = FIELD_FRIENDLY_NAMES[field] || field;
          bulletList.push(`• ${friendly}: ${message}`);
        });
        setErrors(newErrObj);
        const firstKey = Object.keys(newErrObj)[0];
        if (firstKey && FIELD_TAB_MAP[firstKey]) {
          setActiveTab(FIELD_TAB_MAP[firstKey]);
        }
        Alert.alert("Campos Inválidos no Servidor", `O ERP recusou alguns campos:\n\n${bulletList.join("\n")}`);
      } else {
        const apiError =
          err.response?.data?.error ||
          err.message ||
          "Não foi possível cadastrar o produto no ERP. Verifique sua conexão e tente novamente.";
        Alert.alert("Erro ao Cadastrar", apiError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.headerBg} />

      {/* ── Header ─── */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Novo Produto</Text>
          <Text style={s.headerSubtitle}>Cadastro e Especificações no Catálogo</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Abas de Navegação ─── */}
      <View style={s.tabsRow}>
        {(
          [
            { id: "geral", label: "1. Geral", icon: "cube-outline" },
            { id: "tecnico", label: "2. Técnico", icon: "medical-bag" },
            { id: "estoque", label: "3. Estoque", icon: "tune-vertical" },
          ] as const
        ).map((t) => {
          const count = tabErrorCounts[t.id];
          const hasError = count > 0;
          return (
            <TouchableOpacity
              key={t.id}
              style={[s.tabButton, activeTab === t.id && s.tabButtonActive]}
              onPress={() => setActiveTab(t.id)}
            >
              <MaterialCommunityIcons
                name={t.icon as any}
                size={16}
                color={
                  hasError
                    ? C.dangerColor
                    : activeTab === t.id
                    ? C.primaryColor
                    : C.slate500
                }
              />
              <Text
                style={[
                  s.tabText,
                  activeTab === t.id && s.tabTextActive,
                  hasError && s.tabTextError,
                ]}
              >
                {t.label}
              </Text>
              {hasError && (
                <View style={s.tabErrorBadge}>
                  <Text style={s.tabErrorBadgeText}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Surface style={s.card} elevation={1}>
            {/* ─── ABA 1: GERAL ─── */}
            {activeTab === "geral" && (
              <View style={s.formSection}>
                <Text style={s.sectionHeader}>IDENTIFICAÇÃO E FOTO DO PRODUTO</Text>

                {/* 📸 SEÇÃO DE FOTO COM CÂMERA E GALERIA */}
                <View style={s.photoSection}>
                  <Text style={s.label}>Foto do Produto (Opcional)</Text>
                  {imagemUrl ? (
                    <View style={s.photoPreviewContainer}>
                      <Image source={{ uri: imagemUrl }} style={s.photoPreview} resizeMode="contain" />
                      <TouchableOpacity
                        style={s.photoRemoveBtn}
                        onPress={() => setImagemUrl("")}
                        disabled={uploadingFoto}
                      >
                        <MaterialCommunityIcons name="close-circle" size={24} color={C.dangerColor} />
                      </TouchableOpacity>
                      {uploadingFoto && (
                        <View style={s.photoUploadingOverlay}>
                          <ActivityIndicator color={C.white} size="small" />
                          <Text style={{ color: C.white, fontSize: 11, marginTop: 4 }}>Enviando foto...</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={s.photoActionRow}>
                      <TouchableOpacity
                        style={s.photoBtn}
                        onPress={handleTirarFoto}
                        disabled={isLoading || uploadingFoto}
                      >
                        <MaterialCommunityIcons name="camera" size={22} color={C.primaryColor} />
                        <Text style={s.photoBtnText}>Tirar Foto</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={s.photoBtn}
                        onPress={handleEscolherGaleria}
                        disabled={isLoading || uploadingFoto}
                      >
                        <MaterialCommunityIcons name="image-multiple" size={22} color={C.slate700} />
                        <Text style={s.photoBtnText}>Galeria</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Descrição */}
                <View style={s.fieldGroup}>
                  <Text style={s.label}>
                    Descrição do Produto <Text style={s.requiredMark}>* (Obrigatório)</Text>
                  </Text>
                  <RNTextInput
                    style={[s.input, errors.descricao ? s.inputError : null]}
                    placeholder="Ex: Luva Cirúrgica Estéril 7.5 ou Paracetamol 500mg"
                    placeholderTextColor={C.slate500}
                    value={descricao}
                    onChangeText={(t) => {
                      setDescricao(t);
                      clearFieldError("descricao");
                    }}
                    editable={!isLoading}
                  />
                  {errors.descricao && <Text style={s.errorText}>⚠️ {errors.descricao}</Text>}
                </View>

                {/* Código de Barras */}
                <View style={s.fieldGroup}>
                  <Text style={s.label}>Código de Barras / EAN (Opcional)</Text>
                  <View style={s.searchRow}>
                    <RNTextInput
                      style={[
                        s.input,
                        errors.codigoBarras ? s.inputError : null,
                        { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 },
                      ]}
                      placeholder="Código de barras EAN ou DataMatrix"
                      placeholderTextColor={C.slate500}
                      value={codigoBarras}
                      onChangeText={(t) => {
                        setCodigoBarras(t);
                        clearFieldError("codigoBarras");
                      }}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                    <TouchableOpacity style={s.scanBtn} onPress={handleOpenScanner} disabled={isLoading}>
                      <MaterialCommunityIcons name="barcode-scan" size={20} color={C.white} />
                    </TouchableOpacity>
                  </View>
                  {errors.codigoBarras && <Text style={s.errorText}>⚠️ {errors.codigoBarras}</Text>}
                </View>

                {/* SKU e Marca */}
                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>Código Interno / SKU (Opcional)</Text>
                    <RNTextInput
                      style={[s.input, errors.codigoInterno ? s.inputError : null]}
                      placeholder="Ex: MED-102"
                      placeholderTextColor={C.slate500}
                      value={codigoInterno}
                      onChangeText={(t) => {
                        setCodigoInterno(t);
                        clearFieldError("codigoInterno");
                      }}
                      autoCapitalize="characters"
                      editable={!isLoading}
                    />
                    {errors.codigoInterno && <Text style={s.errorText}>⚠️ {errors.codigoInterno}</Text>}
                  </View>
                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 10 }]}>
                    <Text style={s.label}>Marca Comercial (Opcional)</Text>
                    <RNTextInput
                      style={[s.input, errors.marca ? s.inputError : null]}
                      placeholder="Ex: Medley, BD..."
                      placeholderTextColor={C.slate500}
                      value={marca}
                      onChangeText={(t) => {
                        setMarca(t);
                        clearFieldError("marca");
                      }}
                      editable={!isLoading}
                    />
                    {errors.marca && <Text style={s.errorText}>⚠️ {errors.marca}</Text>}
                  </View>
                </View>

                {/* Fabricante */}
                <View style={s.fieldGroup}>
                  <Text style={s.label}>Fabricante / Laboratório (Opcional)</Text>
                  <RNTextInput
                    style={[s.input, errors.fabricante ? s.inputError : null]}
                    placeholder="Razão Social ou Nome do Fabricante"
                    placeholderTextColor={C.slate500}
                    value={fabricante}
                    onChangeText={(t) => {
                      setFabricante(t);
                      clearFieldError("fabricante");
                    }}
                    editable={!isLoading}
                  />
                  {errors.fabricante && <Text style={s.errorText}>⚠️ {errors.fabricante}</Text>}
                </View>

                {/* CNPJ e Código Fabricante */}
                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>CNPJ Fabricante (Opcional)</Text>
                    <RNTextInput
                      style={[s.input, errors.cnpjFabricante ? s.inputError : null]}
                      placeholder="00.000.000/0000-00"
                      placeholderTextColor={C.slate500}
                      value={cnpjFabricante}
                      onChangeText={(t) => {
                        setCnpjFabricante(t);
                        clearFieldError("cnpjFabricante");
                      }}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                    {errors.cnpjFabricante && <Text style={s.errorText}>⚠️ {errors.cnpjFabricante}</Text>}
                  </View>
                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 10 }]}>
                    <Text style={s.label}>Cód. Fabricante (Opcional)</Text>
                    <RNTextInput
                      style={[s.input, errors.codigoFabricante ? s.inputError : null]}
                      placeholder="FAB-990"
                      placeholderTextColor={C.slate500}
                      value={codigoFabricante}
                      onChangeText={(t) => {
                        setCodigoFabricante(t);
                        clearFieldError("codigoFabricante");
                      }}
                      autoCapitalize="characters"
                      editable={!isLoading}
                    />
                    {errors.codigoFabricante && <Text style={s.errorText}>⚠️ {errors.codigoFabricante}</Text>}
                  </View>
                </View>

                {/* Unidades de Medida */}
                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>
                      Unid. Venda <Text style={s.requiredMark}>*</Text>
                    </Text>
                    <RNTextInput
                      style={[s.input, errors.unidadeVenda ? s.inputError : null]}
                      placeholder="UN"
                      placeholderTextColor={C.slate500}
                      value={unidadeVenda}
                      onChangeText={(t) => {
                        setUnidadeVenda(t);
                        clearFieldError("unidadeVenda");
                      }}
                      autoCapitalize="characters"
                      editable={!isLoading}
                    />
                    {errors.unidadeVenda && <Text style={s.errorText}>⚠️ {errors.unidadeVenda}</Text>}
                  </View>
                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 10 }]}>
                    <Text style={s.label}>Unid. Compra (Opcional)</Text>
                    <RNTextInput
                      style={[s.input, errors.unidadeCompra ? s.inputError : null]}
                      placeholder="CX"
                      placeholderTextColor={C.slate500}
                      value={unidadeCompra}
                      onChangeText={(t) => {
                        setUnidadeCompra(t);
                        clearFieldError("unidadeCompra");
                      }}
                      autoCapitalize="characters"
                      editable={!isLoading}
                    />
                    {errors.unidadeCompra && <Text style={s.errorText}>⚠️ {errors.unidadeCompra}</Text>}
                  </View>
                </View>

                {/* Fator de Conversão */}
                <View style={s.fieldGroup}>
                  <Text style={s.label}>Fator de Conversão de Compra</Text>
                  <RNTextInput
                    style={[s.input, errors.fatorConversao ? s.inputError : null]}
                    placeholder="1"
                    placeholderTextColor={C.slate500}
                    value={fatorConversao}
                    onChangeText={(t) => {
                      setFatorConversao(t);
                      clearFieldError("fatorConversao");
                    }}
                    keyboardType="numeric"
                    editable={!isLoading}
                  />
                  {errors.fatorConversao && <Text style={s.errorText}>⚠️ {errors.fatorConversao}</Text>}
                  <Text style={s.helper}>Quantas unidades de venda compõem a embalagem de compra (ex: Caixa com 12 = 12).</Text>
                </View>
              </View>
            )}

            {/* ─── ABA 2: TÉCNICO ─── */}
            {activeTab === "tecnico" && (
              <View style={s.formSection}>
                <Text style={s.sectionHeader}>ESPECIFICAÇÕES CLÍNICAS E FARMACÊUTICAS</Text>

                <View style={s.fieldGroup}>
                  <Text style={s.label}>Registro ANVISA (Opcional)</Text>
                  <RNTextInput
                    style={[s.input, errors.registroAnvisa ? s.inputError : null]}
                    placeholder="Número do Registro na ANVISA"
                    placeholderTextColor={C.slate500}
                    value={registroAnvisa}
                    onChangeText={(t) => {
                      setRegistroAnvisa(t);
                      clearFieldError("registroAnvisa");
                    }}
                    keyboardType="numeric"
                    editable={!isLoading}
                  />
                  {errors.registroAnvisa && <Text style={s.errorText}>⚠️ {errors.registroAnvisa}</Text>}
                </View>

                <View style={s.fieldGroup}>
                  <Text style={s.label}>Princípio Ativo (Opcional)</Text>
                  <RNTextInput
                    style={[s.input, errors.principioAtivo ? s.inputError : null]}
                    placeholder="Ex: Paracetamol, Amoxicilina..."
                    placeholderTextColor={C.slate500}
                    value={principioAtivo}
                    onChangeText={(t) => {
                      setPrincipioAtivo(t);
                      clearFieldError("principioAtivo");
                    }}
                    editable={!isLoading}
                  />
                  {errors.principioAtivo && <Text style={s.errorText}>⚠️ {errors.principioAtivo}</Text>}
                </View>

                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>Concentração (Valor)</Text>
                    <RNTextInput
                      style={[s.input, errors.concentracaoValor ? s.inputError : null]}
                      placeholder="Ex: 500"
                      placeholderTextColor={C.slate500}
                      value={concentracaoValor}
                      onChangeText={(t) => {
                        setConcentracaoValor(t);
                        clearFieldError("concentracaoValor");
                      }}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                    {errors.concentracaoValor && <Text style={s.errorText}>⚠️ {errors.concentracaoValor}</Text>}
                  </View>
                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 10 }]}>
                    <Text style={s.label}>Concentração (Unid.)</Text>
                    <RNTextInput
                      style={[s.input, errors.concentracaoUnidade ? s.inputError : null]}
                      placeholder="Ex: mg, ml, %"
                      placeholderTextColor={C.slate500}
                      value={concentracaoUnidade}
                      onChangeText={(t) => {
                        setConcentracaoUnidade(t);
                        clearFieldError("concentracaoUnidade");
                      }}
                      editable={!isLoading}
                    />
                    {errors.concentracaoUnidade && <Text style={s.errorText}>⚠️ {errors.concentracaoUnidade}</Text>}
                  </View>
                </View>

                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>Apresentação</Text>
                    <TouchableOpacity
                      style={[s.selectBtn, errors.apresentacao ? s.inputError : null]}
                      onPress={() => setShowApresentacaoModal(true)}
                    >
                      <Text style={[s.selectBtnText, !apresentacao && { color: C.slate500 }]}>
                        {apresentacao || "Selecionar..."}
                      </Text>
                      <MaterialCommunityIcons name="chevron-down" size={18} color={C.slate500} />
                    </TouchableOpacity>
                    {errors.apresentacao && <Text style={s.errorText}>⚠️ {errors.apresentacao}</Text>}
                  </View>

                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 10 }]}>
                    <Text style={s.label}>Classe de Risco</Text>
                    <TouchableOpacity
                      style={[s.selectBtn, errors.classeRisco ? s.inputError : null]}
                      onPress={() => setShowClasseRiscoModal(true)}
                    >
                      <Text style={[s.selectBtnText, !classeRisco && { color: C.slate500 }]}>
                        {classeRisco ? `Classe ${classeRisco}` : "Selecionar..."}
                      </Text>
                      <MaterialCommunityIcons name="chevron-down" size={18} color={C.slate500} />
                    </TouchableOpacity>
                    {errors.classeRisco && <Text style={s.errorText}>⚠️ {errors.classeRisco}</Text>}
                  </View>
                </View>

                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>Conteúdo da Embalagem</Text>
                    <RNTextInput
                      style={[s.input, errors.conteudoEmbalagem ? s.inputError : null]}
                      placeholder="Ex: 30"
                      placeholderTextColor={C.slate500}
                      value={conteudoEmbalagem}
                      onChangeText={(t) => {
                        setConteudoEmbalagem(t);
                        clearFieldError("conteudoEmbalagem");
                      }}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                    {errors.conteudoEmbalagem && <Text style={s.errorText}>⚠️ {errors.conteudoEmbalagem}</Text>}
                  </View>
                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 10 }]}>
                    <Text style={s.label}>Tamanho / Calibre</Text>
                    <RNTextInput
                      style={[s.input, errors.tamanho ? s.inputError : null]}
                      placeholder="Ex: P, M, G, 10cm"
                      placeholderTextColor={C.slate500}
                      value={tamanho}
                      onChangeText={(t) => {
                        setTamanho(t);
                        clearFieldError("tamanho");
                      }}
                      editable={!isLoading}
                    />
                    {errors.tamanho && <Text style={s.errorText}>⚠️ {errors.tamanho}</Text>}
                  </View>
                </View>

                <View style={s.fieldGroup}>
                  <Text style={s.label}>Temperatura de Armazenamento</Text>
                  <RNTextInput
                    style={[s.input, errors.temperaturaArmazenamento ? s.inputError : null]}
                    placeholder="Ex: 15°C a 30°C / 2°C a 8°C (Refrigerado)"
                    placeholderTextColor={C.slate500}
                    value={temperaturaArmazenamento}
                    onChangeText={(t) => {
                      setTemperaturaArmazenamento(t);
                      clearFieldError("temperaturaArmazenamento");
                    }}
                    editable={!isLoading}
                  />
                  {errors.temperaturaArmazenamento && <Text style={s.errorText}>⚠️ {errors.temperaturaArmazenamento}</Text>}
                </View>

                <View style={s.fieldGroup}>
                  <Text style={s.label}>Observações e Recomendações</Text>
                  <RNTextInput
                    style={[s.input, errors.observacoes ? s.inputError : null, { minHeight: 65, textAlignVertical: "top" }]}
                    placeholder="Instruções de manuseio ou observações clínicas adicionais"
                    placeholderTextColor={C.slate500}
                    value={observacoes}
                    onChangeText={(t) => {
                      setObservacoes(t);
                      clearFieldError("observacoes");
                    }}
                    multiline
                    numberOfLines={3}
                    editable={!isLoading}
                  />
                  {errors.observacoes && <Text style={s.errorText}>⚠️ {errors.observacoes}</Text>}
                </View>
              </View>
            )}

            {/* ─── ABA 3: ESTOQUE ─── */}
            {activeTab === "estoque" && (
              <View style={s.formSection}>
                <Text style={s.sectionHeader}>GESTÃO DE ESTOQUE E PRECIFICAÇÃO</Text>

                <View style={s.fieldGroup}>
                  <Text style={s.label}>Categoria no ERP (Opcional)</Text>
                  <TouchableOpacity
                    style={[s.selectBtn, errors.categoriaId ? s.inputError : null]}
                    onPress={() => setShowCategoriaModal(true)}
                  >
                    <Text style={[s.selectBtnText, !selectedCategoriaNome && { color: C.slate500 }]}>
                      {selectedCategoriaNome || "Selecionar Categoria..."}
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={18} color={C.slate500} />
                  </TouchableOpacity>
                  {errors.categoriaId && <Text style={s.errorText}>⚠️ {errors.categoriaId}</Text>}
                </View>

                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>Preço de Custo (R$)</Text>
                    <RNTextInput
                      style={[s.input, errors.precoCustoBase ? s.inputError : null]}
                      placeholder="0,00"
                      placeholderTextColor={C.slate500}
                      value={precoCustoBase}
                      onChangeText={(t) => {
                        setPrecoCustoBase(t);
                        clearFieldError("precoCustoBase");
                      }}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                    {errors.precoCustoBase && <Text style={s.errorText}>⚠️ {errors.precoCustoBase}</Text>}
                  </View>
                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 10 }]}>
                    <Text style={s.label}>Preço de Venda (R$)</Text>
                    <RNTextInput
                      style={[s.input, errors.precoVendaBase ? s.inputError : null]}
                      placeholder="0,00"
                      placeholderTextColor={C.slate500}
                      value={precoVendaBase}
                      onChangeText={(t) => {
                        setPrecoVendaBase(t);
                        clearFieldError("precoVendaBase");
                      }}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                    {errors.precoVendaBase && <Text style={s.errorText}>⚠️ {errors.precoVendaBase}</Text>}
                  </View>
                </View>

                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>
                      Estoque Mínimo <Text style={s.requiredMark}>*</Text>
                    </Text>
                    <RNTextInput
                      style={[s.input, errors.estoqueMinimo ? s.inputError : null]}
                      placeholder="0"
                      placeholderTextColor={C.slate500}
                      value={estoqueMinimo}
                      onChangeText={(t) => {
                        setEstoqueMinimo(t);
                        clearFieldError("estoqueMinimo");
                      }}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                    {errors.estoqueMinimo && <Text style={s.errorText}>⚠️ {errors.estoqueMinimo}</Text>}
                  </View>
                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 10 }]}>
                    <Text style={s.label}>Estoque Máximo (Opcional)</Text>
                    <RNTextInput
                      style={[s.input, errors.estoqueMaximo ? s.inputError : null]}
                      placeholder="Ex: 100"
                      placeholderTextColor={C.slate500}
                      value={estoqueMaximo}
                      onChangeText={(t) => {
                        setEstoqueMaximo(t);
                        clearFieldError("estoqueMaximo");
                      }}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                    {errors.estoqueMaximo && <Text style={s.errorText}>⚠️ {errors.estoqueMaximo}</Text>}
                  </View>
                </View>

                <View style={s.rowFields}>
                  <View style={[s.fieldGroup, { flex: 1 }]}>
                    <Text style={s.label}>Ponto de Reposição (Opcional)</Text>
                    <RNTextInput
                      style={[s.input, errors.pontoReposicao ? s.inputError : null]}
                      placeholder="Ex: 20"
                      placeholderTextColor={C.slate500}
                      value={pontoReposicao}
                      onChangeText={(t) => {
                        setPontoReposicao(t);
                        clearFieldError("pontoReposicao");
                      }}
                      keyboardType="numeric"
                      editable={!isLoading}
                    />
                    {errors.pontoReposicao && <Text style={s.errorText}>⚠️ {errors.pontoReposicao}</Text>}
                  </View>
                  <View style={[s.fieldGroup, { flex: 1, marginLeft: 10 }]}>
                    <Text style={s.label}>Localização Padrão</Text>
                    <RNTextInput
                      style={[s.input, errors.localizacaoEstoque ? s.inputError : null]}
                      placeholder="Ex: Prateleira B"
                      placeholderTextColor={C.slate500}
                      value={localizacaoEstoque}
                      onChangeText={(t) => {
                        setLocalizacaoEstoque(t);
                        clearFieldError("localizacaoEstoque");
                      }}
                      editable={!isLoading}
                    />
                    {errors.localizacaoEstoque && <Text style={s.errorText}>⚠️ {errors.localizacaoEstoque}</Text>}
                  </View>
                </View>

                <View style={s.switchBox}>
                  <View style={s.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.switchTitle}>Rastreamento por Lote</Text>
                      <Text style={s.switchDescription}>Exige número de lote em entradas e saídas físicas.</Text>
                    </View>
                    <Switch
                      value={controlaLote}
                      onValueChange={setControlaLote}
                      trackColor={{ false: C.slate200, true: C.primaryColor }}
                      thumbColor={C.white}
                      disabled={isLoading}
                    />
                  </View>

                  <Divider style={{ marginVertical: 8 }} />

                  <View style={s.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.switchTitle}>Controle de Validade</Text>
                      <Text style={s.switchDescription}>Controla datas de vencimento e envia alertas.</Text>
                    </View>
                    <Switch
                      value={controlaValidade}
                      onValueChange={setControlaValidade}
                      trackColor={{ false: C.slate200, true: C.primaryColor }}
                      thumbColor={C.white}
                      disabled={isLoading}
                    />
                  </View>
                </View>
              </View>
            )}

            <Divider style={{ marginVertical: 16 }} />

            {/* ── Botões de Ação ─── */}
            <View style={s.actionBtnRow}>
              <Button mode="outlined" onPress={() => navigation.goBack()} disabled={isLoading} style={{ flex: 1 }}>
                Cancelar
              </Button>
              <Button
                mode="contained"
                onPress={handleSalvar}
                loading={isLoading}
                disabled={isLoading}
                style={[s.btnPrimary, { flex: 1, marginLeft: 10 }]}
              >
                Salvar Produto
              </Button>
            </View>
          </Surface>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Modais de Seleção ─── */}
      {/* Modal Categoria */}
      <Modal visible={showCategoriaModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <Surface style={s.modalContainer} elevation={4}>
            <Text style={s.modalTitle}>Selecione a Categoria</Text>
            <Divider style={{ marginVertical: 10 }} />
            <FlatList
              data={categorias}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.modalItem}
                  onPress={() => {
                    setCategoriaId(item.id);
                    setSelectedCategoriaNome(item.nome);
                    clearFieldError("categoriaId");
                    setShowCategoriaModal(false);
                  }}
                >
                  <Text style={s.modalItemText}>{item.nome}</Text>
                  {categoriaId === item.id && <MaterialCommunityIcons name="check" size={20} color={C.primaryColor} />}
                </TouchableOpacity>
              )}
            />
            <Button
              mode="outlined"
              onPress={() => {
                setCategoriaId(null);
                setSelectedCategoriaNome(null);
                setShowCategoriaModal(false);
              }}
              style={{ marginTop: 8 }}
            >
              Limpar Seleção
            </Button>
            <Button mode="contained" onPress={() => setShowCategoriaModal(false)} style={[s.btnPrimary, { marginTop: 6 }]}>
              Fechar
            </Button>
          </Surface>
        </View>
      </Modal>

      {/* Modal Apresentação */}
      <Modal visible={showApresentacaoModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <Surface style={s.modalContainer} elevation={4}>
            <Text style={s.modalTitle}>Selecione a Apresentação</Text>
            <Divider style={{ marginVertical: 10 }} />
            <FlatList
              data={OPCOES_APRESENTACAO}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.modalItem}
                  onPress={() => {
                    setApresentacao(item);
                    clearFieldError("apresentacao");
                    setShowApresentacaoModal(false);
                  }}
                >
                  <Text style={s.modalItemText}>{item}</Text>
                  {apresentacao === item && <MaterialCommunityIcons name="check" size={20} color={C.primaryColor} />}
                </TouchableOpacity>
              )}
            />
            <Button
              mode="outlined"
              onPress={() => {
                setApresentacao(null);
                setShowApresentacaoModal(false);
              }}
              style={{ marginTop: 8 }}
            >
              Limpar Seleção
            </Button>
            <Button mode="contained" onPress={() => setShowApresentacaoModal(false)} style={[s.btnPrimary, { marginTop: 6 }]}>
              Fechar
            </Button>
          </Surface>
        </View>
      </Modal>

      {/* Modal Classe de Risco */}
      <Modal visible={showClasseRiscoModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <Surface style={s.modalContainer} elevation={4}>
            <Text style={s.modalTitle}>Selecione a Classe de Risco</Text>
            <Divider style={{ marginVertical: 10 }} />
            <FlatList
              data={OPCOES_CLASSE_RISCO}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.modalItem}
                  onPress={() => {
                    setClasseRisco(item);
                    clearFieldError("classeRisco");
                    setShowClasseRiscoModal(false);
                  }}
                >
                  <Text style={s.modalItemText}>Classe {item}</Text>
                  {classeRisco === item && <MaterialCommunityIcons name="check" size={20} color={C.primaryColor} />}
                </TouchableOpacity>
              )}
            />
            <Button
              mode="outlined"
              onPress={() => {
                setClasseRisco(null);
                setShowClasseRiscoModal(false);
              }}
              style={{ marginTop: 8 }}
            >
              Limpar Seleção
            </Button>
            <Button mode="contained" onPress={() => setShowClasseRiscoModal(false)} style={[s.btnPrimary, { marginTop: 6 }]}>
              Fechar
            </Button>
          </Surface>
        </View>
      </Modal>

      {/* Modal de Câmera / Leitor de Código */}
      <Modal visible={showCamera} animationType="slide">
        <View style={{ flex: 1, backgroundColor: "#000000" }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "ean13", "ean8", "code128", "datamatrix"],
            }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View style={s.cameraOverlay}>
            <Text style={s.cameraOverlayText}>Aponte para o código de barras ou DataMatrix</Text>
            <TouchableOpacity style={s.closeCameraBtn} onPress={() => setShowCamera(false)}>
              <Text style={s.closeCameraBtnText}>Cancelar</Text>
            </TouchableOpacity>
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
    gap: 4,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    position: "relative",
  },
  tabButtonActive: {
    borderBottomColor: C.primaryColor,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.slate500,
  },
  tabTextActive: {
    color: C.primaryColor,
    fontWeight: "700",
  },
  tabTextError: {
    color: C.dangerColor,
    fontWeight: "700",
  },
  tabErrorBadge: {
    backgroundColor: C.dangerColor,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    marginLeft: 2,
  },
  tabErrorBadgeText: {
    color: C.white,
    fontSize: 10,
    fontWeight: "800",
  },

  scroll: {
    padding: 16,
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  formSection: {
    gap: 12,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "800",
    color: C.slate700,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  photoSection: {
    gap: 6,
    marginBottom: 4,
  },
  photoActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  photoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.slate100,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingVertical: 12,
  },
  photoBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.slate900,
  },
  photoPreviewContainer: {
    position: "relative",
    width: "100%",
    height: 140,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.slate100,
    overflow: "hidden",
  },
  photoPreview: {
    width: "100%",
    height: "100%",
  },
  photoRemoveBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: C.white,
    borderRadius: 12,
  },
  photoUploadingOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  fieldGroup: {
    gap: 4,
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
  helper: {
    fontSize: 11,
    color: C.slate500,
    marginTop: 2,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  scanBtn: {
    backgroundColor: C.primaryColor,
    height: 42,
    width: 44,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowFields: {
    flexDirection: "row",
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
  switchBox: {
    backgroundColor: C.slate100,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 6,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: C.slate900,
  },
  switchDescription: {
    fontSize: 11,
    color: C.slate500,
    marginTop: 1,
  },
  actionBtnRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  btnPrimary: {
    backgroundColor: C.primaryColor,
    borderRadius: 8,
  },

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

  cameraOverlay: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: "center",
  },
  cameraOverlayText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  closeCameraBtn: {
    backgroundColor: C.white,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  closeCameraBtnText: {
    color: C.slate900,
    fontWeight: "700",
  },
});

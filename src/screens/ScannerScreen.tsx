import React, { useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Vibration,
} from "react-native";
import { Button, Text, ActivityIndicator, TextInput, List, Surface, useTheme } from "react-native-paper";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
import { ProdutosAPI } from "../api/produtos";
import { RootStackParamList } from "../types/navigation";
import { Produto } from "../types/produto";
import { parseGS1 } from "../utils/gs1Parser";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type RoutePropType = RouteProp<RootStackParamList, "Scanner">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Scanner">;

const C = {
  headerBg: "#8B0C21",
  bg: "#F0F2F5",
  white: "#FFFFFF",
  textDark: "#1E293B",
  textGray: "#6B7280",
  chevron: "#C5CAD0",
  border: "#E5E7EB",

  primaryColor: "#C41230",
  successColor: "#22A85A",
  warningColor: "#F97316",
  dangerColor: "#EF4444",
  infoColor: "#3B82F6",
};

export const ScannerScreen = () => {
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavigationProp>();
  const action = route.params?.action;
  const theme = useTheme();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [scanMode, setScanMode] = useState<"camera" | "manual">("camera");
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const scanLockRef = useRef(false);
  
  // Estados para busca manual
  const [searchQuery, setSearchQuery] = useState("");
  const [manualResults, setManualResults] = useState<Produto[]>([]);

  // Lida com a alternância de modo
  const changeMode = (mode: "camera" | "manual") => {
    scanLockRef.current = false;
    setIsTorchOn(false);
    setScanMode(mode);
    if (mode === "camera") {
      setScanned(false);
      setErrorMessage(null);
      setLastScannedCode(null);
      setSearchQuery("");
      setManualResults([]);
    } else {
      setScanned(false);
      if (lastScannedCode && !searchQuery) setSearchQuery(lastScannedCode);
    }
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanLockRef.current) return;

    const codigoLido = data.trim();
    if (!codigoLido) return;

    // A CameraView pode disparar o mesmo evento mais de uma vez antes do
    // React desmontar a câmera. O bloqueio síncrono evita buscas concorrentes.
    scanLockRef.current = true;
    try {
      Vibration.vibrate(80);
    } catch {
      // ignore
    }
    setLastScannedCode(codigoLido);
    setScanned(true);
    await buscarProdutoPorCodigo(codigoLido);
  };

  const buscarProdutoPorCodigo = async (codigo: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const parsed = parseGS1(codigo);
      // O backend é a fonte única de normalização. Enviar a leitura bruta
      // também preserva prefixos GS1 e códigos de embalagem para diagnóstico.
      const { produtos, inativos } = await ProdutosAPI.buscarPorCodigoBarras(codigo);
      if (produtos.length === 1) {
        const produto = produtos[0];
        if (action === "EntradaEstoque") {
          navigation.navigate("EntradaEstoque", { 
            produto, 
            loteSugerido: parsed.lote, 
            validadeSugerida: parsed.validade 
          });
        } else if (action) {
          navigation.navigate("ProdutoDetalhe", { 
            produto, 
            action, 
            loteSugerido: parsed.lote, 
            validadeSugerida: parsed.validade 
          });
        } else {
          navigation.navigate("ProdutoDetalhe", { 
            produto, 
            loteSugerido: parsed.lote, 
            validadeSugerida: parsed.validade 
          });
        }
      } else if (produtos.length > 1) {
        setSearchQuery(parsed.raw);
        setManualResults(produtos);
        setScanMode("manual");
        setErrorMessage("Mais de um produto ativo usa este código. Selecione o produto correto.");
      } else {
        setErrorMessage(
          inativos > 0
            ? `Este código pertence a ${inativos === 1 ? "um produto inativo" : `${inativos} produtos inativos`}. Reative o cadastro no ERP antes de movimentar o estoque.`
            : `Produto com código "${parsed.gtin}" não encontrado.`
        );
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Erro de rede ou servidor inacessível ao buscar o produto.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert("Atenção", "Por favor, digite o nome ou código do produto.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const resultados = await ProdutosAPI.buscarPorTexto(searchQuery.trim());
      setManualResults(resultados);
      if (resultados.length === 0) {
        setErrorMessage(`Nenhum produto encontrado para "${searchQuery}".`);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Erro de rede ou servidor inacessível ao buscar produtos por texto.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetScanner = () => {
    scanLockRef.current = false;
    setScanned(false);
    setErrorMessage(null);
    setLastScannedCode(null);
    setSearchQuery("");
    setManualResults([]);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor={C.headerBg} />

      {/* ── Header Corporativo ─── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} variant="titleLarge">
          Escanear Produto
        </Text>
        <View style={{ width: 28 }} />
      </View>

      {/* ── Abas do Alternador de Modo ─── */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.modeTab, scanMode === "camera" && styles.modeTabActive]}
          onPress={() => changeMode("camera")}
        >
          <Text style={[styles.modeTabText, scanMode === "camera" && styles.modeTabTextActive]}>
            📷 Câmera
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, scanMode === "manual" && styles.modeTabActive]}
          onPress={() => changeMode("manual")}
        >
          <Text style={[styles.modeTabText, scanMode === "manual" && styles.modeTabTextActive]}>
            ⌨️ Digitação
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── MODO CÂMERA ─── */}
        {scanMode === "camera" && (
          <View style={{ width: "100%" }}>
            {!scanned ? (
              <View style={styles.cameraWrapper}>
                {permission?.granted ? (
                  <CameraView
                    style={styles.camera}
                    facing="back"
                    enableTorch={isTorchOn}
                    onBarcodeScanned={handleBarcodeScanned}
                    barcodeScannerSettings={{
                      barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "itf14", "code128", "datamatrix", "qr"],
                    }}
                  />
                ) : (
                  <View style={[styles.camera, styles.centerContainer]}>
                    <MaterialCommunityIcons name="camera-off" size={42} color={C.dangerColor} />
                    <Text style={styles.permissionText}>
                      {permission ? "Permissão da câmera não concedida." : "Carregando permissão da câmera..."}
                    </Text>
                    {permission && <Button mode="contained" onPress={requestPermission}>Permitir câmera</Button>}
                    <Button mode="outlined" onPress={() => changeMode("manual")}>Usar busca manual</Button>
                  </View>
                )}
                {permission?.granted && (
                  <View style={styles.overlayScanner} pointerEvents="box-none">
                    <View style={styles.scanTarget} />
                    <TouchableOpacity
                      style={[styles.torchBtn, isTorchOn && styles.torchBtnActive]}
                      onPress={() => setIsTorchOn((prev) => !prev)}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons
                        name={isTorchOn ? "flashlight" : "flashlight-off"}
                        size={20}
                        color={isTorchOn ? "#0F172A" : "#FFFFFF"}
                      />
                      <Text style={[styles.torchText, isTorchOn && styles.torchTextActive]}>
                        {isTorchOn ? "Lanterna Ligada" : "Lanterna"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              <Surface style={styles.scannedBanner} elevation={1}>
                <MaterialCommunityIcons name="barcode" size={48} color={C.primaryColor} />
                <Text variant="titleMedium" style={styles.scannedTitle}>
                  Código Escaneado!
                </Text>
                <Button
                  mode="contained"
                  onPress={resetScanner}
                  style={[styles.resetBtn, { backgroundColor: C.primaryColor }]}
                >
                  Escanear Novamente
                </Button>
              </Surface>
            )}

            {/* Mensagem de Erro com botão de Fallback */}
            {errorMessage && !isLoading && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText} variant="bodyMedium">
                  {errorMessage}
                </Text>
                {lastScannedCode && (
                  <Text style={styles.scannedCodeText} variant="bodySmall" selectable>
                    Código lido pela câmera: {lastScannedCode}
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.fallbackManualBtn}
                  onPress={() => changeMode("manual")}
                >
                  <Text style={styles.fallbackManualText}>Buscar Manualmente</Text>
                </TouchableOpacity>
                {lastScannedCode && errorMessage.includes("não encontrado") && <Button
                  mode="contained-tonal" icon="plus" style={{ marginTop: 10 }}
                  onPress={() => navigation.navigate("CadastroProduto", { codigoBarrasSugerido: parseGS1(lastScannedCode).gtin })}
                >Cadastrar este produto</Button>}
              </View>
            )}
          </View>
        )}

        {/* ── MODO MANUAL ─── */}
        {scanMode === "manual" && (
          <Surface style={styles.manualSearchWrapper} elevation={1}>
            <Text variant="titleMedium" style={styles.manualTitle}>
              Buscar Produto Manualmente
            </Text>
            
            <View style={styles.rowSearch}>
              <TextInput
                label="Nome, EAN ou código interno"
                value={searchQuery}
                onChangeText={setSearchQuery}
                mode="outlined"
                style={styles.searchInput}
                outlineColor={C.border}
                activeOutlineColor={C.primaryColor}
                disabled={isLoading}
              />
            </View>
            <Button
              mode="contained"
              onPress={handleManualSearch}
              loading={isLoading}
              disabled={isLoading}
              style={[styles.searchBtn, { backgroundColor: C.primaryColor }]}
            >
              Buscar Produto
            </Button>

            {errorMessage && !isLoading && (
              <Text style={[styles.errorText, { marginTop: 12 }]} variant="bodyMedium">
                {errorMessage}
              </Text>
            )}
            {manualResults.length === 0 && errorMessage?.startsWith("Nenhum produto") && <Button
              mode="contained-tonal" icon="plus" style={{ marginTop: 12 }}
              onPress={() => navigation.navigate("CadastroProduto", { codigoBarrasSugerido: parseGS1(searchQuery).gtin })}
            >Cadastrar este produto</Button>}

            {/* Listagem de Resultados */}
            {manualResults.length > 0 && (
              <View style={styles.resultsContainer}>
                <Text variant="labelMedium" style={styles.resultsHeader}>
                  Resultados encontrados ({manualResults.length}):
                </Text>
                {manualResults.map((item) => (
                  <List.Item
                    key={item.id}
                    title={() => <Text style={styles.itemTitle}>{item.nome}</Text>}
                    description={`Cód: ${item.codigoInterno || "N/A"} | EAN: ${item.codigoBarras || "N/A"} (${item.unidade})`}
                    left={(props) => <List.Icon {...props} icon="package-variant" color={C.primaryColor} />}
                    right={(props) => <List.Icon {...props} icon="chevron-right" color={C.chevron} />}
                    onPress={() => {
                      const parsed = parseGS1(searchQuery);
                      const loteSugerido = parsed.isGS1 ? parsed.lote : undefined;
                      const validadeSugerida = parsed.isGS1 ? parsed.validade : undefined;

                      if (action === "EntradaEstoque") {
                        navigation.navigate("EntradaEstoque", { 
                          produto: item, 
                          loteSugerido, 
                          validadeSugerida 
                        });
                      } else if (action) {
                        navigation.navigate("ProdutoDetalhe", { 
                          produto: item, 
                          action, 
                          loteSugerido, 
                          validadeSugerida 
                        });
                      } else {
                        navigation.navigate("ProdutoDetalhe", { 
                          produto: item, 
                          loteSugerido, 
                          validadeSugerida 
                        });
                      }
                    }}
                    style={styles.listItem}
                  />
                ))}
              </View>
            )}
          </Surface>
        )}

        {/* Estado de Carregamento da API */}
        {isLoading && (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator animating={true} size="small" color={C.primaryColor} />
            <Text variant="bodySmall" style={styles.loadingText}>
              Buscando no banco de dados...
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.headerBg,
    paddingTop: Platform.OS === "android" ? 50 : 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  modeTab: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },
  modeTabActive: {
    backgroundColor: C.primaryColor,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textGray,
  },
  modeTabTextActive: {
    color: C.white,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: C.bg,
  },
  loadingText: {
    marginTop: 16,
    color: C.textGray,
    fontSize: 14,
  },
  permissionTitle: {
    fontWeight: "bold",
    marginBottom: 12,
    color: C.textDark,
  },
  permissionText: {
    textAlign: "center",
    color: C.textGray,
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    width: "100%",
    borderRadius: 8,
    marginBottom: 12,
    paddingVertical: 4,
  },
  backButton: {
    width: "100%",
    borderRadius: 8,
  },
  cameraWrapper: {
    height: 320,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000000",
    marginBottom: 16,
    position: "relative",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  camera: {
    flex: 1,
  },
  overlayScanner: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  scanTarget: {
    width: 240,
    height: 140,
    borderWidth: 2.5,
    borderColor: "#00E676",
    backgroundColor: "transparent",
    borderRadius: 12,
  },
  torchBtn: {
    position: "absolute",
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  torchBtnActive: {
    backgroundColor: "#FACC15",
    borderColor: "#EAB308",
  },
  torchText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  torchTextActive: {
    color: "#0F172A",
  },
  scannedBanner: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: C.white,
    alignItems: "center",
    marginBottom: 16,
  },
  scannedTitle: {
    fontWeight: "bold",
    marginVertical: 12,
    color: C.textDark,
  },
  resetBtn: {
    borderRadius: 10,
    width: "80%",
    paddingVertical: 4,
  },
  loadingWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
    gap: 8,
  },
  errorContainer: {
    alignItems: "center",
    marginVertical: 12,
    gap: 8,
  },
  errorText: {
    color: C.dangerColor,
    textAlign: "center",
    fontWeight: "600",
    fontSize: 14,
  },
  scannedCodeText: {
    color: C.textGray,
    textAlign: "center",
    fontSize: 12,
  },
  fallbackManualBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  fallbackManualText: {
    color: C.dangerColor,
    fontWeight: "700",
    fontSize: 12,
  },
  manualSearchWrapper: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: C.white,
  },
  manualTitle: {
    fontWeight: "800",
    color: C.textDark,
    marginBottom: 16,
  },
  rowSearch: {
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: C.white,
  },
  searchBtn: {
    height: 48,
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 4,
  },
  resultsContainer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 16,
  },
  resultsHeader: {
    color: C.textGray,
    fontWeight: "700",
    marginBottom: 12,
  },
  listItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingVertical: 6,
  },
  itemTitle: {
    fontWeight: "700",
    color: C.textDark,
    fontSize: 14,
  },
});

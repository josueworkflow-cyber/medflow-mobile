import React, { useState } from "react";
import { StyleSheet, View, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Button, Text, ActivityIndicator, TextInput, List, Surface, IconButton, useTheme } from "react-native-paper";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
import { ProdutosAPI } from "../api/produtos";
import { RootStackParamList } from "../types/navigation";
import { Produto } from "../types/produto";
import { parseGS1 } from "../utils/gs1Parser";

type RoutePropType = RouteProp<RootStackParamList, "Scanner">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Scanner">;

export const ScannerScreen = () => {
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavigationProp>();
  const action = route.params?.action;
  const theme = useTheme();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Estados para busca manual fallback
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [manualResults, setManualResults] = useState<Produto[]>([]);

  if (!permission) {
    // Permissão da câmera ainda carregando
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText} variant="bodyMedium">
          Carregando permissões...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    // Permissão não concedida
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permissionTitle} variant="titleLarge">
          Acesso à Câmera Necessário
        </Text>
        <Text style={styles.permissionText} variant="bodyMedium">
          Precisamos de acesso à câmera do celular para ler os códigos de barras dos produtos hospitalares.
        </Text>
        <Button mode="contained" onPress={requestPermission} style={styles.button}>
          Conceder Permissão
        </Button>
        <Button mode="outlined" onPress={() => navigation.goBack()} style={styles.backButton}>
          Voltar
        </Button>
      </View>
    );
  }

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    setScanned(true);
    await buscarProdutoPorCodigo(data);
  };

  const buscarProdutoPorCodigo = async (codigo: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setShowManualSearch(false);
    
    try {
      const parsed = parseGS1(codigo);
      const produto = await ProdutosAPI.buscarPorCodigoBarras(parsed.gtin);
      if (produto) {
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
      } else {
        setErrorMessage(`Produto com código "${parsed.gtin}" não encontrado.`);
        setShowManualSearch(true);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Erro de rede ou servidor inacessível ao buscar o produto.");
      setShowManualSearch(true);
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
    setScanned(false);
    setErrorMessage(null);
    setShowManualSearch(false);
    setSearchQuery("");
    setManualResults([]);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle} variant="titleLarge">
          Escanear Produto
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Componente da Câmera */}
        {!scanned ? (
          <View style={styles.cameraWrapper}>
            <CameraView
              style={styles.camera}
              facing="back"
              onBarcodeScanned={handleBarcodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ["ean13", "ean8", "qr"],
              }}
            />
            <View style={styles.overlayScanner}>
              <View style={styles.scanTarget} />
            </View>
          </View>
        ) : (
          <Surface style={styles.scannedBanner} elevation={1}>
            <IconButton icon="barcode" size={48} iconColor={theme.colors.primary} />
            <Text variant="titleMedium" style={styles.scannedTitle}>
              Código Escaneado!
            </Text>
            <Button mode="contained" onPress={resetScanner} style={styles.resetBtn}>
              Escanear Novamente
            </Button>
          </Surface>
        )}

        {/* Estado de Carregamento da API */}
        {isLoading && (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator animating={true} size="small" />
            <Text variant="bodySmall" style={styles.loadingText}>
              Buscando no banco de dados...
            </Text>
          </View>
        )}

        {/* Mensagens de Erro/Não Encontrado */}
        {errorMessage && !isLoading && (
          <Text style={styles.errorText} variant="bodyMedium">
            {errorMessage}
          </Text>
        )}

        {/* Fallback de Busca Manual */}
        {showManualSearch && (
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
                disabled={isLoading}
              />
              <Button
                mode="contained"
                onPress={handleManualSearch}
                loading={isLoading}
                disabled={isLoading}
                style={styles.searchBtn}
              >
                Buscar
              </Button>
            </View>

            {/* Listagem de Resultados da Busca Manual */}
            {manualResults.length > 0 && (
              <View style={styles.resultsContainer}>
                <Text variant="labelMedium" style={styles.resultsHeader}>
                  Resultados encontrados ({manualResults.length}):
                </Text>
                {manualResults.map((item) => (
                  <List.Item
                    key={item.id}
                    title={item.nome}
                    description={`Cód: ${item.codigoInterno || "N/A"} | EAN: ${item.codigoBarras || "N/A"} (${item.unidade})`}
                    left={(props) => <List.Icon {...props} icon="package-variant" />}
                    right={(props) => <List.Icon {...props} icon="chevron-right" />}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 40 : 10,
    paddingBottom: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: {
    fontWeight: "bold",
    marginLeft: 8,
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
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 16,
    color: "#7F8C8D",
  },
  permissionTitle: {
    fontWeight: "bold",
    marginBottom: 12,
    color: "#2C3E50",
  },
  permissionText: {
    textAlign: "center",
    color: "#7F8C8D",
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    width: "100%",
    borderRadius: 8,
    marginBottom: 12,
  },
  backButton: {
    width: "100%",
    borderRadius: 8,
  },
  cameraWrapper: {
    height: 300,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000000",
    marginBottom: 16,
    position: "relative",
  },
  camera: {
    flex: 1,
  },
  overlayScanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  scanTarget: {
    width: 220,
    height: 120,
    borderWidth: 2,
    borderColor: "#00E676",
    backgroundColor: "transparent",
    borderRadius: 8,
  },
  scannedBanner: {
    padding: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    alignItems: "center",
    marginBottom: 16,
  },
  scannedTitle: {
    fontWeight: "bold",
    marginVertical: 12,
    color: "#2C3E50",
  },
  resetBtn: {
    borderRadius: 8,
    width: "80%",
  },
  loadingWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
  },
  errorText: {
    color: "#E53935",
    textAlign: "center",
    marginVertical: 12,
    fontWeight: "500",
  },
  manualSearchWrapper: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    marginTop: 8,
  },
  manualTitle: {
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 16,
  },
  rowSearch: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    marginRight: 8,
  },
  searchBtn: {
    height: 52,
    justifyContent: "center",
    borderRadius: 8,
  },
  resultsContainer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 12,
  },
  resultsHeader: {
    color: "#7F8C8D",
    marginBottom: 8,
  },
  listItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#f9f9f9",
    paddingVertical: 4,
  },
});

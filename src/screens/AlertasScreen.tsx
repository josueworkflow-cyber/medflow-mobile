import React, { useState, useEffect } from "react";
import { StyleSheet, View, ScrollView, Platform } from "react-native";
import { Button, Text, Card, SegmentedButtons, Surface, IconButton, ActivityIndicator } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { AlertasAPI, AlertasResponse } from "../api/alertas";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Alertas">;

export const AlertasScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [dias, setDias] = useState<30 | 60 | 90>(30);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [alertasData, setAlertasData] = useState<AlertasResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregarAlertas = () => setRefreshTrigger((prev) => prev + 1);

  useEffect(() => {
    let cancelled = false;
    const carregar = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await AlertasAPI.buscar(dias);
        if (!cancelled) setAlertasData(data);
      } catch (err: any) {
        console.error(err);
        if (!cancelled) setError("Erro de rede ou servidor inacessível ao carregar alertas.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    carregar();
    return () => {
      cancelled = true;
    };
  }, [dias, refreshTrigger]);

  // Formatação de data local
  const formatValidade = (dateStr: string | null): string => {
    if (!dateStr) return "Sem validade";
    try {
      const cleanDate = dateStr.split("T")[0];
      const parts = cleanDate.split("-");
      if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
      }
    } catch (e) {
      console.error("Erro ao formatar data:", e);
    }
    return dateStr;
  };

  // Formatação monetária manual para máxima compatibilidade
  const formatCurrency = (val: number) => {
    try {
      return `R$ ${val.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
    } catch {
      return `R$ ${val}`;
    }
  };

  if (isLoading && !alertasData) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText} variant="bodyMedium">
          Carregando alertas...
        </Text>
      </View>
    );
  }

  if (error && !alertasData) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle} variant="titleLarge">
          Falha na Conexão
        </Text>
        <Text style={styles.errorText} variant="bodyMedium">
          {error}
        </Text>
        <Button mode="contained" onPress={carregarAlertas} style={styles.btnAction}>
          Tentar Novamente
        </Button>
        <Button mode="outlined" onPress={() => navigation.goBack()} style={styles.backBtn}>
          Voltar ao Painel
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle} variant="titleLarge">
          Alertas do Estoque
        </Text>
        <IconButton icon="refresh" onPress={carregarAlertas} disabled={isLoading} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Filtro de Período */}
        <SegmentedButtons
          value={String(dias)}
          onValueChange={(val) => setDias(Number(val) as 30 | 60 | 90)}
          buttons={[
            { value: "30", label: "30 Dias", disabled: isLoading },
            { value: "60", label: "60 Dias", disabled: isLoading },
            { value: "90", label: "90 Dias", disabled: isLoading },
          ]}
          style={styles.filterContainer}
        />

        {/* Card Valor em Risco */}
        <Card style={styles.riscoCard} mode="contained">
          <Card.Content>
            <Text variant="labelMedium" style={styles.riscoLabel}>
              Valor em Risco (Lotes Vencidos)
            </Text>
            <Text variant="headlineMedium" style={styles.riscoValor}>
              {formatCurrency(alertasData?.valorEmRisco || 0)}
            </Text>
          </Card.Content>
        </Card>

        {/* Seção 1: Vencidos */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Vencidos ({alertasData?.totais.vencidos || 0})
        </Text>
        {(!alertasData || alertasData.vencidos.length === 0) ? (
          <Surface style={styles.emptyContainer} elevation={1}>
            <Text variant="bodyMedium" style={styles.emptyText}>
              Nenhum item nesta categoria
            </Text>
          </Surface>
        ) : (
          alertasData.vencidos.map((lote) => (
            <Card key={`vencido-${lote.loteId}`} style={styles.alertCard} mode="outlined">
              <Card.Content>
                <Text variant="titleMedium" style={styles.alertProductName}>
                  {lote.produto}
                </Text>
                <View style={styles.alertRow}>
                  <Text variant="bodyMedium" style={styles.loteText}>Lote: {lote.numeroLote}</Text>
                  <Text variant="labelSmall" style={styles.vencidoTag}>VENCIDO</Text>
                </View>
                <View style={styles.alertMetaRow}>
                  <Text variant="bodySmall" style={styles.metaText}>Validade: {formatValidade(lote.validade)}</Text>
                  <Text variant="bodySmall" style={styles.metaText}>Saldo: {lote.quantidade}</Text>
                  <Text variant="bodySmall" style={styles.metaText}>Local: {lote.localizacao}</Text>
                </View>
              </Card.Content>
            </Card>
          ))
        )}

        {/* Seção 2: Vencendo em Breve */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Vencendo em Breve ({alertasData?.totais.vencendo || 0})
        </Text>
        {(!alertasData || alertasData.vencendo.length === 0) ? (
          <Surface style={styles.emptyContainer} elevation={1}>
            <Text variant="bodyMedium" style={styles.emptyText}>
              Nenhum item nesta categoria
            </Text>
          </Surface>
        ) : (
          alertasData.vencendo.map((lote) => (
            <Card key={`vencendo-${lote.loteId}`} style={styles.alertCard} mode="outlined">
              <Card.Content>
                <Text variant="titleMedium" style={styles.alertProductName}>
                  {lote.produto}
                </Text>
                <View style={styles.alertRow}>
                  <Text variant="bodyMedium" style={styles.loteText}>Lote: {lote.numeroLote}</Text>
                  <Text variant="labelSmall" style={styles.vencendoTag}>ALERTA</Text>
                </View>
                <View style={styles.alertMetaRow}>
                  <Text variant="bodySmall" style={styles.metaText}>Validade: {formatValidade(lote.validade)}</Text>
                  <Text variant="bodySmall" style={styles.metaText}>Saldo: {lote.quantidade}</Text>
                  <Text variant="bodySmall" style={styles.metaText}>Local: {lote.localizacao}</Text>
                </View>
              </Card.Content>
            </Card>
          ))
        )}

        {/* Seção 3: Estoque Abaixo do Mínimo */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Abaixo do Mínimo ({alertasData?.totais.abaixoMinimo || 0})
        </Text>
        {(!alertasData || alertasData.abaixoMinimo.length === 0) ? (
          <Surface style={styles.emptyContainer} elevation={1}>
            <Text variant="bodyMedium" style={styles.emptyText}>
              Nenhum item nesta categoria
            </Text>
          </Surface>
        ) : (
          alertasData.abaixoMinimo.map((prod) => (
            <Card key={`minimo-${prod.id}`} style={styles.alertCard} mode="outlined">
              <Card.Content>
                <Text variant="titleMedium" style={styles.alertProductName}>
                  {prod.descricao}
                </Text>
                <Text variant="bodySmall" style={styles.loteText}>Cód: {prod.codigoInterno || "N/A"}</Text>
                <View style={styles.alertMetaRow}>
                  <Text variant="bodySmall" style={styles.metaText}>Mínimo: {prod.estoqueMinimo}</Text>
                  <Text variant="bodySmall" style={styles.metaText}>Atual: {prod.estoqueAtual}</Text>
                  <Text variant="bodySmall" style={styles.diferencaText}>Diferença: {prod.diferenca}</Text>
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
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
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 40 : 10,
    paddingBottom: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: {
    fontWeight: "bold",
    marginLeft: 8,
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  filterContainer: {
    marginBottom: 16,
  },
  riscoCard: {
    backgroundColor: "#FFEBEE",
    marginBottom: 20,
    borderRadius: 8,
  },
  riscoLabel: {
    color: "#C62828",
    fontWeight: "500",
  },
  riscoValor: {
    fontWeight: "bold",
    color: "#C62828",
    marginTop: 4,
  },
  sectionTitle: {
    fontWeight: "bold",
    color: "#2C3E50",
    marginTop: 12,
    marginBottom: 8,
  },
  emptyContainer: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#ffffff",
    marginBottom: 12,
  },
  emptyText: {
    color: "#7F8C8D",
  },
  alertCard: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    marginBottom: 8,
  },
  alertProductName: {
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 4,
  },
  alertRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  loteText: {
    color: "#34495E",
    fontWeight: "500",
  },
  vencidoTag: {
    backgroundColor: "#FFEBEE",
    color: "#C62828",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: "bold",
  },
  vencendoTag: {
    backgroundColor: "#FFF3E0",
    color: "#E65100",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: "bold",
  },
  alertMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 8,
  },
  metaText: {
    color: "#7F8C8D",
  },
  diferencaText: {
    color: "#C62828",
    fontWeight: "bold",
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
  errorTitle: {
    fontWeight: "bold",
    color: "#C62828",
    marginBottom: 8,
  },
  errorText: {
    textAlign: "center",
    color: "#7F8C8D",
    marginBottom: 20,
  },
  btnAction: {
    width: "100%",
    borderRadius: 8,
    marginBottom: 10,
  },
  backBtn: {
    width: "100%",
    borderRadius: 8,
  },
});

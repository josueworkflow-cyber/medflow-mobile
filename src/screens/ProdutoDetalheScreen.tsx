import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Alert, Platform } from "react-native";
import { Button, Text, Card, Divider, Surface, IconButton } from "react-native-paper";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";

type RoutePropType = RouteProp<RootStackParamList, "ProdutoDetalhe">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, "ProdutoDetalhe">;

export const ProdutoDetalheScreen = () => {
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavigationProp>();
  
  const { produto, action } = route.params;

  const actionLabels: Record<string, string> = {
    AjusteInventario: "ajustar o saldo",
    BloqueioLote: "bloquear o lote",
    Transferencia: "transferir o lote",
  };
  const actionLabel = action ? actionLabels[action] : null;

  // Estado para armazenar o ID do lote selecionado
  const [selectedLoteId, setSelectedLoteId] = useState<number | null>(null);

  // Função local de formatação de data
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

  return (
    <View style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle} variant="titleLarge">
          Detalhes do Produto
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {actionLabel && (
          <Surface style={styles.actionWarning} elevation={0}>
            <Text style={styles.actionWarningText}>
              Selecione o lote desejado abaixo para {actionLabel}.
            </Text>
          </Surface>
        )}
        {/* Card de Informações Principais do Produto */}
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <Text variant="headlineSmall" style={styles.productName}>
              {produto.nome}
            </Text>
            
            <Divider style={styles.divider} />
            
            <View style={styles.infoRow}>
              <View style={styles.infoCol}>
                <Text variant="labelMedium" style={styles.infoLabel}>Cód. Interno</Text>
                <Text variant="bodyLarge" style={styles.infoValue}>
                  {produto.codigoInterno || "N/A"}
                </Text>
              </View>
              <View style={styles.infoCol}>
                <Text variant="labelMedium" style={styles.infoLabel}>Unidade</Text>
                <Text variant="bodyLarge" style={styles.infoValue}>
                  {produto.unidade}
                </Text>
              </View>
            </View>

            <View style={[styles.infoRow, { marginTop: 12 }]}>
              <View style={styles.infoCol}>
                <Text variant="labelMedium" style={styles.infoLabel}>EAN / Cód. Barras</Text>
                <Text variant="bodyLarge" style={styles.infoValue}>
                  {produto.codigoBarras || "N/A"}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Lotes do Estoque */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Lotes em Estoque
        </Text>

        {(!produto.lotes || produto.lotes.length === 0) ? (
          <Surface style={styles.emptyLotes} elevation={1}>
            <Text variant="bodyMedium" style={{ color: "#7F8C8D" }}>
              Nenhum lote cadastrado ou saldo em estoque.
            </Text>
          </Surface>
        ) : (
          produto.lotes.map((lote) => {
            // Soma a quantidade disponível de todas as localizações desse lote
            const totalQtd = lote.estoqueAtual.reduce(
              (acc, curr) => acc + curr.quantidadeDisponivel, 0
            );

            // Coleta a localização (exibe a primeira, ou lista)
            const localizacoes = lote.estoqueAtual
              .map(e => e.localizacao?.nome)
              .filter(Boolean)
              .join(", ") || "Sem localização";

            const isSelected = selectedLoteId === lote.id;

            return (
              <React.Fragment key={lote.id}>
                {/* Card de Lote Tocável */}
                <Card 
                  style={[
                    styles.loteCard, 
                    isSelected && styles.loteCardSelected
                  ]} 
                  mode="elevated"
                  onPress={() => setSelectedLoteId(isSelected ? null : lote.id)}
                >
                  <Card.Content>
                    <View style={styles.loteHeader}>
                      <Text variant="titleMedium" style={styles.loteCodigo}>
                        Lote: {lote.codigo}
                      </Text>
                      <Surface 
                        style={[
                          styles.statusBadge, 
                          { backgroundColor: lote.status === "ATIVO" ? "#E8F5E9" : "#FFEBEE" }
                        ]}
                        elevation={0}
                      >
                        <Text 
                          variant="labelSmall" 
                          style={{ color: lote.status === "ATIVO" ? "#2E7D32" : "#C62828", fontWeight: "bold" }}
                        >
                          {lote.status}
                        </Text>
                      </Surface>
                    </View>

                    <Divider style={{ marginVertical: 8 }} />

                    <View style={styles.infoRow}>
                      <View style={styles.infoCol}>
                        <Text variant="labelSmall" style={styles.infoLabel}>Validade</Text>
                        <Text variant="bodyMedium">
                          {formatValidade(lote.dataValidade)}
                        </Text>
                      </View>
                      <View style={styles.infoCol}>
                        <Text variant="labelSmall" style={styles.infoLabel}>Localização</Text>
                        <Text variant="bodyMedium">{localizacoes}</Text>
                      </View>
                      <View style={[styles.infoCol, { alignItems: "flex-end" }]}>
                        <Text variant="labelSmall" style={styles.infoLabel}>Saldo</Text>
                        <Text variant="bodyMedium" style={styles.loteSaldo}>
                          {totalQtd} {produto.unidade}
                        </Text>
                      </View>
                    </View>
                  </Card.Content>
                </Card>

                {/* Bloco de Ações Contextuais do Lote Selecionado */}
                {isSelected && (
                  <View style={styles.loteAcoesContextuais}>
                    <Button 
                      mode="contained" 
                      icon="clipboard-edit" 
                      onPress={() => navigation.navigate("AjusteInventario", { produto, lote })}
                      style={styles.contextBtn}
                      labelStyle={styles.contextBtnLabel}
                    >
                      Ajustar
                    </Button>
                    <Button 
                      mode="contained" 
                      icon="lock" 
                      onPress={() => navigation.navigate("BloqueioLote", { produto, lote })}
                      style={[styles.contextBtn, { marginHorizontal: 4 }]}
                      labelStyle={styles.contextBtnLabel}
                    >
                      Bloquear
                    </Button>
                    <Button 
                      mode="contained" 
                      icon="dolly" 
                      onPress={() => navigation.navigate("Transferencia", { produto, lote })}
                      style={styles.contextBtn}
                      labelStyle={styles.contextBtnLabel}
                    >
                      Transferir
                    </Button>
                  </View>
                )}
              </React.Fragment>
            );
          })
        )}

        {/* Grade de Ações Inferior / Botão Dar Entrada Standalone */}
        {selectedLoteId !== null ? (
          <Button
            mode="contained-tonal"
            icon="plus-box"
            onPress={() => navigation.navigate("EntradaEstoque", { produto })}
            style={styles.darEntradaStandaloneBtn}
          >
            Dar Entrada de Novo Lote
          </Button>
        ) : (
          <>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Ações Operacionais
            </Text>
            
            <View style={styles.gridAcoes}>
              <Button 
                mode="contained-tonal" 
                icon="plus-box" 
                onPress={() => navigation.navigate("EntradaEstoque", { produto })}
                style={styles.gridBtn}
                labelStyle={styles.btnLabel}
              >
                Dar Entrada
              </Button>
              <Button 
                mode="contained-tonal" 
                icon="clipboard-edit" 
                onPress={() => Alert.alert("Atenção", "Selecione um lote para esta ação.")}
                style={styles.gridBtn}
                labelStyle={styles.btnLabel}
              >
                Ajustar
              </Button>
            </View>

            <View style={[styles.gridAcoes, { marginTop: 8 }]}>
              <Button 
                mode="contained-tonal" 
                icon="lock" 
                onPress={() => Alert.alert("Atenção", "Selecione um lote para esta ação.")}
                style={styles.gridBtn}
                labelStyle={styles.btnLabel}
              >
                Bloquear Lote
              </Button>
              <Button 
                mode="contained-tonal" 
                icon="dolly" 
                onPress={() => Alert.alert("Atenção", "Selecione um lote para esta ação.")}
                style={styles.gridBtn}
                labelStyle={styles.btnLabel}
              >
                Transferir
              </Button>
            </View>
          </>
        )}

        <Button 
          mode="outlined" 
          onPress={() => navigation.goBack()} 
          style={styles.voltarBtn}
          icon="barcode-scan"
        >
          Voltar ao Scanner
        </Button>
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
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    marginBottom: 20,
  },
  productName: {
    fontWeight: "bold",
    color: "#2C3E50",
    lineHeight: 30,
  },
  divider: {
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    color: "#7F8C8D",
    marginBottom: 2,
  },
  infoValue: {
    color: "#2C3E50",
    fontWeight: "600",
  },
  sectionTitle: {
    fontWeight: "bold",
    color: "#2C3E50",
    marginTop: 8,
    marginBottom: 12,
  },
  emptyLotes: {
    padding: 20,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#ffffff",
    marginBottom: 20,
  },
  loteCard: {
    marginBottom: 10,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  loteCardSelected: {
    borderColor: "#2196F3",
    borderWidth: 2,
  },
  loteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  loteCodigo: {
    fontWeight: "bold",
    color: "#2C3E50",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  loteSaldo: {
    fontWeight: "bold",
    color: "#2C3E50",
  },
  loteAcoesContextuais: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 16,
    marginTop: -4,
  },
  contextBtn: {
    flex: 1,
    borderRadius: 6,
    height: 40,
    justifyContent: "center",
  },
  contextBtnLabel: {
    fontSize: 12,
  },
  darEntradaStandaloneBtn: {
    marginTop: 16,
    borderRadius: 8,
    height: 48,
    justifyContent: "center",
  },
  gridAcoes: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  gridBtn: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 8,
    height: 48,
    justifyContent: "center",
  },
  btnLabel: {
    fontSize: 13,
  },
  voltarBtn: {
    marginTop: 24,
    borderRadius: 8,
  },
  actionWarning: {
    backgroundColor: "#EFF6FF",
    borderColor: "#DBEAFE",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  actionWarningText: {
    color: "#1E40AF",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
});

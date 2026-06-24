import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { Button, Text, TextInput, HelperText, Card } from "react-native-paper";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { EstoqueAPI } from "../api/estoque";
import { z } from "zod";

type RoutePropType = RouteProp<RootStackParamList, "AjusteInventario">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, "AjusteInventario">;

// Schema de validação local Zod
const ajusteSchema = z.object({
  quantidadeNova: z.coerce
    .number({ invalid_type_error: "A quantidade deve ser um número válido." })
    .nonnegative("A quantidade nova não pode ser negativa."),
  motivo: z.string().min(10, "O motivo deve conter pelo menos 10 caracteres."),
});

export const AjusteInventarioScreen = () => {
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavigationProp>();

  const produto = route.params?.produto;
  const lote = route.params?.lote;

  if (!produto || !lote) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 16 }}>
        <Text style={{ textAlign: "center" }}>Produto ou lote não selecionado ou parâmetros inválidos.</Text>
        <Button mode="contained" onPress={() => navigation.goBack()}>
          Voltar
        </Button>
      </View>
    );
  }

  // Estados do Formulário
  const [quantidadeNova, setQuantidadeNova] = useState("");
  const [motivo, setMotivo] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calcula o saldo atual (soma das localizações desse lote)
  const saldoAtual = lote.estoqueAtual.reduce(
    (acc, curr) => acc + curr.quantidadeDisponivel, 0
  );

  const handleSubmeter = async () => {
    const payloadFields = {
      quantidadeNova,
      motivo: motivo.trim(),
    };

    const resultado = ajusteSchema.safeParse(payloadFields);
    
    if (!resultado.success) {
      const formattedErrors: Record<string, string> = {};
      resultado.error.errors.forEach((err) => {
        if (err.path[0]) {
          formattedErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(formattedErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      // Monta o payload final usando o dado validado e limpo pelo Zod
      const payload = {
        produtoId: produto.id,
        loteId: lote.id,
        quantidadeNova: resultado.data.quantidadeNova,
        motivo: resultado.data.motivo,
      };

      await EstoqueAPI.ajuste(payload);

      Alert.alert("Sucesso", "Ajuste de inventário registrado com sucesso!", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (err: any) {
      console.error(err);
      // Tratamento específico para o erro 400 de quantidade idêntica
      const apiError = err.response?.data?.error || "Ocorreu um erro ao processar o ajuste de estoque.";
      Alert.alert("Erro de Ajuste", apiError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.title}>
            Ajustar Saldo de Lote
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {produto.nome} ({produto.unidade})
          </Text>
          <Text variant="bodySmall" style={styles.loteInfo}>
            Lote: {lote.codigo} | Saldo Atual: {saldoAtual} {produto.unidade}
          </Text>
        </View>

        <Card style={styles.card} mode="outlined">
          <Card.Content>
            {/* Campo Quantidade Nova */}
            <TextInput
              label="Nova Quantidade em Estoque *"
              value={quantidadeNova}
              onChangeText={(text) => {
                setQuantidadeNova(text);
                if (errors.quantidadeNova) setErrors((prev) => ({ ...prev, quantidadeNova: "" }));
              }}
              mode="outlined"
              keyboardType="numeric"
              disabled={isLoading}
              style={styles.input}
            />
            {errors.quantidadeNova && (
              <HelperText type="error" visible={true}>
                {errors.quantidadeNova}
              </HelperText>
            )}

            {/* Campo Motivo do Ajuste */}
            <TextInput
              label="Motivo do Ajuste (Mín. 10 caracteres) *"
              value={motivo}
              onChangeText={(text) => {
                setMotivo(text);
                if (errors.motivo) setErrors((prev) => ({ ...prev, motivo: "" }));
              }}
              mode="outlined"
              multiline={true}
              numberOfLines={3}
              placeholder="Ex: Quebra física identificada na prateleira X ou recontagem."
              disabled={isLoading}
              style={styles.input}
            />
            {errors.motivo && (
              <HelperText type="error" visible={true}>
                {errors.motivo}
              </HelperText>
            )}

            {/* Botões de Ação */}
            <View style={styles.btnRow}>
              <Button
                mode="outlined"
                onPress={() => navigation.goBack()}
                disabled={isLoading}
                style={styles.btnAction}
              >
                Cancelar
              </Button>
              <Button
                mode="contained"
                onPress={handleSubmeter}
                loading={isLoading}
                disabled={isLoading}
                style={[styles.btnAction, { marginLeft: 12 }]}
              >
                Salvar Ajuste
              </Button>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  header: {
    marginBottom: 20,
    marginTop: Platform.OS === "ios" ? 40 : 10,
  },
  title: {
    fontWeight: "bold",
    color: "#2C3E50",
  },
  subtitle: {
    color: "#7F8C8D",
    marginTop: 4,
  },
  loteInfo: {
    color: "#34495E",
    fontWeight: "600",
    marginTop: 4,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
  },
  input: {
    marginBottom: 8,
  },
  btnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  btnAction: {
    flex: 1,
    borderRadius: 8,
  },
});

import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { Button, Text, TextInput, HelperText, Card } from "react-native-paper";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { EstoqueAPI } from "../api/estoque";
import { z } from "zod";

type RoutePropType = RouteProp<RootStackParamList, "Transferencia">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Transferencia">;

// Schema de validação local Zod com refine para validar se destino é diferente de origem
const transferenciaSchema = z
  .object({
    localizacaoOrigemId: z.coerce
      .number({ invalid_type_error: "ID de origem deve ser um número válido." })
      .positive("Localização de origem é obrigatória."),
    localizacaoDestinoId: z.coerce
      .number({ invalid_type_error: "ID de destino deve ser um número válido." })
      .positive("Localização de destino é obrigatória."),
    quantidade: z.coerce
      .number({ invalid_type_error: "A quantidade deve ser um número válido." })
      .positive("A quantidade deve ser maior que zero."),
    motivo: z.string().min(1, "O motivo da transferência é obrigatório."),
  })
  .refine((data) => data.localizacaoOrigemId !== data.localizacaoDestinoId, {
    message: "Origem e destino não podem ser iguais.",
    path: ["localizacaoDestinoId"],
  });

export const TransferenciaScreen = () => {
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
  const [localizacaoOrigemId, setLocalizacaoOrigemId] = useState("");
  const [localizacaoDestinoId, setLocalizacaoDestinoId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calcula a quantidade total disponível do lote para exibição
  const totalQtd = lote.estoqueAtual.reduce(
    (acc, curr) => acc + curr.quantidadeDisponivel, 0
  );

  const handleSubmeter = async () => {
    const payloadFields = {
      localizacaoOrigemId,
      localizacaoDestinoId,
      quantidade,
      motivo: motivo.trim(),
    };

    const resultado = transferenciaSchema.safeParse(payloadFields);
    
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
      // Monta o payload final usando o dado validado e limpo pelo Zod (loteId, localizacaoOrigemId, localizacaoDestinoId, quantidade, motivo)
      const payload = {
        loteId: lote.id,
        localizacaoOrigemId: resultado.data.localizacaoOrigemId,
        localizacaoDestinoId: resultado.data.localizacaoDestinoId,
        quantidade: resultado.data.quantidade,
        motivo: resultado.data.motivo,
      };

      await EstoqueAPI.transferir(payload);

      Alert.alert("Sucesso", "Transferência de lote concluída com sucesso!", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (err: any) {
      console.error(err);
      // Tratamento específico de retorno de erro da API (como "Quantidade insuficiente no estoque de origem.")
      const apiError = err.response?.data?.error || "Ocorreu um erro ao processar a transferência de lote.";
      Alert.alert("Erro de Transferência", apiError);
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
            Transferir Lote
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {produto.nome} ({produto.unidade})
          </Text>
          <Text variant="bodySmall" style={styles.loteInfo}>
            Lote: {lote.codigo} | Saldo Disponível: {totalQtd} {produto.unidade}
          </Text>
        </View>

        <Card style={styles.card} mode="outlined">
          <Card.Content>
            {/* Campo Localização Origem */}
            <TextInput
              label="ID Localização Origem *"
              value={localizacaoOrigemId}
              onChangeText={(text) => {
                setLocalizacaoOrigemId(text);
                if (errors.localizacaoOrigemId) setErrors((prev) => ({ ...prev, localizacaoOrigemId: "" }));
              }}
              mode="outlined"
              keyboardType="numeric"
              disabled={isLoading}
              style={styles.input}
            />
            {errors.localizacaoOrigemId && (
              <HelperText type="error" visible={true}>
                {errors.localizacaoOrigemId}
              </HelperText>
            )}

            {/* Campo Localização Destino */}
            <TextInput
              label="ID Localização Destino *"
              value={localizacaoDestinoId}
              onChangeText={(text) => {
                setLocalizacaoDestinoId(text);
                if (errors.localizacaoDestinoId) setErrors((prev) => ({ ...prev, localizacaoDestinoId: "" }));
              }}
              mode="outlined"
              keyboardType="numeric"
              disabled={isLoading}
              style={styles.input}
            />
            {errors.localizacaoDestinoId && (
              <HelperText type="error" visible={true}>
                {errors.localizacaoDestinoId}
              </HelperText>
            )}

            {/* Campo Quantidade a Transferir */}
            <TextInput
              label="Quantidade a Transferir *"
              value={quantidade}
              onChangeText={(text) => {
                setQuantidade(text);
                if (errors.quantidade) setErrors((prev) => ({ ...prev, quantidade: "" }));
              }}
              mode="outlined"
              keyboardType="numeric"
              disabled={isLoading}
              style={styles.input}
            />
            {errors.quantidade && (
              <HelperText type="error" visible={true}>
                {errors.quantidade}
              </HelperText>
            )}

            {/* Campo Motivo */}
            <TextInput
              label="Motivo da Transferência *"
              value={motivo}
              onChangeText={(text) => {
                setMotivo(text);
                if (errors.motivo) setErrors((prev) => ({ ...prev, motivo: "" }));
              }}
              mode="outlined"
              multiline={true}
              numberOfLines={3}
              placeholder="Ex: Mudança de corredor para otimização ou câmara fria."
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
                Transferir
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

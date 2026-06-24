import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { Button, Text, TextInput, HelperText, Card, SegmentedButtons } from "react-native-paper";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { EstoqueAPI } from "../api/estoque";
import { z } from "zod";

type RoutePropType = RouteProp<RootStackParamList, "BloqueioLote">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, "BloqueioLote">;

// Schema de validação local Zod
const bloqueioSchema = z.object({
  status: z.enum(["QUARENTENA", "BLOQUEADO"], {
    errorMap: () => ({ message: "Selecione o status de bloqueio do lote." }),
  }),
  motivo: z.string().min(10, "O motivo do bloqueio deve conter pelo menos 10 caracteres."),
});

export const BloqueioLoteScreen = () => {
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
  const [status, setStatus] = useState<string>("QUARENTENA");
  const [motivo, setMotivo] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmeter = async () => {
    const payloadFields = {
      status,
      motivo: motivo.trim(),
    };

    const resultado = bloqueioSchema.safeParse(payloadFields);
    
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
      // Monta o payload usando dados validados do Zod
      const payload = {
        loteId: lote.id,
        status: resultado.data.status,
        motivo: resultado.data.motivo,
      };

      await EstoqueAPI.bloquear(payload);

      Alert.alert("Sucesso", `Lote colocado em ${resultado.data.status} com sucesso!`, [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (err: any) {
      console.error(err);
      const apiError = err.response?.data?.error || "Ocorreu um erro ao processar o bloqueio do lote.";
      Alert.alert("Erro de Bloqueio", apiError);
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
            Bloquear / Quarentena
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {produto.nome} ({produto.unidade})
          </Text>
          <Text variant="bodySmall" style={styles.loteInfo}>
            Lote: {lote.codigo} | Status Atual: {lote.status}
          </Text>
        </View>

        <Card style={styles.card} mode="outlined">
          <Card.Content>
            {/* Seletor de Status (SegmentedButtons) */}
            <Text variant="labelMedium" style={styles.inputLabel}>
              Selecione o Novo Status:
            </Text>
            <SegmentedButtons
              value={status}
              onValueChange={setStatus}
              buttons={[
                {
                  value: "QUARENTENA",
                  label: "Quarentena",
                  style: styles.segmentedBtn,
                  disabled: isLoading,
                },
                {
                  value: "BLOQUEADO",
                  label: "Bloqueado",
                  style: styles.segmentedBtn,
                  disabled: isLoading,
                },
              ]}
              style={styles.segmentedContainer}
            />
            {errors.status && (
              <HelperText type="error" visible={true}>
                {errors.status}
              </HelperText>
            )}

            {/* Campo Motivo do Bloqueio */}
            <TextInput
              label="Motivo do Bloqueio (Mín. 10 caracteres) *"
              value={motivo}
              onChangeText={(text) => {
                setMotivo(text);
                if (errors.motivo) setErrors((prev) => ({ ...prev, motivo: "" }));
              }}
              mode="outlined"
              multiline={true}
              numberOfLines={3}
              placeholder="Ex: Lote com suspeita de desvio de temperatura ou avaria na embalagem."
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
                Bloquear Lote
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
  inputLabel: {
    color: "#7F8C8D",
    marginBottom: 8,
  },
  segmentedContainer: {
    marginBottom: 16,
  },
  segmentedBtn: {
    borderRadius: 8,
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

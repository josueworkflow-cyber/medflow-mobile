import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { Button, Text, TextInput, HelperText, Card } from "react-native-paper";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { EstoqueAPI } from "../api/estoque";
import { z } from "zod";

type RoutePropType = RouteProp<RootStackParamList, "EntradaEstoque">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, "EntradaEstoque">;

// Schema de validação local Zod
const entradaSchema = z.object({
  quantidade: z.coerce
    .number({ invalid_type_error: "A quantidade deve ser um número válido." })
    .positive("A quantidade deve ser maior que zero."),
  codigoLote: z.string().optional(),
  validade: z.string().optional().refine((val) => {
    if (!val) return true;
    const regex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!regex.test(val)) return false;
    
    // Verifica se os valores de dia, mês e ano formam uma data real
    const [day, month, year] = val.split("/").map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }, "Formato de data inválido. Use DD/MM/AAAA."),
  custoUnitario: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = Number(val);
    return !isNaN(num) && num >= 0;
  }, "Custo unitário deve ser um número maior ou igual a zero."),
  observacao: z.string().optional(),
});

export const EntradaEstoqueScreen = () => {
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavigationProp>();

  const produto = route.params?.produto;

  if (!produto) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 16 }}>
        <Text style={{ textAlign: "center" }}>Nenhum produto selecionado ou parâmetro inválido.</Text>
        <Button mode="contained" onPress={() => navigation.goBack()}>
          Voltar
        </Button>
      </View>
    );
  }

  // Estados do Formulário
  const [quantidade, setQuantidade] = useState("");
  const [codigoLote, setCodigoLote] = useState(route.params?.loteSugerido || "");
  const [validade, setValidade] = useState(route.params?.validadeSugerida || "");
  const [custoUnitario, setCustoUnitario] = useState("");
  const [observacao, setObservacao] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Máscara simples para data (DD/MM/AAAA)
  const handleValidadeChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    let formatted = cleaned;
    
    if (cleaned.length > 2 && cleaned.length <= 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    } else if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
    }
    
    setValidade(formatted);
    // Limpa erro específico de validade ao digitar
    if (errors.validade) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.validade;
        return copy;
      });
    }
  };

  // Converte data DD/MM/AAAA para formato ISO AAAA-MM-DD
  const convertToISODate = (val: string): string => {
    const [day, month, year] = val.split("/");
    return `${year}-${month}-${day}`;
  };

  const handleSubmeter = async () => {
    const payloadFields = {
      quantidade,
      codigoLote: codigoLote.trim() || undefined,
      validade: validade || undefined,
      custoUnitario: custoUnitario || undefined,
      observacao: observacao.trim() || undefined,
    };

    // Validação local
    const resultado = entradaSchema.safeParse(payloadFields);
    
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
        quantidade: resultado.data.quantidade,
        codigoLote: resultado.data.codigoLote || undefined,
        observacao: resultado.data.observacao || undefined,
        validade: resultado.data.validade ? convertToISODate(resultado.data.validade) : undefined,
        custoUnitario: resultado.data.custoUnitario ? Number(resultado.data.custoUnitario) : undefined,
      };

      await EstoqueAPI.entrada(payload);

      Alert.alert("Sucesso", "Entrada de estoque registrada com sucesso!", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (err: any) {
      console.error(err);
      const apiError = err.response?.data?.error || "Ocorreu um erro ao processar a entrada de estoque.";
      Alert.alert("Erro", apiError);
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
            Entrada de Estoque
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {produto.nome} ({produto.unidade})
          </Text>
        </View>

        <Card style={styles.card} mode="outlined">
          <Card.Content>
            {/* Campo Quantidade */}
            <TextInput
              label="Quantidade *"
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

            {/* Campo Código do Lote */}
            <TextInput
              label="Código do Lote (opcional)"
              value={codigoLote}
              onChangeText={setCodigoLote}
              mode="outlined"
              autoCapitalize="characters"
              disabled={isLoading}
              style={styles.input}
            />

            {/* Campo Data de Validade */}
            <TextInput
              label="Validade (DD/MM/AAAA) (opcional)"
              value={validade}
              onChangeText={handleValidadeChange}
              mode="outlined"
              keyboardType="numeric"
              placeholder="DD/MM/AAAA"
              maxLength={10}
              disabled={isLoading}
              style={styles.input}
            />
            {errors.validade && (
              <HelperText type="error" visible={true}>
                {errors.validade}
              </HelperText>
            )}

            {/* Campo Custo Unitário */}
            <TextInput
              label="Custo Unitário R$ (opcional)"
              value={custoUnitario}
              onChangeText={(text) => {
                setCustoUnitario(text);
                if (errors.custoUnitario) setErrors((prev) => ({ ...prev, custoUnitario: "" }));
              }}
              mode="outlined"
              keyboardType="numeric"
              disabled={isLoading}
              style={styles.input}
            />
            {errors.custoUnitario && (
              <HelperText type="error" visible={true}>
                {errors.custoUnitario}
              </HelperText>
            )}

            {/* Campo Observação */}
            <TextInput
              label="Observação (opcional)"
              value={observacao}
              onChangeText={setObservacao}
              mode="outlined"
              multiline={true}
              numberOfLines={3}
              disabled={isLoading}
              style={styles.input}
            />

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
                Registrar
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

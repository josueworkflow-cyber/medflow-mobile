import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { Button, Text, TextInput, HelperText, Card, SegmentedButtons, Surface, Divider } from "react-native-paper";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { EstoqueAPI } from "../api/estoque";
import { EstoqueConsultaAPI, LoteResumo } from "../api/estoque-consulta";
import { ProdutosAPI } from "../api/produtos";
import { Produto, Lote } from "../types/produto";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { z } from "zod";

type RoutePropType = RouteProp<RootStackParamList, "BloqueioLote">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, "BloqueioLote">;

const C = {
  headerBg: "#8B0C21",
  bg: "#F8FAFC",
  white: "#FFFFFF",
  slate100: "#F1F5F9",
  slate200: "#E2E8F0",
  slate500: "#64748B",
  slate700: "#334155",
  slate900: "#0F172A",
  border: "#E2E8F0",

  primaryColor: "#C41230",
  successColor: "#16A34A",
  warningColor: "#D97706",
  dangerColor: "#DC2626",
  infoColor: "#2563EB",
};

const bloqueioSchema = z.object({
  status: z.enum(["DISPONIVEL", "QUARENTENA", "BLOQUEADO"], {
    errorMap: () => ({ message: "Selecione o novo status do lote." }),
  }),
  motivo: z.string().min(5, "O motivo do bloqueio/desbloqueio deve conter pelo menos 5 caracteres."),
});

export const BloqueioLoteScreen = () => {
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavigationProp>();

  const [produto, setProduto] = useState<Produto | undefined>(route.params?.produto);
  const [lote, setLote] = useState<Lote | undefined>(route.params?.lote);

  // Busca de lotes caso a tela seja aberta diretamente
  const [buscaLote, setBuscaLote] = useState("");
  const [lotesEncontrados, setLotesEncontrados] = useState<LoteResumo[]>([]);
  const [loadingBusca, setLoadingBusca] = useState(false);

  // Estados do Formulário
  const [novoStatus, setNovoStatus] = useState<string>(
    lote?.status === "DISPONIVEL" ? "QUARENTENA" : "DISPONIVEL"
  );
  const [motivo, setMotivo] = useState("");
  const [previsaoResolucao, setPrevisaoResolucao] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (lote) {
      setNovoStatus(lote.status === "DISPONIVEL" ? "QUARENTENA" : "DISPONIVEL");
    }
  }, [lote]);

  const buscarLotes = async () => {
    if (buscaLote.trim().length < 2) {
      return Alert.alert("Busca", "Digite pelo menos 2 caracteres para pesquisar.");
    }
    setLoadingBusca(true);
    try {
      const res = await EstoqueConsultaAPI.getLotes({ search: buscaLote.trim() });
      setLotesEncontrados((res || []).slice(0, 10));
      if (!res || res.length === 0) {
        Alert.alert("Busca de Lotes", "Nenhum lote encontrado.");
      }
    } catch {
      Alert.alert("Erro", "Não foi possível pesquisar lotes.");
    } finally {
      setLoadingBusca(false);
    }
  };

  const selecionarLoteResumo = async (item: LoteResumo) => {
    setLoadingBusca(true);
    try {
      const prodDetalhe = await ProdutosAPI.buscarPorId(item.produtoId);
      setProduto(prodDetalhe || {
        id: item.produtoId,
        nome: item.produto.descricao,
        codigoInterno: null,
        codigoBarras: null,
        unidade: "UN",
      });
      setLote({
        id: item.id,
        numeroLote: item.numeroLote,
        validade: item.validade,
        status: item.status as any,
        estoqueAtual: item.estoqueAtual as any || [],
      });
      setNovoStatus(item.status === "DISPONIVEL" ? "QUARENTENA" : "DISPONIVEL");
      setLotesEncontrados([]);
    } catch (err) {
      console.error(err);
      Alert.alert("Erro", "Erro ao carregar detalhes do lote selecionado.");
    } finally {
      setLoadingBusca(false);
    }
  };

  const handleSubmeter = async () => {
    if (!lote) {
      Alert.alert("Aviso", "Selecione o lote antes de submeter.");
      return;
    }

    const resultado = bloqueioSchema.safeParse({
      status: novoStatus,
      motivo: motivo.trim(),
    });

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
      const payload = {
        loteId: lote.id,
        status: resultado.data.status,
        motivo: resultado.data.motivo,
        previsaoResolucao: previsaoResolucao || undefined,
      };

      await EstoqueAPI.bloquear(payload);

      const msg =
        resultado.data.status === "DISPONIVEL"
          ? `Lote ${lote.numeroLote} liberado e desbloqueado com sucesso!`
          : `Lote ${lote.numeroLote} alterado para status ${resultado.data.status}!`;

      Alert.alert("Sucesso", msg, [{ text: "OK", onPress: () => navigation.goBack() }]);
    } catch (err: any) {
      console.error(err);
      Alert.alert("Erro ao Alterar Status", err.response?.data?.error || "Não foi possível alterar o status do lote.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Bloquear / Quarentena</Text>
          <Text style={s.headerSubtitle}>Gestão Sanitária e Restrição de Lote</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {!produto || !lote ? (
          <Surface style={s.card} elevation={1}>
            <Text style={s.cardTitle}>Selecione o Lote para Alterar Status</Text>
            <Text style={s.cardSub}>Pesquise pelo número do lote ou nome do produto:</Text>

            <View style={s.searchRow}>
              <TextInput
                mode="outlined"
                placeholder="Número do lote ou produto..."
                value={buscaLote}
                onChangeText={setBuscaLote}
                style={{ flex: 1, backgroundColor: C.white }}
              />
              <Button mode="contained" onPress={buscarLotes} loading={loadingBusca} style={s.btnPrimary}>
                Buscar
              </Button>
            </View>

            <Button
              mode="contained-tonal"
              icon="barcode-scan"
              onPress={() => navigation.navigate("Scanner", { action: "BloqueioLote" })}
              style={{ marginTop: 10 }}
            >
              Escanear Código de Barras / DataMatrix
            </Button>

            {lotesEncontrados.length > 0 && (
              <Text style={[s.cardTitle, { fontSize: 13, marginTop: 16 }]}>
                LOTES ENCONTRADOS ({lotesEncontrados.length}):
              </Text>
            )}

            {lotesEncontrados.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={s.loteSelectCard}
                onPress={() => selecionarLoteResumo(item)}
              >
                <MaterialCommunityIcons
                  name="shield-lock-outline"
                  size={24}
                  color={item.status === "DISPONIVEL" ? C.successColor : item.status === "QUARENTENA" ? C.warningColor : C.dangerColor}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.loteSelectTitle}>Lote: {item.numeroLote}</Text>
                  <Text style={s.loteSelectSub}>{item.produto.descricao}</Text>
                  <Text style={s.loteSelectSub}>
                    Validade: {item.validade ? new Date(item.validade).toLocaleDateString("pt-BR") : "N/A"} • Status: {item.status}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={C.slate500} />
              </TouchableOpacity>
            ))}
          </Surface>
        ) : (
          <Surface style={s.card} elevation={1}>
            <View style={s.selectedBox}>
              <View style={{ flex: 1 }}>
                <Text style={s.selectedTitle}>Lote: {lote.numeroLote}</Text>
                <Text style={s.selectedSub}>{produto.nome}</Text>
                <Text style={s.selectedSub}>
                  Validade: {lote.validade ? new Date(lote.validade).toLocaleDateString("pt-BR") : "N/A"} • Status Atual: <Text style={{ fontWeight: "700" }}>{lote.status}</Text>
                </Text>
              </View>
              <Button mode="text" compact onPress={() => setLote(undefined)} textColor={C.dangerColor}>
                Trocar
              </Button>
            </View>

            <Divider style={{ marginVertical: 14 }} />

            <Text style={s.fieldLabel}>Selecione o Novo Status:</Text>
            <SegmentedButtons
              value={novoStatus}
              onValueChange={setNovoStatus}
              buttons={[
                { value: "DISPONIVEL", label: "Liberar / Disponível", icon: "check-circle-outline" },
                { value: "QUARENTENA", label: "Quarentena", icon: "alert-outline" },
                { value: "BLOQUEADO", label: "Bloqueado", icon: "lock-outline" },
              ]}
              style={{ marginVertical: 8 }}
            />
            {errors.status && <HelperText type="error">{errors.status}</HelperText>}

            {novoStatus !== "DISPONIVEL" && (
              <TextInput
                label="Previsão de Resolução (AAAA-MM-DD, Opcional)"
                value={previsaoResolucao}
                onChangeText={setPrevisaoResolucao}
                placeholder="Ex: 2026-09-15"
                mode="outlined"
                style={s.input}
              />
            )}

            <TextInput
              label={`Justificativa / Motivo do ${novoStatus === "DISPONIVEL" ? "Desbloqueio" : "Bloqueio"} *`}
              value={motivo}
              onChangeText={(text) => {
                setMotivo(text);
                if (errors.motivo) setErrors((prev) => ({ ...prev, motivo: "" }));
              }}
              mode="outlined"
              multiline
              numberOfLines={3}
              placeholder="Ex: Suspeita de desvio de temperatura ou avaria de embalagem."
              style={s.input}
            />
            {errors.motivo && <HelperText type="error">{errors.motivo}</HelperText>}

            <View style={s.btnRow}>
              <Button mode="outlined" onPress={() => navigation.goBack()} disabled={isLoading} style={{ flex: 1 }}>
                Cancelar
              </Button>
              <Button
                mode="contained"
                onPress={handleSubmeter}
                loading={isLoading}
                disabled={isLoading}
                style={[
                  s.btnPrimary,
                  {
                    flex: 1,
                    marginLeft: 10,
                    backgroundColor: novoStatus === "DISPONIVEL" ? C.successColor : C.primaryColor,
                  },
                ]}
              >
                {novoStatus === "DISPONIVEL" ? "Confirmar Desbloqueio" : "Confirmar Bloqueio"}
              </Button>
            </View>
          </Surface>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
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
  scrollContent: { padding: 16 },
  card: { backgroundColor: C.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.border },
  cardTitle: { fontSize: 16, fontWeight: "800", color: C.slate900 },
  cardSub: { fontSize: 12, color: C.slate500, marginTop: 4, marginBottom: 14 },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  btnPrimary: { backgroundColor: C.primaryColor, borderRadius: 8 },
  loteSelectCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.slate100,
    marginTop: 8,
  },
  loteSelectTitle: { fontSize: 14, fontWeight: "800", color: C.slate900 },
  loteSelectSub: { fontSize: 11, color: C.slate500, marginTop: 1 },
  selectedBox: { flexDirection: "row", alignItems: "center", backgroundColor: C.slate100, padding: 12, borderRadius: 8 },
  selectedTitle: { fontSize: 15, fontWeight: "800", color: C.slate900 },
  selectedSub: { fontSize: 12, color: C.slate500, marginTop: 2 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: C.slate700, marginTop: 6 },
  input: { marginVertical: 6, backgroundColor: C.white },
  btnRow: { flexDirection: "row", marginTop: 16 },
});

import React, { useEffect, useState } from "react";
import { StyleSheet, View, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { Button, Text, TextInput, HelperText, Card, Menu, Surface, Divider } from "react-native-paper";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { EstoqueAPI, TransferenciaPayload } from "../api/estoque";
import { EstoqueConsultaAPI, LoteResumo } from "../api/estoque-consulta";
import { ProdutosAPI } from "../api/produtos";
import { Produto, Lote, SaldoLote } from "../types/produto";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { z } from "zod";

type RoutePropType = RouteProp<RootStackParamList, "Transferencia">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Transferencia">;

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
    motivo: z.string().min(3, "O motivo da transferência deve conter no mínimo 3 caracteres."),
  })
  .refine((data) => data.localizacaoOrigemId !== data.localizacaoDestinoId, {
    message: "O depósito de destino deve ser diferente do de origem.",
    path: ["localizacaoDestinoId"],
  });

export const TransferenciaScreen = () => {
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavigationProp>();

  const [produto, setProduto] = useState<Produto | undefined>(route.params?.produto);
  const [lote, setLote] = useState<Lote | undefined>(route.params?.lote);
  const [saldo, setSaldo] = useState<SaldoLote | undefined>(route.params?.saldo);

  // Busca caso a tela seja aberta diretamente
  const [buscaLote, setBuscaLote] = useState("");
  const [lotesEncontrados, setLotesEncontrados] = useState<LoteResumo[]>([]);
  const [loadingBusca, setLoadingBusca] = useState(false);

  // Formulário
  const [localizacaoOrigemId, setLocalizacaoOrigemId] = useState<string>(String(saldo?.localizacao?.id || ""));
  const [localizacaoDestinoId, setLocalizacaoDestinoId] = useState<string>("");
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [localizacoes, setLocalizacoes] = useState<{ id: number; nome: string }[]>([]);
  const [menuDestino, setMenuDestino] = useState(false);
  const [menuOrigem, setMenuOrigem] = useState(false);

  useEffect(() => {
    EstoqueAPI.localizacoes()
      .then(setLocalizacoes)
      .catch(() => Alert.alert("Erro", "Não foi possível carregar os depósitos."));
  }, []);

  const buscarLotes = async () => {
    if (buscaLote.trim().length < 2) {
      return Alert.alert("Busca", "Digite pelo menos 2 caracteres para pesquisar.");
    }
    setLoadingBusca(true);
    try {
      const res = await EstoqueConsultaAPI.getLotes({ search: buscaLote.trim() });
      setLotesEncontrados((res || []).slice(0, 10));
      if (!res || res.length === 0) {
        Alert.alert("Busca de Lotes", "Nenhum lote com saldo encontrado.");
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

      const loteEncontrado = {
        id: item.id,
        numeroLote: item.numeroLote,
        validade: item.validade,
        status: item.status as any,
        estoqueAtual: (item.estoqueAtual as any) || [],
      };
      setLote(loteEncontrado);

      // Localiza o saldo ou usa o primeiro disponível
      const saldoEncontrado = loteEncontrado.estoqueAtual[0] || {
        id: 0,
        quantidadeDisponivel: 0,
        quantidadeReservada: 0,
        quantidadeBloqueada: 0,
        status: "DISPONIVEL",
        localizacao: null,
      };
      setSaldo(saldoEncontrado);
      if (saldoEncontrado.localizacao?.id) {
        setLocalizacaoOrigemId(String(saldoEncontrado.localizacao.id));
      }
      setLotesEncontrados([]);
    } catch {
      Alert.alert("Erro", "Erro ao carregar detalhes do lote.");
    } finally {
      setLoadingBusca(false);
    }
  };

  const maxDisponivel = saldo?.quantidadeDisponivel ?? 0;

  const handleSubmeter = async () => {
    if (!produto) {
      Alert.alert("Aviso", "Selecione o produto e lote a transferir.");
      return;
    }

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

    if (resultado.data.quantidade > maxDisponivel && maxDisponivel > 0) {
      setErrors({ quantidade: `A quantidade máxima disponível para transferência é ${maxDisponivel} ${produto.unidade}.` });
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const payload: TransferenciaPayload = {
        produtoId: produto.id,
        loteId: lote?.id ?? null,
        localizacaoOrigemId: resultado.data.localizacaoOrigemId,
        localizacaoDestinoId: resultado.data.localizacaoDestinoId,
        quantidade: resultado.data.quantidade,
        motivo: resultado.data.motivo,
      };

      await EstoqueAPI.transferir(payload);

      const origemNome = localizacoes.find((l) => l.id === resultado.data.localizacaoOrigemId)?.nome || "Origem";
      const destinoNome = localizacoes.find((l) => l.id === resultado.data.localizacaoDestinoId)?.nome || "Destino";

      Alert.alert(
        "Transferência Concluída",
        `Transferência de ${resultado.data.quantidade} ${produto.unidade} de [${origemNome}] para [${destinoNome}] realizada com sucesso!`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      console.error(err);
      Alert.alert("Erro na Transferência", err.response?.data?.error || "Ocorreu um erro ao realizar a transferência.");
    } finally {
      setIsLoading(false);
    }
  };

  const origemNome = localizacoes.find((l) => String(l.id) === localizacaoOrigemId)?.nome || "Selecione o Depósito de Origem *";
  const destinoNome = localizacoes.find((l) => String(l.id) === localizacaoDestinoId)?.nome || "Selecione o Depósito de Destino *";

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Transferir Lote</Text>
          <Text style={s.headerSubtitle}>Movimentação Física entre Depósitos</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {!produto || !saldo ? (
          <Surface style={s.card} elevation={1}>
            <Text style={s.cardTitle}>Selecione o Lote / Saldo para Transferência</Text>
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
              onPress={() => navigation.navigate("Scanner", { action: "Transferencia" })}
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
                <MaterialCommunityIcons name="archive-arrow-down-outline" size={24} color={C.successColor} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.loteSelectTitle}>Lote: {item.numeroLote}</Text>
                  <Text style={s.loteSelectSub}>{item.produto.descricao}</Text>
                  <Text style={s.loteSelectSub}>
                    Validade: {item.validade ? new Date(item.validade).toLocaleDateString("pt-BR") : "N/A"}
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
                <Text style={s.selectedTitle}>{produto.nome}</Text>
                <Text style={s.selectedSub}>
                  {lote ? `Lote: ${lote.numeroLote}` : "Produto sem lote"} • Saldo Disp.: <Text style={{ fontWeight: "800", color: C.successColor }}>{maxDisponivel} {produto.unidade}</Text>
                </Text>
              </View>
              <Button mode="text" compact onPress={() => setSaldo(undefined)} textColor={C.dangerColor}>
                Trocar
              </Button>
            </View>

            <Divider style={{ marginVertical: 14 }} />

            {/* Origem */}
            <Text style={s.fieldLabel}>Depósito de Origem:</Text>
            <Menu
              visible={menuOrigem}
              onDismiss={() => setMenuOrigem(false)}
              anchor={
                <Button mode="outlined" onPress={() => setMenuOrigem(true)} style={s.menuBtn}>
                  {origemNome}
                </Button>
              }
            >
              {localizacoes.map((l) => (
                <Menu.Item
                  key={l.id}
                  title={l.nome}
                  onPress={() => {
                    setLocalizacaoOrigemId(String(l.id));
                    setMenuOrigem(false);
                  }}
                />
              ))}
            </Menu>
            {errors.localizacaoOrigemId && <HelperText type="error">{errors.localizacaoOrigemId}</HelperText>}

            {/* Destino */}
            <Text style={s.fieldLabel}>Depósito de Destino:</Text>
            <Menu
              visible={menuDestino}
              onDismiss={() => setMenuDestino(false)}
              anchor={
                <Button mode="outlined" onPress={() => setMenuDestino(true)} style={s.menuBtn}>
                  {destinoNome}
                </Button>
              }
            >
              {localizacoes.map((l) => (
                <Menu.Item
                  key={l.id}
                  title={l.nome}
                  onPress={() => {
                    setLocalizacaoDestinoId(String(l.id));
                    setMenuDestino(false);
                  }}
                />
              ))}
            </Menu>
            {errors.localizacaoDestinoId && <HelperText type="error">{errors.localizacaoDestinoId}</HelperText>}

            {/* Quantidade */}
            <TextInput
              label={`Quantidade a Transferir (${produto.unidade}) *`}
              value={quantidade}
              onChangeText={(text) => {
                setQuantidade(text);
                if (errors.quantidade) setErrors((prev) => ({ ...prev, quantidade: "" }));
              }}
              mode="outlined"
              keyboardType="decimal-pad"
              placeholder={`Máx: ${maxDisponivel}`}
              style={s.input}
            />
            {errors.quantidade && <HelperText type="error">{errors.quantidade}</HelperText>}

            {/* Motivo */}
            <TextInput
              label="Motivo da Transferência *"
              value={motivo}
              onChangeText={(text) => {
                setMotivo(text);
                if (errors.motivo) setErrors((prev) => ({ ...prev, motivo: "" }));
              }}
              mode="outlined"
              multiline
              numberOfLines={2}
              placeholder="Ex: Reorganização de prateleira ou abastecimento do picking."
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
                style={[s.btnPrimary, { flex: 1, marginLeft: 10 }]}
              >
                Confirmar Transferência
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
  menuBtn: { marginVertical: 4, borderRadius: 8 },
  input: { marginVertical: 6, backgroundColor: C.white },
  btnRow: { flexDirection: "row", marginTop: 16 },
});

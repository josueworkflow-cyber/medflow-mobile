import React, { useMemo, useState, useEffect } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, TouchableOpacity } from "react-native";
import { Button, Card, HelperText, Menu, Text, TextInput, Surface, Divider } from "react-native-paper";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { AjustePayload, EstoqueAPI } from "../api/estoque";
import { ProdutosAPI } from "../api/produtos";
import { Produto, Lote, SaldoLote } from "../types/produto";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type RouteType = RouteProp<RootStackParamList, "AjusteInventario">;
type NavigationType = NativeStackNavigationProp<RootStackParamList, "AjusteInventario">;
type MotivoCodigo = AjustePayload["motivoCodigo"];

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
};

const MOTIVOS: { value: MotivoCodigo; label: string }[] = [
  { value: "ERRO_CONTAGEM", label: "Erro de Contagem / Recontagem" },
  { value: "AVARIA", label: "Avaria Física de Embalagem" },
  { value: "PERDA", label: "Perda / Extravio Interno" },
  { value: "VALIDADE", label: "Descarte por Vencimento" },
  { value: "INVENTARIO", label: "Ajuste Geral de Inventário" },
  { value: "OUTRO", label: "Outro Motivo Operacional" },
];

export const AjusteInventarioScreen = () => {
  const route = useRoute<RouteType>();
  const navigation = useNavigation<NavigationType>();

  const [produto, setProduto] = useState<Produto | undefined>(route.params?.produto);
  const [lote, setLote] = useState<Lote | undefined>(route.params?.lote);
  const [saldo, setSaldo] = useState<SaldoLote | undefined>(route.params?.saldo);

  // Estados de busca para seleção direta
  const [buscaProduto, setBuscaProduto] = useState("");
  const [produtosEncontrados, setProdutosEncontrados] = useState<Produto[]>([]);
  const [loadingBusca, setLoadingBusca] = useState(false);

  const [quantidadeNova, setQuantidadeNova] = useState("");
  const [motivoCodigo, setMotivoCodigo] = useState<MotivoCodigo>("ERRO_CONTAGEM");
  const [motivo, setMotivo] = useState("");
  const [menuAberto, setMenuAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const saldoAtual = saldo
    ? saldo.quantidadeDisponivel + saldo.quantidadeReservada + saldo.quantidadeBloqueada
    : 0;

  const novaQuantidade = quantidadeNova.trim() === "" ? null : Number(quantidadeNova.replace(",", "."));
  const diferenca = useMemo(
    () => (novaQuantidade !== null && Number.isFinite(novaQuantidade) ? novaQuantidade - saldoAtual : null),
    [novaQuantidade, saldoAtual]
  );

  const buscarProdutos = async () => {
    if (buscaProduto.trim().length < 2) {
      return Alert.alert("Busca", "Digite ao menos 2 caracteres para pesquisar.");
    }
    setLoadingBusca(true);
    try {
      const res = await ProdutosAPI.buscarPorTexto(buscaProduto.trim());
      setProdutosEncontrados(res || []);
      if (res.length === 0) {
        Alert.alert("Busca", "Nenhum produto encontrado.");
      }
    } catch {
      Alert.alert("Erro", "Erro ao buscar produtos.");
    } finally {
      setLoadingBusca(false);
    }
  };

  const selecionarProdutoCompleto = async (p: Produto) => {
    setLoadingBusca(true);
    try {
      const detalhe = await ProdutosAPI.buscarPorId(p.id);
      if (!detalhe) throw new Error();
      setProduto(detalhe);

      // Tenta achar primeiro saldo disponível
      let saldoEncontrado: SaldoLote | undefined;
      let loteEncontrado: Lote | undefined;

      if (detalhe.lotes && detalhe.lotes.length > 0) {
        for (const l of detalhe.lotes) {
          if (l.estoqueAtual && l.estoqueAtual.length > 0) {
            loteEncontrado = l;
            saldoEncontrado = l.estoqueAtual[0];
            break;
          }
        }
      }

      setLote(loteEncontrado);
      setSaldo(saldoEncontrado);
      setProdutosEncontrados([]);
    } catch {
      Alert.alert("Erro", "Não foi possível carregar os lotes e saldos deste produto.");
    } finally {
      setLoadingBusca(false);
    }
  };

  const enviar = async (confirmarAjusteRelevante = false) => {
    if (!produto || !saldo) {
      setErro("Selecione o produto e o saldo a ajustar.");
      return;
    }
    if (novaQuantidade === null || !Number.isFinite(novaQuantidade) || novaQuantidade < 0) {
      setErro("Informe a nova quantidade física apurada.");
      return;
    }
    if (motivo.trim().length < 3) {
      setErro("Descreva o motivo detalhado do ajuste.");
      return;
    }

    setErro(null);
    setLoading(true);

    try {
      await EstoqueAPI.ajuste({
        produtoId: produto.id,
        estoqueAtualId: saldo.id,
        loteId: lote?.id ?? null,
        localizacaoId: saldo.localizacao?.id ?? null,
        quantidadeNova: novaQuantidade,
        motivoCodigo,
        motivo: motivo.trim(),
        confirmarAjusteRelevante,
      });

      Alert.alert(
        "Ajuste Concluído",
        `Saldo ajustado de ${saldoAtual} para ${novaQuantidade} ${produto.unidade} (Diferença: ${(diferenca ?? 0) > 0 ? "+" : ""}${diferenca})`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      const body = error.response?.data;
      if (body?.code === "AJUSTE_RELEVANTE" && !confirmarAjusteRelevante) {
        const resumo = body.resumo;
        Alert.alert(
          "Confirmação de Divergência Relevante",
          `${body.error}\n\nSaldo Anterior: ${resumo.saldoAnterior}\nSaldo Novo: ${resumo.saldoResultante}\nDiferença: ${resumo.diferenca}`,
          [
            { text: "Cancelar", style: "cancel" },
            { text: "Confirmar Ajuste", style: "destructive", onPress: () => enviar(true) },
          ]
        );
      } else {
        Alert.alert("Erro no Ajuste", body?.error || "Não foi possível registrar o ajuste.");
      }
    } finally {
      setLoading(false);
    }
  };

  const motivoLabel = MOTIVOS.find((item) => item.value === motivoCodigo)?.label;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Ajustar Saldo de Estoque</Text>
          <Text style={s.headerSubtitle}>Correção de Contagem e Lançamento de Ajuste</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {!produto || !saldo ? (
          <Surface style={s.card} elevation={1}>
            <Text style={s.cardTitle}>Selecione o Produto para Ajuste</Text>
            <Text style={s.cardSub}>Pesquise pelo nome, SKU ou utilize o leitor:</Text>

            <View style={s.searchRow}>
              <TextInput
                mode="outlined"
                placeholder="Nome, código ou EAN..."
                value={buscaProduto}
                onChangeText={setBuscaProduto}
                style={{ flex: 1, backgroundColor: C.white }}
              />
              <Button mode="contained" onPress={buscarProdutos} loading={loadingBusca} style={s.btnPrimary}>
                Buscar
              </Button>
            </View>

            <Button
              mode="contained-tonal"
              icon="barcode-scan"
              onPress={() => navigation.navigate("Scanner", { action: "AjusteInventario" })}
              style={{ marginTop: 10 }}
            >
              Escanear Código com a Câmera
            </Button>

            {produtosEncontrados.map((p) => (
              <TouchableOpacity key={p.id} style={s.productSelectCard} onPress={() => selecionarProdutoCompleto(p)}>
                <MaterialCommunityIcons name="package-variant" size={24} color={C.primaryColor} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.productSelectTitle}>{p.nome}</Text>
                  <Text style={s.productSelectSub}>SKU: {p.codigoInterno || "N/A"} • Un: {p.unidade}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={C.slate500} />
              </TouchableOpacity>
            ))}
          </Surface>
        ) : (
          <Surface style={s.card} elevation={1}>
            <View style={s.selectedProductBox}>
              <View style={{ flex: 1 }}>
                <Text style={s.selectedProductName}>{produto.nome}</Text>
                <Text style={s.selectedProductSub}>
                  {lote ? `Lote: ${lote.numeroLote}` : "Sem lote"} • Local: {saldo.localizacao?.nome || "Geral"}
                </Text>
              </View>
              <Button mode="text" compact onPress={() => setProduto(undefined)} textColor={C.dangerColor}>
                Trocar
              </Button>
            </View>

            <Divider style={{ marginVertical: 14 }} />

            {/* Saldo Atual */}
            <View style={s.saldoAtualBox}>
              <Text style={s.saldoAtualLabel}>Saldo Atual no Sistema:</Text>
              <Text style={s.saldoAtualValue}>
                {saldoAtual} {produto.unidade}
              </Text>
            </View>

            {/* Nova Quantidade */}
            <TextInput
              label="Novo Saldo Físico Apurado *"
              value={quantidadeNova}
              onChangeText={setQuantidadeNova}
              keyboardType="decimal-pad"
              mode="outlined"
              style={s.input}
            />

            {diferenca !== null && Number.isFinite(diferenca) && (
              <View
                style={[
                  s.diferencaBanner,
                  { backgroundColor: diferenca === 0 ? C.slate100 : diferenca > 0 ? "#DCFCE7" : "#FEE2E2" },
                ]}
              >
                <Text
                  style={[
                    s.diferencaText,
                    { color: diferenca === 0 ? C.slate700 : diferenca > 0 ? "#166534" : "#991B1B" },
                  ]}
                >
                  Resumo: {saldoAtual} → {novaQuantidade} (Diferença: {diferenca > 0 ? `+${diferenca}` : diferenca})
                </Text>
              </View>
            )}

            {/* Motivo do Ajuste */}
            <Menu
              visible={menuAberto}
              onDismiss={() => setMenuAberto(false)}
              anchor={
                <Button mode="outlined" onPress={() => setMenuAberto(true)} style={s.menuBtn}>
                  Motivo: {motivoLabel}
                </Button>
              }
            >
              {MOTIVOS.map((item) => (
                <Menu.Item
                  key={item.value}
                  title={item.label}
                  onPress={() => {
                    setMotivoCodigo(item.value);
                    setMenuAberto(false);
                  }}
                />
              ))}
            </Menu>

            {/* Detalhe do Motivo */}
            <TextInput
              label="Justificativa do Ajuste *"
              value={motivo}
              onChangeText={setMotivo}
              multiline
              numberOfLines={3}
              placeholder="Ex: Recontagem física periódica apurou divergência."
              mode="outlined"
              style={s.input}
            />

            {erro && <HelperText type="error">{erro}</HelperText>}

            <View style={s.btnRow}>
              <Button mode="outlined" onPress={() => navigation.goBack()} disabled={loading} style={{ flex: 1 }}>
                Cancelar
              </Button>
              <Button
                mode="contained"
                onPress={() => enviar()}
                loading={loading}
                disabled={loading}
                style={[s.btnPrimary, { flex: 1, marginLeft: 10 }]}
              >
                Salvar Ajuste
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
  productSelectCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.slate100,
    marginTop: 8,
  },
  productSelectTitle: { fontSize: 13, fontWeight: "700", color: C.slate900 },
  productSelectSub: { fontSize: 11, color: C.slate500 },
  selectedProductBox: { flexDirection: "row", alignItems: "center", backgroundColor: C.slate100, padding: 12, borderRadius: 8 },
  selectedProductName: { fontSize: 14, fontWeight: "800", color: C.slate900 },
  selectedProductSub: { fontSize: 11, color: C.slate500, marginTop: 2 },
  saldoAtualBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  saldoAtualLabel: { fontSize: 13, color: C.slate700, fontWeight: "600" },
  saldoAtualValue: { fontSize: 16, color: C.slate900, fontWeight: "800" },
  input: { marginVertical: 6, backgroundColor: C.white },
  diferencaBanner: { padding: 8, borderRadius: 6, marginVertical: 6 },
  diferencaText: { fontSize: 12, fontWeight: "700" },
  menuBtn: { marginVertical: 6, borderRadius: 8 },
  btnRow: { flexDirection: "row", marginTop: 16 },
});

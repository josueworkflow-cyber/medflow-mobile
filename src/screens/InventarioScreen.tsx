import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Card, Menu, SegmentedButtons, Text, TextInput } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { EstoqueAPI, Inventario } from "../api/estoque";
import { ProdutosAPI } from "../api/produtos";
import { Produto } from "../types/produto";

export const InventarioScreen = () => {
  const navigation = useNavigation();
  const [escopo, setEscopo] = useState<"PRODUTO" | "LOCALIZACAO">("PRODUTO");
  const [busca, setBusca] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtoId, setProdutoId] = useState<number | null>(null);
  const [localizacoes, setLocalizacoes] = useState<{ id: number; nome: string }[]>([]);
  const [localizacaoId, setLocalizacaoId] = useState<number | null>(null);
  const [menuLocal, setMenuLocal] = useState(false);
  const [inventario, setInventario] = useState<Inventario | null>(null);
  const [contagens, setContagens] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => { EstoqueAPI.localizacoes().then(setLocalizacoes).catch(() => undefined); }, []);

  const buscarProdutos = async () => {
    if (busca.trim().length < 2) return Alert.alert("Busca", "Digite ao menos 2 caracteres.");
    setLoading(true);
    try { setProdutos(await ProdutosAPI.buscarPorTexto(busca.trim())); }
    catch { Alert.alert("Erro", "Não foi possível buscar produtos."); }
    finally { setLoading(false); }
  };

  const iniciar = async () => {
    if (escopo === "PRODUTO" && !produtoId) return Alert.alert("Inventário", "Selecione um produto.");
    if (escopo === "LOCALIZACAO" && !localizacaoId) return Alert.alert("Inventário", "Selecione um depósito.");
    setLoading(true);
    try {
      const criado = await EstoqueAPI.iniciarInventario(escopo === "PRODUTO" ? { produtoId: produtoId! } : { localizacaoId: localizacaoId! });
      const detalhe = await EstoqueAPI.inventario(criado.id);
      setInventario(detalhe);
      setContagens(Object.fromEntries(detalhe.itens.map((item) => [item.id, item.quantidadeContada?.toString() || ""])));
    } catch (error: any) { Alert.alert("Erro", error.response?.data?.error || "Não foi possível iniciar a conferência."); }
    finally { setLoading(false); }
  };

  const salvar = async (aplicar: boolean) => {
    if (!inventario) return;
    const vazios = inventario.itens.filter((item) => (contagens[item.id] ?? "").trim() === "");
    if (vazios.length) return Alert.alert("Contagem incompleta", `Informe a quantidade contada nos ${vazios.length} itens restantes.`);
    const payload = inventario.itens.map((item) => ({ itemId: item.id, quantidadeContada: Number(contagens[item.id].replace(",", ".")) }));
    if (payload.some((item) => !Number.isFinite(item.quantidadeContada) || item.quantidadeContada < 0)) return Alert.alert("Contagem", "Há uma quantidade inválida.");
    setLoading(true);
    try {
      await EstoqueAPI.salvarContagens(inventario.id, payload);
      if (aplicar) {
        const result = await EstoqueAPI.aplicarInventario(inventario.id);
        Alert.alert("Inventário aplicado", `${result.ajustes} ajuste(s) automático(s) gerado(s).`, [{ text: "OK", onPress: () => navigation.goBack() }]);
      } else {
        setInventario(await EstoqueAPI.inventario(inventario.id));
        Alert.alert("Salvo", "Contagens salvas. Revise as divergências antes de aplicar.");
      }
    } catch (error: any) { Alert.alert("Erro", error.response?.data?.error || "Não foi possível salvar o inventário."); }
    finally { setLoading(false); }
  };

  return <ScrollView contentContainerStyle={s.content}>
    <Text variant="headlineSmall" style={s.title}>Conferência física</Text>
    {!inventario ? <Card mode="outlined"><Card.Content>
      <SegmentedButtons value={escopo} onValueChange={(value) => setEscopo(value as typeof escopo)} buttons={[{ value: "PRODUTO", label: "Por produto" }, { value: "LOCALIZACAO", label: "Depósito inteiro" }]} />
      {escopo === "PRODUTO" ? <>
        <View style={s.row}><TextInput mode="outlined" label="Código ou nome" value={busca} onChangeText={setBusca} style={s.grow} /><Button mode="contained" onPress={buscarProdutos}>Buscar</Button></View>
        {produtos.map((produto) => <Button key={produto.id} mode={produtoId === produto.id ? "contained-tonal" : "text"} onPress={() => setProdutoId(produto.id)}>{produto.nome} · {produto.codigoInterno || "sem SKU"}</Button>)}
      </> : <Menu visible={menuLocal} onDismiss={() => setMenuLocal(false)} anchor={<Button mode="outlined" style={s.input} onPress={() => setMenuLocal(true)}>{localizacoes.find((item) => item.id === localizacaoId)?.nome || "Selecionar depósito"}</Button>}>
        {localizacoes.map((item) => <Menu.Item key={item.id} title={item.nome} onPress={() => { setLocalizacaoId(item.id); setMenuLocal(false); }} />)}
      </Menu>}
      <Button mode="contained" onPress={iniciar} disabled={loading} style={s.input}>Iniciar conferência</Button>
    </Card.Content></Card> : <>
      <Text>{inventario.itens.length} saldo(s) esperado(s). Digite a contagem física de cada um.</Text>
      {inventario.itens.map((item) => {
        const texto = contagens[item.id] ?? "";
        const contado = texto === "" ? null : Number(texto.replace(",", "."));
        const divergencia = contado === null || !Number.isFinite(contado) ? null : contado - item.quantidadeEsperada;
        return <Card key={item.id} mode="outlined" style={[s.item, divergencia !== null && { borderColor: divergencia === 0 ? "#16A34A" : "#DC2626" }]}><Card.Content>
          <Text variant="titleSmall">{item.produto.descricao}</Text>
          <Text>{item.lote ? `Lote ${item.lote.numeroLote}` : "Sem lote"} · {item.localizacao?.nome || "Sem local"}</Text>
          <Text>Esperado: {item.quantidadeEsperada}</Text>
          <TextInput mode="outlined" label="Quantidade contada *" keyboardType="decimal-pad" value={texto} onChangeText={(value) => setContagens((atual) => ({ ...atual, [item.id]: value }))} />
          {divergencia !== null && <Text style={{ color: divergencia === 0 ? "#166534" : "#991B1B", marginTop: 6 }}>{divergencia === 0 ? "Confere" : `Divergência: ${divergencia > 0 ? "+" : ""}${divergencia}`}</Text>}
        </Card.Content></Card>;
      })}
      <View style={s.row}><Button mode="outlined" onPress={() => salvar(false)} disabled={loading}>Salvar contagem</Button><Button mode="contained" onPress={() => salvar(true)} disabled={loading}>Aplicar ajustes</Button></View>
    </>}
    {loading && <ActivityIndicator style={s.input} />}
  </ScrollView>;
};

const s = StyleSheet.create({ content: { padding: 16, paddingTop: 52, gap: 12, backgroundColor: "#F8FAFC", flexGrow: 1 }, title: { fontWeight: "700" }, row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }, grow: { flex: 1 }, input: { marginTop: 12 }, item: { backgroundColor: "white" } });

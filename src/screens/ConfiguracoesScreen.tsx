import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  TextInput as RNTextInput,
  ActivityIndicator,
} from "react-native";
import { Text } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { useAuth } from "../hooks/useAuth";
import { Storage } from "../utils/storage";
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Configuracoes">;

const C = {
  bg: "#F8FAFC",
  white: "#FFFFFF",
  slate100: "#F1F5F9",
  slate200: "#E2E8F0",
  slate400: "#94A3B8",
  slate500: "#64748B",
  slate700: "#334155",
  slate900: "#0F172A",
  red600: "#DC2626",
  green600: "#16A34A",
};

export const ConfiguracoesScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { signOut, state } = useAuth();

  const [apiUrl, setApiUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Storage.getApiUrl().then(setApiUrl);
  }, []);

  const handleSalvar = async () => {
    const url = apiUrl.trim().replace(/\/$/, "");
    if (!url) { Alert.alert("Erro", "URL não pode estar vazia."); return; }
    setIsLoading(true);
    try {
      await Storage.saveApiUrl(url);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      Alert.alert("Erro", "Não foi possível salvar.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Encerrar sessão", "Deseja realmente sair?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: () => signOut() },
    ]);
  };

  const userName = state.user?.nome ?? "Usuário";
  const userInitials = userName.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="arrow-left" size={20} color={C.slate700} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Configurações</Text>
        <View style={s.avatarBox}>
          <Text style={s.avatarText}>{userInitials}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Seção: Conta */}
          <Text style={s.sectionLabel}>Conta</Text>
          <View style={s.listCard}>
            <View style={s.row}>
              <View style={s.rowIcon}>
                <Icon name="account-outline" size={18} color={C.slate700} />
              </View>
              <View style={s.rowContent}>
                <Text style={s.rowLabel}>{userName}</Text>
                <Text style={s.rowDesc}>
                  {state.user?.perfil === "ADMINISTRADOR" ? "Administrador" : "Estoque"}
                </Text>
              </View>
            </View>
          </View>

          {/* Seção: Servidor */}
          <Text style={s.sectionLabel}>Servidor</Text>
          <View style={s.listCard}>
            <View style={s.row}>
              <View style={s.rowIcon}>
                <Icon name="server-outline" size={18} color={C.slate700} />
              </View>
              <View style={s.rowContent}>
                <Text style={s.rowLabel}>Endereço da API</Text>
                <Text style={s.rowDesc} numberOfLines={1}>{apiUrl}</Text>
              </View>
            </View>
            <View style={s.separator} />
            <View style={s.inputBlock}>
              <Text style={s.label}>NOVO ENDEREÇO</Text>
              <RNTextInput
                style={s.input}
                value={apiUrl}
                onChangeText={setApiUrl}
                placeholder="http://192.168.0.46:3000"
                placeholderTextColor={C.slate400}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!isLoading}
              />
              <TouchableOpacity
                style={[s.btn, saved && s.btnSaved, isLoading && s.btnDisabled]}
                onPress={handleSalvar}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading
                  ? <ActivityIndicator size="small" color={C.white} />
                  : <Text style={s.btnText}>{saved ? "Salvo ✓" : "Salvar endereço"}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>

          {/* Seção: App */}
          <Text style={s.sectionLabel}>Aplicativo</Text>
          <View style={s.listCard}>
            {[
              { icon: "information-outline", label: "Versão", value: "1.0.0 (Build 1)" },
              { icon: "cellphone", label: "Plataforma", value: Platform.OS === "android" ? "Android" : "iOS" },
              { icon: "lightning-bolt-outline", label: "SDK", value: "Expo 56 — React Native" },
            ].map((item, i, arr) => (
              <React.Fragment key={item.label}>
                <View style={s.row}>
                  <View style={s.rowIcon}>
                  <Icon name={item.icon as any} size={18} color={C.slate700} />
                  </View>
                  <View style={s.rowContent}>
                    <Text style={s.rowLabel}>{item.label}</Text>
                    <Text style={s.rowDesc}>{item.value}</Text>
                  </View>
                </View>
                {i < arr.length - 1 && <View style={s.separator} />}
              </React.Fragment>
            ))}
          </View>

          {/* Logout */}
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
            <Icon name="logout" size={16} color={C.red600} />
            <Text style={s.logoutText}>Sair da conta</Text>
          </TouchableOpacity>

          <Text style={s.footer}>© 2026 MedFlow ERP Systems</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    backgroundColor: C.white,
    paddingTop: Platform.OS === "android" ? 44 : 58,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: C.slate200,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: C.slate100,
    alignItems: "center", justifyContent: "center",
    marginRight: 12,
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: C.slate900 },
  avatarBox: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.slate900,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: C.white, fontSize: 13, fontWeight: "700" },

  // Scroll
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 11, fontWeight: "600", color: C.slate500,
    letterSpacing: 0.8, textTransform: "uppercase",
    marginBottom: 8, marginTop: 20, marginLeft: 2,
  },

  // Card lista
  listCard: {
    backgroundColor: C.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.slate200,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowIcon: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: C.slate100,
    alignItems: "center", justifyContent: "center",
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 13, fontWeight: "600", color: C.slate900, marginBottom: 1 },
  rowDesc: { fontSize: 12, color: C.slate500 },
  separator: { height: 1, backgroundColor: C.slate200, marginHorizontal: 16 },

  // Input
  inputBlock: { padding: 16 },
  label: {
    fontSize: 10, fontWeight: "600", color: C.slate500,
    letterSpacing: 0.8, marginBottom: 6,
  },
  input: {
    borderWidth: 1, borderColor: C.slate200,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 13, color: C.slate900, backgroundColor: C.white,
    marginBottom: 10,
  },

  // Botões
  btn: {
    backgroundColor: C.slate900,
    borderRadius: 10, paddingVertical: 13,
    alignItems: "center",
  },
  btnSaved: { backgroundColor: C.green600 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: C.white, fontSize: 13, fontWeight: "600" },

  // Logout
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1, borderColor: C.slate200,
    backgroundColor: C.white,
  },
  logoutText: { color: C.red600, fontSize: 13, fontWeight: "600" },

  footer: { textAlign: "center", fontSize: 11, color: C.slate400, marginTop: 20 },
});

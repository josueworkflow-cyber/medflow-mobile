import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  TextInput as RNTextInput,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { Text } from "react-native-paper";
import { useAuth } from "../hooks/useAuth";
import { AuthAPI } from "../api/auth";
import { Storage } from "../utils/storage";

// Design tokens idênticos ao ERP
const C = {
  bg: "#F8FAFC",          // slate-50
  white: "#FFFFFF",
  slate200: "#E2E8F0",
  slate400: "#94A3B8",
  slate500: "#64748B",
  slate900: "#0F172A",
  blue500: "#3B82F6",
  red50: "#FEF2F2",
  red100: "#FEE2E2",
  red600: "#DC2626",
};

export const LoginScreen = () => {
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showServer, setShowServer] = useState(false);
  const [apiUrl, setApiUrl] = useState("");

  useEffect(() => {
    Storage.getApiUrl().then(setApiUrl);
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Preencha todos os campos.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const url = apiUrl.trim().replace(/\/$/, "");
      if (url) await Storage.saveApiUrl(url);
      const { token, usuario } = await AuthAPI.login(email.trim(), password);
      await signIn(token, usuario);
    } catch (err: any) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError("Servidor inacessível. Verifique o endereço abaixo.");
        setShowServer(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={s.logoArea}>
            <View style={s.logoBox}>
              <Text style={s.logoText}>MF</Text>
            </View>
            <Text style={s.title}>MedFlow Mobile</Text>
            <Text style={s.subtitle}>Gestão Hospitalar Inteligente</Text>
          </View>

          {/* Card */}
          <View style={s.card}>

            {error && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            {/* Email */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>EMAIL CORPORATIVO</Text>
              <RNTextInput
                style={[s.input, error ? s.inputError : null]}
                placeholder="seu@email.com"
                placeholderTextColor={C.slate400}
                value={email}
                onChangeText={(t) => { setEmail(t); setError(null); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            {/* Senha */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>SENHA DE ACESSO</Text>
              <RNTextInput
                style={[s.input, error ? s.inputError : null]}
                placeholder="••••••••"
                placeholderTextColor={C.slate400}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(null); }}
                secureTextEntry
                editable={!isLoading}
              />
            </View>

            {/* Botão */}
            <TouchableOpacity
              style={[s.btn, isLoading && s.btnDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading
                ? <ActivityIndicator color={C.white} size="small" />
                : <Text style={s.btnText}>Entrar no Sistema</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Configurações do servidor */}
          <TouchableOpacity
            style={s.serverToggle}
            onPress={() => setShowServer(!showServer)}
          >
            <Text style={s.serverToggleText}>
              Configurações do servidor {showServer ? "▲" : "▼"}
            </Text>
          </TouchableOpacity>

          {showServer && (
            <View style={s.serverCard}>
              <Text style={s.label}>ENDEREÇO DA API</Text>
              <RNTextInput
                style={s.input}
                placeholder="http://192.168.0.46:3000"
                placeholderTextColor={C.slate400}
                value={apiUrl}
                onChangeText={setApiUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!isLoading}
              />
              <TouchableOpacity
                style={s.btnOutline}
                onPress={async () => {
                  const u = apiUrl.trim().replace(/\/$/, "");
                  if (u) { await Storage.saveApiUrl(u); setError(null); }
                }}
              >
                <Text style={s.btnOutlineText}>Salvar endereço</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={s.footer}>© 2026 MedFlow Systems. Todos os direitos reservados.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },

  // Logo
  logoArea: { alignItems: "center", marginBottom: 32 },
  logoBox: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: C.slate900,
    alignItems: "center", justifyContent: "center",
    marginBottom: 14,
  },
  logoText: { color: C.white, fontSize: 22, fontWeight: "800", letterSpacing: 1 },
  title: { fontSize: 22, fontWeight: "700", color: C.slate900, marginBottom: 4 },
  subtitle: { fontSize: 13, color: C.slate500 },

  // Card
  card: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: C.slate200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  fieldGroup: { marginBottom: 16 },
  label: {
    fontSize: 11, fontWeight: "600",
    color: C.slate500, letterSpacing: 0.8,
    marginBottom: 6, textTransform: "uppercase",
  },
  input: {
    borderWidth: 1, borderColor: C.slate200,
    borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 14, color: C.slate900,
    backgroundColor: C.white,
  },
  inputError: { borderColor: "#FCA5A5" },
  errorBox: {
    backgroundColor: C.red50,
    borderWidth: 1, borderColor: C.red100,
    borderRadius: 10, padding: 12, marginBottom: 16,
  },
  errorText: { color: C.red600, fontSize: 13, fontWeight: "500", textAlign: "center" },

  // Botão primário
  btn: {
    backgroundColor: C.slate900,
    borderRadius: 12, paddingVertical: 16,
    alignItems: "center", marginTop: 8,
  },
  btnDisabled: { opacity: 0.55 },
  btnText: { color: C.white, fontSize: 14, fontWeight: "600", letterSpacing: 0.3 },

  // Botão outline
  btnOutline: {
    borderWidth: 1, borderColor: C.slate200,
    borderRadius: 12, paddingVertical: 13,
    alignItems: "center", marginTop: 12,
    backgroundColor: C.white,
  },
  btnOutlineText: { color: C.slate900, fontSize: 13, fontWeight: "600" },

  // Servidor
  serverToggle: { alignItems: "center", paddingVertical: 20 },
  serverToggleText: { fontSize: 12, color: C.slate400 },
  serverCard: {
    backgroundColor: C.white, borderRadius: 12,
    padding: 18, borderWidth: 1, borderColor: C.slate200,
  },

  footer: { textAlign: "center", fontSize: 11, color: C.slate400, marginTop: 24 },
});

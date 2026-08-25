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
  Image,
} from "react-native";
import { Text, Surface, Divider } from "react-native-paper";
import { useAuth } from "../hooks/useAuth";
import { AuthAPI } from "../api/auth";
import { Storage } from "../utils/storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const C = {
  headerBg: "#8B0C21",
  primaryColor: "#C41230",
  bg: "#F8FAFC",
  white: "#FFFFFF",
  slate100: "#F1F5F9",
  slate200: "#E2E8F0",
  slate300: "#CBD5E1",
  slate400: "#94A3B8",
  slate500: "#64748B",
  slate700: "#334155",
  slate900: "#0F172A",
  border: "#E2E8F0",
  dangerColor: "#DC2626",
  dangerBg: "#FEF2F2",
  dangerBorder: "#FEE2E2",
  successColor: "#16A34A",
};

export const LoginScreen = () => {
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showServer, setShowServer] = useState(false);
  const [apiUrl, setApiUrl] = useState("");
  const [savedUrlSuccess, setSavedUrlSuccess] = useState(false);

  useEffect(() => {
    Storage.getApiUrl().then(setApiUrl);
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Informe seu e-mail corporativo e senha de acesso.");
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
        setError("Não foi possível conectar ao servidor. Verifique o endereço da API abaixo.");
        setShowServer(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveApiUrl = async () => {
    const u = apiUrl.trim().replace(/\/$/, "");
    if (u) {
      await Storage.saveApiUrl(u);
      setError(null);
      setSavedUrlSuccess(true);
      setTimeout(() => setSavedUrlSuccess(false), 3000);
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
          {/* Card Principal de Login */}
          <Surface style={s.card} elevation={3}>
            {/* Logotipo Oficial */}
            <View style={s.logoArea}>
              <Image
                source={require("../../assets/logo-dac.png")}
                style={s.logoImage}
                resizeMode="contain"
              />
            </View>

            <Divider style={{ marginVertical: 14 }} />

            {/* Mensagem de Erro */}
            {error && (
              <View style={s.errorBox}>
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color={C.dangerColor} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            {/* Campo: E-mail */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>E-MAIL CORPORATIVO</Text>
              <View style={[s.inputWrapper, error && s.inputWrapperError]}>
                <MaterialCommunityIcons name="email-outline" size={20} color={C.slate500} style={s.inputIcon} />
                <RNTextInput
                  style={s.input}
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
            </View>

            {/* Campo: Senha */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>SENHA DE ACESSO</Text>
              <View style={[s.inputWrapper, error && s.inputWrapperError]}>
                <MaterialCommunityIcons name="lock-outline" size={20} color={C.slate500} style={s.inputIcon} />
                <RNTextInput
                  style={s.input}
                  placeholder="••••••••"
                  placeholderTextColor={C.slate400}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(null); }}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={s.eyeBtn}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={C.slate500}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Botão de Entrada */}
            <TouchableOpacity
              style={[s.btn, isLoading && s.btnDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <View style={s.btnContent}>
                  <ActivityIndicator color={C.white} size="small" />
                  <Text style={s.btnText}>Autenticando...</Text>
                </View>
              ) : (
                <View style={s.btnContent}>
                  <MaterialCommunityIcons name="login" size={20} color={C.white} />
                  <Text style={s.btnText}>Entrar no Sistema</Text>
                </View>
              )}
            </TouchableOpacity>
          </Surface>

          {/* Configurações do Servidor (Colapsável) */}
          <TouchableOpacity
            style={s.serverToggle}
            onPress={() => setShowServer(!showServer)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={showServer ? "server-network" : "server-network-off"}
              size={16}
              color={C.slate500}
            />
            <Text style={s.serverToggleText}>
              {showServer ? "Ocultar configurações de servidor" : "Configurar endereço do servidor API"}
            </Text>
            <MaterialCommunityIcons
              name={showServer ? "chevron-up" : "chevron-down"}
              size={16}
              color={C.slate500}
            />
          </TouchableOpacity>

          {showServer && (
            <Surface style={s.serverCard} elevation={1}>
              <View style={s.serverCardHeader}>
                <MaterialCommunityIcons name="server" size={18} color={C.slate700} />
                <Text style={s.serverCardTitle}>Conexão com ERP MedFlow</Text>
              </View>
              <Text style={s.serverHelpText}>
                Informe o IP ou domínio do servidor central onde o ERP está rodando:
              </Text>
              <View style={s.inputWrapper}>
                <MaterialCommunityIcons name="web" size={18} color={C.slate500} style={s.inputIcon} />
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
              </View>
              <TouchableOpacity
                style={s.btnSaveServer}
                onPress={handleSaveApiUrl}
                activeOpacity={0.8}
              >
                <Text style={s.btnSaveServerText}>Salvar Endereço da API</Text>
              </TouchableOpacity>
              {savedUrlSuccess && (
                <View style={s.successBox}>
                  <MaterialCommunityIcons name="check-circle" size={16} color={C.successColor} />
                  <Text style={s.successText}>Endereço salvo com sucesso!</Text>
                </View>
              )}
            </Surface>
          )}

          {/* Rodapé Corporativo */}
          <View style={s.footerArea}>
            <View style={s.securityBadge}>
              <MaterialCommunityIcons name="shield-check-outline" size={14} color={C.slate500} />
              <Text style={s.securityText}>Acesso Seguro • Criptografia TLS 256-bit</Text>
            </View>
            <Text style={s.footer}>© 2026 MedFlow ERP Systems. Todos os direitos reservados.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 32,
  },

  /* Card */
  card: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: C.border,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },

  /* Logo */
  logoArea: {
    alignItems: "center",
    paddingVertical: 6,
  },
  logoImage: {
    width: 210,
    height: 48,
    marginBottom: 10,
  },

  /* Campos */
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: C.slate700,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.slate100,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    height: 48,
  },
  inputWrapperError: {
    borderColor: C.dangerColor,
    backgroundColor: C.dangerBg,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: C.slate900,
    height: "100%",
  },
  eyeBtn: {
    padding: 6,
  },

  /* Erro */
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.dangerBg,
    borderWidth: 1,
    borderColor: C.dangerBorder,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: C.dangerColor,
    fontSize: 12,
    fontWeight: "600",
  },

  /* Botão Primário */
  btn: {
    backgroundColor: C.headerBg,
    borderRadius: 10,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btnText: {
    color: C.white,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  /* Servidor */
  serverToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 6,
  },
  serverToggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.slate500,
  },
  serverCard: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },
  serverCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  serverCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: C.slate900,
  },
  serverHelpText: {
    fontSize: 11,
    color: C.slate500,
    marginBottom: 10,
  },
  btnSaveServer: {
    backgroundColor: C.slate900,
    borderRadius: 8,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  btnSaveServerText: {
    color: C.white,
    fontSize: 12,
    fontWeight: "700",
  },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
  },
  successText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.successColor,
  },

  /* Footer */
  footerArea: {
    alignItems: "center",
    marginTop: 8,
  },
  securityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  securityText: {
    fontSize: 11,
    color: C.slate500,
    fontWeight: "600",
  },
  footer: {
    textAlign: "center",
    fontSize: 11,
    color: C.slate400,
  },
});

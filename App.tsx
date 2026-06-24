import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider as PaperProvider, MD3LightTheme } from "react-native-paper";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthProvider } from "./src/store/AuthContext";
import { useAuth } from "./src/hooks/useAuth";
import { LoginScreen } from "./src/screens/LoginScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ScannerScreen } from "./src/screens/ScannerScreen";
import { ProdutoDetalheScreen } from "./src/screens/ProdutoDetalheScreen";
import { EntradaEstoqueScreen } from "./src/screens/EntradaEstoqueScreen";
import { AjusteInventarioScreen } from "./src/screens/AjusteInventarioScreen";
import { BloqueioLoteScreen } from "./src/screens/BloqueioLoteScreen";
import { TransferenciaScreen } from "./src/screens/TransferenciaScreen";
import { AlertasScreen } from "./src/screens/AlertasScreen";
import { ConfiguracoesScreen } from "./src/screens/ConfiguracoesScreen";
import { CadastroProdutoScreen } from "./src/screens/CadastroProdutoScreen";
import { MovimentacoesScreen } from "./src/screens/MovimentacoesScreen";
import { LotesScreen } from "./src/screens/LotesScreen";
import { setupResponseInterceptors, api } from "./src/api/client";
import { RootStackParamList } from "./src/types/navigation";

// ── Tema MedFlow — clean, alinhado com ERP (slate/neutro) ─────────────────
const medflowTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#0F172A",          // slate-900
    onPrimary: "#FFFFFF",
    primaryContainer: "#F1F5F9", // slate-100
    onPrimaryContainer: "#0F172A",
    secondary: "#64748B",        // slate-500
    onSecondary: "#FFFFFF",
    secondaryContainer: "#E2E8F0",
    onSecondaryContainer: "#334155",
    background: "#F8FAFC",       // slate-50
    onBackground: "#0F172A",
    surface: "#FFFFFF",
    onSurface: "#0F172A",
    surfaceVariant: "#F1F5F9",
    onSurfaceVariant: "#64748B",
    outline: "#E2E8F0",
    error: "#DC2626",
    onError: "#FFFFFF",
  },
};
// ───────────────────────────────────────────────────────────────────────────

const Stack = createNativeStackNavigator<RootStackParamList>();

const NavigationRouter = () => {
  const { state, signOut } = useAuth();

  React.useEffect(() => {
    const interceptorId = setupResponseInterceptors(signOut);
    return () => {
      api.interceptors.response.eject(interceptorId);
    };
  }, []);

  if (state.isLoading) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {state.token === null ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Scanner" component={ScannerScreen} />
            <Stack.Screen name="ProdutoDetalhe" component={ProdutoDetalheScreen} options={{ headerShown: false }} />
            <Stack.Screen name="EntradaEstoque" component={EntradaEstoqueScreen} />
            <Stack.Screen name="AjusteInventario" component={AjusteInventarioScreen} />
            <Stack.Screen name="BloqueioLote" component={BloqueioLoteScreen} />
            <Stack.Screen name="Transferencia" component={TransferenciaScreen} />
            <Stack.Screen name="Alertas" component={AlertasScreen} />
            <Stack.Screen name="Configuracoes" component={ConfiguracoesScreen} />
            <Stack.Screen name="CadastroProduto" component={CadastroProdutoScreen} />
            <Stack.Screen name="Movimentacoes" component={MovimentacoesScreen} />
            <Stack.Screen name="Lotes" component={LotesScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={medflowTheme}>
        <AuthProvider>
          <NavigationRouter />
          <StatusBar style="dark" />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

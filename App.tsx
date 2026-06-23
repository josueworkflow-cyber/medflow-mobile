import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider as PaperProvider } from "react-native-paper";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthProvider } from "./src/store/AuthContext";
import { useAuth } from "./src/hooks/useAuth";
import { LoginScreen } from "./src/screens/LoginScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { setupResponseInterceptors, api } from "./src/api/client";

const Stack = createNativeStackNavigator();

const NavigationRouter = () => {
  const { state, signOut } = useAuth();

  // Setup interceptor para limpar sessão em caso de token expirado (401)
  React.useEffect(() => {
    const interceptorId = setupResponseInterceptors(signOut);
    return () => {
      api.interceptors.response.eject(interceptorId);
    };
  }, []);

  if (state.isLoading) {
    return null; // Pode ser exibido um splash/loading screen
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {state.token === null ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <Stack.Screen name="Home" component={HomeScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider>
        <AuthProvider>
          <NavigationRouter />
          <StatusBar style="auto" />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

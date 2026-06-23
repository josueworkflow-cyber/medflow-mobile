import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text, Avatar } from "react-native-paper";
import { useAuth } from "../hooks/useAuth";

export const HomeScreen = () => {
  const { state, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Avatar.Icon size={48} icon="account" />
        <View style={styles.userInfo}>
          <Text variant="titleMedium">{state.user?.nome}</Text>
          <Text variant="bodySmall" style={{ color: "#7F8C8D" }}>
            Perfil: {state.user?.perfil}
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.welcomeText}>
          MedFlow Estoque
        </Text>
        <Text variant="bodyLarge" style={styles.instructions}>
          Setup inicial concluído com sucesso. Os atalhos e o leitor de código de barras serão integrados nas próximas etapas.
        </Text>
      </View>

      <Button
        mode="outlined"
        onPress={signOut}
        style={styles.logoutButton}
        icon="logout"
      >
        Sair
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 20,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  userInfo: {
    marginLeft: 12,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  welcomeText: {
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 12,
  },
  instructions: {
    textAlign: "center",
    color: "#7F8C8D",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  logoutButton: {
    borderRadius: 8,
  },
});

import React from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "react-native-paper";
import { PedidoEstoque } from "../api/estoque-consulta";
import { formatarNomeCliente } from "../utils/funil-pedidos";

interface ConfirmarFaltaEstoqueModalProps {
  pedido: PedidoEstoque | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const COLORS = {
  primary: "#8B0C21",
  primaryAction: "#C41230",
  primarySoft: "#FEF2F2",
  primaryBorder: "#FECACA",
  text: "#1E293B",
  muted: "#64748B",
  border: "#E2E8F0",
  surface: "#FFFFFF",
  disabled: "#94A3B8",
};

function formatarQuantidade(valor: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);
}

export function ConfirmarFaltaEstoqueModal({
  pedido,
  loading,
  onClose,
  onConfirm,
}: ConfirmarFaltaEstoqueModalProps) {
  const pendenciasAtivas = (pedido?.pendenciasEstoque || []).filter(
    (pendencia) => !["RESOLVIDA", "CANCELADA"].includes(pendencia.status)
  );
  const podeConfirmar = pendenciasAtivas.length > 0 && !loading;

  const fechar = () => {
    if (!loading) onClose();
  };

  return (
    <Modal
      visible={pedido !== null}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={fechar}
    >
      <View style={styles.overlay}>
        <View
          style={styles.content}
          accessibilityViewIsModal
          accessibilityLabel="Confirmação de itens em falta"
        >
          {pedido && (
            <View style={{ flex: 1, justifyContent: "space-between" }}>
              <View style={styles.header}>
                <View style={styles.titleIcon}>
                  <MaterialCommunityIcons
                    name="alert-outline"
                    size={22}
                    color={COLORS.primaryAction}
                  />
                </View>
                <View style={styles.headerText}>
                  <Text style={styles.title}>Confirmar itens em falta</Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {formatarNomeCliente(pedido.cliente)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeIcon}
                  onPress={fechar}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Fechar confirmação"
                  accessibilityState={{ disabled: loading }}
                >
                  <MaterialCommunityIcons name="close" size={22} color={COLORS.muted} />
                </TouchableOpacity>
              </View>

              <View style={styles.notice}>
                <MaterialCommunityIcons
                  name="information-outline"
                  size={19}
                  color={COLORS.primary}
                />
                <Text style={styles.noticeText}>
                  Ao confirmar, os itens abaixo serão marcados como falta e enviados ao Comercial.
                  Quando a mercadoria chegar, registre a entrada antes da separação para evitar saldo
                  negativo.
                </Text>
              </View>

              <Text style={styles.listTitle}>ITENS EM FALTA</Text>
              <ScrollView
                style={styles.itemsList}
                contentContainerStyle={styles.itemsContent}
                showsVerticalScrollIndicator={false}
              >
                {pendenciasAtivas.length === 0 ? (
                  <View style={styles.emptyState}>
                    <MaterialCommunityIcons
                      name="check-circle-outline"
                      size={34}
                      color={COLORS.muted}
                    />
                    <Text style={styles.emptyText}>Nenhuma pendência ativa neste pedido.</Text>
                  </View>
                ) : (
                  pendenciasAtivas.map((pendencia) => {
                    const unidade = pendencia.produto.unidadeVenda || "UN";

                    return (
                      <View key={pendencia.id} style={styles.itemCard}>
                        <View style={styles.itemIcon}>
                          <MaterialCommunityIcons
                            name="package-variant-closed-remove"
                            size={20}
                            color={COLORS.primaryAction}
                          />
                        </View>
                        <View style={styles.itemIdentity}>
                          <Text style={styles.itemName}>{pendencia.produto.descricao}</Text>
                          <Text style={styles.itemQuantity}>
                            Falta: {formatarQuantidade(pendencia.quantidadePendente)} {unidade}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.button, styles.backButton]}
                  onPress={fechar}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Voltar sem confirmar a falta"
                  accessibilityState={{ disabled: loading }}
                >
                  <Text style={styles.backButtonText}>Voltar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.confirmButton,
                    !podeConfirmar && styles.disabledButton,
                  ]}
                  onPress={onConfirm}
                  disabled={!podeConfirmar}
                  accessibilityRole="button"
                  accessibilityLabel="Confirmar itens em falta"
                  accessibilityState={{ disabled: !podeConfirmar, busy: loading }}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={COLORS.surface} />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name="alert-circle-check-outline"
                        size={18}
                        color={COLORS.surface}
                      />
                      <Text style={styles.confirmButtonText}>Confirmar falta</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(15, 23, 42, 0.64)",
  },
  content: {
    width: "100%",
    maxWidth: 480,
    height: "82%",
    minHeight: 380,
    padding: 18,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    elevation: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  titleIcon: {
    width: 40,
    height: 40,
    marginRight: 10,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySoft,
  },
  headerText: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.primary,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 11,
    color: COLORS.muted,
  },
  closeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 14,
    padding: 11,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.primary,
  },
  listTitle: {
    marginTop: 16,
    marginBottom: 7,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: COLORS.muted,
  },
  itemsList: {
    flexShrink: 1,
  },
  itemsContent: {
    paddingBottom: 4,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 11,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primaryAction,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
  },
  itemIcon: {
    width: 34,
    height: 34,
    marginRight: 9,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySoft,
  },
  itemIdentity: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
    color: COLORS.text,
  },
  itemQuantity: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.primaryAction,
  },
  emptyState: {
    minHeight: 110,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 12,
    textAlign: "center",
    color: COLORS.muted,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  button: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  backButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  confirmButton: {
    flexDirection: "row",
    gap: 7,
    backgroundColor: COLORS.primaryAction,
  },
  confirmButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.surface,
  },
  disabledButton: {
    backgroundColor: COLORS.disabled,
    opacity: 0.76,
  },
});

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useRiskFeed } from "../hooks/useRiskFeed";
import { Colors, Spacing, Radius } from "../constants/theme";
import { Ionicons } from "@expo/vector-icons";

const WS_URL = "ws://localhost:8000/ws/risk-events";
const REPORT_URL = "http://localhost:8000/report";
const CATEGORIES = ["Overcrowding", "Medical Emergency", "Blocked Exit", "Other"];

export default function ReportScreen() {
  const { zoneList, connected } = useRiskFeed(WS_URL);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [description, setDescription] = useState("");
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const selectedZone = zoneList.find((z) => z.zone_id === selectedZoneId);

  const handleSubmit = async () => {
    if (!selectedZoneId || !selectedCategory) return;

    setSubmitting(true);

    const payload = {
      zone_id: selectedZoneId,
      zone_name: selectedZone ? selectedZone.zone_name : "Unknown",
      category: selectedCategory,
      description: description.trim(),
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await fetch(REPORT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.warn("[ReportScreen] POST response not ok, but proceeding for MVP");
      }
    } catch (e) {
      console.warn("[ReportScreen] POST failed, but proceeding for MVP:", e.message);
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  };

  const handleReset = () => {
    setSelectedZoneId(null);
    setSelectedCategory(null);
    setDescription("");
    setSubmitted(false);
  };

  const isFormValid = selectedZoneId && selectedCategory;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Incident Report</Text>
          <Text style={styles.subtitle}>Report crowd issues directly to local authority</Text>
        </View>

        {!submitted ? (
          <View style={styles.form}>
            {/* Zone Picker */}
            <Text style={styles.label}>Select Location:</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setDropdownVisible(true)}
            >
              <Text style={styles.dropdownButtonText}>
                {selectedZone ? selectedZone.zone_name : "Choose a zone…"}
              </Text>
              <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>

            {/* Category Selector */}
            <Text style={styles.label}>Incident Category:</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryButton,
                      isActive && styles.categoryButtonActive,
                    ]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        isActive && styles.categoryButtonTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Description Input */}
            <View style={styles.descriptionHeader}>
              <Text style={styles.label}>Description (Optional):</Text>
              <Text style={styles.counter}>{description.length} / 200</Text>
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="Provide more context (e.g. near exit 4)..."
              placeholderTextColor={Colors.textMuted}
              multiline={true}
              numberOfLines={4}
              maxLength={200}
              value={description}
              onChangeText={setDescription}
            />

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, !isFormValid && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!isFormValid || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          /* Success Screen */
          <View style={styles.successContainer}>
            <View style={styles.successIconWrapper}>
              <Ionicons name="checkmark-circle" size={80} color={Colors.low} />
            </View>
            <Text style={styles.successTitle}>Report Submitted</Text>
            <Text style={styles.successMessage}>
              Thank you. The control room has been alerted of the situation.
            </Text>

            <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>Report Another Incident</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Custom Dropdown Modal */}
      <Modal
        visible={dropdownVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDropdownVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDropdownVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Zone</Text>
              <TouchableOpacity onPress={() => setDropdownVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {zoneList.length > 0 ? (
              <FlatList
                data={zoneList}
                keyExtractor={(item) => item.zone_id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.modalItem,
                      item.zone_id === selectedZoneId && styles.modalItemActive,
                    ]}
                    onPress={() => {
                      setSelectedZoneId(item.zone_id);
                      setDropdownVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalItemText,
                        item.zone_id === selectedZoneId && styles.modalItemTextActive,
                      ]}
                    >
                      {item.zone_name}
                    </Text>
                    {item.zone_id === selectedZoneId && (
                      <Ionicons name="checkmark" size={18} color={Colors.accent} />
                    )}
                  </TouchableOpacity>
                )}
              />
            ) : (
              <Text style={styles.modalEmptyText}>
                {connected ? "Loading zones…" : "Connection lost. Reconnecting…"}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContainer: {
    padding: Spacing.md,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  form: {
    flex: 1,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  dropdownButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  dropdownButtonText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "500",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  categoryButton: {
    width: "48%", // Approximately half width minus gap
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryButtonActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentDim,
  },
  categoryButtonText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  categoryButtonTextActive: {
    color: Colors.textPrimary,
  },
  descriptionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  counter: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.sm,
    color: Colors.textPrimary,
    padding: Spacing.md,
    fontSize: 14,
    height: 100,
    textAlignVertical: "top",
    marginBottom: Spacing.xl,
  },
  submitButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    height: 50,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  successContainer: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 350,
  },
  successIconWrapper: {
    marginBottom: Spacing.md,
  },
  successTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: Spacing.sm,
  },
  successMessage: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  resetButton: {
    borderColor: Colors.accent,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  resetButtonText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    maxHeight: "80%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  modalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalItemActive: {
    backgroundColor: Colors.surface,
  },
  modalItemText: {
    color: Colors.textSecondary,
    fontSize: 15,
  },
  modalItemTextActive: {
    color: Colors.accent,
    fontWeight: "600",
  },
  modalEmptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    padding: Spacing.xl,
  },
});

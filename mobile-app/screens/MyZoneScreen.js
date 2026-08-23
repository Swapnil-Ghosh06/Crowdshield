import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  FlatList,
  StatusBar,
} from "react-native";
import { useRiskFeed } from "../hooks/useRiskFeed";
import { Colors, Spacing, Radius } from "../constants/theme";
import { WS_URL } from "../constants/config";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";

// Configure local notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function MyZoneScreen() {
  const { zoneList, connected } = useRiskFeed(WS_URL);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [lang, setLang] = useState("en"); // "en" or "hi"
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const prevRiskLevelRef = useRef(null);
  const prevZoneIdRef = useRef(null);

  // Request notification permissions on mount
  useEffect(() => {
    async function requestPermissions() {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        console.warn("Notification permissions not granted");
      }
    }
    requestPermissions();
  }, []);

  // Find the selected zone's latest live data
  const selectedZone = zoneList.find((z) => z.zone_id === selectedZoneId);

  // Monitor risk level transitions for the selected zone
  useEffect(() => {
    if (!selectedZone) {
      prevRiskLevelRef.current = null;
      prevZoneIdRef.current = null;
      return;
    }

    const currentLevel = selectedZone.risk_level;
    const prevLevel = prevRiskLevelRef.current;

    // If the user just selected a new zone, initialize the ref and don't alert immediately
    if (prevZoneIdRef.current !== selectedZone.zone_id) {
      prevRiskLevelRef.current = currentLevel;
      prevZoneIdRef.current = selectedZone.zone_id;
      return;
    }

    // Trigger alert on transition from low/medium to high/critical
    if (prevLevel && prevLevel !== currentLevel) {
      const wasElevated = prevLevel === "high" || prevLevel === "critical";
      const isNowElevated = currentLevel === "high" || currentLevel === "critical";

      if (isNowElevated && !wasElevated) {
        const announcementText =
          selectedZone.announcement?.[lang] ?? selectedZone.announcement?.en;

        triggerNotification(selectedZone.zone_name, currentLevel, announcementText);
      }
    }

    prevRiskLevelRef.current = currentLevel;
  }, [selectedZone?.risk_level, selectedZoneId, lang]);

  const triggerNotification = async (zoneName, riskLevel, announcement) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🚨 CrowdShield Alert: ${zoneName}`,
          body: `Risk level changed to ${riskLevel.toUpperCase()}.\n${
            announcement || "Please follow local exit directions."
          }`,
        },
        trigger: null, // trigger immediately
      });
    } catch (e) {
      console.warn("Failed to schedule notification:", e);
    }
  };

  // Get configuration styles for the current risk level
  const getRiskStyles = (level) => {
    switch (level) {
      case "critical":
        return { color: Colors.critical, bg: Colors.criticalBg, label: "CRITICAL 🚨" };
      case "high":
        return { color: Colors.high, bg: Colors.highBg, label: "HIGH 🔴" };
      case "medium":
        return { color: Colors.medium, bg: Colors.mediumBg, label: "MEDIUM 🟡" };
      default:
        return { color: Colors.low, bg: Colors.lowBg, label: "LOW 🟢" };
    }
  };

  const riskStyles = selectedZone ? getRiskStyles(selectedZone.risk_level) : null;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>My Zone Monitor</Text>
          <Text style={styles.subtitle}>Get instant push alerts for your location</Text>
        </View>

        {/* Dropdown Selector */}
        <Text style={styles.label}>Select your current area:</Text>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setDropdownVisible(true)}
        >
          <Text style={styles.dropdownButtonText}>
            {selectedZone ? selectedZone.zone_name : "Choose a zone…"}
          </Text>
          <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>

        {/* Live Zone Status Card */}
        {selectedZone ? (
          <View style={[styles.statusCard, { borderColor: riskStyles.color }]}>
            <View style={styles.statusHeader}>
              <Text style={styles.statusZoneName}>{selectedZone.zone_name}</Text>
              <View style={[styles.badge, { backgroundColor: riskStyles.color }]}>
                <Text style={styles.badgeText}>{riskStyles.label}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Risk Score</Text>
                <Text style={[styles.statValue, { color: riskStyles.color }]}>
                  {Math.round(selectedZone.risk_score * 100)}%
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Density</Text>
                <Text style={styles.statValue}>{selectedZone.density_per_sqm} /m²</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Flow Speed</Text>
                <Text style={styles.statValue}>{selectedZone.flow_speed_mps} m/s</Text>
              </View>
            </View>

            {/* Announcement Section */}
            {selectedZone.announcement?.[lang] && (
              <View style={[styles.announcement, { borderLeftColor: riskStyles.color }]}>
                <Text style={[styles.announcementText, { color: riskStyles.color }]}>
                  {selectedZone.announcement[lang]}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="location-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              Select a zone above to start monitoring live risk alerts.
            </Text>
          </View>
        )}

        {/* Bottom controls / Language toggle */}
        <View style={styles.controls}>
          <Text style={styles.controlLabel}>Alert Language Toggle:</Text>
          <TouchableOpacity
            style={styles.langToggle}
            onPress={() => setLang((l) => (l === "en" ? "hi" : "en"))}
          >
            <Text style={styles.langText}>
              {lang === "en" ? "ENGLISH 🇬🇧" : "HINDI 🇮🇳"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

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
  container: {
    flex: 1,
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
    marginBottom: Spacing.lg,
  },
  dropdownButtonText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "500",
  },
  statusCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusZoneName: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  stat: {
    flex: 1,
    alignItems: "flex-start",
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    marginBottom: 4,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  announcement: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.sm,
    marginTop: Spacing.xs,
  },
  announcementText: {
    fontSize: 13,
    fontStyle: "italic",
  },
  emptyCard: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.xl,
    minHeight: 200,
    marginBottom: Spacing.lg,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginTop: Spacing.md,
    lineHeight: 20,
  },
  controls: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  controlLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  langToggle: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  langText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
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

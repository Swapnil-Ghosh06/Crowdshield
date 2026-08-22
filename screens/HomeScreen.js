import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { useRiskFeed } from "../hooks/useRiskFeed";
import { ZoneCard } from "../components/ZoneCard";
import { Colors, Spacing, Radius } from "../constants/theme";

// Update this if your mock server is on a different host (e.g. your machine's IP for device testing)
const WS_URL = "ws://localhost:8000/ws/risk-events";

export default function HomeScreen() {
  const { zoneList, connected, error } = useRiskFeed(WS_URL);
  const [lang, setLang] = useState("en");

  const criticalCount = zoneList.filter((z) => z.risk_level === "critical").length;
  const highCount = zoneList.filter((z) => z.risk_level === "high").length;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>CrowdShield</Text>
          <Text style={styles.subtitle}>Live Crowd Risk Monitor</Text>
        </View>

        {/* Language toggle */}
        <TouchableOpacity
          style={styles.langToggle}
          onPress={() => setLang((l) => (l === "en" ? "hi" : "en"))}
          accessibilityLabel="Toggle language"
        >
          <Text style={styles.langText}>{lang === "en" ? "EN 🇮🇳" : "HI 🇬🇧"}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Connection status ── */}
      <View style={[styles.statusBar, { backgroundColor: connected ? Colors.lowBg : Colors.mediumBg }]}>
        <View style={[styles.dot, { backgroundColor: connected ? Colors.low : Colors.medium }]} />
        <Text style={[styles.statusText, { color: connected ? Colors.low : Colors.medium }]}>
          {connected ? "Live feed connected" : error ?? "Connecting…"}
        </Text>
      </View>

      {/* ── Summary pills ── */}
      {zoneList.length > 0 && (
        <View style={styles.summary}>
          <SummaryPill count={criticalCount} label="Critical" color={Colors.critical} />
          <SummaryPill count={highCount} label="High" color={Colors.high} />
          <SummaryPill count={zoneList.length} label="Total zones" color={Colors.accent} />
        </View>
      )}

      {/* ── Zone list ── */}
      <FlatList
        data={zoneList}
        keyExtractor={(item) => item.zone_id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <ZoneCard zone={item} lang={lang} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {connected ? "Waiting for zone data…" : "Connecting to feed…"}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function SummaryPill({ count, label, color }) {
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillCount, { color }]}>{count}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  appName: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: { color: Colors.textSecondary, fontSize: 13 },
  langToggle: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  langText: { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "600" },
  summary: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  pillCount: { fontSize: 15, fontWeight: "800" },
  pillLabel: { color: Colors.textSecondary, fontSize: 12 },
  list: { padding: Spacing.md },
  empty: { flex: 1, alignItems: "center", paddingTop: Spacing.xl },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
});

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Colors, RISK_CONFIG, Spacing, Radius } from "../constants/theme";

export function ZoneCard({ zone, lang = "en" }) {
  const cfg = RISK_CONFIG[zone.risk_level] ?? RISK_CONFIG.low;
  const isCritical = zone.risk_level === "critical";

  // Pulse animation for critical zones
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isCritical) {
      pulseAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 700, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isCritical, pulseAnim]);

  const pulseBg = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [cfg.bg, Colors.criticalPulse],
  });

  const containerStyle = isCritical
    ? { backgroundColor: pulseBg }
    : { backgroundColor: cfg.bg };

  const announcement = zone.announcement?.[lang] ?? zone.announcement?.en;

  return (
    <Animated.View style={[styles.card, { borderColor: cfg.color }, containerStyle]}>
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.nameRow}>
          <Text style={styles.emoji}>{cfg.emoji}</Text>
          <Text style={styles.zoneName}>{zone.zone_name}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: cfg.color }]}>
          <Text style={styles.badgeText}>{cfg.label}</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <Stat label="Density" value={`${zone.density_per_sqm} /m²`} />
        <Stat label="Flow" value={`${zone.flow_speed_mps} m/s`} />
        <Stat label="Risk" value={`${Math.round(zone.risk_score * 100)}%`} highlight={cfg.color} />
        {zone.eta_minutes != null && (
          <Stat label="ETA" value={`${zone.eta_minutes}m`} highlight={Colors.critical} />
        )}
      </View>

      {/* Announcement */}
      {announcement && zone.risk_level !== "low" && (
        <View style={[styles.announcement, { borderLeftColor: cfg.color }]}>
          <Text style={[styles.announcementText, { color: cfg.color }]}>{announcement}</Text>
        </View>
      )}

      {/* Timestamp */}
      <Text style={styles.timestamp}>
        Updated {new Date(zone.timestamp).toLocaleTimeString()}
      </Text>
    </Animated.View>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight ? { color: highlight } : {}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flex: 1,
  },
  emoji: { fontSize: 18 },
  zoneName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  stat: { alignItems: "flex-start" },
  statLabel: { color: Colors.textMuted, fontSize: 11, marginBottom: 2 },
  statValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
  announcement: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  announcementText: { fontSize: 13, fontStyle: "italic" },
  timestamp: { color: Colors.textMuted, fontSize: 11, marginTop: Spacing.xs },
});

/**
 * CrowdShield design tokens
 * Dark-first: built for operators monitoring in dim control rooms + outdoor use.
 */

export const Colors = {
  // Base
  bg: "#0D0F14",
  surface: "#161A22",
  surfaceElevated: "#1E2330",
  border: "#2A3045",
  textPrimary: "#F0F2F7",
  textSecondary: "#8A95AB",
  textMuted: "#505A70",

  // Risk level — traffic-light system everyone already understands
  low: "#2ECC71",
  lowBg: "#0D2B1A",
  medium: "#F39C12",
  mediumBg: "#2B1E08",
  high: "#E74C3C",
  highBg: "#2B0E0E",
  critical: "#FF2D55",
  criticalBg: "#2B0818",
  criticalPulse: "#FF2D5520",

  accent: "#4F8EF7", // interactive / links
  accentDim: "#1A2E55",
};

export const RISK_CONFIG = {
  low: {
    color: Colors.low,
    bg: Colors.lowBg,
    label: "LOW",
    emoji: "🟢",
  },
  medium: {
    color: Colors.medium,
    bg: Colors.mediumBg,
    label: "MEDIUM",
    emoji: "🟡",
  },
  high: {
    color: Colors.high,
    bg: Colors.highBg,
    label: "HIGH",
    emoji: "🔴",
  },
  critical: {
    color: Colors.critical,
    bg: Colors.criticalBg,
    label: "CRITICAL",
    emoji: "🚨",
  },
};

export const Typography = {
  mono: "SpaceMono", // Expo default mono — good for numbers/scores
  sans: undefined, // system default
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const Radius = {
  sm: 6,
  md: 12,
  lg: 20,
};

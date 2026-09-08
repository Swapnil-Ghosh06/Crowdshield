import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  StatusBar,
} from "react-native";
import { useRiskFeed } from "../hooks/useRiskFeed";
import { Colors, Spacing, Radius } from "../constants/theme";
import { WS_URL, HTTP_URL } from "../constants/config";
import { Ionicons } from "@expo/vector-icons";

export default function AssistantScreen() {
  const { zoneList } = useRiskFeed(WS_URL);
  const [messages, setMessages] = useState([
    {
      id: "msg_welcome",
      role: "assistant",
      content:
        "Hello! I am CrowdShield, your crowd safety assistant. Ask me anything about the live zone statuses or safety recommendations.",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const micPulse = useRef(new Animated.Value(1)).current;

  const flatListRef = useRef(null);

  // Typing animation dots opacity
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  // Trigger typing animation loop
  useEffect(() => {
    if (!isLoading) return;

    const animateDot = (dot, delay) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay(400),
        ])
      );
    };

    const anim = Animated.parallel([
      animateDot(dot1, 0),
      animateDot(dot2, 200),
      animateDot(dot3, 400),
    ]);

    anim.start();

    return () => {
      anim.stop();
      dot1.setValue(0.3);
      dot2.setValue(0.3);
      dot3.setValue(0.3);
    };
  }, [isLoading, dot1, dot2, dot3]);

  // Scroll to bottom whenever messages or loading state changes
  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, isLoading]);

  /**
   * Generate a smart local response from live zone data.
   * This guarantees the assistant ALWAYS works — even with no internet or API key.
   */
  const generateLocalResponse = (userQuery, zones) => {
    if (!zones || zones.length === 0) {
      return "I'm connecting to live zone data. Please try again in a moment.";
    }

    const q = userQuery.toLowerCase();
    const sorted = [...zones].sort((a, b) => b.risk_score - a.risk_score);
    const highest = sorted[0];
    const safest = sorted[sorted.length - 1];
    const critical = zones.filter((z) => z.risk_level === "critical");
    const high = zones.filter((z) => z.risk_level === "high");
    const safe = zones.filter((z) => z.risk_level === "low");

    if (q.includes("safe") || q.includes("which zone") || q.includes("where")) {
      if (safe.length > 0) {
        return `The safest zones right now are: ${safe.map((z) => z.zone_name).join(", ")} — all showing LOW risk. Avoid ${highest.zone_name} which has the highest density at ${highest.density_per_sqm?.toFixed(1)} p/m².`;
      }
      return `All zones are elevated. ${highest.zone_name} is highest risk (${highest.risk_level?.toUpperCase()}). Proceed with caution.`;
    }

    if (q.includes("critical") || q.includes("danger") || q.includes("emergency")) {
      if (critical.length > 0) {
        const z = critical[0];
        return `⚠️ CRITICAL ALERT: ${z.zone_name} is at CRITICAL risk with ${z.density_per_sqm?.toFixed(1)} p/m² density. ${z.announcement?.en || "Please evacuate calmly and follow marshal instructions."}`;
      }
      if (high.length > 0) {
        return `${high[0].zone_name} is at HIGH risk (${high[0].risk_score?.toFixed(2)} score). No critical zones at the moment, but stay alert and monitor announcements.`;
      }
      return "No critical zones detected right now. All zones are within manageable risk levels.";
    }

    if (q.includes("crowd") || q.includes("density") || q.includes("busy") || q.includes("congested")) {
      return `Current crowd density — ${zones.map((z) => `${z.zone_name}: ${z.density_per_sqm?.toFixed(1)} p/m² (${z.risk_level})`).join(", ")}. The most congested area is ${highest.zone_name}.`;
    }

    if (q.includes("evacuate") || q.includes("exit") || q.includes("leave") || q.includes("route")) {
      const rec = highest.recommendations?.[0];
      const recText = rec ? ` Recommended action: ${rec.replace(/_/g, " ")}.` : "";
      return `For evacuation, avoid ${highest.zone_name} (highest risk). Head towards ${safest.zone_name} — currently LOW risk with the least congestion.${recText}`;
    }

    if (q.includes("recommendation") || q.includes("what should") || q.includes("advice")) {
      const recs = highest.recommendations?.slice(0, 2).map((r) => r.replace(/_/g, " ")).join(", ") || "monitor situation";
      return `For ${highest.zone_name} (${highest.risk_level} risk): ${recs}. ${highest.announcement?.en || ""}`;
    }

    if (q.includes("eta") || q.includes("minute") || q.includes("how long") || q.includes("time")) {
      const etaZones = zones.filter((z) => z.eta_minutes != null);
      if (etaZones.length > 0) {
        return `ETA to critical threshold — ${etaZones.map((z) => `${z.zone_name}: ${z.eta_minutes} min`).join(", ")}. Immediate action recommended for zones under 10 minutes.`;
      }
      return "No zones are currently approaching critical thresholds. All zones have sufficient time margins.";
    }

    // Default: summary of current situation
    return `Current status: ${highest.zone_name} is the highest risk zone (${highest.risk_level?.toUpperCase()}, score ${highest.risk_score?.toFixed(2)}) with ${highest.density_per_sqm?.toFixed(1)} p/m² density. ${safe.length} of ${zones.length} zones are safe. ${highest.announcement?.en || ""}`;
  };

  /**
   * Mic handler — uses the browser's native Web Speech API.
   * Tap once to start listening (button turns red). Speak. Auto-fills + sends on result.
   * Tap again to stop early.
   */
  const handleMic = () => {
    // If already listening, stop it
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    // Check browser support (works in Chrome, Edge, Brave on web)
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please type your question or use Chrome/Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-IN"; // Indian English — matches your audience
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      // Pulsing scale animation while listening
      Animated.loop(
        Animated.sequence([
          Animated.timing(micPulse, { toValue: 1.25, duration: 500, useNativeDriver: true }),
          Animated.timing(micPulse, { toValue: 1.0, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
      // Auto-send after a short delay so user can see what was captured
      setTimeout(() => {
        setInputText("");
        // Manually trigger send with the transcript
        handleSendText(transcript);
      }, 400);
    };

    recognition.onerror = (event) => {
      console.warn("[Mic] SpeechRecognition error:", event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
      micPulse.stopAnimation();
      micPulse.setValue(1);
      recognitionRef.current = null;
    };

    recognition.start();
  };

  /**
   * Send a specific text string (used by handleMic to send after transcription).
   */
  const handleSendText = async (text) => {
    if (!text || text.trim() === "") return;

    const userMsgObj = {
      id: `msg_user_${Date.now()}`,
      role: "user",
      content: text.trim(),
    };
    setMessages((prev) => [...prev, userMsgObj]);
    setIsLoading(true);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const backendRes = await fetch(`${HTTP_URL}/ai/summary`, { signal: controller.signal });
      clearTimeout(timeout);

      if (backendRes.ok) {
        const data = await backendRes.json();
        const reply = data?.summary_en;
        if (reply) {
          setMessages((prev) => [...prev, { id: `msg_assistant_${Date.now()}`, role: "assistant", content: reply.trim() }]);
          return;
        }
      }
      throw new Error("no summary");
    } catch {
      const localReply = generateLocalResponse(text, zoneList);
      setMessages((prev) => [...prev, { id: `msg_assistant_${Date.now()}`, role: "assistant", content: localReply }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (inputText.trim() === "" || isLoading) return;


    const userMessage = inputText.trim();
    setInputText("");

    // Append user message
    const userMsgObj = {
      id: `msg_user_${Date.now()}`,
      role: "user",
      content: userMessage,
    };
    setMessages((prev) => [...prev, userMsgObj]);
    setIsLoading(true);

    try {
      // Strategy 1: Try backend /ai/summary (Gemini → Groq → Cohere → deterministic fallback)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const backendRes = await fetch(`${HTTP_URL}/ai/summary`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (backendRes.ok) {
        const data = await backendRes.json();
        const reply = data?.summary_en;
        if (reply) {
          setMessages((prev) => [
            ...prev,
            {
              id: `msg_assistant_${Date.now()}`,
              role: "assistant",
              content: reply.trim(),
            },
          ]);
          return;
        }
      }
      throw new Error("Backend returned no usable summary");
    } catch (backendErr) {
      console.warn("[AssistantScreen] Backend unavailable, using local intelligence:", backendErr.message);

      // Strategy 2: Smart local response using live zone data — always works, zero API calls
      const localReply = generateLocalResponse(userMessage, zoneList);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_assistant_${Date.now()}`,
          role: "assistant",
          content: localReply,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === "user";
    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.messageRowUser : styles.messageRowAssistant,
        ]}
      >
        {!isUser && (
          <View style={styles.avatar}>
            <Ionicons name="shield-checkmark" size={16} color={Colors.accent} />
          </View>
        )}
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAssistant,
          ]}
        >
          <Text style={[styles.messageText, isUser ? styles.messageTextUser : styles.messageTextAssistant]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>CrowdShield Assistant</Text>
          <Text style={styles.subtitle}>AI Operator & Safety Guide</Text>
        </View>

        {/* Message Feed */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.feed}
          ListFooterComponent={
            isLoading && (
              <View style={[styles.messageRow, styles.messageRowAssistant]}>
                <View style={styles.avatar}>
                  <Ionicons name="shield-checkmark" size={16} color={Colors.accent} />
                </View>
                <View style={[styles.bubble, styles.bubbleAssistant]}>
                  <View style={styles.typingContainer}>
                    <Animated.View style={[styles.typingDot, { opacity: dot1 }]} />
                    <Animated.View style={[styles.typingDot, { opacity: dot2 }]} />
                    <Animated.View style={[styles.typingDot, { opacity: dot3 }]} />
                  </View>
                </View>
              </View>
            )
          }
        />

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          {/* Mic Button - Web Speech API */}
          <TouchableOpacity
            style={[
              styles.iconButton,
              isListening && { backgroundColor: Colors.critical, borderColor: Colors.critical },
            ]}
            onPress={handleMic}
            activeOpacity={0.7}
            accessibilityLabel={isListening ? "Stop listening" : "Start voice input"}
          >
            <Animated.View style={{ transform: [{ scale: micPulse }] }}>
              <Ionicons
                name={isListening ? "mic" : "mic-outline"}
                size={20}
                color={isListening ? "#fff" : Colors.textSecondary}
              />
            </Animated.View>
          </TouchableOpacity>

          {/* Text Input */}
          <TextInput
            style={styles.input}
            placeholder="Ask about live risk or exit routes..."
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />

          {/* Send Button */}
          <TouchableOpacity
            style={[styles.sendButton, inputText.trim() === "" && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={inputText.trim() === "" || isLoading}
          >
            <Ionicons name="send" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  feed: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    maxWidth: "80%",
  },
  messageRowUser: {
    alignSelf: "flex-end",
    justifyContent: "flex-end",
  },
  messageRowAssistant: {
    alignSelf: "flex-start",
    justifyContent: "flex-start",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.xs,
    marginBottom: 4,
  },
  bubble: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 1,
  },
  bubbleUser: {
    backgroundColor: Colors.accent,
    borderBottomRightRadius: Radius.sm,
  },
  bubbleAssistant: {
    backgroundColor: Colors.surfaceElevated,
    borderBottomLeftRadius: Radius.sm,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextUser: {
    color: "#fff",
  },
  messageTextAssistant: {
    color: Colors.textPrimary,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.sm,
    borderColor: Colors.border,
    borderWidth: 1,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    fontSize: 14,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    borderColor: Colors.border,
    borderWidth: 1,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  typingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 16,
    width: 40,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textSecondary,
  },
});

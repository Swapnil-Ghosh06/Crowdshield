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
import { WS_URL } from "../constants/config";
import { Ionicons } from "@expo/vector-icons";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

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

    // Build dynamic system prompt containing the live zones state
    const systemPrompt = `You are CrowdShield, a crowd safety assistant. Current zone status: ${JSON.stringify(
      zoneList
    )}. Answer questions clearly and calmly. Keep responses under 3 sentences.`;

    try {
      const response = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_GROQ_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          max_tokens: 300,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content;

      if (reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_assistant_${Date.now()}`,
            role: "assistant",
            content: reply.trim(),
          },
        ]);
      } else {
        throw new Error("Empty response content");
      }
    } catch (e) {
      console.error("[AssistantScreen] Groq API call failed:", e);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          role: "assistant",
          content: "Unable to reach assistant",
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
          {/* Mic Button - UI only */}
          <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
            <Ionicons name="mic" size={20} color={Colors.textSecondary} />
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

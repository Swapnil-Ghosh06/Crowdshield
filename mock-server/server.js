/**
 * CrowdShield — Mock WebSocket Server
 * Emits fake risk events in the shared contract shape every 3 seconds.
 * Run: node server.js
 * WS endpoint: ws://localhost:8000/ws/risk-events
 * REST endpoint: GET http://localhost:8000/zones (snapshot of all zones)
 */

const http = require("http");
const { WebSocketServer } = require("ws");

// ── Zone definitions ──────────────────────────────────────────────────────────
const ZONES = [
  { zone_id: "gate_1", zone_name: "South Entrance" },
  { zone_id: "gate_2", zone_name: "East Entrance" },
  { zone_id: "gate_3", zone_name: "North Entrance" },
  { zone_id: "gate_4", zone_name: "West Entrance" },
  { zone_id: "stage_front", zone_name: "Stage Front Pit" },
  { zone_id: "food_court", zone_name: "Food Court" },
];

const RISK_LEVELS = ["low", "medium", "high", "critical"];

const RECOMMENDATIONS_POOL = [
  "open_gate_5",
  "redirect_flow_north",
  "close_gate_2",
  "deploy_stewards_zone_3",
  "activate_pa_system",
  "open_emergency_exit_7",
];

const ANNOUNCEMENTS = {
  low: {
    en: "All clear. Enjoy the event.",
    hi: "सब ठीक है। कार्यक्रम का आनंद लें।",
  },
  medium: {
    en: "This area is getting busy. Please move towards less crowded zones.",
    hi: "यह क्षेत्र भीड़भाड़ हो रहा है। कृपया कम भीड़ वाले क्षेत्रों की ओर जाएं।",
  },
  high: {
    en: "High crowd density detected. Please move calmly towards Gate 5.",
    hi: "अधिक भीड़ का पता चला है। कृपया शांति से गेट 5 की ओर बढ़ें।",
  },
  critical: {
    en: "URGENT: Please evacuate this zone immediately via the nearest exit.",
    hi: "तुरंत: कृपया निकटतम निकास से इस क्षेत्र को तुरंत खाली करें।",
  },
};

// ── State — each zone has a slowly drifting risk score ────────────────────────
const zoneState = {};
ZONES.forEach((z) => {
  zoneState[z.zone_id] = {
    ...z,
    risk_score: Math.random() * 0.4, // start low
    trend: (Math.random() - 0.4) * 0.05, // slight upward bias
  };
});

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function riskLevel(score) {
  if (score < 0.3) return "low";
  if (score < 0.55) return "medium";
  if (score < 0.8) return "high";
  return "critical";
}

function buildEvent(state) {
  const level = riskLevel(state.risk_score);
  const isElevated = level === "high" || level === "critical";

  // Pick 0–2 recommendations only when elevated
  const recs = isElevated
    ? RECOMMENDATIONS_POOL.sort(() => Math.random() - 0.5).slice(
        0,
        Math.floor(Math.random() * 3)
      )
    : [];

  return {
    zone_id: state.zone_id,
    zone_name: state.zone_name,
    timestamp: new Date().toISOString(),
    density_per_sqm: parseFloat((state.risk_score * 8 + Math.random() * 0.5).toFixed(2)),
    flow_speed_mps: parseFloat((1.5 - state.risk_score + Math.random() * 0.2).toFixed(2)),
    risk_score: parseFloat(state.risk_score.toFixed(3)),
    risk_level: level,
    eta_minutes: isElevated ? Math.floor(4 + Math.random() * 10) : null,
    recommendations: recs,
    announcement: ANNOUNCEMENTS[level],
  };
}

function tickAllZones() {
  const events = [];
  for (const id in zoneState) {
    const s = zoneState[id];
    // Drift the score; occasionally flip trend direction
    if (Math.random() < 0.15) s.trend = (Math.random() - 0.4) * 0.06;
    s.risk_score = clamp(s.risk_score + s.trend + (Math.random() - 0.5) * 0.02, 0, 1);
    events.push(buildEvent(s));
  }
  return events;
}

// ── HTTP server (REST snapshot + WS upgrade) ──────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/report") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        console.log(`[Incident Report] Zone: ${payload.zone_name} (${payload.zone_id}), Category: ${payload.category}, Description: ${payload.description || "N/A"}, Time: ${payload.timestamp}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        console.error("[Incident Report] Error parsing report:", e.message);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  if (req.method === "GET" && req.url === "/zones") {
    const snapshot = Object.values(zoneState).map(buildEvent);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(snapshot));
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", zones: ZONES.length }));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

const wss = new WebSocketServer({ server, path: "/ws/risk-events" });

wss.on("connection", (ws) => {
  console.log(`[WS] Client connected. Total: ${wss.clients.size}`);

  // Send a full snapshot immediately on connect so the app doesn't wait 3 s
  const snapshot = Object.values(zoneState).map(buildEvent);
  ws.send(JSON.stringify({ type: "snapshot", events: snapshot }));

  ws.on("close", () => {
    console.log(`[WS] Client disconnected. Total: ${wss.clients.size}`);
  });
});

// Broadcast tick every 3 seconds
setInterval(() => {
  const events = tickAllZones();
  const payload = JSON.stringify({ type: "update", events });
  wss.clients.forEach((client) => {
    if (client.readyState === 1 /* OPEN */) client.send(payload);
  });
  console.log(`[tick] Broadcast to ${wss.clients.size} client(s) — sample risk: ${events[0].risk_level}`);
}, 3000);

const PORT = 8000;
server.listen(PORT, () => {
  console.log(`\nCrowdShield mock server running`);
  console.log(`  WS  → ws://localhost:${PORT}/ws/risk-events`);
  console.log(`  REST → http://localhost:${PORT}/zones`);
  console.log(`  Health → http://localhost:${PORT}/health\n`);
});

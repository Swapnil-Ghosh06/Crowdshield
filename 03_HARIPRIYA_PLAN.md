# Haripriya's Plan — Mobile App + Multilingual Layer + Docs

Branch: `haripriya` (or `feature/haripriya-mobile-app`)

## Your scope
1. Citizen mobile app — alerts, location-based warnings, incident reporting
2. Multilingual alert delivery (reusing the `announcement` field from the event feed)
3. Bonus: voice-enabled command center query interface
4. Documentation, pitch deck, and demo video — you own pulling these together (mandatory deliverables, easy to lose points on if rushed)

**You don't need to wait for Swapnil's real model.** Same as Zahid — connect to his Day 1 mock WebSocket feed and build your whole app against it.

## Folder structure (your ownership)
```
mobile-app/    React Native or Flutter app
docs/          documentation, pitch deck source, demo video script
```

## Tech stack
- React Native (Expo) or Flutter — pick whichever you're more comfortable with, Antigravity can scaffold either
- Push notifications: Expo Notifications (if RN) or Firebase Cloud Messaging (if Flutter)
- Same WebSocket/REST feed as Zahid for live data

## The data you'll be consuming
```json
{
  "zone_id": "gate_3",
  "zone_name": "North Entrance",
  "timestamp": "2026-08-08T18:42:00Z",
  "density_per_sqm": 4.2,
  "flow_speed_mps": 0.3,
  "risk_score": 0.78,
  "risk_level": "high",
  "eta_minutes": 6,
  "recommendations": ["open_gate_5", "redirect_flow_north"],
  "announcement": { "en": "Please move calmly towards Gate 5.", "hi": "कृपया शांति से गेट 5 की ओर बढ़ें।" }
}
```

## Step-by-step build order

**Step 1** — Scaffold the app, connect to the mock feed, show a simple list of zones + current risk_level.

**Step 2** — Location-based warning: user selects/simulates "I'm near Gate 3" (or picks it on a mini map), and gets a push notification when that zone's risk_level crosses "high", showing the `announcement.en` (or `.hi` based on a language toggle).

**Step 3** — Incident reporting: a simple form (photo optional, category, zone, free text) that citizens can submit — this data doesn't need to feed back into the risk engine for the MVP, just needs to demonstrate the reporting loop exists.

**Step 4** — Multilingual toggle: let the user pick a language and render `announcement[lang]`; if you want to go further, prompt an LLM at request time for languages beyond English/Hindi.

**Step 5 (bonus)** — Voice command interface: a simple "ask the assistant" screen where a control-room operator can type or speak a question ("which zones are high risk right now?") and get an answer generated from the current event data via an LLM call — this doubles as your "voice-enabled command center" bonus feature.

**Step 6** — Documentation + pitch deck + demo video: start this in parallel from Day 2, don't leave it to the last night. See checklist below.

## Docs/deliverables checklist (you own coordinating this)
- [ ] Architecture diagram (can be built from `00_PROJECT_PLAN.md` section 2 — turn it into a clean visual)
- [ ] Tech stack + assumptions doc (pull from all three plan files)
- [ ] Data ethics & privacy section — explicitly state: no raw video stored, density metadata only, face anonymization at the edge, and why (covers the 10% Data Ethics criterion directly)
- [ ] Pitch deck, max 10 slides — problem, solution, architecture, demo screenshots, bonus features, impact
- [ ] Demo video — script it around the "success vision" from the problem statement (predictive alert 10 minutes before a crush)

## Antigravity workspace context (paste into `.antigravity/rules.md`)

```
Project: CrowdShield — citizen-facing mobile app for a crowd stampede early
warning system.
My role: I build the mobile app (alerts, location-based warnings, incident
reporting, multilingual delivery) and the voice-assistant bonus feature.

I consume events shaped like:
{
  "zone_id": string, "zone_name": string, "timestamp": ISO8601,
  "density_per_sqm": float, "flow_speed_mps": float,
  "risk_score": float(0-1), "risk_level": "low"|"medium"|"high"|"critical",
  "eta_minutes": int|null, "recommendations": [string],
  "announcement": { "en": string, "hi": string }
}

Data source: same WebSocket feed as the dashboard (ws://localhost:8000/ws/risk-events),
confirm host/port with Swapnil/Zahid.

Coding conventions: React Native + Expo (or Flutter — state your choice),
functional components, keep push-notification logic isolated so it can be
tested without a real device where possible.
```

## Sequential prompts to run in Antigravity

1. "Scaffold a React Native (Expo) app. Create a hook that connects to `ws://localhost:8000/ws/risk-events`, parses events matching this shape: [paste contract], and stores latest event per zone_id. Build a home screen listing all zones with a color-coded risk_level badge."

2. "Add a 'my location' feature (can be simulated — a dropdown/picker of zones standing in for GPS for the prototype) and push local notifications (using Expo Notifications) whenever the selected zone's risk_level becomes 'high' or 'critical', displaying the announcement.en text. Add a language toggle (English/Hindi) that switches which announcement field is shown."

3. "Add an incident reporting screen: a form with zone picker, category dropdown (overcrowding, medical, blocked exit, other), optional photo attachment, and free-text description, submitting to a local mock endpoint (or Swapnil's backend if ready) and showing a confirmation state."

4. "Add a voice/text assistant screen: a text input (with a mic button as a stretch goal) where the user can ask a question like 'which zones are high risk right now', and get an answer generated by calling an LLM with the current event data as context, phrased clearly and calmly."

5. "Generate a clean architecture diagram description (as a Mermaid diagram) I can drop into our documentation, based on: camera/video → vision engine → risk engine → realtime pipeline → dashboard + mobile app, matching the flow in 00_PROJECT_PLAN.md."

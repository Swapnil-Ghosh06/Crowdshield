// CrowdShield — Central config
//
// FOR LOCAL DEVELOPMENT (both dashboard and mobile on same machine):
//   Keep DEPLOYED_BACKEND as null → uses localhost:8000
//
// FOR PRODUCTION / DEMO (Railway or Render deployed backend):
//   Set DEPLOYED_BACKEND to your Railway URL, e.g.:
//   "crowdshield-production.up.railway.app"
//   Then BOTH Vercel dashboard and mobile app will sync to the same live backend.

const DEPLOYED_BACKEND = null; // ← Replace null with your Railway URL when deployed
                                 // e.g. "crowdshield-xyz.up.railway.app"

const PIPELINE_HOST = DEPLOYED_BACKEND ?? "localhost:8000";

// Use wss:// (secure WebSocket) for deployed backends, ws:// for localhost
const WS_PROTOCOL = DEPLOYED_BACKEND ? "wss" : "ws";
const HTTP_PROTOCOL = DEPLOYED_BACKEND ? "https" : "http";

export const WS_URL = `${WS_PROTOCOL}://${PIPELINE_HOST}/ws/risk-events`;
export const HTTP_URL = `${HTTP_PROTOCOL}://${PIPELINE_HOST}`;
export const REPORT_URL = `${HTTP_URL}/report`;

// CrowdShield — Central config
// Change PIPELINE_HOST to your machine's local WiFi IP when testing on a real device.
// Keep as localhost for Expo web / simulator on the same machine.

const PIPELINE_HOST = "localhost:8000";

export const WS_URL = `ws://${PIPELINE_HOST}/ws/risk-events`;
export const HTTP_URL = `http://${PIPELINE_HOST}`;
export const REPORT_URL = `${HTTP_URL}/report`;

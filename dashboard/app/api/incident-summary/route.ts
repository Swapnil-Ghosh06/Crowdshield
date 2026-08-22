import { NextResponse } from 'next/server'

async function fetchSummary() {
  const backendUrl = process.env.CROWDSHIELD_BACKEND_URL ?? 'http://localhost:8000'
  const res = await fetch(`${backendUrl}/ai/summary`)
  if (!res.ok) throw new Error(`Backend returned ${res.status}`)
  const data = await res.json()
  return NextResponse.json({
    text: `${data.summary_en}\n\n[हिंदी] ${data.summary_hi}\n\nSEVERITY LEVEL: ${data.risk_level?.toUpperCase() ?? 'UNKNOWN'}`
  })
}

export async function GET() {
  try {
    return await fetchSummary()
  } catch {
    return NextResponse.json({ error: 'Unable to generate incident summary.' }, { status: 500 })
  }
}

export async function POST() {
  try {
    return await fetchSummary()
  } catch {
    return NextResponse.json({ error: 'Unable to generate incident summary.' }, { status: 500 })
  }
}


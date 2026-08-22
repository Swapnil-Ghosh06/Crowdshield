import { generateText } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { snapshot, interventions, totalEvents } = await request.json()
    const result = await generateText({
      model: gateway('anthropic/claude-sonnet-4.6'),
      system: 'You are CrowdShield AI, an emergency crowd safety monitoring system. Be direct, clinical, and specific. Return exactly three short paragraphs, then a final line beginning SEVERITY LEVEL: with CRITICAL, HIGH, MODERATE, or LOW.',
      prompt: `Analyze this venue telemetry for authorities. Address current severity and zones needing attention, density/flow/ETA risk factors, and immediate recommended actions.\n\nZONE STATUS:\n${String(snapshot).slice(0, 12000)}\n\nINTERVENTIONS: ${String(interventions).slice(0, 3000)}\nTOTAL EVENTS: ${totalEvents}`,
      maxOutputTokens: 1000,
    })
    return NextResponse.json({ text: result.text })
  } catch (error) {
    return NextResponse.json({ error: 'Unable to generate incident summary.' }, { status: 500 })
  }
}

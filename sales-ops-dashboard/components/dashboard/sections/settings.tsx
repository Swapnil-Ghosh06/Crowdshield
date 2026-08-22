'use client'

import { useState } from 'react'
import { Bell, Check, Radio, Save, Shield, Wifi } from 'lucide-react'
import { useCrowdShield } from '@/lib/crowdshield/context'

export function SettingsSection() {
  const { connectionStatus, reconnect, simulateEvent } = useCrowdShield()
  const [wsUrl, setWsUrl] = useState('ws://localhost:8000/ws/risk-events')
  const [critical, setCritical] = useState('0.82')
  const [high, setHigh] = useState('0.68')
  const [medium, setMedium] = useState('0.42')
  const [autoSimulate, setAutoSimulate] = useState(true)
  const [multilingual, setMultilingual] = useState(true)
  const [voice, setVoice] = useState(true)
  const [saved, setSaved] = useState(false)
  function save() { setSaved(true); window.setTimeout(() => setSaved(false), 1800) }
  const input = (label: string, value: string, setValue: (value: string) => void, help: string) => <label className="block space-y-1"><span className="text-xs font-semibold text-foreground">{label}</span><span className="block text-xs text-muted-foreground">{help}</span><input value={value} onChange={(event) => setValue(event.target.value)} className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm font-mono focus:outline-none focus:border-accent" /></label>
  const toggle = (label: string, help: string, value: boolean, setValue: (value: boolean) => void) => <label className="flex items-center justify-between gap-4"><span><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground mt-1">{help}</span></span><input type="checkbox" checked={value} onChange={(event) => setValue(event.target.checked)} className="size-4 accent-accent" /></label>
  return <div className="space-y-6 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500"><div><h2 className="text-xl font-semibold">Settings</h2><p className="text-sm text-muted-foreground mt-1">Configure CrowdShield monitoring, thresholds, and operational features.</p></div><div className="grid gap-4 md:grid-cols-2">{[[Wifi, 'WebSocket Connection', <div className="space-y-4">{input('Backend WebSocket URL', wsUrl, setWsUrl, 'Python risk-events endpoint')}<button onClick={reconnect} className="px-3 py-2 rounded-lg bg-secondary border border-border text-xs font-semibold hover:border-accent">{connectionStatus === 'connected' ? 'Connected' : 'Reconnect'}</button></div>], [Shield, 'Risk Thresholds', <div className="space-y-4">{input('Critical threshold', critical, setCritical, 'Triggers critical alert')}{input('High threshold', high, setHigh, 'Triggers high alert')}{input('Medium threshold', medium, setMedium, 'Triggers medium alert')}</div>], [Radio, 'Simulation & Demo', <div className="space-y-4">{toggle('Auto-simulate offline', 'Keep the dashboard live when backend is unavailable.', autoSimulate, setAutoSimulate)}<button onClick={simulateEvent} className="px-3 py-2 rounded-lg bg-accent text-accent-foreground text-xs font-semibold">Fire Simulate Event</button></div>], [Bell, 'Bonus Features', <div className="space-y-4">{toggle('Multilingual broadcast ticker', 'Show English and Hindi announcements.', multilingual, setMultilingual)}{toggle('Voice command center', 'Enable spoken highest-risk status.', voice, setVoice)}</div>]].map(([Icon, title, content]) => <section key={title as string} className="bg-card border border-border rounded-xl p-5"><div className="flex items-center gap-2 mb-4 pb-3 border-b border-border"><Icon className="w-4 h-4 text-accent" /><h3 className="text-sm font-semibold">{title as string}</h3></div>{content}</section>)}</div><button onClick={save} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-semibold">{saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}{saved ? 'Saved' : 'Save Settings'}</button></div>
}

'use client'

import React, { useState } from 'react'
import { Bell, Check, Radio, Save, Shield, Wifi } from 'lucide-react'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { useCrowdShieldSettings } from '@/lib/crowdshield/settings-context'

export function SettingsSection() {
  const { connectionStatus, reconnect, simulateEvent } = useCrowdShield()
  const {
    wsUrl,
    setWsUrl,
    criticalThreshold,
    setCriticalThreshold,
    highThreshold,
    setHighThreshold,
    mediumThreshold,
    setMediumThreshold,
    autoSimulate,
    setAutoSimulate,
    multilingualTickerEnabled,
    setMultilingualTickerEnabled,
    voiceCommandEnabled,
    setVoiceCommandEnabled,
  } = useCrowdShieldSettings()

  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div className="space-y-6 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure CrowdShield monitoring, thresholds, and operational features.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* WebSocket Connection */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
            <Wifi className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold">WebSocket Connection</h3>
          </div>
          <div className="space-y-4">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-foreground">Backend WebSocket URL</span>
              <span className="block text-xs text-muted-foreground">Python risk-events endpoint</span>
              <input
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm font-mono focus:outline-none focus:border-accent"
              />
            </label>
            <button
              type="button"
              onClick={reconnect}
              className="px-3 py-2 rounded-lg bg-secondary border border-border text-xs font-semibold hover:border-accent"
            >
              {connectionStatus === 'connected' ? 'Connected' : 'Reconnect'}
            </button>
          </div>
        </section>

        {/* Risk Thresholds */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
            <Shield className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold">Risk Thresholds</h3>
          </div>
          <div className="space-y-4">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-foreground">Critical threshold</span>
              <span className="block text-xs text-muted-foreground">Triggers critical alert</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={criticalThreshold}
                onChange={(e) => setCriticalThreshold(parseFloat(e.target.value) || 0)}
                className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm font-mono focus:outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-foreground">High threshold</span>
              <span className="block text-xs text-muted-foreground">Triggers high alert</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={highThreshold}
                onChange={(e) => setHighThreshold(parseFloat(e.target.value) || 0)}
                className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm font-mono focus:outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-foreground">Medium threshold</span>
              <span className="block text-xs text-muted-foreground">Triggers medium alert</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={mediumThreshold}
                onChange={(e) => setMediumThreshold(parseFloat(e.target.value) || 0)}
                className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm font-mono focus:outline-none focus:border-accent"
              />
            </label>
          </div>
        </section>

        {/* Simulation & Demo */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
            <Radio className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold">Simulation & Demo</h3>
          </div>
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <span>
                <span className="block text-sm font-medium">Auto-simulate offline</span>
                <span className="block text-xs text-muted-foreground mt-1">
                  Keep the dashboard live when backend is unavailable.
                </span>
              </span>
              <input
                type="checkbox"
                checked={autoSimulate}
                onChange={(e) => setAutoSimulate(e.target.checked)}
                className="size-4 accent-accent"
              />
            </label>
            <button
              type="button"
              onClick={() => simulateEvent()}
              className="px-3 py-2 rounded-lg bg-accent text-accent-foreground text-xs font-semibold"
            >
              Fire Simulate Event
            </button>
          </div>
        </section>

        {/* Bonus Features */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
            <Bell className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold">Bonus Features</h3>
          </div>
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <span>
                <span className="block text-sm font-medium">Multilingual broadcast ticker</span>
                <span className="block text-xs text-muted-foreground mt-1">
                  Show English and Hindi announcements.
                </span>
              </span>
              <input
                type="checkbox"
                checked={multilingualTickerEnabled}
                onChange={(e) => setMultilingualTickerEnabled(e.target.checked)}
                className="size-4 accent-accent"
              />
            </label>
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <span>
                <span className="block text-sm font-medium">Voice command center</span>
                <span className="block text-xs text-muted-foreground mt-1">
                  Enable spoken highest-risk status.
                </span>
              </span>
              <input
                type="checkbox"
                checked={voiceCommandEnabled}
                onChange={(e) => setVoiceCommandEnabled(e.target.checked)}
                className="size-4 accent-accent"
              />
            </label>
          </div>
        </section>
      </div>

      <button
        type="button"
        onClick={handleSave}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90 transition-colors"
      >
        {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? 'Saved' : 'Save Settings'}
      </button>
    </div>
  )
}

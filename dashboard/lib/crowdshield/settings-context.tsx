'use client'

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface CrowdShieldSettings {
  wsUrl: string
  criticalThreshold: number
  highThreshold: number
  mediumThreshold: number
  autoSimulate: boolean
  multilingualTickerEnabled: boolean
  voiceCommandEnabled: boolean
}

export interface CrowdShieldSettingsContextValue extends CrowdShieldSettings {
  setWsUrl: (url: string) => void
  setCriticalThreshold: (val: number) => void
  setHighThreshold: (val: number) => void
  setMediumThreshold: (val: number) => void
  setAutoSimulate: (val: boolean) => void
  setMultilingualTickerEnabled: (val: boolean) => void
  setVoiceCommandEnabled: (val: boolean) => void
  updateSettings: (partial: Partial<CrowdShieldSettings>) => void
}

const STORAGE_KEY = 'crowdshield:settings'

const DEFAULT_SETTINGS: CrowdShieldSettings = {
  wsUrl: 'ws://localhost:8000/ws/risk-events',
  criticalThreshold: 0.82,
  highThreshold: 0.68,
  mediumThreshold: 0.42,
  autoSimulate: true,
  multilingualTickerEnabled: true,
  voiceCommandEnabled: true,
}

function loadInitialSettings(): CrowdShieldSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    return {
      wsUrl: typeof parsed.wsUrl === 'string' ? parsed.wsUrl : DEFAULT_SETTINGS.wsUrl,
      criticalThreshold: typeof parsed.criticalThreshold === 'number' ? parsed.criticalThreshold : DEFAULT_SETTINGS.criticalThreshold,
      highThreshold: typeof parsed.highThreshold === 'number' ? parsed.highThreshold : DEFAULT_SETTINGS.highThreshold,
      mediumThreshold: typeof parsed.mediumThreshold === 'number' ? parsed.mediumThreshold : DEFAULT_SETTINGS.mediumThreshold,
      autoSimulate: typeof parsed.autoSimulate === 'boolean' ? parsed.autoSimulate : DEFAULT_SETTINGS.autoSimulate,
      multilingualTickerEnabled: typeof parsed.multilingualTickerEnabled === 'boolean' ? parsed.multilingualTickerEnabled : DEFAULT_SETTINGS.multilingualTickerEnabled,
      voiceCommandEnabled: typeof parsed.voiceCommandEnabled === 'boolean' ? parsed.voiceCommandEnabled : DEFAULT_SETTINGS.voiceCommandEnabled,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

const CrowdShieldSettingsContext = createContext<CrowdShieldSettingsContextValue | null>(null)

export function CrowdShieldSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CrowdShieldSettings>(DEFAULT_SETTINGS)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const loaded = loadInitialSettings()
    setSettings(loaded)
    setInitialized(true)
  }, [])

  useEffect(() => {
    if (!initialized) return
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      } catch (err) {
        console.error('Failed to save crowdshield:settings to localStorage', err)
      }
    }
  }, [settings, initialized])

  const setWsUrl = (wsUrl: string) => setSettings(prev => ({ ...prev, wsUrl }))
  const setCriticalThreshold = (criticalThreshold: number) => setSettings(prev => ({ ...prev, criticalThreshold }))
  const setHighThreshold = (highThreshold: number) => setSettings(prev => ({ ...prev, highThreshold }))
  const setMediumThreshold = (mediumThreshold: number) => setSettings(prev => ({ ...prev, mediumThreshold }))
  const setAutoSimulate = (autoSimulate: boolean) => setSettings(prev => ({ ...prev, autoSimulate }))
  const setMultilingualTickerEnabled = (multilingualTickerEnabled: boolean) => setSettings(prev => ({ ...prev, multilingualTickerEnabled }))
  const setVoiceCommandEnabled = (voiceCommandEnabled: boolean) => setSettings(prev => ({ ...prev, voiceCommandEnabled }))
  const updateSettings = (partial: Partial<CrowdShieldSettings>) => setSettings(prev => ({ ...prev, ...partial }))

  const value: CrowdShieldSettingsContextValue = {
    ...settings,
    setWsUrl,
    setCriticalThreshold,
    setHighThreshold,
    setMediumThreshold,
    setAutoSimulate,
    setMultilingualTickerEnabled,
    setVoiceCommandEnabled,
    updateSettings,
  }

  return (
    <CrowdShieldSettingsContext.Provider value={value}>
      {children}
    </CrowdShieldSettingsContext.Provider>
  )
}

export function useCrowdShieldSettings(): CrowdShieldSettingsContextValue {
  const ctx = useContext(CrowdShieldSettingsContext)
  if (!ctx) {
    throw new Error('useCrowdShieldSettings must be used inside CrowdShieldSettingsProvider')
  }
  return ctx
}

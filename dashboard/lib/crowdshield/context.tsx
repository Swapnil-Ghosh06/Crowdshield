'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useRiskEvents, type UseRiskEventsReturn } from '@/hooks/use-risk-events'
import { useCrowdShieldSettings } from '@/lib/crowdshield/settings-context'

const CrowdShieldContext = createContext<UseRiskEventsReturn | null>(null)

export function CrowdShieldProvider({ children }: { children: ReactNode }) {
  const { wsUrl } = useCrowdShieldSettings()
  const value = useRiskEvents(wsUrl)
  return (
    <CrowdShieldContext.Provider value={value}>
      {children}
    </CrowdShieldContext.Provider>
  )
}

export function useCrowdShield(): UseRiskEventsReturn {
  const ctx = useContext(CrowdShieldContext)
  if (!ctx) throw new Error('useCrowdShield must be used inside CrowdShieldProvider')
  return ctx
}

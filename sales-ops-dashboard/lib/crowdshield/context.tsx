'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useRiskEvents, type UseRiskEventsReturn } from '@/hooks/use-risk-events'

const CrowdShieldContext = createContext<UseRiskEventsReturn | null>(null)

export function CrowdShieldProvider({ children }: { children: ReactNode }) {
  const value = useRiskEvents('ws://localhost:8000/ws/risk-events')
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

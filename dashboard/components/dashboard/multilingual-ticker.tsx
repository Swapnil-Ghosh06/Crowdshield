'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Volume2 } from 'lucide-react'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { useCrowdShieldSettings } from '@/lib/crowdshield/settings-context'
import { cn } from '@/lib/utils'

export function MultilingualTicker() {
  const { events } = useCrowdShield()
  const { multilingualTickerEnabled } = useCrowdShieldSettings()

  const announcements = useMemo(() => {
    const list: { id: string; zoneName: string; level: string; en: string; hi: string }[] = []
    events.forEach((event) => {
      if ((event.risk_level === 'high' || event.risk_level === 'critical') && event.announcement) {
        list.push({
          id: event.zone_id,
          zoneName: event.zone_name,
          level: event.risk_level,
          en: event.announcement.en,
          hi: event.announcement.hi,
        })
      }
    })

    if (list.length > 0) {
      return list
    }

    return [
      {
        id: 'nominal',
        zoneName: 'All Zones',
        level: 'low',
        en: 'All zones nominal',
        hi: 'सभी क्षेत्र सामान्य',
      },
    ]
  }, [events])

  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (announcements.length <= 1) {
      setCurrentIndex(0)
      return
    }

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length)
    }, 5000)

    return () => clearInterval(timer)
  }, [announcements.length])

  if (!multilingualTickerEnabled) {
    return null
  }

  const activeIndex = currentIndex < announcements.length ? currentIndex : 0
  const current = announcements[activeIndex]

  return (
    <div className="h-7 bg-secondary/30 border-b border-border px-6 flex items-center justify-between overflow-hidden shrink-0 z-20">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex items-center gap-1.5 shrink-0">
          <Volume2
            className={cn(
              'w-3.5 h-3.5',
              current.level === 'critical'
                ? 'text-destructive animate-pulse'
                : current.level === 'high'
                ? 'text-orange-500'
                : 'text-accent'
            )}
          />
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground hidden sm:inline" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Broadcast
          </span>
        </div>

        <div
          key={`${current.id}-${activeIndex}`}
          className="flex items-center gap-2 text-[11px] truncate min-w-0 animate-in fade-in slide-in-from-bottom-1 duration-300"
        >
          <span className="font-semibold text-foreground truncate min-w-0 flex-1">{current.en}</span>
          <span className="text-muted-foreground/60 select-none shrink-0">·</span>
          <span className="text-muted-foreground font-medium truncate min-w-0 flex-1">{current.hi}</span>
        </div>
      </div>

      {announcements.length > 1 && (
        <div className="flex items-center gap-1.5 shrink-0 pl-3">
          {announcements.map((_, i) => (
            <button
              type="button"
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300 cursor-pointer',
                i === activeIndex
                  ? current.level === 'critical'
                    ? 'w-3 bg-destructive'
                    : current.level === 'high'
                    ? 'w-3 bg-orange-500'
                    : 'w-3 bg-accent'
                  : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60'
              )}
              aria-label={`Go to announcement ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

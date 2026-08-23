"use client"

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Volume2,
  Radio,
  Send,
  AlertTriangle,
  CheckCircle2,
  Play,
  VolumeX,
  Languages,
  Layers,
  Sparkles,
} from 'lucide-react'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { cn } from '@/lib/utils'

export function BroadcastSection() {
  const { events, addIntervention } = useCrowdShield()
  const [selectedSector, setSelectedSector] = useState<string>('all')
  const [customEnglish, setCustomEnglish] = useState('')
  const [customHindi, setCustomHindi] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'critical' | 'normal'>('all')
  const [isPlayingId, setIsPlayingId] = useState<string | null>(null)
  const [dispatchedNotice, setDispatchedNotice] = useState<string | null>(null)

  // Collect all active announcements from high/critical events
  const broadcastList = events
    .filter((e) => e.announcement)
    .map((e) => ({
      id: e.zone_id,
      zoneName: e.zone_name,
      level: e.risk_level,
      en: e.announcement?.en ?? 'All clear.',
      hi: e.announcement?.hi ?? 'सभी क्षेत्र सुरक्षित हैं।',
      timestamp: e.timestamp,
    }))

  const filteredBroadcasts = broadcastList.filter((b) => {
    if (activeTab === 'critical') return b.level === 'critical' || b.level === 'high'
    if (activeTab === 'normal') return b.level === 'low' || b.level === 'medium'
    return true
  })

  const presets = [
    {
      title: 'Maintain Standard Flow',
      en: 'Please maintain a steady pace and follow ground marshal directions.',
      hi: 'कृपया अपनी गति सामान्य बनाए रखें और सुरक्षा निर्देशों का पालन करें।',
      severity: 'info',
    },
    {
      title: 'Emergency Open Gate 1',
      en: 'Gate 1 turnstiles fully open. Proceed through West Corridor immediately.',
      hi: 'गेट 1 पूरी तरह से खोल दिया गया है। कृपया पश्चिमी गलियारे का उपयोग करें।',
      severity: 'critical',
    },
    {
      title: 'Concourse Divert Vector',
      en: 'Central Concourse reaching capacity. Please use North Exit bypass.',
      hi: 'सेंट्रल कॉनकोर्स भर चुका है। कृपया उत्तरी निकास बाईपास का उपयोग करें।',
      severity: 'warning',
    },
    {
      title: 'Clear Exit Passageway',
      en: 'Keep all emergency exit routes clear. Do not stop near turnstiles.',
      hi: 'सभी आपातकालीन मार्गों को खाली रखें। टर्नस्टाइल के पास न रुकें।',
      severity: 'warning',
    },
  ]

  const handleQuickPreset = (preset: typeof presets[0]) => {
    setCustomEnglish(preset.en)
    setCustomHindi(preset.hi)
  }

  const handleDispatchCustom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customEnglish.trim()) return

    addIntervention({
      zone_id: selectedSector === 'all' ? 'VENUE_WIDE' : selectedSector,
      zone_name: selectedSector === 'all' ? 'All Sectors' : `Sector ${selectedSector}`,
      action: 'pa_alert',
      label: `PA Broadcast: "${customEnglish.slice(0, 24)}..."`,
    })

    setDispatchedNotice(`PA Announcement successfully broadcasted to ${selectedSector === 'all' ? 'all venue sectors' : selectedSector}!`)
    setCustomEnglish('')
    setCustomHindi('')
    setTimeout(() => setDispatchedNotice(null), 5000)
  }

  const togglePlayAudio = (id: string) => {
    if (isPlayingId === id) {
      setIsPlayingId(null)
    } else {
      setIsPlayingId(id)
      setTimeout(() => setIsPlayingId(null), 4000)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 select-none pb-12">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-[#44492B] text-[#FAF7F2] shadow-md">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2
                className="text-xl font-extrabold text-foreground tracking-tight"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                Public Address & PA Broadcast Console
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                Live venue-wide audio messaging & multi-lingual crowd guidance
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 flex items-center gap-1.5" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            8 PA Speakers Active
          </span>
        </div>
      </div>

      {/* Dispatch Success Alert Banner */}
      {dispatchedNotice && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-xs"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{dispatchedNotice}</span>
          </div>
          <span className="text-[10px] text-emerald-700 uppercase tracking-wider font-extrabold">DISPATCHED</span>
        </motion.div>
      )}

      {/* Main Grid: Custom Dispatcher + Preset Library */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Custom Broadcast Dispatcher Panel */}
        <div className="lg:col-span-7 bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h3
              className="text-sm font-bold text-foreground flex items-center gap-2"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              <Send className="w-4 h-4 text-accent" /> Custom PA Broadcast Dispatcher
            </h3>
            <span className="text-[11px] font-bold text-muted-foreground uppercase" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Live Audio Feed
            </span>
          </div>

          <form onSubmit={handleDispatchCustom} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Select Target Sector Node
              </label>
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-secondary/80 border border-border text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                <option value="all">ALL VENUE SECTORS (GLOBAL PA)</option>
                <option value="GATE_1">West Main Gate (Gate 1)</option>
                <option value="GATE_2">North Concourse (Gate 2)</option>
                <option value="GATE_3">South Arena Ramp (Gate 3)</option>
                <option value="GATE_4">East Promenade (Gate 4)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1 flex items-center justify-between" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                <span>English Broadcast Message</span>
                <span className="text-[10px] text-muted-foreground font-normal">Primary Speaker Feed</span>
              </label>
              <textarea
                value={customEnglish}
                onChange={(e) => setCustomEnglish(e.target.value)}
                placeholder="Enter English PA announcement text..."
                rows={2}
                className="w-full p-3 rounded-xl bg-secondary/60 border border-border text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1 flex items-center justify-between" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                <span className="flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-cyan-600" /> Hindi Announcement (हिंदी अनुवाद)
                </span>
                <span className="text-[10px] text-muted-foreground font-normal">Auto-Translated / Custom</span>
              </label>
              <textarea
                value={customHindi}
                onChange={(e) => setCustomHindi(e.target.value)}
                placeholder="हिंदी घोषणा पाठ दर्ज करें..."
                rows={2}
                className="w-full p-3 rounded-xl bg-secondary/60 border border-border text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <button
              type="submit"
              disabled={!customEnglish.trim()}
              className={cn(
                'w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md',
                customEnglish.trim()
                  ? 'bg-[#44492B] hover:bg-[#363a22] text-[#FAF7F2]'
                  : 'bg-secondary text-muted-foreground cursor-not-allowed opacity-60'
              )}
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              <Volume2 className="w-4 h-4" />
              Dispatch PA Announcement Now
            </button>
          </form>
        </div>

        {/* Quick Presets Library */}
        <div className="lg:col-span-5 bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-3">
              <h3
                className="text-sm font-bold text-foreground flex items-center gap-2"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                <Sparkles className="w-4 h-4 text-amber-500" /> One-Click PA Presets
              </h3>
              <span className="text-[10px] font-bold text-muted-foreground uppercase" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Instant Load
              </span>
            </div>

            <div className="space-y-2">
              {presets.map((p, idx) => (
                <div
                  key={idx}
                  onClick={() => handleQuickPreset(p)}
                  className="group p-3 rounded-xl bg-secondary/50 hover:bg-secondary border border-border/60 hover:border-accent/40 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-foreground group-hover:text-accent transition-colors" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                      {p.title}
                    </span>
                    <span
                      className={cn(
                        'text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border',
                        p.severity === 'critical'
                          ? 'bg-destructive/15 border-destructive/40 text-destructive'
                          : p.severity === 'warning'
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-700'
                          : 'bg-cyan-500/15 border-cyan-500/40 text-cyan-700'
                      )}
                      style={{ fontFamily: "'Montserrat', sans-serif" }}
                    >
                      {p.severity}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate font-medium">{p.en}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground font-medium text-center pt-2 border-t border-border/40">
            Click any preset to pre-fill English & Hindi broadcast scripts above.
          </p>
        </div>
      </div>

      {/* Live Multilingual Announcements Feed */}
      <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div>
            <h3
              className="text-sm font-bold text-foreground flex items-center gap-2"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              <Volume2 className="w-4 h-4 text-emerald-600" /> Active Venue Announcements Log
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              Real-time multilingual announcements cycling across PA speaker nodes
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {(['all', 'critical', 'normal'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer',
                  activeTab === tab
                    ? 'bg-[#44492B] text-[#FAF7F2]'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                )}
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredBroadcasts.map((b) => {
            const isPlaying = isPlayingId === b.id

            return (
              <div
                key={b.id}
                className={cn(
                  'p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4',
                  b.level === 'critical'
                    ? 'bg-rose-500/10 border-rose-500/30'
                    : b.level === 'high'
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-secondary/40 border-border/80'
                )}
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                      {b.zoneName} ({b.id})
                    </span>
                    <span
                      className={cn(
                        'text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border',
                        b.level === 'critical'
                          ? 'bg-destructive/20 border-destructive text-destructive'
                          : b.level === 'high'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-700'
                          : 'bg-emerald-500/20 border-emerald-500 text-emerald-700'
                      )}
                      style={{ fontFamily: "'Montserrat', sans-serif" }}
                    >
                      {b.level}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div className="bg-background/60 p-2.5 rounded-lg border border-border/60">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-0.5" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                        English Broadcast
                      </span>
                      <p className="text-foreground font-semibold">{b.en}</p>
                    </div>

                    <div className="bg-background/60 p-2.5 rounded-lg border border-border/60">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-0.5" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                        Hindi Broadcast (हिंदी)
                      </span>
                      <p className="text-foreground font-semibold">{b.hi}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={() => togglePlayAudio(b.id)}
                    className={cn(
                      'px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer',
                      isPlaying
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                        : 'bg-secondary hover:bg-secondary/80 border-border text-foreground'
                    )}
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    {isPlaying ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5 animate-pulse" /> Playing Audio...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" /> Test Audio
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

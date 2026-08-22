'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { toast } from 'sonner'
import { useCrowdShield } from '@/lib/crowdshield/context'
import { useCrowdShieldSettings } from '@/lib/crowdshield/settings-context'
import { cn } from '@/lib/utils'

export function VoiceCommandButton() {
  const { events } = useCrowdShield()
  const { voiceCommandEnabled } = useCrowdShieldSettings()

  const [isSupported, setIsSupported] = useState(true)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hasSpeech = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
    setIsSupported(hasSpeech)
  }, [])

  const speak = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.0
    utterance.pitch = 1.0
    window.speechSynthesis.speak(utterance)
  }

  const handleCommand = (rawTranscript: string) => {
    const transcript = rawTranscript.trim().toLowerCase()
    const eventList = Array.from(events.values())

    let response = ''

    if (
      transcript.includes('status') ||
      transcript.includes('highest risk') ||
      transcript.includes('current risk')
    ) {
      if (eventList.length === 0) {
        response = 'No zone data available yet.'
      } else {
        const atRisk = eventList.filter((e) => e.risk_level === 'high' || e.risk_level === 'critical')
        const sorted = [...eventList].sort((a, b) => b.risk_score - a.risk_score)
        const highest = sorted[0]
        response = `Current status: ${atRisk.length} zones at risk. Highest risk zone is ${highest.zone_name} at ${highest.risk_level} level, risk score ${highest.risk_score.toFixed(2)}.`
      }
    } else if (transcript.includes('critical zones') || transcript.includes('critical zone')) {
      const criticalZones = eventList.filter((e) => e.risk_level === 'critical')
      if (criticalZones.length === 0) {
        response = 'No zones are currently critical.'
      } else {
        const names = criticalZones.map((z) => z.zone_name).join(', ')
        response = `Critical zones: ${names}.`
      }
    } else if (
      transcript.includes('help') ||
      transcript.includes('commands') ||
      transcript.includes('command')
    ) {
      response = 'You can ask for current status, highest risk, or critical zones.'
    } else {
      response = "Sorry, I didn't understand that command. Say help to hear what I can do."
    }

    toast(`🎙️ "${rawTranscript}"`, {
      description: response,
      duration: 4000,
    })

    speak(response)
  }

  const stopListening = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore already stopped
      }
    }
    setIsListening(false)
  }

  const startListening = () => {
    if (typeof window === 'undefined' || !isSupported) return

    if (isListening) {
      stopListening()
      return
    }

    try {
      const SpeechRecognitionClass =
        window.SpeechRecognition || window.webkitSpeechRecognition

      if (!SpeechRecognitionClass) {
        setIsSupported(false)
        return
      }

      const recognition = new SpeechRecognitionClass()
      recognitionRef.current = recognition
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        setIsListening(true)
        timeoutRef.current = setTimeout(() => {
          stopListening()
        }, 6000)
      }

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        const transcript = event.results[0]?.[0]?.transcript || ''
        setIsListening(false)
        if (transcript) {
          handleCommand(transcript)
        } else {
          toast('No speech detected', { duration: 4000 })
        }
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setIsListening(false)
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          toast.error(`Voice error: ${event.error}`, { duration: 4000 })
        }
      }

      recognition.onend = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setIsListening(false)
      }

      recognition.start()
    } catch {
      setIsListening(false)
    }
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {
          // ignore
        }
      }
    }
  }, [])

  if (!voiceCommandEnabled) {
    return null
  }

  if (!isSupported) {
    return (
      <button
        type="button"
        disabled
        title="Voice commands not supported in this browser"
        aria-label="Voice commands not supported in this browser"
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground/40 cursor-not-allowed bg-secondary/30"
      >
        <MicOff className="w-5 h-5" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={startListening}
      title={isListening ? 'Listening... Speak your command' : 'Voice Command Center'}
      aria-label={isListening ? 'Listening... Speak your command' : 'Voice Command Center'}
      className={cn(
        'relative w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200',
        isListening
          ? 'bg-destructive/20 text-destructive ring-2 ring-destructive ring-offset-2 ring-offset-background animate-pulse'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      )}
    >
      <Mic className="w-5 h-5" />
      {isListening && (
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full animate-ping" />
      )}
    </button>
  )
}

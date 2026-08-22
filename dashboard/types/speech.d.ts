interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message?: string
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onaudiostart: ((this: SpeechRecognitionInstance, ev: Event) => any) | null
  onaudioend: ((this: SpeechRecognitionInstance, ev: Event) => any) | null
  onend: ((this: SpeechRecognitionInstance, ev: Event) => any) | null
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => any) | null
  onnomatch: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => any) | null
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => any) | null
  onsoundstart: ((this: SpeechRecognitionInstance, ev: Event) => any) | null
  onsoundend: ((this: SpeechRecognitionInstance, ev: Event) => any) | null
  onspeechstart: ((this: SpeechRecognitionInstance, ev: Event) => any) | null
  onspeechend: ((this: SpeechRecognitionInstance, ev: Event) => any) | null
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => any) | null
  abort(): void
  start(): void
  stop(): void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

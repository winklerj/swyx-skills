import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileImage,
  FolderSearch,
  GitBranch,
  Image as ImageIcon,
  Mic,
  MicOff,
  Monitor,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings2,
  Terminal,
  Trash2,
  Wrench,
} from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

type Role = 'assistant' | 'user' | 'tool'
type MessageKind = 'normal' | 'tool-call' | 'multimodal-input' | 'multimodal-output'

type MessageStats = {
  inputTokens?: number
  outputTokens?: number
  latencyMs?: number
}

type Attachment = {
  type: 'image' | 'audio' | 'chart'
  title: string
  detail: string
}

type ToolCall = {
  name: string
  status: 'running' | 'complete'
  durationMs: number
  args: string
  result: string
}

type MessageVariant = {
  label: string
  text: string
}

type Message = {
  id: string
  role: Role
  text: string
  kind?: MessageKind
  sentAt: string
  stats?: MessageStats
  attachment?: Attachment
  toolCall?: ToolCall
  variants?: MessageVariant[]
}

type Effort = 'Low' | 'xHigh'
type Mode = 'Plan' | 'Build'
type ToolName = 'Terminal' | 'File search' | 'Search'
type VoiceStatus = 'idle' | 'connecting' | 'live' | 'error'
type VoiceTurnState = 'silent' | 'speaking' | 'transcribing'
type SlideDirection = 'left' | 'right' | null

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

const now = new Date('2026-05-27T10:42:00')

const timeFor = (minutesAgo: number) => {
  const value = new Date(now)
  value.setMinutes(value.getMinutes() - minutesAgo)
  return value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const firstMessages: Message[] = [
  {
    id: 'seed-1',
    role: 'user',
    kind: 'multimodal-input',
    sentAt: timeFor(21),
    text: 'Can you answer the venue accessibility question? I attached the floor map screenshot from the event page.',
    stats: { inputTokens: 126 },
    attachment: { type: 'image', title: 'venue-map.png', detail: 'Annotated map, 1440 x 900' },
  },
  {
    id: 'seed-2',
    role: 'assistant',
    sentAt: timeFor(20),
    text: 'Yes. The public FAQ says the main hall, workshop rooms, and registration desk are step-free. I would answer with the access route first, then offer staff contact details for special accommodations.',
    stats: { inputTokens: 126, outputTokens: 64, latencyMs: 1180 },
    variants: [
      {
        label: 'Answer',
        text: 'Yes. The public FAQ says the main hall, workshop rooms, and registration desk are step-free. I would answer with the access route first, then offer staff contact details for special accommodations.',
      },
      {
        label: 'Cite',
        text: 'Source-backed answer: main hall, workshops, and registration are step-free. Mention the accessible entrance and link to the venue FAQ so the visitor can verify details.',
      },
      {
        label: 'Short',
        text: 'Yes. The venue supports step-free access for registration, the main hall, and workshops. Contact the events team for specific accommodation needs.',
      },
    ],
  },
  {
    id: 'seed-3',
    role: 'tool',
    kind: 'tool-call',
    sentAt: timeFor(19),
    text: 'Fetched the current FAQ section and matched it against the user screenshot.',
    stats: { inputTokens: 46, outputTokens: 31, latencyMs: 820 },
    toolCall: {
      name: 'file_search.search',
      status: 'complete',
      durationMs: 612,
      args: '{ "query": "venue accessibility step-free registration workshop rooms" }',
      result: '3 matching passages from conference-faq.md',
    },
  },
  {
    id: 'seed-4',
    role: 'user',
    sentAt: timeFor(17),
    text: 'Also summarize the refund policy, but keep it short enough for a floating website widget.',
    stats: { inputTokens: 42 },
  },
  {
    id: 'seed-5',
    role: 'assistant',
    kind: 'multimodal-output',
    sentAt: timeFor(16),
    text: 'Refunds are available until the early cutoff, transfers stay open longer, and sponsors should contact the events team directly. I generated a compact policy card because this is easier to scan in a public support widget.',
    stats: { inputTokens: 42, outputTokens: 78, latencyMs: 940 },
    attachment: { type: 'chart', title: 'Refund policy timeline', detail: 'Generated visual summary' },
  },
  {
    id: 'seed-6',
    role: 'assistant',
    sentAt: timeFor(14),
    text: 'Long chat lists still need a calm scroll contract: stable row keys, measured dynamic heights, a latest affordance, and no transcript jump when the bottom toolbar opens.',
    stats: { inputTokens: 96, outputTokens: 54, latencyMs: 760 },
    variants: [
      {
        label: 'Design',
        text: 'Long chat lists still need a calm scroll contract: stable row keys, measured dynamic heights, a latest affordance, and no transcript jump when the bottom toolbar opens.',
      },
      {
        label: 'Implement',
        text: 'Implementation checklist: stable IDs, measured virtual rows, fixed compact composer inset, overlay toolbar expansion, and follow-on-append only when already near latest.',
      },
      {
        label: 'Risk',
        text: 'Main risk: measuring toolbar height as layout can make the transcript jump. Keep the compact composer footprint reserved and animate extra controls upward as an overlay.',
      },
    ],
  },
  {
    id: 'seed-7',
    role: 'user',
    sentAt: timeFor(11),
    text: 'Show me a tool result and make sure the message has stats I can inspect.',
    stats: { inputTokens: 28 },
  },
  {
    id: 'seed-8',
    role: 'tool',
    kind: 'tool-call',
    sentAt: timeFor(10),
    text: 'Ran a terminal check for the local demo and captured build status.',
    stats: { inputTokens: 38, outputTokens: 22, latencyMs: 520 },
    toolCall: {
      name: 'terminal.run',
      status: 'complete',
      durationMs: 388,
      args: 'npm run build',
      result: 'TypeScript check and Vite build passed',
    },
  },
  {
    id: 'seed-9',
    role: 'assistant',
    sentAt: timeFor(9),
    text: 'Hover any message to reveal delete controls and operational metadata. Double-clicking a bubble also removes it, which is useful for fast transcript cleanup in demos.',
    stats: { inputTokens: 72, outputTokens: 49, latencyMs: 690 },
    variants: [
      {
        label: 'Actions',
        text: 'Hover any message to reveal delete controls and operational metadata. Double-clicking a bubble also removes it, which is useful for fast transcript cleanup in demos.',
      },
      {
        label: 'Swipe',
        text: 'Swipe assistant messages left or right to cycle between answer modes. This keeps alternate answers close to the response without adding permanent buttons to every row.',
      },
      {
        label: 'Touch',
        text: 'On touch devices, horizontal swipe can expose alternate answers while tap and scroll keep their normal behavior. Keep the gesture threshold high enough to avoid accidental changes.',
      },
    ],
  },
]

const replyScript = [
  'The composer can stay visually stable while the toolbar rises above it.',
  'Messages now carry time, token counts, latency, attachments, and tool call records.',
  'Hover exposes per-message controls without adding permanent clutter.',
  'Double-click deletes a row so transcript cleanup feels quick during testing.',
]

const makeResponseVariants = (text: string): MessageVariant[] => [
  {
    label: 'Answer',
    text,
  },
  {
    label: 'Actions',
    text: 'Action version: keep the compact composer fixed, let the toolbar expand upward as an overlay, preserve scroll anchoring, and expose row controls only on hover or swipe.',
  },
  {
    label: 'Short',
    text: 'Short version: reserve the composer space, animate tools upward, keep scroll position stable, and hide operational details until requested.',
  },
]

const makeAssistantStats = (step: number): MessageStats => ({
  inputTokens: 76,
  outputTokens: step * 18,
  latencyMs: 420 + step * 210,
})

const getRealtimeToken = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null
  const record = payload as Record<string, unknown>
  if (typeof record.value === 'string') return record.value
  const clientSecret = record.client_secret
  if (clientSecret && typeof clientSecret === 'object') {
    const value = (clientSecret as Record<string, unknown>).value
    if (typeof value === 'string') return value
  }
  return null
}

const extractRealtimeText = (data: Record<string, unknown>) => {
  const text = data.delta ?? data.text ?? data.transcript
  return typeof text === 'string' ? text : ''
}

function App() {
  const parentRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const audioFrameRef = useRef<number | null>(null)
  const lastAudioFrameRef = useRef(0)
  const transcriptFinalRef = useRef('')
  const transcriptInterimRef = useRef('')
  const voiceMessageIdRef = useRef<string | null>(null)
  const shouldFollowRef = useRef(true)
  const prependSnapshotRef = useRef<{ height: number; top: number } | null>(null)
  const streamTimerRef = useRef<number | null>(null)

  const [messages, setMessages] = useState<Message[]>(firstMessages)
  const [input, setInput] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState<Mode>('Plan')
  const [effort, setEffort] = useState<Effort>('Low')
  const [activeTool, setActiveTool] = useState<ToolName>('Search')
  const [showStats, setShowStats] = useState(true)
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle')
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [voiceTurnState, setVoiceTurnState] = useState<VoiceTurnState>('silent')
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [voiceLevel, setVoiceLevel] = useState(0)
  const [voiceBands, setVoiceBands] = useState<number[]>([0.12, 0.18, 0.14, 0.22, 0.16, 0.2, 0.15, 0.12])
  const [variantIndexById, setVariantIndexById] = useState<Record<string, number>>({})
  const [slideDirectionById, setSlideDirectionById] = useState<Record<string, SlideDirection>>({})
  const [isNearEnd, setIsNearEnd] = useState(true)
  const [isStreaming, setIsStreaming] = useState(false)

  const aggregateStats = useMemo(() => {
    const totals = messages.reduce(
      (acc, message) => {
        acc.input += message.stats?.inputTokens ?? 0
        acc.output += message.stats?.outputTokens ?? 0
        if (message.stats?.latencyMs) {
          acc.latency += message.stats.latencyMs
          acc.latencyCount += 1
        }
        return acc
      },
      { input: 0, output: 0, latency: 0, latencyCount: 0 },
    )
    return {
      tokens: totals.input + totals.output,
      input: totals.input,
      output: totals.output,
      averageLatency: totals.latencyCount ? Math.round(totals.latency / totals.latencyCount) : 0,
    }
  }, [messages])

  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const message = messages[index]
      if (message?.kind === 'tool-call') return 218
      if (message?.attachment) return 228
      return message?.role === 'user' ? 126 : 158
    },
    getItemKey: (index) => messages[index]?.id ?? index,
    overscan: 6,
  })

  const scrollToEnd = useCallback((behavior: ScrollBehavior = 'auto') => {
    const element = parentRef.current
    if (!element) return
    element.scrollTo({ top: element.scrollHeight, behavior })
  }, [])

  const updateNearEnd = useCallback(() => {
    const element = parentRef.current
    if (!element) return true
    const distance = element.scrollHeight - element.clientHeight - element.scrollTop
    const next = distance < 180
    setIsNearEnd(next)
    shouldFollowRef.current = next
    return next
  }, [])

  useLayoutEffect(() => {
    let frame = requestAnimationFrame(() => {
      scrollToEnd()
      frame = requestAnimationFrame(() => {
        scrollToEnd()
        updateNearEnd()
      })
    })
    const timeout = window.setTimeout(() => {
      scrollToEnd()
      updateNearEnd()
    }, 120)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }
  }, [scrollToEnd, updateNearEnd])

  useLayoutEffect(() => {
    const snapshot = prependSnapshotRef.current
    const element = parentRef.current
    if (!snapshot || !element) return
    const delta = element.scrollHeight - snapshot.height
    element.scrollTop = snapshot.top + delta
    prependSnapshotRef.current = null
    updateNearEnd()
  }, [messages.length, updateNearEnd])

  useEffect(() => {
    if (!shouldFollowRef.current) return
    const frame = requestAnimationFrame(() => {
      scrollToEnd()
      requestAnimationFrame(() => {
        scrollToEnd()
        updateNearEnd()
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [messages, scrollToEnd, updateNearEnd])

  useEffect(() => {
    return () => {
      if (streamTimerRef.current) window.clearInterval(streamTimerRef.current)
      dataChannelRef.current?.close()
      peerRef.current?.close()
      micStreamRef.current?.getTracks().forEach((track) => track.stop())
      if (audioFrameRef.current) cancelAnimationFrame(audioFrameRef.current)
      audioSourceRef.current?.disconnect()
      void audioContextRef.current?.close()
      remoteAudioRef.current?.remove()
    }
  }, [])

  const deleteMessage = (id: string) => {
    setMessages((current) => current.filter((message) => message.id !== id))
  }

  const cleanupMicMonitor = useCallback(() => {
    if (audioFrameRef.current) {
      cancelAnimationFrame(audioFrameRef.current)
      audioFrameRef.current = null
    }
    audioSourceRef.current?.disconnect()
    audioSourceRef.current = null
    void audioContextRef.current?.close()
    audioContextRef.current = null
    lastAudioFrameRef.current = 0
    setVoiceLevel(0)
    setVoiceBands([0.12, 0.18, 0.14, 0.22, 0.16, 0.2, 0.15, 0.12])
    setVoiceTurnState('silent')
  }, [])

  const refreshVoiceTranscript = useCallback(() => {
    const finalText = transcriptFinalRef.current.trim()
    const interimText = transcriptInterimRef.current.trim()
    setVoiceTranscript([finalText, interimText].filter(Boolean).join(' '))
  }, [])

  const updateStoredVoiceMessage = useCallback((text: string) => {
    const messageId = voiceMessageIdRef.current
    if (!messageId) return
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              text,
            }
          : message,
      ),
    )
  }, [])

  const startMicMonitor = useCallback(
    (stream: MediaStream) => {
      cleanupMicMonitor()
      const AudioContextCtor =
        window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextCtor) return

      const context = new AudioContextCtor()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.82
      source.connect(analyser)
      audioContextRef.current = context
      audioSourceRef.current = source
      const frequencyData = new Uint8Array(analyser.frequencyBinCount)

      const tick = (time: number) => {
        audioFrameRef.current = requestAnimationFrame(tick)
        if (time - lastAudioFrameRef.current < 72) return
        lastAudioFrameRef.current = time
        analyser.getByteFrequencyData(frequencyData)
        const sliceSize = Math.max(1, Math.floor(frequencyData.length / 8))
        const bands = Array.from({ length: 8 }, (_, index) => {
          const slice = frequencyData.slice(index * sliceSize, index * sliceSize + sliceSize)
          const average = slice.reduce((sum, value) => sum + value, 0) / Math.max(1, slice.length)
          return Math.max(0.08, Math.min(1, average / 156))
        })
        const level = bands.reduce((sum, value) => sum + value, 0) / bands.length
        setVoiceBands(bands)
        setVoiceLevel(level)
      }

      audioFrameRef.current = requestAnimationFrame(tick)
    },
    [cleanupMicMonitor],
  )

  const disconnectRealtimeVoice = useCallback(() => {
    dataChannelRef.current?.close()
    dataChannelRef.current = null
    peerRef.current?.close()
    peerRef.current = null
    micStreamRef.current?.getTracks().forEach((track) => track.stop())
    micStreamRef.current = null
    cleanupMicMonitor()
    remoteAudioRef.current?.remove()
    remoteAudioRef.current = null
    voiceMessageIdRef.current = null
    transcriptFinalRef.current = ''
    transcriptInterimRef.current = ''
    setVoiceTranscript('')
    setVoiceStatus('idle')
  }, [cleanupMicMonitor])

  const updateVoiceMessage = useCallback((text: string) => {
    const messageId = voiceMessageIdRef.current
    if (!messageId || !text.trim()) return
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              text: `${message.text}${text}`,
            }
          : message,
      ),
    )
  }, [])

  const connectRealtimeVoice = async () => {
    if (voiceStatus === 'live' || voiceStatus === 'connecting') {
      disconnectRealtimeVoice()
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceStatus('error')
      setVoiceError('Microphone access is not available in this browser.')
      return
    }

    const voiceMessageId = `voice-${Date.now()}`
    voiceMessageIdRef.current = voiceMessageId
    transcriptFinalRef.current = ''
    transcriptInterimRef.current = ''
    setVoiceStatus('connecting')
    setVoiceError(null)
    setVoiceTranscript('')
    setVoiceTurnState('silent')
    shouldFollowRef.current = updateNearEnd()
    setMessages((current) => [
      ...current,
      {
        id: voiceMessageId,
        role: 'assistant',
        kind: 'multimodal-output',
        sentAt: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        text: 'Realtime voice session connecting...',
        attachment: {
          type: 'audio',
          title: 'Live microphone',
          detail: 'WebRTC session pending',
        },
        stats: { inputTokens: 0, outputTokens: 0 },
      },
    ])

    try {
      const tokenResponse = await fetch('/api/realtime-token')
      const tokenPayload = await tokenResponse.json().catch(() => ({}))
      if (!tokenResponse.ok) {
        const error = tokenPayload && typeof tokenPayload.error === 'string' ? tokenPayload.error : 'Unable to create Realtime token.'
        throw new Error(error)
      }
      const ephemeralKey = getRealtimeToken(tokenPayload)
      if (!ephemeralKey) throw new Error('Realtime token response did not include a client secret.')

      const peer = new RTCPeerConnection()
      peerRef.current = peer

      const audio = document.createElement('audio')
      audio.autoplay = true
      remoteAudioRef.current = audio
      peer.ontrack = (event) => {
        audio.srcObject = event.streams[0]
      }

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStreamRef.current = micStream
      startMicMonitor(micStream)
      peer.addTrack(micStream.getAudioTracks()[0], micStream)

      const dataChannel = peer.createDataChannel('oai-events')
      dataChannelRef.current = dataChannel
      dataChannel.addEventListener('open', () => {
        dataChannel.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              audio: {
                input: {
                  transcription: { model: 'gpt-4o-transcribe' },
                  turn_detection: { type: 'server_vad' },
                },
              },
            },
          }),
        )
        setVoiceStatus('live')
        setMessages((current) =>
          current.map((message) =>
            message.id === voiceMessageId
              ? {
                  ...message,
                  text: 'Realtime voice is live. Speak into the microphone; model audio will play back through this page.',
                  attachment: { type: 'audio', title: 'Live microphone', detail: 'Connected to gpt-realtime-2' },
                }
              : message,
          ),
        )
      })
      dataChannel.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data) as Record<string, unknown>
          const type = String(data.type ?? '')
          if (type === 'error') {
            const message = data.error && typeof data.error === 'object' ? String((data.error as Record<string, unknown>).message ?? 'Realtime error') : 'Realtime error'
            setVoiceStatus('error')
            setVoiceError(message)
            return
          }
          if (type === 'input_audio_buffer.speech_started') {
            transcriptInterimRef.current = ''
            refreshVoiceTranscript()
            setVoiceTurnState('speaking')
            return
          }
          if (type === 'input_audio_buffer.speech_stopped') {
            setVoiceTurnState('transcribing')
            return
          }
          if (type === 'conversation.item.input_audio_transcription.delta') {
            transcriptInterimRef.current = `${transcriptInterimRef.current}${extractRealtimeText(data)}`
            refreshVoiceTranscript()
            return
          }
          if (type === 'conversation.item.input_audio_transcription.completed') {
            const transcript = typeof data.transcript === 'string' ? data.transcript : transcriptInterimRef.current
            if (transcript.trim()) {
              transcriptFinalRef.current = `${transcriptFinalRef.current} ${transcript}`.trim()
              transcriptInterimRef.current = ''
              refreshVoiceTranscript()
              updateStoredVoiceMessage(`Mic transcript: ${transcriptFinalRef.current}`)
            }
            setVoiceTurnState('silent')
            return
          }
          if (type === 'response.output_audio_transcript.delta' || type === 'response.audio_transcript.delta') {
            updateVoiceMessage(extractRealtimeText(data))
          }
        } catch {
          // Ignore non-JSON diagnostic events.
        }
      })

      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
      })
      if (!sdpResponse.ok) throw new Error(await sdpResponse.text())
      await peer.setRemoteDescription({ type: 'answer', sdp: await sdpResponse.text() })
    } catch (error) {
      disconnectRealtimeVoice()
      setVoiceStatus('error')
      setVoiceError(error instanceof Error ? error.message : 'Realtime voice failed.')
      setMessages((current) =>
        current.map((message) =>
          message.id === voiceMessageId
            ? {
                ...message,
                text: error instanceof Error ? error.message : 'Realtime voice failed.',
                attachment: { type: 'audio', title: 'Voice unavailable', detail: 'Check OPENAI_API_KEY and microphone permissions' },
              }
            : message,
        ),
      )
    }
  }

  const cycleAssistantVariant = (message: Message, direction: 'left' | 'right') => {
    if (!message.variants?.length) return
    setSlideDirectionById((current) => ({ ...current, [message.id]: direction }))
    setVariantIndexById((current) => {
      const previous = current[message.id] ?? 0
      const offset = direction === 'right' ? 1 : -1
      return {
        ...current,
        [message.id]: (previous + offset + message.variants!.length) % message.variants!.length,
      }
    })
    window.setTimeout(() => {
      setSlideDirectionById((current) => ({ ...current, [message.id]: null }))
    }, 180)
  }

  const loadOlder = () => {
    const element = parentRef.current
    if (!element) return
    prependSnapshotRef.current = { height: element.scrollHeight, top: element.scrollTop }
    const base = messages.length + Date.now()
    const older = Array.from({ length: 5 }, (_, index): Message => ({
      id: `older-${base}-${index}`,
      role: index % 2 === 0 ? 'assistant' : 'user',
      sentAt: timeFor(40 + index * 3),
      text:
        index % 2 === 0
          ? 'Older answer loaded above the viewport. The visible row should stay anchored instead of jumping when history is prepended.'
          : 'Earlier visitor follow-up about schedules, speakers, and venue access.',
      stats: index % 2 === 0 ? { inputTokens: 38, outputTokens: 47, latencyMs: 710 } : { inputTokens: 26 },
    }))
    setMessages((current) => [...older, ...current])
  }

  const appendToolNote = (tool: ToolName) => {
    setActiveTool(tool)
    shouldFollowRef.current = updateNearEnd()
    const toolMap: Record<ToolName, ToolCall> = {
      Terminal: {
        name: 'terminal.run',
        status: 'complete',
        durationMs: 431,
        args: 'npm run build',
        result: 'Build completed with 1,570 transformed modules',
      },
      'File search': {
        name: 'file_search.search',
        status: 'complete',
        durationMs: 276,
        args: '{ "query": "chat scroll bottom shelf virtualizer" }',
        result: 'Matched SKILL.md and demo source files',
      },
      Search: {
        name: 'web_search.query',
        status: 'complete',
        durationMs: 690,
        args: '{ "q": "TanStack Virtual chat anchoring" }',
        result: 'Found current chat virtualization guidance',
      },
    }
    setMessages((current) => [
      ...current,
      {
        id: `tool-${Date.now()}`,
        role: 'tool',
        kind: 'tool-call',
        sentAt: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        text: `${tool} ran from the bottom shelf while the composer stayed ready.`,
        stats: { inputTokens: 34, outputTokens: 29, latencyMs: toolMap[tool].durationMs },
        toolCall: toolMap[tool],
      },
    ])
  }

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (isStreaming) return
    const prompt = input.trim() || 'Show how the bottom shelf should behave while a response streams.'
    const assistantId = `assistant-${Date.now()}`
    shouldFollowRef.current = updateNearEnd()
    setInput('')
    setIsStreaming(true)
    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        sentAt: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        text: prompt,
        stats: { inputTokens: Math.max(18, Math.round(prompt.length / 3)) },
      },
      {
        id: assistantId,
        role: 'assistant',
        sentAt: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        text: '',
        stats: makeAssistantStats(0),
      },
    ])

    let step = 0
    streamTimerRef.current = window.setInterval(() => {
      step += 1
      const nextText = replyScript.slice(0, step).join(' ')
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                text: nextText,
                stats: makeAssistantStats(step),
                variants: step >= replyScript.length ? makeResponseVariants(nextText) : undefined,
              }
            : message,
        ),
      )
      if (step >= replyScript.length && streamTimerRef.current) {
        window.clearInterval(streamTimerRef.current)
        streamTimerRef.current = null
        setIsStreaming(false)
      }
    }, 650)
  }

  const toggleShelf = () => {
    shouldFollowRef.current = updateNearEnd()
    setExpanded((value) => !value)
  }

  const shelfTools = useMemo(
    () => [
      { name: 'Terminal' as const, icon: Terminal },
      { name: 'File search' as const, icon: FolderSearch },
      { name: 'Search' as const, icon: Search },
    ],
    [],
  )

  return (
    <main className="grid min-h-screen grid-cols-[minmax(320px,430px)_minmax(200px,250px)] place-content-center items-center gap-8 bg-[radial-gradient(circle_at_21%_18%,rgba(255,255,255,0.72),transparent_24%),radial-gradient(circle_at_78%_66%,rgba(65,102,139,0.24),transparent_28%),linear-gradient(132deg,#d4d0c1_0%,#f5f0e4_38%,#92a49b_39%,#e9e1d2_65%,#596760_100%)] p-8 font-['Avenir_Next',ui-rounded,system-ui,sans-serif] text-[#19201d] antialiased max-[760px]:block max-[760px]:p-0">
      <section className="relative h-[min(860px,calc(100vh-64px))] min-h-[640px] w-[min(100%,414px)] overflow-hidden rounded-[34px] border border-white/65 bg-[linear-gradient(180deg,rgba(251,249,243,0.96),rgba(239,235,225,0.92))] shadow-[0_44px_96px_rgba(25,31,28,0.30),inset_0_1px_rgba(255,255,255,0.78)] backdrop-blur-lg max-[760px]:h-screen max-[760px]:min-h-screen max-[760px]:w-screen max-[760px]:rounded-none max-[760px]:border-0" aria-label="Bottom command shelf chatbot demo">
        <header className="absolute inset-x-0 top-0 z-5 flex h-[86px] items-start justify-between bg-gradient-to-b from-[#fbf9f3] to-[#fbf9f300] px-[22px] pt-[19px]">
          <div>
            <span className="text-[9px] font-black uppercase text-[#8d7566]">Conference desk</span>
            <strong className="mt-px block text-sm">Operator Chat</strong>
          </div>
          <button
            className={cx(
              'grid size-8 place-items-center rounded-full bg-white/60 text-[#5a635e]',
              !showStats && 'bg-[#17211f] text-white',
            )}
            type="button"
            aria-label={showStats ? 'Hide token and latency stats' : 'Show token and latency stats'}
            aria-pressed={!showStats}
            onClick={() => setShowStats((value) => !value)}
          >
            <Settings2 size={16} />
          </button>
        </header>

        <div ref={parentRef} className="absolute inset-x-0 top-[86px] bottom-[156px] overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onScroll={updateNearEnd}>
          <button className="relative z-4 mx-auto mb-[18px] block w-fit rounded-full bg-white/85 px-3.5 py-2 text-[#48514b] shadow-[0_8px_22px_rgba(36,44,40,0.12)]" type="button" onClick={loadOlder}>
            Load earlier
          </button>
          <div className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() + 224 }}>
            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
              const message = messages[virtualItem.index]
              if (!message) return null
              return (
                <MessageRow
                  key={virtualItem.key}
                  message={message}
                  measure={rowVirtualizer.measureElement}
                  index={virtualItem.index}
                  y={virtualItem.start + 54}
                  showStats={showStats}
                  activeVariantIndex={variantIndexById[message.id] ?? 0}
                  slideDirection={slideDirectionById[message.id] ?? null}
                  onCycleVariant={cycleAssistantVariant}
                  onDelete={deleteMessage}
                />
              )
            })}
          </div>
        </div>

        {!isNearEnd && (
          <button className="absolute right-[22px] bottom-44 z-10 inline-flex items-center gap-2 rounded-full bg-[#17211f] px-3 py-2 text-white shadow-[0_12px_30px_rgba(22,31,28,0.28)]" type="button" onClick={() => scrollToEnd('smooth')}>
            <ArrowDown size={15} />
            Latest
          </button>
        )}

        <section className={cx(
          'absolute inset-x-3 bottom-3 z-9 flex flex-col gap-2.5 rounded-[28px] bg-[#fdfaf3]/95 p-2.5 shadow-[0_22px_52px_rgba(33,41,38,0.27),inset_0_1px_rgba(255,255,255,0.92)] backdrop-blur-2xl transition-[border-radius,transform,padding,background,box-shadow] duration-300',
          expanded && 'bg-[#fdfaf3]/98',
        )}>
          <button
            className={cx(
              'mx-auto inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-white/95 px-3 text-[#27312d] shadow-[0_10px_24px_rgba(34,42,38,0.15)] transition-all duration-300',
              expanded
                ? '-mt-[46px] max-h-8 translate-y-0 scale-100 py-1.5 opacity-100'
                : 'mt-0 max-h-0 translate-y-3 scale-95 py-0 opacity-0 pointer-events-none',
            )}
            type="button"
            onClick={toggleShelf}
            aria-hidden={!expanded}
            tabIndex={expanded ? 0 : -1}
          >
            <ChevronDown size={15} />
            Close toolbar
          </button>

          <form className="flex h-[108px] flex-col gap-2.5 transition-all duration-300" onSubmit={submit}>
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask, paste, attach, or run a tool..."
              aria-label="Message"
              className="w-full rounded-[18px] border-0 bg-transparent px-2.5 pt-2 pb-0 text-[#1b2421] outline-none placeholder:text-[#818a84]"
            />
            <div className="flex flex-wrap gap-2" aria-label="Attached multimodal inputs">
              <span className="inline-flex min-h-6 items-center gap-1.5 rounded-full bg-[#eef0ea] px-2 text-[11px] font-extrabold text-[#596660]">
                <Paperclip size={12} />
                floor-map.png
              </span>
              {voiceStatus === 'live' || voiceStatus === 'connecting' ? (
                <VoiceCapturePill
                  bands={voiceBands}
                  level={voiceLevel}
                  status={voiceStatus}
                  transcript={voiceTranscript}
                  turnState={voiceTurnState}
                />
              ) : (
                <span className="inline-flex min-h-6 items-center gap-1.5 rounded-full bg-[#eef0ea] px-2 text-[11px] font-extrabold text-[#596660]">
                  <Mic size={12} />
                  voice note
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="grid size-[34px] shrink-0 place-items-center rounded-full bg-[#e9ebe5] text-[#68726d] active:scale-95" aria-label="Attach context">
                <Plus size={18} />
              </button>
              <button
                type="button"
                className={cx('grid size-[34px] shrink-0 place-items-center rounded-full bg-[#e9ebe5] text-[#68726d] active:scale-95', expanded && 'bg-[#dce9fb] text-[#184f92]')}
                aria-label="Toggle tools"
                onClick={toggleShelf}
              >
                <Wrench size={17} />
              </button>
              <button type="button" className="h-[30px] rounded-full bg-[#151d1a] px-3 text-xs font-black text-white">
                GPT 5.5
              </button>
              <button
                type="button"
                className={cx(
                  'ml-auto grid size-[34px] place-items-center rounded-full text-[#68726d]',
                  voiceStatus === 'live' && 'bg-[#dff7e8] text-[#117347]',
                  voiceStatus === 'connecting' && 'animate-pulse bg-[#fff1cf] text-[#8b5e15]',
                  voiceStatus === 'error' && 'bg-[#ffe6df] text-[#a84432]',
                )}
                aria-label={voiceStatus === 'live' || voiceStatus === 'connecting' ? 'Stop realtime voice' : 'Start realtime voice'}
                onClick={connectRealtimeVoice}
              >
                {voiceStatus === 'live' || voiceStatus === 'connecting' ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button className="grid size-[34px] place-items-center rounded-full bg-[#dedfe5] text-[#4a5650]" type="submit" aria-label="Send message">
                {isStreaming ? <span className="size-2.5 animate-pulse rounded-full bg-[#1c7f5a]" /> : <ArrowUp size={19} />}
              </button>
            </div>
          </form>

          <div className={cx(
            'grid origin-bottom gap-2.5 overflow-hidden border-t transition-all duration-300',
            expanded
              ? 'max-h-[132px] translate-y-0 border-[#262d2a14] pt-2.5 opacity-100'
              : 'max-h-0 translate-y-4 border-transparent pt-0 opacity-0 pointer-events-none',
          )} aria-hidden={!expanded}>
            <div className={cx('flex flex-wrap items-center gap-2 transition-all duration-300', !expanded && 'translate-y-2 opacity-0')}>
              <SegmentedControl values={['Plan', 'Build']} value={mode} disabled={!expanded} onChange={(value) => setMode(value as Mode)} />
              <SegmentedControl values={['Low', 'xHigh']} value={effort} disabled={!expanded} onChange={(value) => setEffort(value as Effort)} />
              <span className="inline-flex min-h-[29px] items-center gap-1.5 rounded-full bg-[#101512] px-2.5 text-xs text-[#d4dbd7]">
                <Monitor size={14} />
                M2 Air
              </span>
              <span className="inline-flex min-h-[29px] items-center gap-1.5 rounded-full bg-[#101512] px-2.5 text-xs text-[#d4dbd7]">
                <GitBranch size={13} />
                main
              </span>
              <span className="inline-flex size-[33px] items-center justify-center rounded-full border-2 border-[#e4decf] bg-[#101512] text-xs font-black text-white">85</span>
            </div>

            <div className={cx('grid grid-cols-3 gap-1.5 transition-all duration-300', !expanded && 'translate-y-4 opacity-0')}>
              {shelfTools.map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  type="button"
                  className={cx(
                    'flex h-[50px] min-w-0 flex-col items-center justify-center gap-1 rounded-[14px] bg-[#050706] text-[11px] text-[#c8d0cb] active:scale-95',
                    activeTool === name && 'outline outline-1 outline-[#b8ffde]/50 text-[#f1fff8]',
                  )}
                  disabled={!expanded}
                  onClick={() => appendToolNote(name)}
                >
                  <Icon size={17} />
                  <span>{name}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </section>

      <aside className="grid w-[242px] grid-cols-[1fr_auto] items-center gap-x-3.5 gap-y-2 rounded-3xl bg-[#fffbf2]/60 p-4.5 text-[#202925] shadow-[inset_0_1px_rgba(255,255,255,0.72),0_24px_58px_rgba(27,34,31,0.18)] backdrop-blur-lg max-[760px]:hidden">
        <div className="col-span-full flex items-end justify-between border-b border-[#242c281a] pb-1.5">
          <span className="text-[11px] font-black uppercase text-[#6f6255]">Settings</span>
          <strong className="text-base">Run Stats</strong>
        </div>
        <StatLine label="Mode" value={mode} />
        <StatLine label="Effort" value={effort} />
        <StatLine label="Tool" value={activeTool} />
        <StatLine label="Voice" value={voiceStatus} valueClassName={cx('font-mono text-xs font-semibold', voiceStatus === 'error' ? 'text-[#9b3d2f]' : 'text-[#5c665f]')} />
        {voiceError && (
          <span className="col-span-full rounded-xl bg-[#fff1e8]/70 px-3 py-2 font-mono text-[10px] leading-snug text-[#8a4a36]">
            {voiceError}
          </span>
        )}
        <div className="col-span-full flex items-center justify-between rounded-2xl bg-white/35 px-2.5 py-2">
          <span className="text-[11px] font-black uppercase text-[#6f6255]">Show stats</span>
          <button
            className={cx(
              'relative h-6 w-11 rounded-full transition-colors',
              showStats ? 'bg-[#17211f]' : 'bg-[#cfc8b9]',
            )}
            type="button"
            aria-pressed={showStats}
            onClick={() => setShowStats((value) => !value)}
          >
            <span
              className={cx(
                'absolute top-1 size-4 rounded-full bg-white shadow-sm transition-transform',
                showStats ? 'translate-x-[22px]' : 'translate-x-1',
              )}
            />
          </button>
        </div>
        {showStats ? (
          <>
            <StatLine label="Tokens" value={aggregateStats.tokens.toLocaleString()} valueClassName="font-mono text-[11px] font-medium text-[#69756e]" />
            <div className="col-span-full grid grid-cols-2 gap-2">
              <span className="rounded-xl bg-white/30 p-2 text-center font-mono text-[10px] font-normal text-[#717b75]">{aggregateStats.input} input</span>
              <span className="rounded-xl bg-white/30 p-2 text-center font-mono text-[10px] font-normal text-[#717b75]">{aggregateStats.output} output</span>
            </div>
            <StatLine label="Avg latency" value={`${aggregateStats.averageLatency}ms`} valueClassName="font-mono text-[11px] font-medium text-[#69756e]" />
          </>
        ) : (
          <span className="col-span-full rounded-xl bg-white/25 px-3 py-2 font-mono text-[10px] text-[#7f8781]">
            token and latency display hidden
          </span>
        )}
        <StatLine label="Rows" value={messages.length.toString()} />
        <button className="col-span-full inline-flex h-[38px] items-center justify-center gap-2 rounded-full bg-[#17211f] text-white" type="button" onClick={() => inputRef.current?.focus()}>
          Focus composer
          <Send size={14} />
        </button>
      </aside>
    </main>
  )
}

function MessageRow({
  message,
  index,
  y,
  showStats,
  activeVariantIndex,
  slideDirection,
  measure,
  onCycleVariant,
  onDelete,
}: {
  message: Message
  index: number
  y: number
  showStats: boolean
  activeVariantIndex: number
  slideDirection: SlideDirection
  measure: (node: Element | null) => void
  onCycleVariant: (message: Message, direction: 'left' | 'right') => void
  onDelete: (id: string) => void
}) {
  const pointerStartX = useRef<number | null>(null)
  const variant = message.variants?.[activeVariantIndex]
  const renderedText = variant?.text ?? message.text
  const canCycle = message.role === 'assistant' && !!message.variants?.length

  return (
    <article
      className={cx(
        'group absolute left-0 top-0 w-full pb-5',
        message.role === 'user' ? 'pl-[74px] pr-[22px] max-[760px]:pl-[62px] max-[760px]:pr-4' : 'pl-[22px] pr-[54px] max-[760px]:px-4',
      )}
      ref={measure}
      data-index={index}
      onDoubleClick={() => onDelete(message.id)}
      onPointerDown={(event) => {
        if (canCycle) pointerStartX.current = event.clientX
      }}
      onPointerUp={(event) => {
        if (!canCycle || pointerStartX.current === null) return
        const delta = event.clientX - pointerStartX.current
        pointerStartX.current = null
        if (Math.abs(delta) > 54) onCycleVariant(message, delta < 0 ? 'right' : 'left')
      }}
      style={{ transform: `translateY(${y}px)` }}
    >
      <div
        className={cx(
          'relative rounded-[22px] border p-[14px_15px_12px] shadow-[0_12px_32px_rgba(37,43,39,0.09),inset_0_1px_rgba(255,255,255,0.78)]',
          message.role === 'user' && 'border-white/10 bg-gradient-to-br from-[#17211f] to-[#26362f] text-[#f7f3e9]',
          message.role === 'assistant' && 'border-white/60 bg-[#fffaf0] text-[#26302b]',
          message.role === 'tool' && 'border-[#28775a38] bg-[#edf8f1] text-[#26302b]',
          message.kind === 'multimodal-input' && 'border-[#bb763f40] bg-[#fff3df]',
          message.kind === 'multimodal-output' && 'border-[#4a68a838] bg-[#eef3ff]',
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className={cx('text-[10px] font-black uppercase text-[#7f7060]', message.role === 'user' && 'text-white/65')}>
            {message.role === 'user' ? 'Visitor' : message.role}
          </span>
          <div className="flex items-center gap-2">
            {variant && <span className="rounded-full bg-[#18201d0d] px-2 py-0.5 text-[10px] font-black text-[#7f7060]">{variant.label}</span>}
            <time className={cx('shrink-0 text-[11px] font-bold text-[#8b928e]', message.role === 'user' && 'text-white/60')}>{message.sentAt}</time>
          </div>
        </div>
        {canCycle && (
          <div className="pointer-events-none absolute inset-y-0 -left-3 -right-3 flex items-center justify-between opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
            <button
              className="grid size-7 place-items-center rounded-full bg-white/90 text-[#52615a] shadow-[0_8px_20px_rgba(37,43,39,0.16)]"
              type="button"
              aria-label="Previous response variant"
              onClick={(event) => {
                event.stopPropagation()
                onCycleVariant(message, 'left')
              }}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              className="grid size-7 place-items-center rounded-full bg-white/90 text-[#52615a] shadow-[0_8px_20px_rgba(37,43,39,0.16)]"
              type="button"
              aria-label="Next response variant"
              onClick={(event) => {
                event.stopPropagation()
                onCycleVariant(message, 'right')
              }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}
        <p
          className={cx(
            'm-0 text-sm leading-[1.55] transition-transform duration-200',
            slideDirection === 'left' && '-translate-x-2',
            slideDirection === 'right' && 'translate-x-2',
          )}
        >
          {renderedText || 'Thinking...'}
        </p>
        {message.attachment && <AttachmentCard attachment={message.attachment} />}
        {message.toolCall && <ToolCallCard call={message.toolCall} />}
        {showStats && (
          <div className={cx('mt-3 flex flex-wrap gap-2 font-mono text-[10px] font-normal text-[#909a94]', message.role === 'user' && 'text-white/45')}>
            <span className="px-0.5">{message.stats?.inputTokens ?? 0} in</span>
            <span className="px-0.5">{message.stats?.outputTokens ?? 0} out</span>
            <span className="px-0.5">{message.stats?.latencyMs ? `${message.stats.latencyMs}ms` : 'queued'}</span>
          </div>
        )}
        <button
          className="pointer-events-none absolute right-[-13px] top-2 grid size-7 translate-y-1 scale-95 place-items-center rounded-full bg-[#fff4ed] text-[#7b4038] opacity-0 shadow-[0_10px_22px_rgba(63,43,34,0.16)] transition-all duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 focus:pointer-events-auto focus:translate-y-0 focus:scale-100 focus:opacity-100"
          type="button"
          aria-label="Delete message"
          onClick={(event) => {
            event.stopPropagation()
            onDelete(message.id)
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </article>
  )
}

function AttachmentCard({ attachment }: { attachment: Attachment }) {
  const Icon = attachment.type === 'image' ? FileImage : attachment.type === 'audio' ? Mic : BarChart3
  return (
    <div className="mt-3 grid min-h-[92px] grid-cols-[86px_1fr] items-center gap-3 rounded-2xl border border-white/60 bg-white/55 p-2.5">
      <div className={cx('relative grid h-[74px] place-items-center overflow-hidden rounded-[13px] text-[#fffaf0]', attachment.type === 'chart' ? 'bg-gradient-to-br from-[#344e7a] to-[#c17c45]' : 'bg-gradient-to-br from-[#1a2522] to-[#5b7593]')}>
        <Icon size={18} />
        {attachment.type === 'chart' && (
          <div className="absolute inset-x-3 bottom-3 grid h-7 grid-cols-3 items-end gap-1.5" aria-hidden="true">
            <span className="block h-[36%] rounded-t-md bg-white/80" />
            <span className="block h-[72%] rounded-t-md bg-white/80" />
            <span className="block h-[54%] rounded-t-md bg-white/80" />
          </div>
        )}
        {attachment.type === 'image' && <ImageIcon size={38} />}
      </div>
      <div>
        <strong className="block text-xs">{attachment.title}</strong>
        <span className="mt-1 block text-[11px] font-bold text-[#6d7772]">{attachment.detail}</span>
      </div>
    </div>
  )
}

function VoiceCapturePill({
  bands,
  level,
  status,
  transcript,
  turnState,
}: {
  bands: number[]
  level: number
  status: VoiceStatus
  transcript: string
  turnState: VoiceTurnState
}) {
  const isActive = turnState === 'speaking' || level > 0.2
  const label = status === 'connecting' ? 'connecting' : turnState === 'transcribing' ? 'transcribing' : isActive ? 'speaking' : 'silence'
  return (
    <span className="inline-flex min-h-6 min-w-0 max-w-full flex-1 items-center gap-2 rounded-full bg-[#17211f] px-2.5 text-[11px] text-[#dbe7e1] shadow-[inset_0_1px_rgba(255,255,255,0.10)]">
      <span className="relative grid size-4 shrink-0 place-items-center rounded-full bg-[#dff7e8]/12 text-[#a9efc8]">
        <Mic size={10} />
        <span className={cx('absolute inset-0 rounded-full border border-[#a9efc8]/45', isActive && 'animate-ping')} />
      </span>
      <span className="flex h-4 shrink-0 items-end gap-0.5" aria-label={`Voice activity: ${label}`}>
        {bands.map((band, index) => (
          <span
            key={`${index}-${band.toFixed(2)}`}
            className={cx(
              'w-1 rounded-full transition-all duration-100',
              isActive ? 'bg-[#a9efc8]' : 'bg-[#6f7f78]',
            )}
            style={{ height: `${Math.max(3, Math.round(band * 15))}px` }}
          />
        ))}
      </span>
      <span className={cx('shrink-0 font-mono text-[9px] uppercase tracking-[0.08em]', isActive ? 'text-[#a9efc8]' : 'text-[#91a099]')}>{label}</span>
      <span className="min-w-0 flex-1 truncate font-medium text-[#eef6f1]">
        {transcript || (status === 'connecting' ? 'opening realtime mic...' : 'listening...')}
      </span>
    </span>
  )
}

function ToolCallCard({ call }: { call: ToolCall }) {
  return (
    <div className="mt-3 rounded-[15px] bg-[#0d1613] p-3 text-[#dce9e3]">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
        <span className="rounded-full bg-[#9ff0c2] px-2 py-1 text-[10px] font-black uppercase text-[#11251d]">{call.status}</span>
        <strong className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs">{call.name}</strong>
        <small className="font-extrabold text-[#9fb1a9]">{call.durationMs}ms</small>
      </div>
      <code className="mt-2 block overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[#c6ddff]">{call.args}</code>
      <p className="mt-2 text-xs text-[#b7c8c0]">{call.result}</p>
    </div>
  )
}

function StatLine({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <>
      <span className="text-[11px] font-black uppercase text-[#6f6255]">{label}</span>
      <strong className={cx('text-sm text-[#16201c]', valueClassName)}>{value}</strong>
    </>
  )
}

function SegmentedControl({
  values,
  value,
  disabled = false,
  onChange,
}: {
  values: string[]
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="inline-flex gap-0.5 rounded-full bg-[#101512] p-1">
      {values.map((item) => (
        <button
          key={item}
          type="button"
          className={cx('h-7 min-w-12 rounded-full bg-transparent text-xs font-black text-[#aab1ad]', item === value && 'bg-[#2c332f] text-white')}
          disabled={disabled}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  )
}

export default App

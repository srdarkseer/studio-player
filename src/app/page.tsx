"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, Heart, Share, Repeat, Shuffle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

/**
 * Audio Effects Configuration Interface
 * Defines all available audio processing parameters with their acceptable ranges
 */
interface AudioEffects {
  /** Playback speed multiplier (0.5x to 2.0x) */
  speed: number
  /** Pitch shift in semitones (-12 to +12) */
  pitch: number
  /** Reverb wet/dry mix percentage (0-100%) */
  reverb: number
  /** Distortion amount percentage (0-100%) */
  distortion: number
  /** Low-pass filter cutoff frequency in Hz (200-20000) */
  lowPass: number
  /** High-pass filter cutoff frequency in Hz (20-2000) */
  highPass: number
  /** Overall gain multiplier (0.1x to 3.0x) */
  gain: number
  /** Bass EQ adjustment in dB (-20 to +20) */
  bass: number
  /** Mid-range EQ adjustment in dB (-20 to +20) */
  mid: number
  /** Treble EQ adjustment in dB (-20 to +20) */
  treble: number
  /** Master volume level (0.0 to 1.0) */
  volume: number
}

/**
 * Track Information Interface
 * Contains metadata about the currently playing track
 */
interface TrackInfo {
  title: string
  artist: string
  album: string
  genre: string
  duration: string
  year: number
}

/**
 * Audio Context References Interface
 * Centralizes all Web Audio API node references for better management
 */
interface AudioNodes {
  context: AudioContext | null
  source: MediaElementAudioSourceNode | null
  gainNode: GainNode | null
  analyser: AnalyserNode | null
  eqFilters: BiquadFilterNode[]
  lowPassFilter: BiquadFilterNode | null
  highPassFilter: BiquadFilterNode | null
  distortionNode: WaveShaperNode | null
  reverbNode: ConvolverNode | null
  reverbDryGain: GainNode | null
  reverbWetGain: GainNode | null
}

/**
 * Default Audio Effects Configuration
 * Represents the neutral/baseline state for all audio processing
 * These values provide optimal playback without any modifications
 */
const DEFAULT_EFFECTS: Readonly<AudioEffects> = {
  speed: 1.0,        // Normal playback speed
  pitch: 0,          // No pitch adjustment
  reverb: 0,         // No reverb effect
  distortion: 0,     // No distortion
  lowPass: 20000,    // Full frequency range (no low-pass filtering)
  highPass: 20,      // Full frequency range (no high-pass filtering)
  gain: 1.0,         // Unity gain (no amplification)
  bass: 0,           // Flat bass response
  mid: 0,            // Flat mid-range response
  treble: 0,         // Flat treble response
  volume: 0.8        // 80% volume for comfortable listening
} as const

/**
 * Track Metadata Configuration
 * Static information about the demo track being played
 */
const TRACK_INFO: Readonly<TrackInfo> = {
  title: "Love Yourz",
  artist: "J. Cole",
  album: "2014 Forest Hills Drive",
  genre: "Hip-Hop",
  duration: "3:31",
  year: 2014
} as const

/**
 * Audio Processing Constants
 * Configuration values for Web Audio API setup and processing
 */
const AUDIO_CONFIG = {
  /** FFT size for frequency analysis - higher values = more frequency resolution */
  FFT_SIZE: 1024,
  /** Analyser smoothing factor - higher values = smoother but less responsive */
  ANALYSER_SMOOTHING: 0.8,
  /** Number of waveform bars to display in the visualization */
  WAVEFORM_BARS: 200,
  /** Fallback duration in seconds if metadata fails to load */
  FALLBACK_DURATION: 211, // 3:31 in seconds
  /** Distortion curve sample rate for wave shaping */
  DISTORTION_SAMPLES: 44100,
  /** Reverb impulse response length in seconds */
  REVERB_LENGTH: 2,
  /** EQ filter frequencies in Hz [bass, mid, treble] */
  EQ_FREQUENCIES: [100, 1000, 10000] as const,
  /** Maximum waveform bar height in pixels */
  WAVEFORM_MAX_HEIGHT: 16,
  /** Waveform container padding in pixels */
  WAVEFORM_PADDING: 24
} as const

/**
 * Professional Music Player Component
 * 
 * A comprehensive audio player with real-time effects processing using Web Audio API.
 * Features include:
 * - Real-time audio effects (EQ, reverb, distortion, filters)
 * - Interactive waveform visualization with seeking
 * - Professional audio controls with precise parameter adjustment
 * - Responsive design with modern UI components
 * 
 * Architecture:
 * - Separation of concerns with dedicated functions for audio processing
 * - Proper error handling and loading states
 * - Memory management with cleanup on unmount
 * - Type-safe interfaces for all data structures
 * 
 * @returns The complete music player interface
 */
export default function MusicPlayer() {
  // ============================================================================
  // HYDRATION SAFETY
  // ============================================================================
  
  /** 
   * Hydration safety flag to prevent SSR/client mismatch
   * Ensures component only renders interactive content after hydration
   */
  const [isMounted, setIsMounted] = useState<boolean>(false)

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  /** Playback state management */
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [duration, setDuration] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  
  /** UI state management */
  const [isLiked, setIsLiked] = useState<boolean>(false)
  
  /** Audio processing state */
  const [effects, setEffects] = useState<AudioEffects>(DEFAULT_EFFECTS)
  const [staticWaveform, setStaticWaveform] = useState<number[]>([])

  // ============================================================================
  // REF MANAGEMENT
  // ============================================================================
  
  /** Core audio element reference */
  const audioRef = useRef<HTMLAudioElement>(null)
  
  /** Waveform UI interaction reference */
  const waveformContainerRef = useRef<HTMLDivElement>(null)
  
  /** Animation frame reference for cleanup */
  const animationRef = useRef<number | undefined>(undefined)
  
  /** Web Audio API nodes - centralized reference management */
  const audioNodesRef = useRef<AudioNodes>({
    context: null,
    source: null,
    gainNode: null,
    analyser: null,
    eqFilters: [],
    lowPassFilter: null,
    highPassFilter: null,
    distortionNode: null,
    reverbNode: null,
    reverbDryGain: null,
    reverbWetGain: null
  })

  // ============================================================================
  // HYDRATION SAFETY EFFECT
  // ============================================================================

  /**
   * Hydration safety effect
   * Sets mounted flag after component hydrates to prevent SSR/client mismatches
   * This fixes issues with browser extensions (like Grammarly) modifying the DOM
   */
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // ============================================================================
  // AUDIO PROCESSING UTILITIES
  // ============================================================================

  /**
   * Creates a distortion curve for the WaveShaper node
   * Uses mathematical wave shaping to create harmonic distortion
   * 
   * @param amount - Distortion intensity (0-100)
   * @returns Float32Array containing the distortion curve
   */
  const createDistortionCurve = useCallback((amount: number): Float32Array => {
    const curve = new Float32Array(AUDIO_CONFIG.DISTORTION_SAMPLES)
    const deg = Math.PI / 180
    
    for (let i = 0; i < AUDIO_CONFIG.DISTORTION_SAMPLES; i++) {
      const x = (i * 2) / AUDIO_CONFIG.DISTORTION_SAMPLES - 1
      // Asymptotic distortion formula for smooth harmonic distortion
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x))
    }
    
    return curve
  }, [])

  /**
   * Generates reverb impulse response using filtered white noise
   * Creates a natural-sounding reverb tail with exponential decay
   * 
   * @param audioContext - The audio context to create the buffer in
   * @returns Promise that resolves when reverb is configured
   */
  const createReverbImpulse = useCallback(async (audioContext: AudioContext): Promise<void> => {
    const length = audioContext.sampleRate * AUDIO_CONFIG.REVERB_LENGTH
    const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate)
    
    // Generate stereo reverb impulse with exponential decay
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        // White noise with exponential decay for natural reverb tail
        const decay = Math.pow(1 - i / length, 2)
        channelData[i] = (Math.random() * 2 - 1) * decay
      }
    }
    
    if (audioNodesRef.current.reverbNode) {
      audioNodesRef.current.reverbNode.buffer = impulse
    }
  }, [])

  /**
   * Generates a realistic static waveform visualization
   * Simulates the amplitude envelope of a typical song structure
   * 
   * @returns Array of normalized amplitude values (0-1)
   */
  const generateStaticWaveform = useCallback((): number[] => {
    const waveform: number[] = []
    
    for (let i = 0; i < AUDIO_CONFIG.WAVEFORM_BARS; i++) {
      const progress = i / AUDIO_CONFIG.WAVEFORM_BARS
      let amplitude = 1
      
      // Intro section - gradual build-up
      if (progress < 0.1) {
        amplitude = progress * 5
      }
      // Verse/build sections - moderate variation
      else if (progress < 0.3) {
        amplitude = 0.5 + Math.sin(progress * 10) * 0.3
      }
      // Chorus/main sections - high energy with variation
      else if (progress < 0.8) {
        amplitude = 0.7 + Math.sin(progress * 15) * 0.4 + Math.sin(progress * 5) * 0.2
      }
      // Outro - fade out
      else {
        amplitude = (1 - progress) * 4
      }
      
      // Add natural randomness and ensure valid range
      amplitude = amplitude * (0.8 + Math.random() * 0.4)
      amplitude = Math.max(0.1, Math.min(1, amplitude))
      
      waveform.push(amplitude)
    }
    
    return waveform
  }, [])

  // ============================================================================
  // AUDIO SYSTEM INITIALIZATION
  // ============================================================================

  /**
   * Initializes the complete Web Audio API processing chain
   * Sets up all audio nodes and their connections for real-time processing
   * 
   * Error handling ensures graceful degradation if Web Audio API is unavailable
   */
  useEffect(() => {
    const initializeAudioSystem = async (): Promise<void> => {
      if (!audioRef.current) {
        console.warn('Audio element not available for initialization')
        return
      }

      try {
        // Initialize Audio Context with fallback for older browsers
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        if (!AudioContextClass) {
          throw new Error('Web Audio API not supported in this browser')
        }

        const audioContext = new AudioContextClass()
        audioNodesRef.current.context = audioContext

        // Create media source from audio element
        audioNodesRef.current.source = audioContext.createMediaElementSource(audioRef.current)

        // Master gain control
        audioNodesRef.current.gainNode = audioContext.createGain()
        audioNodesRef.current.gainNode.gain.value = effects.volume * effects.gain

        // Real-time frequency analyser for visualizations
        audioNodesRef.current.analyser = audioContext.createAnalyser()
        audioNodesRef.current.analyser.fftSize = AUDIO_CONFIG.FFT_SIZE
        audioNodesRef.current.analyser.smoothingTimeConstant = AUDIO_CONFIG.ANALYSER_SMOOTHING
        
        // Three-band EQ system (Bass, Mid, Treble)
        audioNodesRef.current.eqFilters = AUDIO_CONFIG.EQ_FREQUENCIES.map((freq, index) => {
          const filter = audioContext.createBiquadFilter()
          filter.type = index === 0 ? 'lowshelf' : index === 1 ? 'peaking' : 'highshelf'
          filter.frequency.value = freq
          filter.Q.value = 1 // Reasonable Q factor for musical EQ
          return filter
        })

        // Frequency filtering nodes
        audioNodesRef.current.lowPassFilter = audioContext.createBiquadFilter()
        audioNodesRef.current.lowPassFilter.type = 'lowpass'
        audioNodesRef.current.lowPassFilter.frequency.value = effects.lowPass

        audioNodesRef.current.highPassFilter = audioContext.createBiquadFilter()
        audioNodesRef.current.highPassFilter.type = 'highpass'
        audioNodesRef.current.highPassFilter.frequency.value = effects.highPass

        // Harmonic distortion processor
        audioNodesRef.current.distortionNode = audioContext.createWaveShaper()
        audioNodesRef.current.distortionNode.curve = createDistortionCurve(effects.distortion)
        audioNodesRef.current.distortionNode.oversample = '4x' // High-quality oversampling

        // Reverb effect with dry/wet mixing
        audioNodesRef.current.reverbNode = audioContext.createConvolver()
        await createReverbImpulse(audioContext)

        // Reverb dry/wet gain controls for effect mixing
        audioNodesRef.current.reverbDryGain = audioContext.createGain()
        audioNodesRef.current.reverbWetGain = audioContext.createGain()

        // ========================================================================
        // AUDIO PROCESSING CHAIN CONSTRUCTION
        // ========================================================================
        
        let currentNode: AudioNode = audioNodesRef.current.source
        
        // 1. EQ Processing Chain
        audioNodesRef.current.eqFilters.forEach(filter => {
          currentNode.connect(filter)
          currentNode = filter
        })

        // 2. Frequency Filtering
        currentNode.connect(audioNodesRef.current.highPassFilter)
        currentNode = audioNodesRef.current.highPassFilter
        
        currentNode.connect(audioNodesRef.current.lowPassFilter)
        currentNode = audioNodesRef.current.lowPassFilter

        // 3. Harmonic Distortion
        currentNode.connect(audioNodesRef.current.distortionNode)
        currentNode = audioNodesRef.current.distortionNode

        // 4. Reverb Processing (parallel dry/wet paths)
        currentNode.connect(audioNodesRef.current.reverbDryGain)
        currentNode.connect(audioNodesRef.current.reverbNode)
        audioNodesRef.current.reverbNode.connect(audioNodesRef.current.reverbWetGain)
        
        // Configure initial reverb mix
        audioNodesRef.current.reverbDryGain.gain.value = 1 - effects.reverb / 100
        audioNodesRef.current.reverbWetGain.gain.value = effects.reverb / 100
        
        // 5. Final mixing and output
        audioNodesRef.current.reverbDryGain.connect(audioNodesRef.current.gainNode)
        audioNodesRef.current.reverbWetGain.connect(audioNodesRef.current.gainNode)
        
        audioNodesRef.current.gainNode.connect(audioNodesRef.current.analyser)
        audioNodesRef.current.analyser.connect(audioContext.destination)

        setIsLoading(false)
        console.log('Audio system initialized successfully')
        
      } catch (error) {
        console.error('Failed to initialize audio system:', error)
        setIsLoading(false)
        // Graceful degradation - basic playback will still work without effects
      }
    }

    initializeAudioSystem()

    // Cleanup function to prevent memory leaks
    return () => {
      const currentAnimationFrame = animationRef.current
      const currentAudioContext = audioNodesRef.current.context
      
      if (currentAnimationFrame) {
        cancelAnimationFrame(currentAnimationFrame)
      }
      
      // Clean up audio context if it exists
      if (currentAudioContext?.state === 'running') {
        currentAudioContext.close().catch(console.error)
      }
    }
  }, [createDistortionCurve, createReverbImpulse]) // Dependencies for audio system initialization

  // ============================================================================
  // WAVEFORM VISUALIZATION SETUP
  // ============================================================================

  /**
   * Generates the static waveform visualization
   * Only runs once to create a consistent visual representation
   */
  useEffect(() => {
    if (staticWaveform.length === 0) {
      setStaticWaveform(generateStaticWaveform())
    }
  }, [staticWaveform.length, generateStaticWaveform])

  // ============================================================================
  // AUDIO EFFECTS APPLICATION
  // ============================================================================

  /**
   * Applies all audio effects to the processing chain
   * Runs whenever effects state changes to maintain real-time responsiveness
   */
  useEffect(() => {
    if (!audioRef.current) return

    try {
      // Apply playback speed (affects pitch and tempo together)
      audioRef.current.playbackRate = effects.speed

      // Update master gain (volume * gain multiplier)
      if (audioNodesRef.current.gainNode) {
        audioNodesRef.current.gainNode.gain.value = effects.volume * effects.gain
      }

      // Apply three-band EQ settings
      if (audioNodesRef.current.eqFilters.length === 3) {
        audioNodesRef.current.eqFilters[0].gain.value = effects.bass
        audioNodesRef.current.eqFilters[1].gain.value = effects.mid
        audioNodesRef.current.eqFilters[2].gain.value = effects.treble
      }

      // Update frequency filters
      if (audioNodesRef.current.lowPassFilter) {
        audioNodesRef.current.lowPassFilter.frequency.value = effects.lowPass
      }

      if (audioNodesRef.current.highPassFilter) {
        audioNodesRef.current.highPassFilter.frequency.value = effects.highPass
      }

      // Update distortion curve
      if (audioNodesRef.current.distortionNode) {
        audioNodesRef.current.distortionNode.curve = createDistortionCurve(effects.distortion)
      }

      // Update reverb dry/wet balance
      if (audioNodesRef.current.reverbDryGain && audioNodesRef.current.reverbWetGain) {
        audioNodesRef.current.reverbDryGain.gain.value = 1 - effects.reverb / 100
        audioNodesRef.current.reverbWetGain.gain.value = effects.reverb / 100
      }
      
    } catch (error) {
      console.error('Error applying audio effects:', error)
    }
  }, [effects, createDistortionCurve])

  // ============================================================================
  // AUDIO EVENT HANDLERS
  // ============================================================================

  /**
   * Sets up event listeners for audio element
   * Handles time updates, metadata loading, and playback completion
   */
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = (): void => setCurrentTime(audio.currentTime)
    const handleLoadedMetadata = (): void => {
      setDuration(audio.duration)
      console.log('Track duration loaded:', audio.duration)
    }
    const handleEnded = (): void => {
      setIsPlaying(false)
      setCurrentTime(0)
      console.log('Playback completed')
    }

    // Attach event listeners
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)

    // Cleanup event listeners
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Formats time in seconds to MM:SS format
   * @param time - Time in seconds
   * @returns Formatted time string
   */
  const formatTime = useCallback((time: number): string => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }, [])

  /**
   * Checks if any audio effects are currently applied
   * Compares current values with defaults using floating-point tolerance
   * @returns True if any effects differ from default values
   */
  const hasEffectsApplied = useCallback((): boolean => {
    return Object.keys(effects).some(key => {
      const effectKey = key as keyof AudioEffects
      return Math.abs(effects[effectKey] - DEFAULT_EFFECTS[effectKey]) > 0.01
    })
  }, [effects])

  /**
   * Resets all audio effects to their default values
   * Provides quick way to return to neutral audio processing
   */
  const resetEffects = useCallback((): void => {
    setEffects({ ...DEFAULT_EFFECTS })
    console.log('Audio effects reset to defaults')
  }, [])

  // ============================================================================
  // PLAYBACK CONTROLS
  // ============================================================================

  /**
   * Toggles play/pause state with proper audio context handling
   * Manages browser autoplay policies and audio context suspension
   */
  const togglePlayback = useCallback(async (): Promise<void> => {
    if (!audioRef.current || !audioNodesRef.current.context) return

    try {
      // Resume audio context if suspended (browser autoplay policy)
      if (audioNodesRef.current.context.state === 'suspended') {
        await audioNodesRef.current.context.resume()
        console.log('Audio context resumed')
      }

      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
        console.log('Playback paused')
      } else {
        await audioRef.current.play()
        setIsPlaying(true)
        console.log('Playback started')
      }
    } catch (error) {
      console.error('Playback toggle failed:', error)
    }
  }, [isPlaying])

  /**
   * Handles seeking within the track via waveform interaction
   * Calculates precise position based on click coordinates
   */
  const handleWaveformSeek = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
    if (!waveformContainerRef.current || !audioRef.current) return
    
    const rect = waveformContainerRef.current.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const containerWidth = rect.width
    
    // Calculate click position with padding compensation
    const clickPercent = Math.max(0, Math.min(1, 
      (clickX - AUDIO_CONFIG.WAVEFORM_PADDING / 2) / (containerWidth - AUDIO_CONFIG.WAVEFORM_PADDING)
    ))
    
    // Use actual duration or fallback value
    const trackDuration = duration || AUDIO_CONFIG.FALLBACK_DURATION
    const newTime = clickPercent * trackDuration
    
    console.log('Waveform seek:', {
      clickX,
      containerWidth,
      clickPercent: (clickPercent * 100).toFixed(1) + '%',
      newTime: formatTime(newTime),
      totalDuration: formatTime(trackDuration)
    })
    
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }, [duration, formatTime])



  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  /**
   * Calculate current playback progress
   * Uses memoization to prevent unnecessary recalculations
   */
  const playbackProgress = useMemo((): number => {
    const trackDuration = duration || AUDIO_CONFIG.FALLBACK_DURATION
    return trackDuration > 0 ? (currentTime / trackDuration) * 100 : 0
  }, [currentTime, duration])

  // ============================================================================
  // RENDER COMPONENT
  // ============================================================================

  // Prevent hydration mismatches by showing loading state until mounted
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Play className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Studio Player</h2>
          <p className="text-gray-600">Initializing audio system...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Application Header */}
      <header className="flex items-center justify-between p-6 border-b border-gray-200/80 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
            <Play className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Studio Player</h1>
        </div>
      </header>

      {/* Main Player Interface */}
      <div className="flex flex-col h-screen">
        
        {/* Track Information & Waveform Section */}
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            
            {/* Track Metadata Display */}
            <div className="mb-6">
              <div className="flex items-start space-x-4">
                
                {/* Album Artwork Placeholder */}
                <div className="w-32 h-32 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-lg shadow-lg flex items-center justify-center">
                  <div className="text-white text-3xl font-bold opacity-20">♪</div>
                </div>
                
                {/* Track Information */}
                <div className="flex-1 pt-2">
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">{TRACK_INFO.title}</h2>
                  <p className="text-lg text-gray-600 mb-2">{TRACK_INFO.artist}</p>
                  <p className="text-gray-500 mb-4">
                    {TRACK_INFO.genre} • {TRACK_INFO.album} • {TRACK_INFO.duration}
                  </p>
                  
                  {/* Track Action Buttons */}
                  <div className="flex items-center space-x-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsLiked(!isLiked)}
                      className={cn(
                        "text-gray-600 hover:text-gray-900",
                        isLiked && "text-red-500 hover:text-red-400"
                      )}
                      aria-label={isLiked ? "Unlike track" : "Like track"}
                    >
                      <Heart className={cn("w-5 h-5", isLiked && "fill-current")} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-gray-600 hover:text-gray-900"
                      aria-label="Share track"
                    >
                      <Share className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Waveform Visualization */}
            <div className="mb-6">
              <div 
                ref={waveformContainerRef}
                className="h-16 bg-gray-100/80 border border-gray-200 rounded-lg relative overflow-hidden cursor-pointer shadow-sm hover:bg-gray-100/90 transition-colors"
                onClick={handleWaveformSeek}
                role="slider"
                aria-label="Seek through track"
                aria-valuemin={0}
                aria-valuemax={duration || AUDIO_CONFIG.FALLBACK_DURATION}
                aria-valuenow={currentTime}
              >
                {/* Waveform Visualization */}
                <div className="absolute top-4 left-4 right-4 bottom-8 flex items-end justify-start space-x-1">
                  {staticWaveform.map((amplitude, index) => {
                    const barProgress = index / staticWaveform.length
                    const trackProgress = playbackProgress / 100
                    const isActive = barProgress <= trackProgress
                    const waveHeight = Math.max(1, amplitude * AUDIO_CONFIG.WAVEFORM_MAX_HEIGHT)
                    
                    return (
                      <div
                        key={index}
                        className={cn(
                          "rounded-full transition-colors duration-300 flex-shrink-0 hover:opacity-80",
                          isActive 
                            ? "bg-gradient-to-t from-orange-500 to-orange-300" 
                            : "bg-gray-300/80"
                        )}
                        style={{
                          height: `${Math.min(AUDIO_CONFIG.WAVEFORM_MAX_HEIGHT, waveHeight)}px`,
                          width: '2px'
                        }}
                      />
                    )
                  })}
                </div>
                
                {/* Time Display Overlay */}
                <div className="absolute bottom-1 left-3 right-3 flex justify-between text-xs text-gray-600 pointer-events-none">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration || AUDIO_CONFIG.FALLBACK_DURATION)}</span>
                </div>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="space-y-4">
              
              {/* Main Control Buttons */}
              <div className="flex items-center justify-center space-x-6">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-gray-600 hover:text-gray-900"
                  aria-label="Toggle shuffle"
                >
                  <Shuffle className="w-5 h-5" />
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-gray-600 hover:text-gray-900"
                  aria-label="Previous track"
                >
                  <SkipBack className="w-6 h-6" />
                </Button>
                
                <Button
                  onClick={togglePlayback}
                  disabled={isLoading}
                  className="bg-gray-900 hover:bg-gray-800 text-white rounded-full w-12 h-12 shadow-lg disabled:opacity-50"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-gray-600 hover:text-gray-900"
                  aria-label="Next track"
                >
                  <SkipForward className="w-6 h-6" />
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-gray-600 hover:text-gray-900"
                  aria-label="Toggle repeat"
                >
                  <Repeat className="w-5 h-5" />
                </Button>
              </div>

              {/* Volume Control */}
              <div className="flex items-center justify-center space-x-4 max-w-xs mx-auto">
                <Volume2 className="w-5 h-5 text-gray-600" />
                <Slider
                  value={[effects.volume]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={(value) => setEffects(prev => ({ ...prev, volume: value[0] }))}
                  className="flex-1"
                  aria-label="Volume"
                />
                <span className="text-sm text-gray-600 w-10" aria-live="polite">
                  {Math.round(effects.volume * 100)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Audio Effects Processing Panel */}
        <div className="border-t border-gray-200/80 bg-white/90 backdrop-blur-sm flex-1">
          <div className="p-6">
            
            {/* Effects Panel Header with Reset Option */}
            <div className="flex items-center justify-center mb-6 space-x-4 h-20">
              <h3 className="text-lg font-semibold text-gray-900">Audio Effects</h3>
              {hasEffectsApplied() && (
                <Button
                  onClick={resetEffects}
                  variant="outline"
                  size="icon"
                  className="text-gray-600 hover:text-gray-900 border-gray-300 hover:border-gray-400"
                  aria-label="Reset all effects to default"
                  title="Reset all effects"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
            </div>
            
            {/* Effects Control Grid */}
            <div className="flex justify-center items-start space-x-10 max-w-7xl mx-auto">
              
              {/* Playback Controls Section */}
              <div className="flex flex-col items-center space-y-6">
                <h4 className="text-gray-900 font-medium text-sm">Playback</h4>
                <div className="flex space-x-8">
                  
                  {/* Speed Control */}
                  <div className="flex flex-col items-center w-20">
                    <span className="text-xs text-gray-700 text-center mb-3">Speed</span>
                    <div className="h-32 w-8 relative">
                      <Slider
                        value={[effects.speed]}
                        min={0.5}
                        max={2}
                        step={0.1}
                        orientation="vertical"
                        onValueChange={(value) => setEffects(prev => ({ ...prev, speed: value[0] }))}
                        className="h-full"
                        aria-label="Playback speed"
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-full text-center mt-14" aria-live="polite">
                      {effects.speed.toFixed(1)}x
                    </span>
                  </div>
                 
                  {/* Pitch Control */}
                  <div className="flex flex-col items-center w-20">
                    <span className="text-xs text-gray-700 text-center mb-3">Pitch</span>
                    <div className="h-32 w-8 relative">
                      <Slider
                        value={[effects.pitch]}
                        min={-12}
                        max={12}
                        step={1}
                        orientation="vertical"
                        onValueChange={(value) => setEffects(prev => ({ ...prev, pitch: value[0] }))}
                        className="h-full"
                        aria-label="Pitch adjustment in semitones"
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-full text-center mt-14" aria-live="polite">
                      {effects.pitch}st
                    </span>
                  </div>
                </div>
              </div>

              {/* Visual Separator */}
              <div className="w-px h-72 bg-gray-200" aria-hidden="true"></div>

              {/* Equalizer Section */}
              <div className="flex flex-col items-center space-y-6">
                <h4 className="text-gray-900 font-medium text-sm">Equalizer</h4>
                <div className="flex space-x-8">
                  
                  {/* Bass EQ */}
                  <div className="flex flex-col items-center w-20">
                    <span className="text-xs text-gray-700 text-center mb-3">Bass</span>
                    <div className="h-32 w-8 relative">
                      <Slider
                        value={[effects.bass]}
                        min={-20}
                        max={20}
                        step={1}
                        orientation="vertical"
                        onValueChange={(value) => setEffects(prev => ({ ...prev, bass: value[0] }))}
                        className="h-full"
                        aria-label="Bass EQ adjustment"
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-full text-center mt-14" aria-live="polite">
                      {effects.bass > 0 ? '+' : ''}{effects.bass}dB
                    </span>
                  </div>
                 
                  {/* Mid EQ */}
                  <div className="flex flex-col items-center w-20">
                    <span className="text-xs text-gray-700 text-center mb-3">Mid</span>
                    <div className="h-32 w-8 relative">
                      <Slider
                        value={[effects.mid]}
                        min={-20}
                        max={20}
                        step={1}
                        orientation="vertical"
                        onValueChange={(value) => setEffects(prev => ({ ...prev, mid: value[0] }))}
                        className="h-full"
                        aria-label="Mid-range EQ adjustment"
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-full text-center mt-14" aria-live="polite">
                      {effects.mid > 0 ? '+' : ''}{effects.mid}dB
                    </span>
                  </div>
                 
                  {/* Treble EQ */}
                  <div className="flex flex-col items-center w-20">
                    <span className="text-xs text-gray-700 text-center mb-3">Treble</span>
                    <div className="h-32 w-8 relative">
                      <Slider
                        value={[effects.treble]}
                        min={-20}
                        max={20}
                        step={1}
                        orientation="vertical"
                        onValueChange={(value) => setEffects(prev => ({ ...prev, treble: value[0] }))}
                        className="h-full"
                        aria-label="Treble EQ adjustment"
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-full text-center mt-14" aria-live="polite">
                      {effects.treble > 0 ? '+' : ''}{effects.treble}dB
                    </span>
                  </div>
                </div>
              </div>

              {/* Visual Separator */}
              <div className="w-px h-72 bg-gray-200" aria-hidden="true"></div>

              {/* Effects Section */}
              <div className="flex flex-col items-center space-y-6">
                <h4 className="text-gray-900 font-medium text-sm">Effects</h4>
                <div className="flex space-x-8">
                  
                  {/* Reverb Effect */}
                  <div className="flex flex-col items-center w-20">
                    <span className="text-xs text-gray-700 text-center mb-3">Reverb</span>
                    <div className="h-32 w-8 relative">
                      <Slider
                        value={[effects.reverb]}
                        min={0}
                        max={100}
                        step={1}
                        orientation="vertical"
                        onValueChange={(value) => setEffects(prev => ({ ...prev, reverb: value[0] }))}
                        className="h-full"
                        aria-label="Reverb amount"
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-full text-center mt-14" aria-live="polite">
                      {effects.reverb}%
                    </span>
                  </div>
                 
                  {/* Distortion Effect */}
                  <div className="flex flex-col items-center w-20">
                    <span className="text-xs text-gray-700 text-center mb-3">Distortion</span>
                    <div className="h-32 w-8 relative">
                      <Slider
                        value={[effects.distortion]}
                        min={0}
                        max={100}
                        step={1}
                        orientation="vertical"
                        onValueChange={(value) => setEffects(prev => ({ ...prev, distortion: value[0] }))}
                        className="h-full"
                        aria-label="Distortion amount"
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-full text-center mt-14" aria-live="polite">
                      {effects.distortion}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Visual Separator */}
              <div className="w-px h-72 bg-gray-200" aria-hidden="true"></div>

              {/* Filters Section */}
              <div className="flex flex-col items-center space-y-6">
                <h4 className="text-gray-900 font-medium text-sm">Filters</h4>
                <div className="flex space-x-8">
                  
                  {/* Low Pass Filter */}
                  <div className="flex flex-col items-center w-20">
                    <span className="text-xs text-gray-700 text-center mb-3">Low Pass</span>
                    <div className="h-32 w-8 relative">
                      <Slider
                        value={[effects.lowPass]}
                        min={200}
                        max={20000}
                        step={100}
                        orientation="vertical"
                        onValueChange={(value) => setEffects(prev => ({ ...prev, lowPass: value[0] }))}
                        className="h-full"
                        aria-label="Low pass filter frequency"
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-full text-center mt-14" aria-live="polite">
                      {effects.lowPass}Hz
                    </span>
                  </div>
                 
                  {/* High Pass Filter */}
                  <div className="flex flex-col items-center w-20">
                    <span className="text-xs text-gray-700 text-center mb-3">High Pass</span>
                    <div className="h-32 w-8 relative">
                      <Slider
                        value={[effects.highPass]}
                        min={20}
                        max={2000}
                        step={10}
                        orientation="vertical"
                        onValueChange={(value) => setEffects(prev => ({ ...prev, highPass: value[0] }))}
                        className="h-full"
                        aria-label="High pass filter frequency"
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-full text-center mt-14" aria-live="polite">
                      {effects.highPass}Hz
                    </span>
                  </div>
                 
                  {/* Gain Control */}
                  <div className="flex flex-col items-center w-20">
                    <span className="text-xs text-gray-700 text-center mb-3">Gain</span>
                    <div className="h-32 w-8 relative">
                      <Slider
                        value={[effects.gain]}
                        min={0.1}
                        max={3}
                        step={0.1}
                        orientation="vertical"
                        onValueChange={(value) => setEffects(prev => ({ ...prev, gain: value[0] }))}
                        className="h-full"
                        aria-label="Gain multiplier"
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-full text-center mt-14" aria-live="polite">
                      {effects.gain.toFixed(1)}x
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden Audio Element */}
        <audio
          ref={audioRef}
          src="/song/Love Yourz.mp3"
          crossOrigin="anonymous"
          preload="metadata"
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration)
              console.log('Track metadata loaded - Duration:', audioRef.current.duration)
            }
          }}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime)
            }
          }}
          onError={(e) => {
            console.error('Audio loading error:', e)
            setIsLoading(false)
          }}
        />
      </div>
    </div>
  )
}
"use client"

import { useState, useEffect } from "react"

interface StreamEmbedProps {
  eventCode: string
}

export function StreamEmbed({ eventCode }: StreamEmbedProps) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [customUrl, setCustomUrl] = useState("")
  const [useCustom, setUseCustom] = useState(false)

  // Load saved custom URL from sessionStorage on mount
  useEffect(() => {
    const savedUrl = sessionStorage.getItem(`stream-url-${eventCode}`)
    if (savedUrl) {
      setCustomUrl(savedUrl)
      setUseCustom(true)
    }
  }, [eventCode])

  useEffect(() => {
    const fetchEventStream = async () => {
      try {
        const response = await fetch(`/api/events/${eventCode}`)
        if (response.ok) {
          const data = await response.json()
          const url = data.event?.liveStreamUrl || data.event?.webcasts?.[0]?.url
          setStreamUrl(url || null)
        }
      } catch (error) {
        console.error("Error fetching event stream:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchEventStream()
  }, [eventCode])

  const getEmbedUrl = (url: string): string | null => {
    // YouTube
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1]
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`
      }
    }

    // Twitch
    if (url.includes("twitch.tv")) {
      const channel = url.match(/twitch\.tv\/([^\/\?]+)/)?.[1]
      if (channel) {
        return `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}&autoplay=true&muted=true`
      }
    }

    // Direct embed URL (assume it's already an embed)
    if (url.includes("/embed")) {
      return url
    }

    return null
  }

  const activeUrl = useCustom && customUrl.trim() ? customUrl.trim() : streamUrl
  const embedUrl = activeUrl ? getEmbedUrl(activeUrl) : null

  if (loading) {
    return (
      <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
        <p className="text-white">Loading stream...</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Stream display */}
      {embedUrl ? (
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      ) : activeUrl ? (
        <div className="aspect-video bg-black rounded-lg flex flex-col items-center justify-center gap-2">
          <p className="text-white">Stream available at:</p>
          <a
            href={activeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            {activeUrl}
          </a>
        </div>
      ) : (
        <div className="aspect-video bg-black rounded-lg flex flex-col items-center justify-center gap-2">
          <svg
            className="w-16 h-16 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <p className="text-gray-400 text-lg font-medium">No Live Stream Available</p>
          <p className="text-gray-500 text-sm">Enter a YouTube or Twitch link below</p>
        </div>
      )}

      {/* Custom URL input */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Paste YouTube or Twitch URL..."
          value={customUrl}
          onChange={(e) => {
            setCustomUrl(e.target.value)
            if (e.target.value.trim()) {
              setUseCustom(true)
              sessionStorage.setItem(`stream-url-${eventCode}`, e.target.value.trim())
            } else {
              sessionStorage.removeItem(`stream-url-${eventCode}`)
            }
          }}
          className="flex-1 px-3 py-1.5 text-sm rounded border bg-transparent"
          style={{ borderColor: 'var(--color-border)' }}
        />
        {useCustom && customUrl.trim() && (
          <button
            onClick={() => {
              setCustomUrl("")
              setUseCustom(false)
              sessionStorage.removeItem(`stream-url-${eventCode}`)
            }}
            className="px-3 py-1.5 text-sm rounded border hover:bg-accent/50 transition-colors"
            style={{ borderColor: 'var(--color-border)' }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  )
}

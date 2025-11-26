"use client"

import { useState, useEffect } from "react"

interface StreamEmbedProps {
  eventCode: string
}

export function StreamEmbed({ eventCode }: StreamEmbedProps) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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
      const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1]
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

  if (loading) {
    return (
      <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
        <p className="text-white">Loading stream...</p>
      </div>
    )
  }

  if (!streamUrl) {
    return (
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
        <p className="text-gray-500 text-sm">Check back when the event is live</p>
      </div>
    )
  }

  const embedUrl = getEmbedUrl(streamUrl)

  if (!embedUrl) {
    return (
      <div className="aspect-video bg-black rounded-lg flex flex-col items-center justify-center gap-2">
        <p className="text-white">Stream available at:</p>
        <a
          href={streamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline"
        >
          {streamUrl}
        </a>
      </div>
    )
  }

  return (
    <div className="aspect-video bg-black rounded-lg overflow-hidden">
      <iframe
        src={embedUrl}
        className="w-full h-full"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />
    </div>
  )
}

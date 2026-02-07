/**
 * Cache Invalidation API
 * Allows manual cache invalidation for live events
 */

import { type NextRequest, NextResponse } from "next/server"
import { ftcApiClient } from "@/lib/ftc-api-client"
import { cacheManager } from "@/lib/cache-manager"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventCode, namespace } = body

    if (!eventCode && !namespace) {
      return NextResponse.json(
        { error: "eventCode or namespace required" },
        { status: 400 }
      )
    }

    if (eventCode) {
      // Invalidate all caches for a specific event
      await ftcApiClient.invalidateEvent(eventCode)
      return NextResponse.json({
        success: true,
        message: `Cache invalidated for event: ${eventCode}`,
      })
    }

    if (namespace) {
      // Invalidate a specific namespace
      await cacheManager.invalidateNamespace(namespace)
      return NextResponse.json({
        success: true,
        message: `Cache invalidated for namespace: ${namespace}`,
      })
    }

    return NextResponse.json({ success: false }, { status: 400 })
  } catch (error) {
    console.error("Error invalidating cache:", error)
    return NextResponse.json(
      {
        error: "Failed to invalidate cache",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    info: "POST to this endpoint with { eventCode } or { namespace } to invalidate cache",
    example: {
      invalidateEvent: { eventCode: "USWAGIL1" },
      invalidateNamespace: { namespace: "rankings" },
    },
  })
}

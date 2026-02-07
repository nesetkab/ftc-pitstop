"use client"

import ScoutingManager from '@/components/scouting-manager'

export default function TestScoutPage() {
  return (
    <ScoutingManager
      onSessionCreate={(sessionCode) => {
        console.log('Session created:', sessionCode)
      }}
    />)
}

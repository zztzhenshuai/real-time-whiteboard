'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { v4 as uuidv4 } from 'uuid'

// Dynamic import for Fabric.js component to avoid SSR issues
const FabricWhiteboard = dynamic(() => import('@/components/FabricWhiteboard'), { 
  ssr: false,
  loading: () => <p className="text-center p-10">Loading Canvas...</p>
})

export default function Home() {
  const [roomId, setRoomId] = useState('')
  const [joined, setJoined] = useState(false)

  const createRoom = () => {
    const id = uuidv4()
    setRoomId(id)
    setJoined(true)
  }

  const joinRoom = () => {
    if (roomId.trim()) {
      setJoined(true)
    }
  }

  if (joined) {
    return <FabricWhiteboard roomId={roomId} />
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-24 text-white">
      <div className="bg-white text-gray-800 p-10 rounded-2xl shadow-2xl max-w-md w-full">
        <h1 className="text-3xl font-bold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">
          Collaborative Board
        </h1>
        
        <div className="space-y-4">
          <button 
            onClick={createRoom}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200"
          >
            Create New Room
          </button>
          
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400">OR</span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>

          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Enter Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button 
              onClick={joinRoom}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition duration-200"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

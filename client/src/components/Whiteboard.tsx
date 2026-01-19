'use client'

import React, { useEffect, useState } from 'react'
import { useDraw, Draw } from '../hooks/useDraw'
import { socket } from '../lib/socket'
import { drawLine } from '../utils/drawLine'

interface WhiteboardProps {}

const Whiteboard: React.FC<WhiteboardProps> = () => {
  const [color, setColor] = useState<string>('#000000')
  const { canvasRef, onMouseDown, clear } = useDraw(createLine)

  function createLine({ ctx, currentPoint, prevPoint }: Draw) {
    socket.emit('draw-line', { prevPoint, currentPoint, color })
    drawLine({ prevPoint, currentPoint, ctx, color })
  }

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')

    socket.on('draw-line', ({ prevPoint, currentPoint, color }: any) => {
      if (!ctx) return
      drawLine({ prevPoint, currentPoint, ctx, color })
    })

    socket.on('clear', () => {
        const canvas = canvasRef.current;
        if(canvas) {
            const context = canvas.getContext('2d');
            context?.clearRect(0, 0, canvas.width, canvas.height);
        }
    })

    return () => {
      socket.off('draw-line')
      socket.off('clear')
    }
  }, [canvasRef])

  return (
    <div className='w-full h-screen flex flex-col items-center justify-center bg-gray-100'>
      <div className='fixed top-10 flex gap-5 p-2 bg-white rounded-lg shadow-md z-10'>
        <input 
            type="color" 
            value={color} 
            onChange={(e) => setColor(e.target.value)}
            className="w-10 h-10 border-none cursor-pointer"
        />
        <button 
            onClick={() => {
                socket.emit('clear')
                clear()
            }} 
            className='p-2 bg-red-500 text-white rounded hover:bg-red-600 transition'
        >
          Clear Board
        </button>
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        width={800}
        height={600}
        className='border border-gray-300 rounded-md bg-white shadow-xl cursor-crosshair'
      />
    </div>
  )
}

export default Whiteboard

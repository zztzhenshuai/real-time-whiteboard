'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { socket } from '../lib/socket';

interface FabricWhiteboardProps {
  roomId: string;
}

const FabricWhiteboard: React.FC<FabricWhiteboardProps> = ({ roomId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [color, setColor] = useState('#000000');
  const [history, setHistory] = useState<string[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [status, setStatus] = useState('Disconnected');
  const isDrawingRemote = useRef(false);

  // Socket Connection Status
  useEffect(() => {
    const onConnect = () => setStatus('Connected');
    const onDisconnect = () => setStatus('Disconnected');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) setStatus('Connected'); // Check initial state

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  // Initialize Canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const initCanvas = new fabric.Canvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: '#ffffff',
      isDrawingMode: true, // Start in drawing mode
    });

    const brush = new fabric.PencilBrush(initCanvas);
    brush.width = 5;
    brush.color = color;
    initCanvas.freeDrawingBrush = brush;

    setCanvas(initCanvas);

    return () => {
      initCanvas.dispose();
    };
  }, []);

  // Update Brush Color
  useEffect(() => {
    if (canvas && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = color;
    }
  }, [color, canvas]);

  // Socket Logic
  useEffect(() => {
    if (!canvas || !roomId) return;

    // Join Room
    socket.emit('join-room', roomId);

    // Listeners
    socket.on('load-canvas', (data) => {
      console.log('Received load-canvas event', data);
      isDrawingRemote.current = true;
      canvas.loadFromJSON(data, () => {
        canvas.renderAll();
        isDrawingRemote.current = false;
        saveHistory(canvas); // Save initial state
      });
    });

    socket.on('update-canvas', (data) => {
      if (!data) return; 
      console.log('Received update-canvas event');
      isDrawingRemote.current = true;
      
      // Safety timeout to release the lock
      const safetyTimeout = setTimeout(() => {
          if (isDrawingRemote.current) {
              console.warn("Force releasing isDrawingRemote lock after timeout");
              isDrawingRemote.current = false;
          }
      }, 2000);

      canvas.loadFromJSON(data, () => {
        clearTimeout(safetyTimeout);
        console.log(`Canvas loaded remotely. Objects count: ${canvas.getObjects().length}`);
        
        // Ensure background is set if missing in JSON to avoid transparent bg
        if (!canvas.backgroundColor) {
            canvas.backgroundColor = '#ffffff';
        }

        canvas.requestRenderAll(); // Use requestRenderAll for smoother UI updates
        isDrawingRemote.current = false;
        
        // Don't save history immediately to avoid rapid state changes or potential loops
        // saveHistory(canvas); 
      });
    });

    socket.on('clear', () => {
      isDrawingRemote.current = true;
      canvas.clear();
      canvas.backgroundColor = '#ffffff';
      canvas.renderAll();
      isDrawingRemote.current = false;
      saveHistory(canvas);
    });

    return () => {
      socket.off('load-canvas');
      socket.off('update-canvas');
      socket.off('clear');
    };
  }, [canvas, roomId]);

  // Canvas Events for Sync & History
  useEffect(() => {
    if (!canvas) return;

    const handlePathCreated = () => {
      if (isDrawingRemote.current) return;
      
      console.log('Path created, syncing...');
      const json = canvas.toJSON();
      socket.emit('sync-canvas', { roomId, canvasData: json });
      saveHistory(canvas);
    };

    const handleObjectModified = () => {
        if (isDrawingRemote.current) return;
        console.log('Object modified, syncing...');
        const json = canvas.toJSON();
        socket.emit('sync-canvas', { roomId, canvasData: json });
        saveHistory(canvas);
    }
   
    // Hook into fabric events
    canvas.on('path:created', handlePathCreated);
    canvas.on('object:modified', handleObjectModified);
    // Removed object:added listener to prevent infinite loops during loadFromJSON

    return () => {
      canvas.off('path:created', handlePathCreated);
      canvas.off('object:modified', handleObjectModified);
    };
  }, [canvas, roomId]);


  const saveHistory = (c: fabric.Canvas) => {
    if(isDrawingRemote.current) return; // Optional: Decide if we want to undo remote changes
    const json = JSON.stringify(c.toJSON());
    setHistory((prev) => {
        const newHistory = prev.slice(0, historyStep + 1);
        newHistory.push(json);
        return newHistory;
    });
    setHistoryStep((prev) => prev + 1);
  };

  const undo = () => {
    if (historyStep > 0) {
      const prevStep = historyStep - 1;
      const jsonStr = history[prevStep];
      isDrawingRemote.current = true; // prevent sync loop
      try {
        const json = JSON.parse(jsonStr);
        canvas?.loadFromJSON(json, () => {
          canvas.renderAll();
          isDrawingRemote.current = false;
          setHistoryStep(prevStep);
          socket.emit('sync-canvas', { roomId, canvasData: json });
        });
      } catch (e) {
        console.error("Undo error:", e);
        isDrawingRemote.current = false;
      }
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      const nextStep = historyStep + 1;
      const jsonStr = history[nextStep];
      isDrawingRemote.current = true;
      try {
        const json = JSON.parse(jsonStr);
        canvas?.loadFromJSON(json, () => {
          canvas.renderAll();
          isDrawingRemote.current = false;
          setHistoryStep(nextStep);
          socket.emit('sync-canvas', { roomId, canvasData: json });
        });
      } catch (e) {
        console.error("Redo error:", e);
        isDrawingRemote.current = false;
      }
    }
  };

  const addRectangle = () => {
    if (!canvas) return;
    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      fill: color,
      width: 60,
      height: 60,
    });
    canvas.add(rect);
    canvas.setActiveObject(rect); 
    canvas.isDrawingMode = false;
    
    // Manual sync for added object
    const json = canvas.toJSON();
    socket.emit('sync-canvas', { roomId, canvasData: json });
    saveHistory(canvas);
  };

  const addCircle = () => {
    if (!canvas) return;
    const circle = new fabric.Circle({
      left: 200,
      top: 100,
      fill: color,
      radius: 30,
    });
    canvas.add(circle);
    canvas.setActiveObject(circle);
    canvas.isDrawingMode = false;
    
    // Manual sync for added object
    const json = canvas.toJSON();
    socket.emit('sync-canvas', { roomId, canvasData: json });
    saveHistory(canvas);
  };

  const toggleDrawMode = () => {
    if (canvas) {
      canvas.isDrawingMode = !canvas.isDrawingMode;
    }
  };

  const clearBoard = () => {
    socket.emit('clear', roomId);
    if (canvas) {
      canvas.clear();
      canvas.backgroundColor = '#ffffff';
      canvas.renderAll();
      saveHistory(canvas);
    }
  };

  return (
    <div className='flex flex-col items-center justify-center min-h-screen bg-gray-100 p-5'>
      <div className='mb-4 flex gap-4 p-4 bg-white rounded-xl shadow-lg'>
        <div className='flex items-center gap-2'>
            <span className='font-bold'>Color:</span>
            <input 
                type="color" 
                value={color} 
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 cursor-pointer border-none"
            />
        </div>
        
        <button onClick={toggleDrawMode} className='px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600'>
            Draw / Select
        </button>
        <button onClick={addRectangle} className='px-3 py-1 bg-gray-200 rounded hover:bg-gray-300'>
            Rectangle
        </button>
        <button onClick={addCircle} className='px-3 py-1 bg-gray-200 rounded hover:bg-gray-300'>
            Circle
        </button>

        <div className='w-[1px] bg-gray-300 mx-2'></div>

        <button onClick={undo} disabled={historyStep <= 0} className='px-3 py-1 bg-yellow-500 text-white rounded disabled:opacity-50'>
            Undo
        </button>
        <button onClick={redo} disabled={historyStep >= history.length - 1} className='px-3 py-1 bg-yellow-500 text-white rounded disabled:opacity-50'>
            Redo
        </button>

        <div className='w-[1px] bg-gray-300 mx-2'></div>

        <button onClick={clearBoard} className='px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600'>
            Clear
        </button>
      </div>

       <div className='shadow-xl border border-gray-300 rounded-lg overflow-hidden bg-white'>
        <canvas ref={canvasRef} />
      </div>
      
      <div className='mt-2 text-gray-500 text-sm flex gap-4'>
        <span>Room ID: {roomId}</span>
        <span className={status === 'Connected' ? 'text-green-500' : 'text-red-500'}>
            Status: {status}
        </span>
      </div>
    </div>
  );
};

export default FabricWhiteboard;

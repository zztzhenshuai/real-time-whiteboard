const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createClient } = require('redis');

const app = express();
app.use(cors());

// Redis Client Setup
const redisClient = createClient({
  url: 'redis://106.15.54.183:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect().then(() => console.log('Connected to Redis'));

app.get('/', (req, res) => {
  res.send('Server is up and running!');
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join-room', async (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
    
    // Load existing canvas state from Redis
    try {
      const data = await redisClient.get(`room:${roomId}`);
      if (data) {
        socket.emit('load-canvas', JSON.parse(data));
      }
    } catch (e) {
      console.error('Error fetching from Redis:', e);
    }
  });

  socket.on('sync-canvas', async ({ roomId, canvasData }) => {
    console.log(`Received sync-canvas from ${socket.id} for room ${roomId}`);
    // Broadcast to others in the room
    socket.to(roomId).emit('update-canvas', canvasData);
    
    // Save to Redis
    try {
      await redisClient.set(`room:${roomId}`, JSON.stringify(canvasData));
      console.log(`Saved canvas state for room ${roomId} to Redis`);
    } catch (e) {
      console.error('Error saving to Redis:', e);
    }
  });

  socket.on('clear', async (roomId) => {
    io.to(roomId).emit('clear');
    await redisClient.del(`room:${roomId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

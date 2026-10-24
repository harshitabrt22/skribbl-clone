import express, { Request, Response } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';

// Load port from environment variable (used by Render in production) or default to 3001
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO attached to HTTP server.
// In development, the Vite dev server (port 5173) proxies /socket.io requests to port 3001.
// In production, the client and server are served from the same origin.
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// Health check endpoint required by Render and PRD Section 20
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).send('ok');
});

// Socket.IO connection event logging (verifies client handshake)
io.on('connection', (socket: Socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  socket.on('disconnect', (reason: string) => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
  });
});

// In production, serve the built React client from ../client/dist
if (isProduction) {
  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));

  // Fallback for non-API routes so direct navigation/refresh works (e.g. /room/:code)
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Start HTTP and WebSocket listener
server.listen(PORT, () => {
  console.log(`[Server] Doodle Dash server listening on port ${PORT} (mode: ${process.env.NODE_ENV || 'development'})`);
});

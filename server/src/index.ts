import express, { Request, Response } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { roomManager } from './game/RoomManager';
import { registerHandlers } from './socket/registerHandlers';

// Load port from environment variable (used by Render in production) or default to 3001
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

// JSON body parsing for API endpoints
app.use(express.json());

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

// Public rooms listing (PRD Section 8 & 14)
app.get('/api/rooms/public', (_req: Request, res: Response) => {
  const publicRooms = roomManager.getPublicRooms();
  res.json({ rooms: publicRooms });
});

// Socket.IO connection event logging and handler registration
io.on('connection', (socket: Socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);
  registerHandlers(io, socket, roomManager);
});

// Serve the built React client from client/dist whenever it exists (PRD Section 20)
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  // Fallback for non-API routes so direct navigation/refresh works (e.g. /room/:code)
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
  console.log(`[Server] Serving static client assets from: ${clientDistPath}`);
} else {
  console.log(`[Server] client/dist not found at ${clientDistPath}; running in API/dev mode`);
}

// Handle server startup errors gracefully (e.g. port collision / EADDRINUSE)
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Server error] Port ${PORT} is already in use (EADDRINUSE). Please terminate any lingering process on port ${PORT}.`);
    process.exit(1);
  } else {
    console.error('[Server error]', err);
  }
});

// Start HTTP and WebSocket listener
server.listen(PORT, () => {
  console.log(`[Server] Doodle Dash server listening on port ${PORT} (mode: ${process.env.NODE_ENV || 'development'})`);
});

import { io, Socket } from 'socket.io-client';

// Single Socket.IO client instance.
// Using io() without a URL automatically connects to the current host/origin:
// - In development: Vite dev server on port 5173 proxies /socket.io to http://localhost:3001.
// - In production: Express serves both client and Socket.IO from the same port.
export const socket: Socket = io({
  autoConnect: true,
  transports: ['websocket', 'polling'],
});

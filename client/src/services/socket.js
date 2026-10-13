import { io } from 'socket.io-client';

let socket;
// The server only lets a logged-in user connect, and only sends that user the events they may see.
export function getSocket() {
  if (!socket) socket = io('/', { withCredentials: true, transports: ['websocket', 'polling'], reconnectionDelayMax: 8000 });
  return socket;
}
export function closeSocket() { socket?.disconnect(); socket = undefined; }

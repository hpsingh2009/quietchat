import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const initSocket = (token: string) => {
  if (socket) {
    socket.disconnect();
  }
  
  socket = io(window.location.origin, {
    auth: { token }
  });
  
  return socket;
};

export const getSocket = () => socket;

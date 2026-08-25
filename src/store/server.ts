import { create } from 'zustand';

export interface Server {
  id: number;
  name: string;
  iconUrl: string | null;
  ownerId: number;
}

export interface Channel {
  id: number;
  serverId: number;
  name: string;
  type: string;
}

interface ServerState {
  servers: Server[];
  activeServer: Server | null;
  channels: Channel[];
  activeChannel: Channel | null;
  setServers: (servers: Server[]) => void;
  setActiveServer: (server: Server | null) => void;
  setChannels: (channels: Channel[]) => void;
  setActiveChannel: (channel: Channel | null) => void;
  addServer: (server: Server) => void;
}

export const useServerStore = create<ServerState>((set) => ({
  servers: [],
  activeServer: null,
  channels: [],
  activeChannel: null,
  setServers: (servers) => set({ servers }),
  setActiveServer: (server) => set({ activeServer: server }),
  setChannels: (channels) => set({ channels }),
  setActiveChannel: (channel) => set({ activeChannel: channel }),
  addServer: (server) => set((state) => ({ servers: [...state.servers, server] })),
}));

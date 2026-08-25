import { create } from 'zustand';

export interface Message {
  id: number | string;
  conversationId: number | null;
  channelId: number | null;
  senderId: number;
  encryptedContent: string;
  type: string;
  status: string;
  createdAt: string;
  sender?: {
    id: number;
    username: string;
    displayName: string;
    avatarUrl: string;
  };
  tempId?: string;
}

export interface Conversation {
  id: number;
  isGroup: boolean;
  name: string | null;
  avatarUrl: string | null;
  updatedAt: string;
  otherMember?: {
    id: number;
    username: string;
    displayName: string;
    avatarUrl: string;
    status: string;
  };
  lastMessage?: Message;
}

interface ChatState {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (conversation: Conversation | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (activeConversation) => set({ activeConversation }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => {
    // If we receive a message that matches a tempId we already optimistically added
    if (message.tempId) {
      const existingIdx = state.messages.findIndex(m => m.id === message.tempId);
      if (existingIdx !== -1) {
        const newMsgs = [...state.messages];
        newMsgs[existingIdx] = message;
        return { messages: newMsgs };
      }
    }
    // Also guard against adding duplicate real IDs
    if (state.messages.some(m => m.id === message.id)) {
      return state;
    }
    return { messages: [...state.messages, message] };
  }),
}));

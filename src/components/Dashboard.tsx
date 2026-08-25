import React, { useEffect, useState, useRef } from 'react';
import { Edit, Search, Phone, Video, MoreVertical, Mic, Send, ShieldCheck, CheckCheck, X, Plus, Hash, PhoneOff } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useChatStore, Conversation, Message } from '../store/chat';
import { useServerStore, Server, Channel } from '../store/server';
import { auth } from '../lib/firebase';
import { initSocket, getSocket } from '../lib/socket';
import { CallScreen } from './CallScreen';

export function Dashboard() {
  const { user, dbUser, token } = useAuthStore();
  const { conversations, activeConversation, messages, setConversations, setActiveConversation, setMessages, addMessage } = useChatStore();
  const { servers, activeServer, channels, activeChannel, setServers, setActiveServer, setChannels, setActiveChannel, addServer } = useServerStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  
  // Call state
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [activeCall, setActiveCall] = useState<any>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    const socket = getSocket();
    if (socket) socket.disconnect();
    auth.signOut();
  };

  useEffect(() => {
    if (!token) return;
    
    // Initialize socket
    const socket = initSocket(token);
    
    socket.on('connect', () => {
      console.log('Socket connected');
    });
    
    socket.on('receive-message', (msg: Message) => {
      // If it's a DM and we're looking at it
      if (!msg.channelId && activeConversation?.id === msg.conversationId) {
        addMessage(msg);
      }
      // If it's a channel message and we're looking at it
      else if (msg.channelId && activeChannel?.id === msg.channelId) {
        addMessage(msg);
      }
    });
    
    // Call listeners
    socket.on('incoming-call', (data: any) => {
      if (activeCall) return; // Busy
      setIncomingCall(data);
    });
    
    socket.on('call-accepted', (data: any) => {
      setActiveCall((prev: any) => prev ? { ...prev, connected: true, peer: data.from } : null);
    });
    
    socket.on('call-rejected', () => {
      setActiveCall(null);
    });
    
    socket.on('call-ended', () => {
      setActiveCall(null);
      setIncomingCall(null);
    });

    // Fetch conversations and servers
    const fetchData = async () => {
      try {
        const [convRes, serverRes] = await Promise.all([
          fetch('/api/conversations', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/servers', { headers: { Authorization: `Bearer ${token}` } })
        ]);
        
        const convData = await convRes.json();
        const serverData = await serverRes.json();
        
        if (convData.conversations) {
          setConversations(convData.conversations);
          
          // Join socket room for all conversations to receive background calls and messages
          const socket = getSocket();
          if (socket) {
            convData.conversations.forEach((conv: Conversation) => {
              socket.emit('join-conversation', conv.id);
            });
          }
        }
        if (serverData.servers) setServers(serverData.servers);
      } catch (err) {
        console.error(err);
      }
    };
    
    fetchData();

    return () => {
      socket.disconnect();
    };
  }, [token, activeConversation?.id, activeChannel?.id, activeCall]); // Rebind socket events if active items change

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectConversation = async (conv: Conversation) => {
    setActiveConversation(conv);
    setActiveServer(null);
    setActiveChannel(null);
    
    // Join socket room
    const socket = getSocket();
    if (socket) {
      socket.emit('join-conversation', conv.id);
    }

    // Fetch messages
    try {
      const res = await fetch(`/api/conversations/${conv.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const selectServer = async (server: Server) => {
    setActiveServer(server);
    setActiveConversation(null);
    
    // Fetch channels
    try {
      const res = await fetch(`/api/servers/${server.id}/channels`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.channels) {
        setChannels(data.channels);
        if (data.channels.length > 0) {
          selectChannel(data.channels[0]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const selectChannel = async (channel: Channel) => {
    setActiveChannel(channel);
    
    const socket = getSocket();
    if (socket) {
      socket.emit('join-channel', channel.id);
    }
    
    // Fetch messages
    try {
      const res = await fetch(`/api/channels/${channel.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startConversation = async (targetUserId: number) => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId })
      });
      const data = await res.json();
      
      if (data.conversation) {
        setIsSearching(false);
        setSearchQuery('');
        // Reload conversations
        const convRes = await fetch('/api/conversations', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const convData = await convRes.json();
        if (convData.conversations) {
          setConversations(convData.conversations);
          const newConv = convData.conversations.find((c: any) => c.id === data.conversation.id);
          if (newConv) selectConversation(newConv);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    
    if (q.length > 2) {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${q}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setSearchResults(data.users || []);
      } catch (err) {
        console.error(err);
      }
    } else {
      setIsSearching(false);
      setSearchResults([]);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || (!activeConversation && !activeChannel)) return;

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      conversationId: activeConversation?.id || null,
      channelId: activeChannel?.id || null,
      senderId: dbUser!.id,
      encryptedContent: newMessage,
      type: 'text',
      status: 'sending',
      createdAt: new Date().toISOString(),
      sender: dbUser as any
    };

    // Immediately add to UI for instant feedback
    addMessage(optimisticMsg);

    const socket = getSocket();
    if (socket) {
      socket.emit('send-message', {
        conversationId: activeConversation?.id,
        channelId: activeChannel?.id,
        encryptedContent: newMessage,
        type: 'text',
        tempId
      });
      setNewMessage('');
    }
  };

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServerName.trim()) return;

    try {
      const res = await fetch('/api/servers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newServerName })
      });
      const data = await res.json();
      if (data.server) {
        addServer(data.server);
        setShowCreateServer(false);
        setNewServerName('');
        selectServer(data.server);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startCall = (isVideo: boolean) => {
    if (!activeConversation) return;
    
    const socket = getSocket();
    if (socket) {
      socket.emit('call-user', {
        conversationId: activeConversation.id,
        isVideo
      });
      setActiveCall({ 
        connected: false, 
        isVideo, 
        peer: activeConversation.otherMember,
        conversationId: activeConversation.id,
        isCaller: true
      });
    }
  };

  const acceptCall = () => {
    const socket = getSocket();
    if (socket && incomingCall) {
      socket.emit('accept-call', { conversationId: incomingCall.conversationId });
      setActiveCall({ 
        connected: true, 
        isVideo: incomingCall.isVideo, 
        peer: incomingCall.from,
        conversationId: incomingCall.conversationId,
        isCaller: false
      });
      setIncomingCall(null);
    }
  };

  const rejectCall = () => {
    const socket = getSocket();
    if (socket && incomingCall) {
      socket.emit('reject-call', { conversationId: incomingCall.conversationId });
      setIncomingCall(null);
    }
  };

  const endCall = () => {
    const socket = getSocket();
    if (socket && activeConversation) {
      socket.emit('end-call', { conversationId: activeConversation.id });
    }
    setActiveCall(null);
  };

  const getInitials = (name?: string | null) => {
    return name ? name.substring(0, 2).toUpperCase() : 'U';
  };

  return (
    <div className="flex h-screen w-full bg-[#0A0A0A] text-[#E0E0E0] font-sans overflow-hidden">
      {/* Servers/Communities Sidebar */}
      <aside className="w-[72px] bg-[#050505] flex flex-col items-center py-4 space-y-4 border-r border-[#1A1A1A]">
        <div 
          onClick={() => { setActiveServer(null); setActiveConversation(null); }}
          className={`w-12 h-12 flex items-center justify-center text-white font-bold text-xl cursor-pointer transition-all ${!activeServer ? 'bg-indigo-600 rounded-[12px]' : 'bg-[#1A1A1A] hover:bg-indigo-500 rounded-[24px] hover:rounded-[16px]'}`}
        >
          {dbUser?.username ? dbUser.username[0].toUpperCase() : 'M'}
        </div>
        <div className="w-[32px] h-[1px] bg-[#1A1A1A]"></div>
        
        {servers.map(server => (
          <div 
            key={server.id}
            onClick={() => selectServer(server)}
            className={`w-12 h-12 flex items-center justify-center cursor-pointer transition-all relative group ${activeServer?.id === server.id ? 'bg-indigo-600 rounded-[16px]' : 'bg-[#141414] hover:bg-indigo-500 rounded-[24px] hover:rounded-[16px]'}`}
          >
            <span className="text-white font-bold">{getInitials(server.name)}</span>
            {activeServer?.id === server.id && (
              <div className="absolute -left-[16px] w-2 h-10 bg-white rounded-r-lg"></div>
            )}
          </div>
        ))}

        <div 
          onClick={() => setShowCreateServer(true)}
          className="w-12 h-12 bg-[#141414] rounded-[24px] flex items-center justify-center cursor-pointer hover:rounded-[16px] hover:bg-green-500 transition-all text-green-500 hover:text-white"
        >
          <Plus className="w-6 h-6" />
        </div>
        
        {/* Connection Status Indicator */}
        <div className="mt-auto w-12 h-12 bg-green-500/10 rounded-[24px] flex items-center justify-center cursor-pointer hover:rounded-[16px] transition-all">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
        </div>
      </aside>

      {/* Secondary Sidebar */}
      <aside className="w-[280px] bg-[#0A0A0A] flex flex-col border-r border-[#1A1A1A] flex-shrink-0 relative">
        <div className="p-4 border-b border-[#1A1A1A] flex justify-between items-center h-[64px]">
          <h1 className="text-lg font-bold tracking-tight text-white truncate pr-2">{activeServer ? activeServer.name : 'Messages'}</h1>
          <div className="p-2 bg-[#141414] rounded-lg cursor-pointer hover:bg-[#1A1A1A] transition-colors text-[#888] hover:text-[#E0E0E0] flex-shrink-0">
            <Edit className="w-4 h-4" />
          </div>
        </div>
        
        {activeServer ? (
          <div className="flex-1 overflow-y-auto space-y-1 p-2 custom-scrollbar">
            <p className="text-xs font-bold text-[#666] uppercase px-2 mb-2 mt-2">Text Channels</p>
            {channels.map(channel => (
              <div 
                key={channel.id}
                onClick={() => selectChannel(channel)}
                className={`flex items-center px-3 py-2 rounded-lg cursor-pointer transition-colors ${activeChannel?.id === channel.id ? 'bg-[#222] text-white' : 'text-[#888] hover:bg-[#141414] hover:text-[#E0E0E0]'}`}
              >
                <Hash className="w-4 h-4 mr-2 opacity-70 flex-shrink-0" />
                <span className="text-sm font-medium truncate">{channel.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="px-4 py-3">
          <div className="relative">
            <input 
              type="text" 
              value={searchQuery}
              onChange={handleSearch}
              placeholder="Find users..." 
              className="w-full bg-[#141414] border-none rounded-lg py-2 pl-9 pr-8 text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-[#444] text-[#E0E0E0] transition-shadow" 
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#444]" />
            {searchQuery && (
              <X 
                className="absolute right-3 top-2.5 w-4 h-4 text-[#888] cursor-pointer hover:text-white" 
                onClick={() => { setSearchQuery(''); setIsSearching(false); setSearchResults([]); }}
              />
            )}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-1 p-2 custom-scrollbar">
          {isSearching ? (
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#666] uppercase px-2 mb-2">Search Results</p>
              {searchResults.length === 0 ? (
                <p className="text-xs text-[#555] px-2">No users found</p>
              ) : (
                searchResults.map(u => (
                  <div key={u.id} onClick={() => startConversation(u.id)} className="flex items-center p-3 rounded-xl cursor-pointer hover:bg-[#111] transition-colors">
                    <div className="w-10 h-10 bg-[#1A1A1A] rounded-full mr-3 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                      {getInitials(u.displayName)}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h3 className="font-medium text-sm text-white truncate">{u.displayName}</h3>
                      <p className="text-xs text-[#888] truncate">@{u.username}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              {conversations.length === 0 ? (
                <div className="p-4 text-center text-sm text-[#555]">
                  Search for users to start a conversation.
                </div>
              ) : (
                conversations.map(conv => {
                  const title = conv.isGroup ? conv.name : conv.otherMember?.displayName;
                  const isActive = activeConversation?.id === conv.id;
                  
                  return (
                    <div 
                      key={conv.id} 
                      onClick={() => selectConversation(conv)}
                      className={`flex items-center p-3 rounded-xl cursor-pointer transition-colors ${isActive ? 'bg-[#141414]' : 'hover:bg-[#111]'}`}
                    >
                      <div className="relative w-11 h-11 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full mr-3 flex-shrink-0 flex items-center justify-center text-white font-bold text-sm">
                        {conv.isGroup ? 'G' : getInitials(title)}
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#141414] rounded-full"></div>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-baseline">
                          <h3 className="font-medium text-sm text-white truncate">{title || 'Unknown'}</h3>
                          <span className="text-[10px] text-[#444] flex-shrink-0 ml-2"></span>
                        </div>
                        <p className="text-xs text-[#888] truncate">{!conv.isGroup && `@${conv.otherMember?.username}`}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
          </>
        )}
        
        {/* User Profile Footer */}
        <div className="p-4 border-t border-[#1A1A1A] flex items-center space-x-3 bg-[#0A0A0A]">
          <div className="w-9 h-9 bg-[#1A1A1A] rounded-full flex items-center justify-center text-xs border border-[#222] font-medium text-white flex-shrink-0 overflow-hidden">
            {dbUser?.avatarUrl ? (
              <img src={dbUser.avatarUrl} alt={dbUser.displayName || 'User'} className="w-full h-full object-cover" />
            ) : (
              getInitials(dbUser?.displayName)
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-bold leading-none text-white truncate">{dbUser?.displayName}</p>
            <p className="text-[10px] text-[#888] mt-1 truncate">@{dbUser?.username}</p>
          </div>
          <div className="ml-auto flex space-x-1">
            <div onClick={handleLogout} className="p-1.5 rounded hover:bg-[#1A1A1A] cursor-pointer text-[#666] hover:text-red-400 transition-colors" title="Logout">
              <MoreVertical className="w-4 h-4" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#050505]">
        {(!activeConversation && !activeChannel) ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[#555]">
            <ShieldCheck className="w-16 h-16 mb-4 opacity-50" />
            <p>Select a {activeServer ? 'channel' : 'conversation'} or start a new one</p>
          </div>
        ) : (
          <>
            <header className="h-[64px] border-b border-[#1A1A1A] flex items-center justify-between px-6 bg-[#0A0A0A]/80 backdrop-blur-md z-10 flex-shrink-0">
              <div className="flex items-center space-x-3 min-w-0">
                {activeChannel ? (
                  <div className="w-8 h-8 bg-[#1A1A1A] rounded-lg flex-shrink-0 flex items-center justify-center text-[#888]">
                    <Hash className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
                    {activeConversation?.isGroup ? 'G' : getInitials(activeConversation?.otherMember?.displayName)}
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center space-x-2">
                    <h2 className="font-bold text-sm text-white truncate">
                      {activeChannel ? activeChannel.name : (activeConversation?.isGroup ? activeConversation.name : activeConversation?.otherMember?.displayName)}
                    </h2>
                    {!activeChannel && <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
                  </div>
                  {!activeChannel && <span className="text-[10px] text-indigo-400/80 tracking-wide font-medium">E2EE ESTABLISHED</span>}
                  {activeChannel && <span className="text-[10px] text-[#888] tracking-wide font-medium">SERVER CHANNEL</span>}
                </div>
              </div>
              
              <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0 ml-4">
                {!activeChannel && (
                  <>
                    <div onClick={() => startCall(false)} className="p-2 hover:bg-[#1A1A1A] rounded-lg cursor-pointer text-[#888] hover:text-white transition-colors">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div onClick={() => startCall(true)} className="p-2 hover:bg-[#1A1A1A] rounded-lg cursor-pointer text-[#888] hover:text-white transition-colors">
                      <Video className="w-4 h-4" />
                    </div>
                    <div className="h-4 w-[1px] bg-[#222] mx-1 md:mx-0"></div>
                  </>
                )}
                <div className="p-2 hover:bg-[#1A1A1A] rounded-lg cursor-pointer text-[#888] hover:text-white transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </div>
              </div>
            </header>
            
            <section className="flex-1 p-6 overflow-y-auto flex flex-col space-y-6 custom-scrollbar">
              <div className="mt-auto"></div>
              {messages.map(msg => {
                const isMe = msg.senderId === dbUser?.id;
                
                return isMe ? (
                  <div key={msg.id} className="flex flex-col items-end space-y-2">
                    <div className="flex items-end justify-end space-x-3 max-w-[85%] md:max-w-[70%]">
                      <div className="bg-indigo-600 p-4 rounded-2xl rounded-br-none text-white shadow-lg shadow-indigo-500/10">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.encryptedContent}</p>
                        <div className="mt-2 flex justify-end items-center space-x-1.5">
                          <span className="text-[10px] text-indigo-200/80">
                            {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                          <CheckCheck className="w-3.5 h-3.5 text-indigo-300" />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex items-end space-x-3 max-w-[85%] md:max-w-[70%]">
                    <div className="w-8 h-8 rounded-lg bg-[#1A1A1A] flex-shrink-0 flex items-center justify-center text-xs font-bold text-white border border-[#222]">
                      {getInitials(msg.sender?.displayName)}
                    </div>
                    <div className="bg-[#141414] p-4 rounded-2xl rounded-bl-none border border-[#1A1A1A] shadow-sm">
                      <p className="text-[11px] font-bold text-indigo-400 mb-1">{msg.sender?.displayName}</p>
                      <p className="text-sm leading-relaxed text-[#E0E0E0] whitespace-pre-wrap">{msg.encryptedContent}</p>
                      <div className="mt-2 text-[10px] text-[#555]">
                        {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </section>
            
            <footer className="p-4 md:p-6 pt-2 bg-[#0A0A0A] flex-shrink-0">
              <form onSubmit={handleSendMessage} className="bg-[#141414] border border-[#1A1A1A] rounded-[24px] p-2 flex items-center space-x-2 focus-within:border-indigo-500/50 transition-all shadow-sm">
                <div className="p-2 hover:bg-[#1A1A1A] rounded-full cursor-pointer text-[#666] hover:text-[#E0E0E0] transition-colors flex-shrink-0">
                  <Mic className="w-5 h-5" />
                </div>
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Message ${activeChannel ? activeChannel.name : (activeConversation?.isGroup ? activeConversation.name : activeConversation?.otherMember?.displayName)}...`} 
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm placeholder-[#555] text-white px-2 focus:outline-none" 
                  autoComplete="off"
                />
                <button type="submit" disabled={!newMessage.trim()} className="flex items-center space-x-1 pr-1 flex-shrink-0 focus:outline-none disabled:opacity-50">
                  <div className="p-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-full cursor-pointer text-white shadow-lg shadow-indigo-600/20 transition-all">
                    <Send className="w-4 h-4 ml-0.5" />
                  </div>
                </button>
              </form>
              
              <div className="mt-3 flex justify-center">
                <div className="text-[9px] text-[#444] flex items-center space-x-2 uppercase tracking-[0.2em] font-bold">
                  <ShieldCheck className="w-3 h-3 text-[#555]" />
                  <span>Secured by Protocol v2.4</span>
                </div>
              </div>
            </footer>
          </>
        )}
      </main>

      {/* Modals */}
      {showCreateServer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#222] rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Create a Server</h2>
              <X className="w-5 h-5 text-[#888] cursor-pointer hover:text-white" onClick={() => setShowCreateServer(false)} />
            </div>
            <form onSubmit={handleCreateServer}>
              <div className="mb-6">
                <label className="block text-xs font-bold text-[#888] uppercase mb-2">Server Name</label>
                <input 
                  type="text" 
                  value={newServerName}
                  onChange={e => setNewServerName(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#222] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Study Group"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button type="button" onClick={() => setShowCreateServer(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:bg-[#1A1A1A] transition-colors">Cancel</button>
                <button type="submit" disabled={!newServerName.trim()} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors">Create Server</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Incoming Call Modal */}
      {incomingCall && !activeCall && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#222] rounded-3xl w-full max-w-sm shadow-2xl p-8 flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-lg shadow-indigo-500/20">
              {getInitials(incomingCall.from.displayName)}
            </div>
            <h2 className="text-xl font-bold text-white mb-1">{incomingCall.from.displayName}</h2>
            <p className="text-[#888] text-sm mb-8">Incoming {incomingCall.isVideo ? 'Video' : 'Voice'} Call...</p>
            
            <div className="flex items-center space-x-6 w-full justify-center">
              <div onClick={rejectCall} className="w-14 h-14 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-full flex items-center justify-center cursor-pointer transition-colors shadow-lg">
                <PhoneOff className="w-6 h-6" />
              </div>
              <div onClick={acceptCall} className="w-14 h-14 bg-green-500 hover:bg-green-400 text-white rounded-full flex items-center justify-center cursor-pointer transition-colors shadow-lg shadow-green-500/30 animate-pulse">
                {incomingCall.isVideo ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Call Overlay */}
      {activeCall && (
        <CallScreen 
          activeCall={activeCall} 
          onEnd={() => { 
            setActiveCall(null); 
            setIncomingCall(null); 
          }} 
        />
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #1A1A1A;
          border-radius: 10px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: #333;
        }
      `}</style>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { Mic, Video as VideoIcon, PhoneOff, ShieldCheck, MicOff, VideoOff } from 'lucide-react';
import { getSocket } from '../lib/socket';

export function CallScreen({ activeCall, onEnd }: { activeCall: any, onEnd: () => void }) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(!activeCall.isVideo);
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    let interval: any;
    if (activeCall.connected) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeCall.connected]);

  useEffect(() => {
    const initCall = async () => {
      try {
        let stream = localStream.current;
        if (!stream) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: activeCall.isVideo,
            audio: true
          });
          localStream.current = stream;
        }
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
          ]
        });
        peerConnection.current = pc;

        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream!);
        });

        pc.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const socket = getSocket();
            if (socket) {
              socket.emit('webrtc-ice-candidate', {
                conversationId: activeCall.conversationId,
                candidate: event.candidate
              });
            }
          }
        };

        const socket = getSocket();
        if (socket) {
          socket.on('webrtc-offer', async (data: any) => {
            if (pc.signalingState !== 'stable') return;
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('webrtc-answer', {
              conversationId: activeCall.conversationId,
              answer
            });
          });

          socket.on('webrtc-answer', async (data: any) => {
            if (pc.signalingState !== 'have-local-offer') return;
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          });

          socket.on('webrtc-ice-candidate', async (data: any) => {
            try {
              if (data.candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              }
            } catch (e) {
              console.error('Error adding ICE candidate', e);
            }
          });

          // If we are the caller and connected is true, we initiate the offer
          // Add a small delay to ensure the receiver has finished starting their PC
          if (activeCall.isCaller && activeCall.connected) {
            setTimeout(async () => {
              try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('webrtc-offer', {
                  conversationId: activeCall.conversationId,
                  offer
                });
              } catch (e) {
                console.error("Failed to create offer", e);
              }
            }, 1000);
          }
        }
      } catch (err) {
        console.error('Failed to get local stream', err);
      }
    };

    if (activeCall.connected) {
      initCall();
    } else if (activeCall.isCaller) {
      // Setup local stream even while ringing
      navigator.mediaDevices.getUserMedia({ video: activeCall.isVideo, audio: true })
        .then(stream => {
          localStream.current = stream;
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        }).catch(err => console.error(err));
    }

    return () => {
      const socket = getSocket();
      if (socket) {
        socket.off('webrtc-offer');
        socket.off('webrtc-answer');
        socket.off('webrtc-ice-candidate');
      }
    };
  }, [activeCall.connected, activeCall.isCaller, activeCall.isVideo, activeCall.conversationId]);

  // Clean up when unmounting (call ended)
  useEffect(() => {
    return () => {
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnection.current) {
        peerConnection.current.close();
      }
    };
  }, []);

  const toggleMute = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream.current) {
      localStream.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getInitials = (name?: string | null) => {
    return name ? name.substring(0, 2).toUpperCase() : 'U';
  };

  return (
    <div className="fixed inset-0 bg-[#0A0A0A] z-50 flex flex-col items-center justify-center">
      <div className="absolute top-8 left-8 text-white font-bold text-xl flex items-center space-x-3 z-20">
        <ShieldCheck className="w-6 h-6 text-indigo-500" />
        <span>End-to-End Encrypted Call</span>
      </div>
      
      <div className="w-full h-full relative flex items-center justify-center">
        {activeCall.isVideo ? (
          <>
            {/* Remote Video (Full Screen) */}
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline 
              className={`w-full h-full object-cover ${!activeCall.connected ? 'hidden' : ''}`} 
            />
            
            {/* Local Video (Picture in Picture) */}
            <div className="absolute top-8 right-8 w-48 h-72 bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-2xl border-2 border-[#333] z-20">
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover" 
              />
            </div>
            
            {/* Placeholder if remote hasn't connected or video is off */}
            {!activeCall.connected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[#0A0A0A]">
                <div className="relative">
                  <div className="w-48 h-48 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-white text-6xl font-bold shadow-2xl shadow-indigo-500/20 relative z-10">
                    {getInitials(activeCall.peer?.displayName)}
                  </div>
                  <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping"></div>
                  <div className="absolute -inset-4 bg-indigo-500/10 rounded-full animate-ping" style={{ animationDelay: '300ms' }}></div>
                </div>
                <h2 className="text-3xl font-bold text-white mt-12">{activeCall.peer?.displayName}</h2>
                <p className="text-[#888] mt-2 text-lg">Connecting...</p>
              </div>
            )}
          </>
        ) : (
          /* Audio Call Layout */
          <div className="flex flex-col items-center justify-center z-10">
            <div className="relative">
              <div className="w-48 h-48 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-white text-6xl font-bold shadow-2xl shadow-indigo-500/20 relative z-10">
                {getInitials(activeCall.peer?.displayName)}
              </div>
              {activeCall.connected && (
                <>
                  <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping" style={{ animationDuration: '2s' }}></div>
                </>
              )}
              {!activeCall.connected && (
                <>
                  <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping"></div>
                  <div className="absolute -inset-4 bg-indigo-500/10 rounded-full animate-ping" style={{ animationDelay: '300ms' }}></div>
                </>
              )}
            </div>
            <h2 className="text-3xl font-bold text-white mt-12">{activeCall.peer?.displayName}</h2>
            <p className="text-[#888] mt-2 text-lg font-mono">
              {activeCall.connected ? formatTime(callDuration) : 'Connecting...'}
            </p>
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="absolute bottom-12 bg-[#141414]/90 backdrop-blur-md border border-[#222] p-4 rounded-[32px] flex items-center space-x-4 shadow-2xl z-20">
        <div onClick={toggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition-colors ${isMuted ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-[#222] hover:bg-[#333] text-white'}`}>
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </div>
        {activeCall.isVideo && (
          <div onClick={toggleVideo} className={`w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition-colors ${isVideoOff ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-[#222] hover:bg-[#333] text-white'}`}>
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <VideoIcon className="w-6 h-6" />}
          </div>
        )}
        <div onClick={() => {
          const socket = getSocket();
          if (socket) socket.emit('end-call', { conversationId: activeCall.conversationId });
          onEnd();
        }} className="w-16 h-16 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center cursor-pointer text-white shadow-lg shadow-red-500/20 transition-all transform hover:scale-105 ml-4">
          <PhoneOff className="w-7 h-7" />
        </div>
      </div>
    </div>
  );
}

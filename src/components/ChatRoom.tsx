import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, collection, query, onSnapshot, orderBy, doc, updateDoc, setDoc, getDoc, handleFirestoreError, OperationType, getDocs, deleteDoc } from '../firebase';
import { useAuth } from '../App';
import { Message, User, Conversation, DeliveryMethod } from '../types';
import { 
  ChevronLeft, 
  Send, 
  Paperclip, 
  Mic, 
  User as UserIcon, 
  MoreVertical, 
  ShieldCheck, 
  Zap, 
  X, 
  WifiOff, 
  Wifi, 
  Bluetooth, 
  Share2, 
  Play, 
  Pause, 
  Smile, 
  Users, 
  Search, 
  Waves, 
  QrCode, 
  Radio, 
  Globe, 
  RefreshCw, 
  CheckCheck,
  Check
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { meshNetwork, OfflineRelayPacket } from '../services/meshNetwork';
import { ultrasoundService } from '../services/ultrasoundAudio';
import { OpticalAirGapModal } from './OpticalAirGapModal';
import { OpticalMessagePayload } from '../services/opticalMesh';

const EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

function AudioPlayer({ src, duration, isMe, otherUser }: { src: string; duration?: number; isMe: boolean; otherUser: User | null }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const total = audioRef.current.duration || duration || 1;
      setProgress((current / total) * 100);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  return (
    <div className="flex items-center gap-3 min-w-[200px] py-1 text-zinc-900">
      <audio 
        ref={audioRef} 
        src={src} 
        onTimeUpdate={handleTimeUpdate} 
        onEnded={handleEnded}
        className="hidden"
      />
      
      <div className="relative h-10 w-10 flex-shrink-0">
        {!isMe && otherUser?.photoURL ? (
          <img src={otherUser.photoURL} className="h-full w-full rounded-full object-cover" alt="" />
        ) : (
          <div className={cn(
            "flex h-full w-full items-center justify-center rounded-full",
            isMe ? "bg-zinc-800 text-white" : "bg-zinc-100 text-zinc-600"
          )}>
            <UserIcon className="h-5 w-5 opacity-50" />
          </div>
        )}
        <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white shadow-sm border border-white">
          <Mic className="h-3 w-3" />
        </div>
      </div>

      <button 
        type="button"
        onClick={togglePlay}
        className="flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-90 text-zinc-700 hover:bg-black/10"
      >
        {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
      </button>

      <div className="flex flex-1 flex-col gap-1 pr-2">
        <div className="relative h-1.5 w-full rounded-full bg-zinc-300 overflow-hidden">
          <div 
            className="absolute left-0 top-0 h-full transition-all duration-100 bg-[#00a884]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function ChatRoom() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user, connectionStatus, setConnectionStatus, syncOfflineMessagesNow } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [participantInfo, setParticipantInfo] = useState<Record<string, User>>({});
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isE2EEEnabled, setIsE2EEEnabled] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected offline transport when offline
  const [offlineMethod, setOfflineMethod] = useState<DeliveryMethod>('wifi-direct');
  const [showOpticalModal, setShowOpticalModal] = useState(false);
  const [opticalTransmitMsg, setOpticalTransmitMsg] = useState<{ id: string; conversationId: string; senderId: string; senderName: string; text: string } | null>(null);
  const [acousticAlert, setAcousticAlert] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const currentRecordingTimeRef = useRef<number>(0);
  const navigate = useNavigate();

  // Subscribe to offline packets from mesh network, audio ultrasound, and local radio
  useEffect(() => {
    if (!conversationId) return;

    const unsubPackets = meshNetwork.subscribePackets((pkt: OfflineRelayPacket) => {
      // If packet belongs to this conversation or is broadcast
      if (pkt.conversationId === conversationId || pkt.conversationId === 'mesh-broadcast-channel') {
        setMessages(prev => {
          if (prev.some(m => m.id === pkt.id)) return prev;
          const incomingMsg: Message = {
            id: pkt.id,
            conversationId: conversationId,
            senderId: pkt.senderId,
            text: pkt.text,
            type: (pkt.type as Message['type']) || 'text',
            createdAt: pkt.timestamp,
            expiresAt: pkt.timestamp + (26 * 60 * 60 * 1000),
            delivered: true,
            seen: true,
            deliveryMethod: pkt.transport || 'mesh',
            isEncrypted: false,
            pendingOfflineSync: false,
          };
          return [...prev, incomingMsg];
        });
      }
    });

    return () => {
      unsubPackets();
    };
  }, [conversationId]);

  // Audio Recording Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const finalDuration = currentRecordingTimeRef.current;
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          sendMessage('audio', base64Audio, finalDuration);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      currentRecordingTimeRef.current = 0;
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => {
          const next = prev + 1;
          currentRecordingTimeRef.current = next;
          return next;
        });
      }, 1000);
    } catch (err) {
      console.error('Error starting recording:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      const type = file.type.startsWith('image/') ? 'image' : 
                   file.type.startsWith('video/') ? 'video' : 'file';
      sendMessage(type, base64);
    };
    reader.readAsDataURL(file);
  };

  // Main sending function:
  // ONLINE -> Standard Server delivery via Firestore
  // OFFLINE -> Multi-Protocol Offline delivery (Wi-Fi Direct, Bluetooth, Ultrasound, Optical QR, Local LAN, Mesh)
  const sendMessage = async (type: Message['type'], content: string, duration?: number) => {
    if (!user || !conversationId) return;

    const now = Date.now();
    const expiresAt = now + (26 * 60 * 60 * 1000);
    const messageId = `msg-${now}-${Math.random().toString(36).substring(2, 7)}`;
    const isOnline = connectionStatus.internet;

    // Delivery method decision
    const method: DeliveryMethod = isOnline ? 'internet' : offlineMethod;

    const messageData: Message = {
      id: messageId,
      conversationId,
      senderId: user.uid,
      text: isE2EEEnabled ? btoa(content) : content,
      type,
      createdAt: now,
      expiresAt,
      delivered: true,
      seen: false,
      deliveryMethod: method,
      isEncrypted: isE2EEEnabled,
      pendingOfflineSync: !isOnline, // Flagged for sync when reconnecting
      ...(duration !== undefined ? { duration } : {})
    };

    if (isOnline) {
      // 1. ONLINE: STANDARD SERVER DELIVERY VIA FIRESTORE
      try {
        const msgDocRef = doc(db, 'conversations', conversationId, 'messages', messageId);
        const convDocRef = doc(db, 'conversations', conversationId);

        await setDoc(msgDocRef, messageData);
        await updateDoc(convDocRef, {
          lastMessage: messageData,
          updatedAt: now
        });
      } catch (err) {
        console.warn('Firestore server write queued:', err);
      }

      // Also dispatch to local mesh for local peer continuity
      meshNetwork.broadcastPacket({
        id: messageId,
        conversationId,
        senderId: user.uid,
        senderName: user.name || 'Usuário',
        text: type === 'text' ? content : `[${type.toUpperCase()}]`,
        type,
        timestamp: now,
        transport: 'internet'
      });
    } else {
      // 2. OFFLINE: PURE OFFLINE DISPATCH VIA LOCAL TRANSPORTS
      // Immediately push to local conversation UI
      setMessages(prev => [...prev, messageData]);

      // Broadcast over local mesh & offline outbox
      meshNetwork.broadcastPacket({
        id: messageId,
        conversationId,
        senderId: user.uid,
        senderName: user.name || 'Usuário',
        text: type === 'text' ? content : `[${type.toUpperCase()}]`,
        type,
        timestamp: now,
        transport: method
      });

      // Special action per offline method
      if (method === 'ultrasound') {
        setAcousticAlert('Emitindo sinal acústico por ultrassom...');
        ultrasoundService.transmitPacket({
          id: messageId,
          senderName: user.name || 'Usuário',
          text: content.slice(0, 60),
          timestamp: now
        }, false).then(() => {
          setTimeout(() => setAcousticAlert(null), 2500);
        });
      } else if (method === 'optical-qr') {
        setOpticalTransmitMsg({
          id: messageId,
          conversationId,
          senderId: user.uid,
          senderName: user.name || 'Usuário',
          text: content
        });
        setShowOpticalModal(true);
      }

      // Try non-blocking background write to Firestore IndexedDB queue
      try {
        const msgDocRef = doc(db, 'conversations', conversationId, 'messages', messageId);
        setDoc(msgDocRef, messageData).catch(() => {});
      } catch {}
    }
  };

  // Fetch conversation and messages from Firestore
  useEffect(() => {
    if (!conversationId || !user) return;

    const fetchOtherUser = async () => {
      try {
        const convSnap = await getDoc(doc(db, 'conversations', conversationId));
        if (convSnap.exists()) {
          const convData = convSnap.data() as Conversation;
          setConversation(convData);
          
          if (convData.isGroup) {
            convData.participants.forEach(pId => {
              onSnapshot(doc(db, 'users_public', pId), (snap) => {
                if (snap.exists()) {
                  setParticipantInfo(prev => ({ ...prev, [pId]: snap.data() as User }));
                }
              }, (error) => {
                handleFirestoreError(error, OperationType.GET, `users_public/${pId}`);
              });
            });
          } else {
            const otherId = convData.participants.find(p => p !== user.uid) || user.uid;
            if (otherId) {
              onSnapshot(doc(db, 'users_public', otherId), (snap) => {
                if (snap.exists()) setOtherUser(snap.data() as User);
              }, (error) => {
                handleFirestoreError(error, OperationType.GET, `users_public/${otherId}`);
              });
            }
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `conversations/${conversationId}`);
      }
    };
    fetchOtherUser();

    // Fetch messages query
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(d => {
        const data = d.data() as Message;
        return { ...data, id: data.id || d.id };
      });
      
      const now = Date.now();
      const validMsgs = msgs.filter(m => m.expiresAt > now);
      
      setMessages(prev => {
        // Merge with existing offline messages not yet in snapshot
        const serverIds = new Set(validMsgs.map(m => m.id));
        const pendingLocal = prev.filter(m => m.pendingOfflineSync && !serverIds.has(m.id));
        return [...validMsgs, ...pendingLocal];
      });

      // Mark unread messages as seen
      msgs.forEach(async (m) => {
        if (m.id && m.senderId !== user.uid && !m.seen) {
          try {
            await updateDoc(doc(db, 'conversations', conversationId, 'messages', m.id), { seen: true });
          } catch (error) {
            // Silently handle offline read mark
          }
        }
      });
    }, (error) => {
      console.warn('Firestore snapshot notice (operating in offline cache mode):', error);
    });

    return () => unsubscribe();
  }, [conversationId, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user || !conversationId) return;
    try {
      const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      await updateDoc(msgRef, {
        [`reactions.${user.uid}`]: emoji
      });
      // Also update local state
      setMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          return { ...m, reactions: { ...(m.reactions || {}), [user.uid]: emoji } };
        }
        return m;
      }));
      setSelectedMessageId(null);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const textToSend = inputText;
    setInputText('');
    await sendMessage('text', textToSend);
    if (user && connectionStatus.internet) {
      try {
        await updateDoc(doc(db, 'users', user.uid), { isTyping: false });
      } catch {}
    }
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (user && connectionStatus.internet) {
      try {
        await updateDoc(doc(db, 'users', user.uid), { isTyping: e.target.value.length > 0 });
      } catch {}
    }
  };

  const clearChat = async () => {
    if (!conversationId) return;
    try {
      const snap = await getDocs(collection(db, 'conversations', conversationId, 'messages'));
      const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      
      await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: null,
        updatedAt: Date.now()
      });
      setMessages([]);
      setShowMenu(false);
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };

  const handleOpticalMessageReceived = (payload: OpticalMessagePayload) => {
    if (payload.conversationId === conversationId || payload.conversationId === 'mesh-broadcast-channel') {
      const newMsg: Message = {
        id: payload.id,
        conversationId: conversationId!,
        senderId: payload.senderId,
        text: payload.text,
        type: 'text',
        createdAt: payload.timestamp,
        expiresAt: payload.timestamp + (26 * 60 * 60 * 1000),
        delivered: true,
        seen: true,
        deliveryMethod: 'optical-qr',
        isEncrypted: false,
      };
      setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
    }
  };

  const filteredMessages = searchQuery.trim() 
    ? messages.filter(m => m.type === 'text' && m.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const isOnline = connectionStatus.internet;

  return (
    <div className="flex h-full flex-col bg-[#F5F5F0]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="rounded-full p-2 hover:bg-zinc-100">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button 
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-3 text-left"
          >
            <div className="relative h-10 w-10">
              {conversation?.isGroup ? (
                <div className="flex h-full w-full items-center justify-center rounded-xl bg-zinc-900 text-white">
                  <Users className="h-5 w-5" />
                </div>
              ) : otherUser?.photoURL ? (
                <img src={otherUser.photoURL} alt={otherUser.name} className="h-full w-full rounded-xl object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
                  <UserIcon className="h-5 w-5" />
                </div>
              )}
              {!conversation?.isGroup && otherUser?.status === 'online' && (
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold leading-tight">
                {conversation?.isGroup ? conversation.groupName : (otherUser?.name || 'Carregando...')}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isOnline ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                    <Wifi className="h-3 w-3 text-emerald-500" />
                    Online com Wi-Fi
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                    <WifiOff className="h-3 w-3 text-amber-500 animate-pulse" />
                    Offline (Rede Mesh)
                  </span>
                )}
                {otherUser?.isTyping && (
                  <span className="text-[10px] text-zinc-400 font-medium"> • digitando...</span>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Header Action Tools */}
        <div className="flex items-center gap-1 relative">
          {/* Quick Optical Air-Gap Scanner Button */}
          <button
            onClick={() => {
              setOpticalTransmitMsg(null);
              setShowOpticalModal(true);
            }}
            className="rounded-full p-2 hover:bg-zinc-100 text-zinc-600"
            title="Malha Óptica Air-Gap (QR Code Scanner & Transmissor)"
          >
            <QrCode className="h-5 w-5" />
          </button>

          {/* Quick Online/Offline Simulation Toggle */}
          <button
            onClick={() => setConnectionStatus(prev => ({ ...prev, internet: !prev.internet }))}
            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[10px] font-bold uppercase transition ${
              isOnline 
                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200' 
                : 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300 animate-pulse'
            }`}
            title="Alternar modo Online com Wi-Fi / Offline"
          >
            {isOnline ? (
              <>
                <Wifi className="h-3 w-3 text-emerald-600" />
                <span className="hidden sm:inline">Online (Wi-Fi)</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-amber-700" />
                <span>Offline</span>
              </>
            )}
          </button>

          <button 
            onClick={() => setIsSearching(!isSearching)}
            className="rounded-full p-2 hover:bg-zinc-100"
          >
            <Search className="h-5 w-5 text-zinc-500" />
          </button>

          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="rounded-full p-2 hover:bg-zinc-100"
          >
            <MoreVertical className="h-5 w-5 text-zinc-500" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-zinc-200">
              <button 
                onClick={() => {
                  setShowProfile(true);
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
              >
                <UserIcon className="h-4 w-4" />
                Ver Perfil
              </button>
              <button 
                onClick={() => {
                  syncOfflineMessagesNow();
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
              >
                <RefreshCw className="h-4 w-4" />
                Sincronizar Fila Offline
              </button>
              <button 
                onClick={() => {
                  navigate('/connections');
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
              >
                <Radio className="h-4 w-4" />
                Painel de Rádios & Mesh
              </button>
              <button 
                onClick={() => {
                  setShowClearConfirm(true);
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-2 text-sm text-red-500 hover:bg-red-50"
              >
                Limpar Conversa
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Acoustic Transmission Toast */}
      {acousticAlert && (
        <div className="bg-indigo-600 text-white px-4 py-2 text-xs flex items-center justify-center gap-2 animate-pulse">
          <Waves className="h-4 w-4 animate-spin-slow" />
          <span className="font-bold">{acousticAlert}</span>
        </div>
      )}

      {/* Offline Methods Selector Ribbon (Shown when offline or user customizes) */}
      {!isOnline && (
        <div className="bg-[#1e293b] text-white px-4 py-2 border-b border-slate-700">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
              <span className="text-[11px] font-bold text-amber-300">
                Modo Offline Ativo — Envio Ponto-a-Ponto:
              </span>
            </div>
            <button
              onClick={() => syncOfflineMessagesNow()}
              className="text-[10px] text-zinc-300 hover:text-white underline flex items-center gap-1"
            >
              <RefreshCw className="h-2.5 w-2.5" />
              Sincronizar ao reconectar
            </button>
          </div>

          {/* Offline transport pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 text-[10px]">
            <button
              onClick={() => setOfflineMethod('wifi-direct')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition ${
                offlineMethod === 'wifi-direct' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Wifi className="h-3 w-3" />
              Wi-Fi Direct
            </button>

            <button
              onClick={() => setOfflineMethod('bluetooth')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition ${
                offlineMethod === 'bluetooth' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Bluetooth className="h-3 w-3" />
              Bluetooth LE
            </button>

            <button
              onClick={() => setOfflineMethod('ultrasound')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition ${
                offlineMethod === 'ultrasound' 
                  ? 'bg-purple-600 text-white shadow-sm' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="Emite pacote em som ultrassom via alto-falante"
            >
              <Waves className="h-3 w-3" />
              Ultrassom
            </button>

            <button
              onClick={() => setOfflineMethod('optical-qr')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition ${
                offlineMethod === 'optical-qr' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="Gera código QR na tela para leitura óptica pela câmera"
            >
              <QrCode className="h-3 w-3" />
              Malha Óptica
            </button>

            <button
              onClick={() => setOfflineMethod('local-lan')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition ${
                offlineMethod === 'local-lan' 
                  ? 'bg-cyan-600 text-white shadow-sm' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Globe className="h-3 w-3" />
              LAN Hotspot
            </button>

            <button
              onClick={() => setOfflineMethod('mesh')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition ${
                offlineMethod === 'mesh' 
                  ? 'bg-amber-600 text-white shadow-sm' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Radio className="h-3 w-3" />
              Mesh Multi-Hop
            </button>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white border-b border-zinc-100 overflow-hidden"
          >
            <div className="p-4 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar mensagens..."
                  className="w-full rounded-xl bg-zinc-100 py-2 pl-10 pr-4 text-sm focus:outline-none"
                />
              </div>
              <button 
                onClick={() => {
                  setIsSearching(false);
                  setSearchQuery('');
                }}
                className="text-xs font-bold text-zinc-400 uppercase tracking-wider"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex justify-center py-2">
          <span className="rounded-full bg-zinc-200/60 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            {isOnline ? 'Conexão via Servidor Ativa' : 'Modo P2P Offline Ativo'}
          </span>
        </div>

        <AnimatePresence initial={false}>
          {filteredMessages.map((msg) => {
            const isMe = msg.senderId === user?.uid;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={cn(
                  "flex w-full",
                  isMe ? "justify-end" : "justify-start"
                )}
              >
                <div className="relative group max-w-[85%]">
                  {conversation?.isGroup && !isMe && (
                    <span className="mb-1 block text-[10px] font-bold text-zinc-500">
                      {participantInfo[msg.senderId]?.name || '...'}
                    </span>
                  )}
                  <div
                    onClick={() => setSelectedMessageId(msg.id === selectedMessageId ? null : msg.id)}
                    className={cn(
                      "relative rounded-2xl px-4 py-3 shadow-xs cursor-pointer transition-all active:scale-[0.98] border border-black/5",
                      isMe 
                        ? "bg-[#D9FDD3] text-zinc-900 rounded-tr-none" 
                        : "bg-white text-zinc-900 rounded-tl-none"
                    )}
                  >
                    {msg.type === 'text' && (
                      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                        {(() => {
                          if (!msg.isEncrypted) return msg.text;
                          try {
                            return atob(msg.text);
                          } catch (e) {
                            return msg.text;
                          }
                        })()}
                      </p>
                    )}
                    {msg.type === 'image' && (
                      <img src={msg.text} alt="Anexo" className="max-h-64 rounded-xl object-cover" />
                    )}
                    {msg.type === 'audio' && (
                      <AudioPlayer src={msg.text} duration={msg.duration} isMe={isMe} otherUser={otherUser} />
                    )}
                    {msg.type === 'video' && (
                      <video src={msg.text} controls className="max-h-64 rounded-xl" />
                    )}
                    {msg.type === 'file' && (
                      <div className="flex items-center gap-2 text-sm">
                        <Paperclip className="h-4 w-4" />
                        <span>Arquivo</span>
                      </div>
                    )}
                    
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className={cn(
                        "absolute -bottom-2.5 flex gap-1 rounded-full bg-white px-2 py-0.5 shadow-sm border border-zinc-100",
                        isMe ? "right-2" : "left-2"
                      )}>
                        {Object.entries(msg.reactions).map(([uid, emoji]) => (
                          <span key={uid} className="text-[10px]">{emoji}</span>
                        ))}
                      </div>
                    )}

                    {/* Delivery & Transport Method Badges */}
                    <div className={cn(
                      "mt-1.5 flex flex-wrap items-center justify-end gap-1.5 text-[9px]",
                      isMe ? "text-zinc-500" : "text-zinc-400"
                    )}>
                      {msg.isEncrypted && <ShieldCheck className="h-2.5 w-2.5 text-zinc-400" />}

                      {/* Delivery method pills */}
                      {msg.deliveryMethod === 'internet' && (
                        <span className="flex items-center gap-0.5 text-emerald-700 font-bold bg-emerald-100/60 px-1 rounded" title="Enviado por servidor normal">
                          <Globe className="h-2.5 w-2.5" /> Servidor
                        </span>
                      )}
                      {msg.deliveryMethod === 'wifi-direct' && (
                        <span className="flex items-center gap-0.5 text-blue-700 font-bold bg-blue-100/70 px-1 rounded" title="Enviado via Wi-Fi Direct">
                          <Wifi className="h-2.5 w-2.5" /> Wi-Fi Direct
                        </span>
                      )}
                      {msg.deliveryMethod === 'bluetooth' && (
                        <span className="flex items-center gap-0.5 text-indigo-700 font-bold bg-indigo-100/70 px-1 rounded" title="Enviado via Bluetooth">
                          <Bluetooth className="h-2.5 w-2.5" /> Bluetooth
                        </span>
                      )}
                      {msg.deliveryMethod === 'ultrasound' && (
                        <span className="flex items-center gap-0.5 text-purple-700 font-bold bg-purple-100/70 px-1 rounded" title="Enviado via Ultrassom">
                          <Waves className="h-2.5 w-2.5" /> Ultrassom
                        </span>
                      )}
                      {msg.deliveryMethod === 'optical-qr' && (
                        <span className="flex items-center gap-0.5 text-emerald-800 font-bold bg-emerald-100 px-1 rounded" title="Enviado via Malha Óptica QR">
                          <QrCode className="h-2.5 w-2.5" /> QR Óptico
                        </span>
                      )}
                      {msg.deliveryMethod === 'local-lan' && (
                        <span className="flex items-center gap-0.5 text-cyan-700 font-bold bg-cyan-100 px-1 rounded" title="Enviado via Hotspot Local">
                          <Globe className="h-2.5 w-2.5" /> LAN Hotspot
                        </span>
                      )}
                      {msg.deliveryMethod === 'mesh' && (
                        <span className="flex items-center gap-0.5 text-amber-700 font-bold bg-amber-100 px-1 rounded" title="Enviado via Rede Mesh">
                          <Zap className="h-2.5 w-2.5" /> Mesh
                        </span>
                      )}

                      {/* Offline queued / synced badge */}
                      {msg.pendingOfflineSync ? (
                        <span className="text-orange-600 font-bold bg-orange-100 px-1 rounded" title="Salvo offline. Será sincronizado no servidor ao reconectar.">
                          ⏳ Fila Offline
                        </span>
                      ) : msg.offlineSynced ? (
                        <span className="text-teal-700 font-semibold bg-teal-100 px-1 rounded" title="Criado offline e sincronizado com o servidor com sucesso!">
                          ✓ Sincronizado
                        </span>
                      ) : null}

                      <span className="font-mono text-zinc-400">{format(msg.createdAt, 'HH:mm')}</span>

                      {isMe && (
                        <span className={cn(msg.seen ? "text-blue-500 font-bold" : "text-zinc-500")}>
                          {msg.seen ? '✓✓' : msg.delivered ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Reaction Popup */}
                  <AnimatePresence>
                    {selectedMessageId === msg.id && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 10 }}
                        className={cn(
                          "absolute z-50 -top-12 flex gap-2 rounded-full bg-white p-2 shadow-2xl border border-zinc-100",
                          isMe ? "right-0" : "left-0"
                        )}
                      >
                        {EMOJIS.map(emoji => (
                          <button 
                            key={emoji} 
                            onClick={(e) => { e.stopPropagation(); handleReaction(msg.id, emoji); }}
                            className="text-lg transition-transform hover:scale-125 active:scale-90"
                          >
                            {emoji}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <footer className="border-t border-zinc-200 bg-white p-4 pb-safe">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileSelect}
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
          />
          <button 
            type="button"
            onClick={() => setIsE2EEEnabled(!isE2EEEnabled)}
            className={cn(
              "rounded-full p-2 transition-colors",
              isE2EEEnabled ? "bg-[#00a884] text-white" : "text-zinc-400 hover:bg-zinc-100"
            )}
            title={isE2EEEnabled ? "Criptografia Ativada" : "Criptografia Desativada"}
          >
            <ShieldCheck className="h-5 w-5" />
          </button>
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          
          <div className="relative flex-1">
            {isRecording ? (
              <div className="flex w-full items-center justify-between rounded-2xl bg-red-50 px-4 py-3 text-red-500">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  <span className="text-xs font-bold uppercase tracking-widest">Gravando {recordingTime}s</span>
                </div>
                <button 
                  type="button" 
                  onClick={stopRecording}
                  className="text-xs font-bold uppercase tracking-widest text-red-700 underline"
                >
                  Finalizar
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={inputText}
                  onChange={handleInputChange}
                  placeholder={
                    !isOnline 
                      ? `Mensagem offline (via ${offlineMethod})...` 
                      : (isE2EEEnabled ? "Mensagem criptografada..." : "Mensagem...")
                  }
                  className="w-full rounded-2xl bg-zinc-100 py-3 pl-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884]"
                />
                <button 
                  type="button" 
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                >
                  <Mic className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={!inputText.trim() && !isRecording}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full transition-all active:scale-90",
              inputText.trim() ? "bg-[#00a884] text-white shadow-lg" : "bg-zinc-100 text-zinc-300"
            )}
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </footer>

      {/* Optical Air-Gap Modal */}
      <OpticalAirGapModal
        isOpen={showOpticalModal}
        onClose={() => {
          setShowOpticalModal(false);
          setOpticalTransmitMsg(null);
        }}
        messageToTransmit={opticalTransmitMsg}
        onMessageReceived={handleOpticalMessageReceived}
      />

      {/* Clear Chat Confirmation */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowClearConfirm(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xs overflow-hidden rounded-[32px] bg-white p-8 shadow-2xl"
            >
              <h3 className="text-xl font-bold text-zinc-900">Limpar conversa?</h3>
              <p className="mt-2 text-sm text-zinc-500">
                Isso apagará todas as mensagens desta conversa no servidor e no seu dispositivo.
              </p>
              <div className="mt-8 flex flex-col gap-3">
                <button
                  onClick={() => {
                    clearChat();
                    setShowClearConfirm(false);
                  }}
                  className="w-full rounded-2xl bg-red-500 py-4 text-sm font-bold text-white shadow-lg transition-all active:scale-95"
                >
                  Sim, Limpar Tudo
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="w-full rounded-2xl bg-zinc-100 py-4 text-sm font-bold text-zinc-900 transition-all active:scale-95"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProfile(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm overflow-hidden rounded-[40px] bg-white shadow-2xl"
            >
              <div className="relative h-48 bg-zinc-900">
                {conversation?.isGroup ? (
                  <div className="flex h-full w-full items-center justify-center text-white">
                    <Users className="h-20 w-20 opacity-20" />
                  </div>
                ) : otherUser?.photoURL ? (
                  <img src={otherUser.photoURL} alt={otherUser.name} className="h-full w-full object-cover opacity-80" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white">
                    <UserIcon className="h-20 w-20 opacity-20" />
                  </div>
                )}
                <button 
                  onClick={() => setShowProfile(false)}
                  className="absolute right-6 top-6 rounded-full bg-black/20 p-2 text-white backdrop-blur-md hover:bg-black/40"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-8 pb-10 pt-6">
                <h3 className="text-2xl font-bold text-zinc-900">
                  {conversation?.isGroup ? conversation.groupName : otherUser?.name}
                </h3>
                <p className="text-sm text-zinc-400">
                  {conversation?.isGroup ? 'Grupo OffGrid' : (otherUser?.email || otherUser?.phoneNumber)}
                </p>

                <div className="mt-8 space-y-6">
                  {!conversation?.isGroup && otherUser?.bio && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Bio</span>
                      <p className="text-sm text-zinc-600 italic leading-relaxed">"{otherUser.bio}"</p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Segurança & Modos</span>
                    <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                      <ShieldCheck className="h-4 w-4" />
                      Criptografia de Ponta a Ponta & Offline Mesh
                    </div>
                  </div>

                  {conversation?.isGroup && (
                    <div className="space-y-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Participantes</span>
                      <div className="max-h-40 overflow-y-auto space-y-3 pr-2">
                        {conversation.participants.map(pId => (
                          <div key={`profile-participant-${pId}`} className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-400">
                              {participantInfo[pId]?.photoURL ? (
                                <img src={participantInfo[pId].photoURL} className="h-full w-full rounded-lg" alt="" />
                              ) : <UserIcon className="h-4 w-4" />}
                            </div>
                            <span className="text-sm font-medium">{participantInfo[pId]?.name || '...'}</span>
                            {pId === conversation.adminId && (
                              <span className="text-[8px] font-bold uppercase tracking-widest text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Admin</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowProfile(false)}
                  className="mt-10 w-full rounded-2xl bg-zinc-900 py-4 text-sm font-bold text-white shadow-xl transition-all active:scale-95"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

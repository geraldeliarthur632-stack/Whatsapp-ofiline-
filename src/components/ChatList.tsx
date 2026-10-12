import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, collection, query, where, onSnapshot, orderBy, doc, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../App';
import { Conversation, User } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Plus, User as UserIcon, Users, ShieldCheck, MessageSquare, Globe, Zap, Wifi, WifiOff, Mic, Laptop } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { LinkedDevicesModal } from './LinkedDevicesModal';

export function ChatList() {
  const { user, connectionStatus } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [participantInfo, setParticipantInfo] = useState<Record<string, User>>({});
  const [showLinkedDevices, setShowLinkedDevices] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convs = snapshot.docs.map(doc => ({
        ...(doc.data() as Conversation),
        id: doc.id // Ensure ID is always present
      }));
      setConversations(convs);

      // Fetch participant info for each conversation
      convs.forEach(conv => {
        const otherId = conv.participants.find(p => p !== user.uid) || user.uid;
        if (otherId && !participantInfo[otherId]) {
          onSnapshot(doc(db, 'users_public', otherId), (snap) => {
            if (snap.exists()) {
              setParticipantInfo(prev => ({ ...prev, [otherId]: snap.data() as User }));
            }
          }, (error) => {
            handleFirestoreError(error, OperationType.GET, `users_public/${otherId}`);
          });
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'conversations');
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="px-6 pt-6 pb-4">
        {/* Top App Bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Conversas</h1>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => navigate('/connections')}
                className="flex items-center gap-1.5 transition hover:opacity-80"
                title="Configurar conexões offline e mesh"
              >
                {connectionStatus.internet ? (
                  <span className="flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wider border border-emerald-500/20">
                    <Wifi className="h-3 w-3 text-emerald-600" />
                    Online com Wi-Fi
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-md bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 uppercase tracking-wider border border-amber-500/30 animate-pulse">
                    <WifiOff className="h-3 w-3 text-amber-600" />
                    Offline (Rede Mesh)
                  </span>
                )}
                {connectionStatus.wifiDirect && (
                  <span className="text-[10px] text-blue-500 font-bold hidden sm:inline">
                    • Wi-Fi Direct
                  </span>
                )}
                {connectionStatus.bluetooth && (
                  <span className="text-[10px] text-indigo-500 font-bold hidden sm:inline">
                    • Bluetooth
                  </span>
                )}
                {connectionStatus.ultrasound && (
                  <span className="text-[10px] text-purple-500 font-bold hidden sm:inline">
                    • Ultrassom
                  </span>
                )}
                {connectionStatus.opticalQR && (
                  <span className="text-[10px] text-teal-600 font-bold hidden sm:inline">
                    • QR Óptico
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PWAInstallButton variant="compact" />
            <button 
              onClick={() => setShowLinkedDevices(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 transition-colors hover:bg-zinc-200"
              title="Aparelhos Conectados (WhatsApp Web)"
            >
              <Laptop className="h-5 w-5" />
            </button>
            <button 
              onClick={() => navigate('/new-group')}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 transition-colors hover:bg-zinc-200"
              title="Novo Grupo"
            >
              <Users className="h-5 w-5" />
            </button>
            <button 
              onClick={() => navigate('/contacts')}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 transition-colors hover:bg-zinc-200"
              title="Novo Contato"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* PWA Promotion Banner */}
        <div className="mb-4">
          <PWAInstallButton variant="banner" />
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar conversas..."
            className="w-full rounded-2xl bg-zinc-100 py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-200"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-2">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <MessageSquare className="mb-4 h-12 w-12 opacity-20" />
            <p className="text-sm">Nenhuma conversa ainda.</p>
            <button 
              onClick={() => navigate('/contacts')}
              className="mt-4 text-sm font-semibold text-zinc-900 underline underline-offset-4"
            >
              Adicionar Contato
            </button>
          </div>
        ) : (
          conversations.map((conv) => {
            const otherId = conv.participants.find(p => p !== user?.uid) || user?.uid;
            const otherUser = otherId ? participantInfo[otherId] : null;

            return (
              <button
                key={conv.id}
                onClick={() => navigate(`/chat/${conv.id}`)}
                className="flex w-full items-center gap-4 rounded-3xl p-4 transition-colors hover:bg-zinc-50 active:bg-zinc-100"
              >
                <div className="relative h-14 w-14 flex-shrink-0">
                  {conv.isGroup ? (
                    <div className="flex h-full w-full items-center justify-center rounded-2xl bg-zinc-900 text-white">
                      <Users className="h-6 w-6" />
                    </div>
                  ) : otherUser?.photoURL ? (
                    <img
                      src={otherUser.photoURL}
                      alt={otherUser.name}
                      className="h-full w-full rounded-2xl object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
                      <UserIcon className="h-6 w-6" />
                    </div>
                  )}
                  {!conv.isGroup && otherUser?.status === 'online' && otherId !== user?.uid && (
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-green-500" />
                  )}
                </div>

                <div className="flex flex-1 flex-col items-start overflow-hidden">
                  <div className="flex w-full items-center justify-between">
                    <span className="truncate font-semibold">
                      {conv.isGroup ? conv.groupName : (otherUser?.name || 'Carregando...')}
                      {!conv.isGroup && otherId === user?.uid && ' (você)'}
                    </span>
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider">
                      {formatDistanceToNow(conv.updatedAt, { locale: ptBR })}
                    </span>
                  </div>
                  <p className="truncate text-sm text-zinc-500">
                    {conv.lastMessage?.isEncrypted ? (
                      '🔒 Mensagem criptografada'
                    ) : conv.lastMessage?.type === 'audio' ? (
                      '🎤 Áudio'
                    ) : conv.lastMessage?.type === 'image' ? (
                      '📷 Imagem'
                    ) : conv.lastMessage?.type === 'video' ? (
                      '🎥 Vídeo'
                    ) : conv.lastMessage?.type === 'file' ? (
                      '📎 Arquivo'
                    ) : (
                      conv.lastMessage?.text || 'Inicie uma conversa'
                    )}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>

      <LinkedDevicesModal 
        isOpen={showLinkedDevices} 
        onClose={() => setShowLinkedDevices(false)} 
      />
    </div>
  );
}


import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { 
  Wifi, 
  Bluetooth, 
  Zap, 
  Globe, 
  Shield, 
  RefreshCw, 
  Radio, 
  CheckCircle2, 
  XCircle, 
  Signal, 
  Smartphone, 
  Send, 
  AlertTriangle,
  Info,
  Sliders,
  Share2,
  Waves,
  QrCode,
  ShieldCheck,
  Sparkles,
  Play
} from 'lucide-react';
import { cn } from '../lib/utils';
import { meshNetwork, LocalPeer, OfflineRelayPacket } from '../services/meshNetwork';
import { ultrasoundService } from '../services/ultrasoundAudio';
import { OpticalAirGapModal } from './OpticalAirGapModal';

export function Connections() {
  const { connectionStatus, setConnectionStatus, user, openPermissionsModal, syncOfflineMessagesNow } = useAuth();
  const [peers, setPeers] = useState<LocalPeer[]>([]);
  const [scanning, setScanning] = useState(false);
  const [broadcastInput, setBroadcastInput] = useState('');
  const [offlinePackets, setOfflinePackets] = useState<OfflineRelayPacket[]>([]);
  const [activeTab, setActiveTab] = useState<'interfaces' | 'peers' | 'radar'>('interfaces');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showOpticalModal, setShowOpticalModal] = useState(false);
  const [isSyncingServer, setIsSyncingServer] = useState(false);
  const [isPlayingUltrasound, setIsPlayingUltrasound] = useState(false);

  useEffect(() => {
    const unsub = meshNetwork.subscribePeers(setPeers);
    const unsubPackets = meshNetwork.subscribePackets((pkt) => {
      setOfflinePackets(prev => [pkt, ...prev].slice(0, 30));
    });
    setOfflinePackets(meshNetwork.getOutbox().slice(-30).reverse());

    return () => {
      unsub();
      unsubPackets();
    };
  }, []);

  const toggleStatus = (key: keyof typeof connectionStatus) => {
    setConnectionStatus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleScan = async () => {
    setScanning(true);
    setStatusMessage('Varrendo frequências Bluetooth LE, Wi-Fi Direct e sensores acústicos...');
    await meshNetwork.scanForDevices();
    setScanning(false);
    setStatusMessage('Varredura concluída! Dispositivos no alcance atualizados.');
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handlePairBluetooth = async () => {
    setStatusMessage('Abrindo seletor de pareamento Bluetooth do dispositivo...');
    const success = await meshNetwork.requestBluetoothDevice();
    if (success) {
      setStatusMessage('Dispositivo Bluetooth conectado à malha OffGrid!');
    } else {
      setStatusMessage('Varredura local concluída via rádio mesh integrado.');
    }
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleTestUltrasound = async () => {
    setIsPlayingUltrasound(true);
    setStatusMessage('Emitindo pulso de teste acústico ultrassônico de 18.5kHz...');
    try {
      await ultrasoundService.transmitPacket({
        id: `chirp-${Date.now()}`,
        senderName: user?.name || 'Operador',
        text: 'PING_ULTRASSOM_OFFGRID',
        timestamp: Date.now()
      }, true); // slight audible chirp for human verification
      setStatusMessage('Pulso acústico emitido com sucesso pelos alto-falantes!');
    } catch {
      setStatusMessage('Erro ao emitir ultrassom.');
    } finally {
      setIsPlayingUltrasound(false);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  const handleManualSync = async () => {
    setIsSyncingServer(true);
    try {
      const count = await syncOfflineMessagesNow();
      setStatusMessage(`Sincronização concluída: ${count} mensagens enviadas ao servidor.`);
    } catch {
      setStatusMessage('Falha ao sincronizar com o servidor. Verifique a internet.');
    } finally {
      setIsSyncingServer(false);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastInput.trim() || !user) return;

    meshNetwork.broadcastPacket({
      id: `mesh-broadcast-${Date.now()}`,
      conversationId: 'mesh-broadcast-channel',
      senderId: user.uid,
      senderName: user.name || 'Operador OffGrid',
      text: broadcastInput.trim(),
      type: 'text',
      timestamp: Date.now(),
      transport: 'mesh'
    });

    setBroadcastInput('');
    setStatusMessage('Mensagem transmitida para todos os rádios, ultrassom e celulares no alcance!');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const activePeersCount = peers.filter(p => p.connected).length;
  const pendingOutboxCount = meshNetwork.getOutbox().filter(p => !p.syncedToServer && p.conversationId !== 'mesh-broadcast-channel').length;

  return (
    <div className="flex h-full flex-col bg-zinc-50 overflow-y-auto">
      {/* Header */}
      <header className="px-6 py-6 bg-white border-b border-zinc-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                Rádios & Redes Offline
              </h1>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                Multi-Protocolo
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Internet, Wi-Fi Direct, Bluetooth, Ultrassom, Códigos Ópticos e Mesh.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleScan}
              disabled={scanning}
              className="flex items-center gap-1.5 rounded-xl bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 transition"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", scanning && "animate-spin text-[#00a884]")} />
              <span>{scanning ? 'Varrendo...' : 'Varrer'}</span>
            </button>
          </div>
        </div>

        {/* Status Toast Alert */}
        {statusMessage && (
          <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 flex items-center gap-2 animate-fadeIn">
            <Radio className="h-4 w-4 shrink-0 text-emerald-600 animate-pulse" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mt-4 flex gap-2 border-b border-zinc-100 pb-1">
          <button
            onClick={() => setActiveTab('interfaces')}
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-lg transition-colors",
              activeTab === 'interfaces'
                ? "bg-[#00a884] text-white"
                : "text-zinc-500 hover:text-zinc-800"
            )}
          >
            Interfaces & Modos
          </button>
          <button
            onClick={() => setActiveTab('peers')}
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5",
              activeTab === 'peers'
                ? "bg-[#00a884] text-white"
                : "text-zinc-500 hover:text-zinc-800"
            )}
          >
            <span>Dispositivos Próximos</span>
            <span className="rounded-full bg-zinc-200 px-1.5 text-[9px]">
              {activePeersCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('radar')}
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-lg transition-colors",
              activeTab === 'radar'
                ? "bg-[#00a884] text-white"
                : "text-zinc-500 hover:text-zinc-800"
            )}
          >
            Transmissão & Fila
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-5 space-y-5">
        {activeTab === 'interfaces' && (
          <>
            {/* Top Server Sync & Permissions Banner */}
            <div className="rounded-2xl bg-white p-4 border border-zinc-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-900">
                    Modo Atual: {connectionStatus.internet ? 'Envio por Servidor Nuvem' : 'Envio Offline Direto'}
                  </span>
                  {pendingOutboxCount > 0 && (
                    <span className="rounded-full bg-orange-100 text-orange-800 px-2 py-0.5 text-[10px] font-bold">
                      {pendingOutboxCount} na fila
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Quando online, as mensagens vão pelo servidor comum. Quando offline, usam os canais locais e sincronizam ao reconectar.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={openPermissionsModal}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl bg-zinc-100 text-zinc-700 px-3 py-2 text-xs font-semibold hover:bg-zinc-200"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-[#00a884]" />
                  <span>Permissões</span>
                </button>

                <button
                  onClick={handleManualSync}
                  disabled={isSyncingServer}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl bg-[#00a884] text-white px-3 py-2 text-xs font-semibold hover:bg-[#009272] disabled:opacity-50 shadow-sm"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isSyncingServer && "animate-spin")} />
                  <span>Sincronizar</span>
                </button>
              </div>
            </div>

            {/* Primary Connectivity Grid (All Methods) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* 1. Internet (Cloud Sync) */}
              <button
                onClick={() => toggleStatus('internet')}
                className={cn(
                  "flex flex-col items-start justify-between rounded-2xl p-4 transition-all border text-left",
                  connectionStatus.internet
                    ? "bg-white border-emerald-500 shadow-md ring-1 ring-emerald-500"
                    : "bg-zinc-100 border-zinc-200 opacity-60"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    connectionStatus.internet ? "bg-emerald-50 text-emerald-600" : "bg-zinc-200 text-zinc-400"
                  )}>
                    <Globe className="h-5 w-5" />
                  </div>
                  {connectionStatus.internet ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
                <div className="mt-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 block">
                    1. Servidor Normal (Internet)
                  </span>
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">
                    {connectionStatus.internet ? 'Envio em tempo real via Firestore' : 'Pausado (usando modo offline)'}
                  </span>
                </div>
              </button>

              {/* 2. Wi-Fi Direct */}
              <button
                onClick={() => toggleStatus('wifiDirect')}
                className={cn(
                  "flex flex-col items-start justify-between rounded-2xl p-4 transition-all border text-left",
                  connectionStatus.wifiDirect
                    ? "bg-white border-blue-500 shadow-md ring-1 ring-blue-500"
                    : "bg-zinc-100 border-zinc-200 opacity-60"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    connectionStatus.wifiDirect ? "bg-blue-50 text-blue-600" : "bg-zinc-200 text-zinc-400"
                  )}>
                    <Wifi className="h-5 w-5" />
                  </div>
                  {connectionStatus.wifiDirect ? (
                    <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
                <div className="mt-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 block">
                    2. Wi-Fi Direct P2P
                  </span>
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">
                    {connectionStatus.wifiDirect ? 'Alcance até 100m sem roteador' : 'Desativado'}
                  </span>
                </div>
              </button>

              {/* 3. Bluetooth LE */}
              <button
                onClick={() => toggleStatus('bluetooth')}
                className={cn(
                  "flex flex-col items-start justify-between rounded-2xl p-4 transition-all border text-left",
                  connectionStatus.bluetooth
                    ? "bg-white border-indigo-500 shadow-md ring-1 ring-indigo-500"
                    : "bg-zinc-100 border-zinc-200 opacity-60"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    connectionStatus.bluetooth ? "bg-indigo-50 text-indigo-600" : "bg-zinc-200 text-zinc-400"
                  )}>
                    <Bluetooth className="h-5 w-5" />
                  </div>
                  {connectionStatus.bluetooth ? (
                    <CheckCircle2 className="h-4 w-4 text-indigo-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
                <div className="mt-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 block">
                    3. Bluetooth LE
                  </span>
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">
                    {connectionStatus.bluetooth ? 'Baixo consumo até 30m' : 'Desativado'}
                  </span>
                </div>
              </button>

              {/* 4. Ultrassom & Som Acústico */}
              <button
                onClick={() => toggleStatus('ultrasound')}
                className={cn(
                  "flex flex-col items-start justify-between rounded-2xl p-4 transition-all border text-left",
                  connectionStatus.ultrasound
                    ? "bg-white border-purple-500 shadow-md ring-1 ring-purple-500"
                    : "bg-zinc-100 border-zinc-200 opacity-60"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    connectionStatus.ultrasound ? "bg-purple-50 text-purple-600" : "bg-zinc-200 text-zinc-400"
                  )}>
                    <Waves className="h-5 w-5" />
                  </div>
                  {connectionStatus.ultrasound ? (
                    <CheckCircle2 className="h-4 w-4 text-purple-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
                <div className="mt-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 block">
                    4. Modem Ultrassom (Som)
                  </span>
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">
                    {connectionStatus.ultrasound ? 'Transmite dados pelo ar via alto-falante' : 'Desativado'}
                  </span>
                </div>
              </button>

              {/* 5. Malha Óptica Air-Gap (QR Code) */}
              <button
                onClick={() => toggleStatus('opticalQR')}
                className={cn(
                  "flex flex-col items-start justify-between rounded-2xl p-4 transition-all border text-left",
                  connectionStatus.opticalQR
                    ? "bg-white border-emerald-600 shadow-md ring-1 ring-emerald-600"
                    : "bg-zinc-100 border-zinc-200 opacity-60"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    connectionStatus.opticalQR ? "bg-emerald-50 text-emerald-700" : "bg-zinc-200 text-zinc-400"
                  )}>
                    <QrCode className="h-5 w-5" />
                  </div>
                  {connectionStatus.opticalQR ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
                <div className="mt-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 block">
                    5. Malha Óptica Air-Gap
                  </span>
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">
                    {connectionStatus.opticalQR ? 'Troca via câmera/QR (zero rádio)' : 'Desativado'}
                  </span>
                </div>
              </button>

              {/* 6. Rede Local Hotspot / LAN */}
              <button
                onClick={() => toggleStatus('localLan')}
                className={cn(
                  "flex flex-col items-start justify-between rounded-2xl p-4 transition-all border text-left",
                  connectionStatus.localLan
                    ? "bg-white border-cyan-500 shadow-md ring-1 ring-cyan-500"
                    : "bg-zinc-100 border-zinc-200 opacity-60"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    connectionStatus.localLan ? "bg-cyan-50 text-cyan-600" : "bg-zinc-200 text-zinc-400"
                  )}>
                    <Globe className="h-5 w-5" />
                  </div>
                  {connectionStatus.localLan ? (
                    <CheckCircle2 className="h-4 w-4 text-cyan-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
                <div className="mt-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 block">
                    6. Hotspot & LAN Local
                  </span>
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">
                    {connectionStatus.localLan ? 'Sub-rede local e roteador sem internet' : 'Desativado'}
                  </span>
                </div>
              </button>
            </div>

            {/* Quick Actions & Live Testing */}
            <div className="rounded-2xl bg-white p-4 border border-zinc-200 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Ferramentas de Teste & Pareamento
              </h3>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handlePairBluetooth}
                  className="flex items-center gap-2 rounded-xl bg-indigo-50 text-indigo-700 px-3 py-2 text-xs font-semibold hover:bg-indigo-100 transition"
                >
                  <Bluetooth className="h-4 w-4" />
                  <span>Parear Bluetooth</span>
                </button>

                <button
                  onClick={handleTestUltrasound}
                  disabled={isPlayingUltrasound}
                  className="flex items-center gap-2 rounded-xl bg-purple-50 text-purple-700 px-3 py-2 text-xs font-semibold hover:bg-purple-100 transition disabled:opacity-50"
                >
                  <Waves className={cn("h-4 w-4", isPlayingUltrasound && "animate-spin")} />
                  <span>Testar Pulso Ultrassom</span>
                </button>

                <button
                  onClick={() => setShowOpticalModal(true)}
                  className="flex items-center gap-2 rounded-xl bg-emerald-50 text-emerald-800 px-3 py-2 text-xs font-semibold hover:bg-emerald-100 transition"
                >
                  <QrCode className="h-4 w-4" />
                  <span>Abrir Scanner QR Óptico</span>
                </button>

                <button
                  onClick={handleScan}
                  className="flex items-center gap-2 rounded-xl bg-blue-50 text-blue-700 px-3 py-2 text-xs font-semibold hover:bg-blue-100 transition"
                >
                  <Wifi className="h-4 w-4" />
                  <span>Procurar Pares Wi-Fi Direct</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Tab: Nearby Peers */}
        {activeTab === 'peers' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Nós e Celulares Detectados ({peers.length})
              </span>
              <button
                onClick={handleScan}
                disabled={scanning}
                className="text-xs text-[#00a884] font-bold hover:underline"
              >
                Atualizar Sinal
              </button>
            </div>

            <div className="space-y-2.5">
              {peers.map((peer) => (
                <div
                  key={peer.id}
                  className="flex items-center justify-between rounded-2xl bg-white p-4 border border-zinc-200 shadow-xs"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-xl",
                      peer.type === 'bluetooth' ? "bg-indigo-50 text-indigo-600" :
                      peer.type === 'ultrasound' ? "bg-purple-50 text-purple-600" :
                      peer.type === 'local-lan' ? "bg-cyan-50 text-cyan-600" :
                      peer.type === 'wifi-direct' ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                    )}>
                      {peer.type === 'bluetooth' ? <Bluetooth className="h-5 w-5" /> :
                       peer.type === 'ultrasound' ? <Waves className="h-5 w-5" /> :
                       peer.type === 'local-lan' ? <Globe className="h-5 w-5" /> :
                       peer.type === 'wifi-direct' ? <Wifi className="h-5 w-5" /> : <Radio className="h-5 w-5" />}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-zinc-900">{peer.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-zinc-400 font-mono">
                          Sinal: {peer.rssi} dBm
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          • {peer.distanceApprox}
                        </span>
                        {peer.batteryLevel && (
                          <span className="text-[10px] text-emerald-600 font-bold">
                            • 🔋 {peer.batteryLevel}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => meshNetwork.togglePeerConnection(peer.id)}
                    className={cn(
                      "rounded-xl px-3 py-1.5 text-xs font-bold transition",
                      peer.connected
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-zinc-100 text-zinc-500"
                    )}
                  >
                    {peer.connected ? 'Pareado' : 'Conectar'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Mesh Radar & Outbox Queue */}
        {activeTab === 'radar' && (
          <div className="space-y-4">
            {/* Outbox Queue status */}
            <div className="rounded-2xl bg-white p-4 border border-zinc-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                  Fila Offline Persistente (Store-and-Forward)
                </span>
                <button
                  onClick={handleManualSync}
                  className="text-xs font-bold text-[#00a884] hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Sincronizar no Servidor
                </button>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Mensagens enviadas quando offline ficam seguras no seu dispositivo e são enviadas ao servidor automaticamente assim que você tiver internet.
              </p>
            </div>

            {/* Broadcast Sender */}
            <form onSubmit={handleSendBroadcast} className="rounded-2xl bg-white p-4 border border-zinc-200 space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block">
                Transmissão Geral Mesh (Broadcast)
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={broadcastInput}
                  onChange={(e) => setBroadcastInput(e.target.value)}
                  placeholder="Mensagem para todos os aparelhos ao redor..."
                  className="flex-1 rounded-xl bg-zinc-100 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#00a884]"
                />
                <button
                  type="submit"
                  disabled={!broadcastInput.trim()}
                  className="rounded-xl bg-[#00a884] text-white px-4 py-2.5 text-xs font-bold disabled:opacity-50 flex items-center gap-1"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Transmitir</span>
                </button>
              </div>
            </form>

            {/* Recent Packets Log */}
            <div className="rounded-2xl bg-white p-4 border border-zinc-200 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block">
                Pacotes Recentes na Malha ({offlinePackets.length})
              </span>
              {offlinePackets.length === 0 ? (
                <p className="text-xs text-zinc-400 py-4 text-center">Nenhum pacote transmitido ainda.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {offlinePackets.map((pkt) => (
                    <div key={pkt.id} className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-100 text-xs">
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                        <span className="font-bold text-zinc-700">{pkt.senderName}</span>
                        <span className="font-mono">{pkt.transport} • Saltos: {pkt.ttl}</span>
                      </div>
                      <p className="text-zinc-800 font-medium">{pkt.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Optical Modal */}
      <OpticalAirGapModal
        isOpen={showOpticalModal}
        onClose={() => setShowOpticalModal(false)}
      />
    </div>
  );
}

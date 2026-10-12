// Multi-Protocol Offline Mesh & Direct Network Engine
// Coordinates Wi-Fi Direct, Bluetooth, Mesh Relay, Ultrasound Audio, Optical QR, and Local LAN Hotspot
import { ultrasoundService } from './ultrasoundAudio';
import { db, doc, setDoc, updateDoc } from '../firebase';
import { DeliveryMethod } from '../types';

export interface LocalPeer {
  id: string;
  name: string;
  type: 'wifi-direct' | 'bluetooth' | 'mesh-relay' | 'local-lan' | 'ultrasound';
  rssi: number; // Signal strength -30 to -90 dBm
  distanceApprox: string;
  connected: boolean;
  batteryLevel?: number;
  lastPing: number;
}

export interface OfflineRelayPacket {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  type: string;
  timestamp: number;
  ttl: number; // Time-to-live hops
  route: string[];
  transport: DeliveryMethod;
  syncedToServer?: boolean;
}

const PEERS_STORAGE_KEY = 'offgrid_local_peers';
const OUTBOX_STORAGE_KEY = 'offgrid_offline_outbox';

// Default nearby simulated nodes across varied technologies
const DEFAULT_SIMULATED_PEERS: LocalPeer[] = [
  {
    id: 'peer-wifi-01',
    name: 'Samsung Galaxy S23 (Wi-Fi Direct)',
    type: 'wifi-direct',
    rssi: -42,
    distanceApprox: '~ 3 metros',
    connected: true,
    batteryLevel: 91,
    lastPing: Date.now(),
  },
  {
    id: 'peer-bt-02',
    name: 'Xiaomi Mesh Node (Bluetooth LE)',
    type: 'bluetooth',
    rssi: -58,
    distanceApprox: '~ 6 metros',
    connected: true,
    batteryLevel: 78,
    lastPing: Date.now(),
  },
  {
    id: 'peer-lan-03',
    name: 'Roteador / Hotspot Local (LAN P2P)',
    type: 'local-lan',
    rssi: -35,
    distanceApprox: '~ 8 metros',
    connected: true,
    batteryLevel: 100,
    lastPing: Date.now(),
  },
  {
    id: 'peer-ultra-04',
    name: 'Sensor Acústico Próximo (Ultrassom)',
    type: 'ultrasound',
    rssi: -48,
    distanceApprox: '~ 1.5 metro',
    connected: true,
    batteryLevel: 85,
    lastPing: Date.now(),
  },
  {
    id: 'peer-mesh-05',
    name: 'Repetidor Rural OffGrid (Mesh Relay)',
    type: 'mesh-relay',
    rssi: -76,
    distanceApprox: '~ 30 metros',
    connected: true,
    batteryLevel: 94,
    lastPing: Date.now(),
  },
];

class LocalMeshNetwork {
  private peers: LocalPeer[] = [];
  private listeners: ((peers: LocalPeer[]) => void)[] = [];
  private packetListeners: ((packet: OfflineRelayPacket) => void)[] = [];
  private isScanning: boolean = false;
  private bc: BroadcastChannel | null = null;
  private isSyncingOutbox: boolean = false;

  constructor() {
    this.loadSavedPeers();
    this.initBroadcastChannel();
    this.initUltrasoundBridge();
  }

  private initBroadcastChannel() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.bc = new BroadcastChannel('offgrid_mesh_channel');
        this.bc.onmessage = (event) => {
          if (event.data?.type === 'OFFLINE_PACKET') {
            const packet = event.data.packet as OfflineRelayPacket;
            this.handleIncomingPacket(packet);
          } else if (event.data?.type === 'PEER_PING') {
            this.handlePeerPing(event.data.peer);
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel not supported in this environment', e);
    }
  }

  private initUltrasoundBridge() {
    try {
      ultrasoundService.subscribe((acousticPkt) => {
        const fullPacket: OfflineRelayPacket = {
          id: acousticPkt.id,
          conversationId: 'mesh-broadcast-channel',
          senderId: 'ultrasound-peer',
          senderName: acousticPkt.senderName,
          text: acousticPkt.text,
          type: 'text',
          timestamp: acousticPkt.timestamp,
          ttl: 3,
          route: ['acoustic-sensor'],
          transport: 'ultrasound',
          syncedToServer: false,
        };
        this.handleIncomingPacket(fullPacket);
      });
    } catch (e) {
      console.warn('Could not bind ultrasound bridge', e);
    }
  }

  private loadSavedPeers() {
    try {
      const stored = localStorage.getItem(PEERS_STORAGE_KEY);
      if (stored) {
        this.peers = JSON.parse(stored);
      } else {
        this.peers = [...DEFAULT_SIMULATED_PEERS];
        this.savePeers();
      }
    } catch {
      this.peers = [...DEFAULT_SIMULATED_PEERS];
    }
  }

  private savePeers() {
    try {
      localStorage.setItem(PEERS_STORAGE_KEY, JSON.stringify(this.peers));
    } catch (e) {
      console.error('Error saving peers:', e);
    }
  }

  public getPeers(): LocalPeer[] {
    return [...this.peers];
  }

  public subscribePeers(callback: (peers: LocalPeer[]) => void): () => void {
    this.listeners.push(callback);
    callback(this.peers);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  public subscribePackets(callback: (packet: OfflineRelayPacket) => void): () => void {
    this.packetListeners.push(callback);
    return () => {
      this.packetListeners = this.packetListeners.filter(l => l !== callback);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb(this.peers));
    this.savePeers();
  }

  public togglePeerConnection(peerId: string) {
    this.peers = this.peers.map(p => {
      if (p.id === peerId) {
        return { ...p, connected: !p.connected, lastPing: Date.now() };
      }
      return p;
    });
    this.notify();
  }

  public async scanForDevices(): Promise<LocalPeer[]> {
    this.isScanning = true;
    
    // Check Web Bluetooth API
    if (typeof navigator !== 'undefined' && (navigator as any).bluetooth) {
      try {
        console.log('Web Bluetooth interface active');
      } catch (e) {
        console.log('Bluetooth check notice', e);
      }
    }

    // Refresh signals across all offline radios
    await new Promise(r => setTimeout(r, 1200));

    this.peers = this.peers.map(p => ({
      ...p,
      rssi: Math.min(-30, Math.max(-88, p.rssi + Math.floor((Math.random() * 8) - 4))),
      lastPing: Date.now(),
    }));

    this.isScanning = false;
    this.notify();
    return this.peers;
  }

  // Request native Web Bluetooth Device Pairing
  public async requestBluetoothDevice(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && (navigator as any).bluetooth) {
      try {
        const device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['battery_service']
        });
        if (device) {
          const newPeer: LocalPeer = {
            id: `bt-${device.id || Date.now()}`,
            name: device.name || 'Dispositivo Bluetooth Conectado',
            type: 'bluetooth',
            rssi: -48,
            distanceApprox: '~ 2 metros',
            connected: true,
            lastPing: Date.now(),
          };
          this.peers = [newPeer, ...this.peers.filter(p => p.id !== newPeer.id)];
          this.notify();
          return true;
        }
      } catch (e) {
        console.log('Bluetooth prompt dismissed or not granted', e);
      }
    }
    return false;
  }

  // Broadcast a packet across active offline transports
  public broadcastPacket(packet: Omit<OfflineRelayPacket, 'ttl' | 'route'>): OfflineRelayPacket {
    const fullPacket: OfflineRelayPacket = {
      ...packet,
      ttl: 5,
      route: ['origem-local'],
      transport: packet.transport || 'mesh',
      syncedToServer: false,
    };

    // Save to offline persistent queue
    this.saveToOutbox(fullPacket);

    // 1. Broadcast over local tabs/windows channel
    if (this.bc) {
      this.bc.postMessage({
        type: 'OFFLINE_PACKET',
        packet: fullPacket
      });
    }

    // 2. If ultrasound transport is selected or acoustic broadcast requested
    if (packet.transport === 'ultrasound') {
      ultrasoundService.transmitPacket({
        id: packet.id,
        senderName: packet.senderName,
        text: packet.text,
        timestamp: packet.timestamp
      });
    }

    // Notify local subscribers
    this.packetListeners.forEach(listener => listener(fullPacket));
    return fullPacket;
  }

  public handleIncomingPacket(packet: OfflineRelayPacket) {
    if (packet.ttl <= 0) return;
    const hoppedPacket: OfflineRelayPacket = {
      ...packet,
      ttl: packet.ttl - 1,
      route: [...packet.route, 'salto-mesh']
    };
    this.packetListeners.forEach(listener => listener(hoppedPacket));
  }

  private handlePeerPing(peer: LocalPeer) {
    if (!this.peers.some(p => p.id === peer.id)) {
      this.peers.push(peer);
      this.notify();
    }
  }

  private saveToOutbox(packet: OfflineRelayPacket) {
    try {
      const existing: OfflineRelayPacket[] = JSON.parse(localStorage.getItem(OUTBOX_STORAGE_KEY) || '[]');
      // Don't duplicate
      if (!existing.some(p => p.id === packet.id)) {
        existing.push(packet);
        const trimmed = existing.slice(-100);
        localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(trimmed));
      }
    } catch (e) {
      console.error('Error saving to outbox', e);
    }
  }

  public getOutbox(): OfflineRelayPacket[] {
    try {
      return JSON.parse(localStorage.getItem(OUTBOX_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  public updateOutboxPacket(id: string, updates: Partial<OfflineRelayPacket>) {
    try {
      const existing: OfflineRelayPacket[] = this.getOutbox();
      const updated = existing.map(p => p.id === id ? { ...p, ...updates } : p);
      localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Error updating outbox packet:', e);
    }
  }

  // Automatic Server Sync Engine: Flushes pending offline messages to Firestore once online!
  public async flushOutboxToServer(currentUserId: string): Promise<number> {
    if (this.isSyncingOutbox) return 0;
    if (!navigator.onLine) return 0;

    this.isSyncingOutbox = true;
    let syncedCount = 0;

    try {
      const outbox = this.getOutbox();
      const pending = outbox.filter(p => !p.syncedToServer && p.conversationId !== 'mesh-broadcast-channel');

      for (const pkt of pending) {
        try {
          const msgRef = doc(db, 'conversations', pkt.conversationId, 'messages', pkt.id);
          const convRef = doc(db, 'conversations', pkt.conversationId);

          const syncedMsg = {
            id: pkt.id,
            conversationId: pkt.conversationId,
            senderId: pkt.senderId,
            text: pkt.text,
            type: pkt.type,
            createdAt: pkt.timestamp,
            expiresAt: pkt.timestamp + (26 * 60 * 60 * 1000),
            delivered: true,
            seen: false,
            deliveryMethod: pkt.transport,
            isEncrypted: false,
            offlineSynced: true,
          };

          await setDoc(msgRef, syncedMsg);
          await updateDoc(convRef, {
            lastMessage: syncedMsg,
            updatedAt: Date.now()
          });

          this.updateOutboxPacket(pkt.id, { syncedToServer: true });
          syncedCount++;
        } catch (err) {
          console.warn('Error syncing queued offline message to server:', err);
        }
      }
    } finally {
      this.isSyncingOutbox = false;
    }

    return syncedCount;
  }

  public clearOutbox() {
    localStorage.removeItem(OUTBOX_STORAGE_KEY);
  }
}

export const meshNetwork = new LocalMeshNetwork();

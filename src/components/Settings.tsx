import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { User as UserIcon, LogOut, Shield, Bell, HelpCircle, ChevronRight, Camera, Edit2, Check, X, Lock, Moon, Sun, Loader2, Download, Laptop } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { ref, uploadBytes, getDownloadURL, storage } from '../firebase';
import { PWAInstallButton } from './PWAInstallButton';
import { LinkedDevicesModal } from './LinkedDevicesModal';

export function Settings() {
  const { user, logout, updateProfile, openPermissionsModal, syncOfflineMessagesNow } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showLinkedDevices, setShowLinkedDevices] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  const [editData, setEditData] = useState({
    name: user?.name || '',
    photoURL: user?.photoURL || '',
    bio: user?.bio || '',
    password: user?.password || ''
  });
  const [loading, setLoading] = useState(false);

  const [saveError, setSaveError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    setSaveError(null);
    try {
      const storageRef = ref(storage, `profiles/${user.uid}/${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      setEditData({ ...editData, photoURL: downloadURL });
    } catch (error) {
      console.error('Error uploading file:', error);
      setSaveError('Erro ao fazer upload da imagem.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    const trimmedName = editData.name.trim();
    const nameParts = trimmedName.split(/\s+/).filter(part => part.length > 0);
    
    if (nameParts.length < 2) {
      setSaveError('Por favor, insira seu nome e sobrenome para facilitar a busca de contatos.');
      return;
    }

    setLoading(true);
    try {
      await updateProfile(editData);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      setSaveError('Erro ao salvar alterações no perfil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-zinc-50 overflow-y-auto">
      <header className="px-6 py-12 bg-white flex flex-col items-center text-center border-b border-zinc-200">
        <div className="relative mb-4 group">
          <div className="h-24 w-24 overflow-hidden rounded-3xl bg-zinc-100 shadow-md border-4 border-white flex items-center justify-center">
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            ) : editData.photoURL || user?.photoURL ? (
              <img 
                src={isEditing ? editData.photoURL : user?.photoURL} 
                alt={user?.name} 
                className="h-full w-full object-cover" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-zinc-400">
                <UserIcon className="h-10 w-10" />
              </div>
            )}
          </div>
          {isEditing && (
            <>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept="image/*"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-lg transition-transform hover:scale-110 disabled:opacity-50"
              >
                <Camera className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        <AnimatePresence mode="wait">
          {!isEditing ? (
            <motion.div
              key="view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full"
            >
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{user?.name}</h1>
              <p className="text-sm text-zinc-500 mb-2">{user?.email || user?.phoneNumber}</p>
              {user?.bio && (
                <p className="text-sm text-zinc-600 italic max-w-xs mx-auto">"{user.bio}"</p>
              )}
              <button
                onClick={() => setIsEditing(true)}
                className="mt-4 flex items-center gap-2 mx-auto text-xs font-bold uppercase tracking-widest text-[#00a884] hover:text-[#008f70]"
              >
                <Edit2 className="h-3 w-3" />
                Editar Perfil
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="edit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full max-w-xs space-y-4"
            >
              <input
                type="text"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                placeholder="Nome"
                className="w-full rounded-xl bg-zinc-100 px-4 py-2 text-sm font-bold text-center outline-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-[#00a884] text-zinc-900"
              />
              <textarea
                value={editData.bio}
                onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                placeholder="Sua descrição (bio)"
                className="w-full rounded-xl bg-zinc-100 px-4 py-2 text-sm text-center outline-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-[#00a884] text-zinc-900 resize-none"
                rows={2}
              />
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                  type="password"
                  value={editData.password}
                  onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                  placeholder="Senha do App (Opcional)"
                  className="w-full rounded-xl bg-zinc-100 pl-10 pr-4 py-2 text-sm text-center outline-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-[#00a884] text-zinc-900"
                />
              </div>
              {saveError && (
                <p className="text-xs text-red-500 font-medium text-center">{saveError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={loading || !editData.name.trim()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#00a884] py-2 text-sm font-bold text-white transition-all hover:bg-[#009373] disabled:opacity-50"
                >
                  {loading ? <Check className="h-4 w-4 animate-pulse" /> : 'Salvar'}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditData({
                      name: user?.name || '',
                      photoURL: user?.photoURL || '',
                      bio: user?.bio || '',
                      password: user?.password || ''
                    });
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div className="flex-1 p-4 space-y-4">
        <div className="rounded-3xl bg-white overflow-hidden border border-zinc-200 shadow-xs">
          <button className="flex w-full items-center justify-between p-4 hover:bg-zinc-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Shield className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-zinc-900">Privacidade e Criptografia Ponta a Ponta</span>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-400" />
          </button>

          <div className="p-4 border-t border-zinc-100">
            <PWAInstallButton variant="banner" />
          </div>
          
          <button 
            onClick={() => setShowLinkedDevices(true)}
            className="flex w-full items-center justify-between p-4 hover:bg-zinc-50 transition-colors border-t border-zinc-100"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-teal-50 text-[#00a884] flex items-center justify-center">
                <Laptop className="h-5 w-5" />
              </div>
              <div className="text-left">
                <span className="text-sm font-medium text-zinc-900 block">Aparelhos Conectados</span>
                <span className="text-[11px] text-zinc-400 block">Conectar OffGrid Web via QR Code (WhatsApp Web)</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-400" />
          </button>

          <button 
            onClick={openPermissionsModal}
            className="flex w-full items-center justify-between p-4 hover:bg-zinc-50 transition-colors border-t border-zinc-100"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-[#00a884] flex items-center justify-center">
                <Shield className="h-5 w-5" />
              </div>
              <div className="text-left">
                <span className="text-sm font-medium text-zinc-900 block">Permissões & Conexões Offline</span>
                <span className="text-[11px] text-zinc-400 block">Notificações, Bluetooth, Microfone e Câmera</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-400" />
          </button>

          <button 
            onClick={openPermissionsModal}
            className="flex w-full items-center justify-between p-4 hover:bg-zinc-50 transition-colors border-t border-zinc-100"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                <Bell className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-zinc-900">Notificações e Sons</span>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-400" />
          </button>
        </div>

        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-3xl bg-white p-4 text-red-600 hover:bg-red-50 transition-colors border border-zinc-200 shadow-xs"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-bold uppercase tracking-wider">Sair da Conta</span>
        </button>

        <div className="pt-8 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">OffGrid Link v1.0.0</p>
          <p className="text-[10px] text-zinc-400 mt-1">Desenvolvido para comunicação resiliente</p>
        </div>
      </div>

      <LinkedDevicesModal 
        isOpen={showLinkedDevices} 
        onClose={() => setShowLinkedDevices(false)} 
      />
    </div>
  );
}

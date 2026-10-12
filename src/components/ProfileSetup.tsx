import React, { useState, useRef } from 'react';
import { useAuth } from '../App';
import { User as UserIcon, Loader2, Check, ArrowRight, Camera, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ref, uploadBytes, getDownloadURL, storage } from '../firebase';

const AVATARS = {
  boy: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  girl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
};

export function ProfileSetup() {
  const { updateProfile, firebaseUser } = useAuth();
  const [step, setStep] = useState<'name' | 'gender'>('name');
  const [name, setName] = useState(firebaseUser?.displayName || '');
  const [gender, setGender] = useState<'boy' | 'girl' | null>(null);
  const [loading, setLoading] = useState(false);
  const [customPhotoURL, setCustomPhotoURL] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `profiles/${firebaseUser.uid}/${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      setCustomPhotoURL(downloadURL);
    } catch (error) {
      console.error('Error uploading profile pic:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleNext = () => {
    setNameError(null);
    const trimmedName = name.trim();
    const nameParts = trimmedName.split(/\s+/).filter(part => part.length > 0);
    if (nameParts.length >= 2) {
      setStep('gender');
    } else {
      setNameError('Por favor, insira seu nome e sobrenome para facilitar a busca de contatos.');
    }
  };

  const handleSubmit = async (selectedGender: 'boy' | 'girl' | 'custom') => {
    if (!name.trim()) return;
    
    setLoading(true);
    try {
      const photoURL = selectedGender === 'custom' ? customPhotoURL : AVATARS[selectedGender as 'boy' | 'girl'];
      await updateProfile({ name, photoURL: photoURL || AVATARS.boy });
    } catch (error) {
      console.error('Error setting up profile:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#111b21] p-6 text-white font-sans">
      <AnimatePresence mode="wait">
        {step === 'name' ? (
          <motion.div
            key="name"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-md space-y-8 text-center"
          >
            <div className="flex flex-col items-center">
              <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-[#202c33] text-[#8696a0]">
                <UserIcon className="h-12 w-12" />
              </div>
              <h2 className="mb-2 text-3xl font-bold">Qual o seu nome?</h2>
              <p className="text-[#8696a0]">Insira seu nome para que seus amigos possam te reconhecer.</p>
            </div>

            <div className="relative">
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="Nome e Sobrenome"
                className="w-full border-b-2 border-[#00a884] bg-transparent py-4 text-center text-2xl font-medium text-white placeholder-[#8696a0] outline-none transition-all focus:border-[#00a884]"
              />
              {nameError && (
                <p className="mt-2 text-xs text-rose-400 font-medium">{nameError}</p>
              )}
            </div>

            <button
              onClick={handleNext}
              disabled={!name.trim()}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-[#00a884] py-4 text-lg font-bold text-[#111b21] transition-transform active:scale-95 disabled:opacity-50"
            >
              Próximo
              <ArrowRight className="h-5 w-5" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="gender"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-md space-y-8 text-center"
          >
            <div className="flex flex-col items-center">
              <h2 className="mb-2 text-3xl font-bold">Você é...</h2>
              <p className="text-[#8696a0]">Escolha uma opção para definir seu avatar automaticamente.</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <button
                onClick={() => handleSubmit('boy')}
                disabled={loading || uploading}
                className="group flex flex-col items-center gap-4 rounded-3xl bg-[#202c33] p-8 transition-all hover:bg-[#2a3942] active:scale-95"
              >
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#111b21] border-2 border-transparent group-hover:border-[#00a884]">
                  <img src={AVATARS.boy} alt="Menino" className="h-full w-full object-cover" />
                </div>
                <span className="text-xl font-bold">Menino</span>
              </button>

              <button
                onClick={() => handleSubmit('girl')}
                disabled={loading || uploading}
                className="group flex flex-col items-center gap-4 rounded-3xl bg-[#202c33] p-8 transition-all hover:bg-[#2a3942] active:scale-95"
              >
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#111b21] border-2 border-transparent group-hover:border-[#00a884]">
                  <img src={AVATARS.girl} alt="Menina" className="h-full w-full object-cover" />
                </div>
                <span className="text-xl font-bold">Menina</span>
              </button>
            </div>

            <div className="mt-8">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept="image/*"
              />
              {customPhotoURL ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative h-32 w-32 rounded-full border-4 border-[#00a884] overflow-hidden">
                    <img src={customPhotoURL} alt="Custom" className="h-full w-full object-cover" />
                    <button 
                      onClick={() => setCustomPhotoURL(null)}
                      className="absolute top-0 right-0 bg-red-500 p-1 rounded-full"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => handleSubmit('custom')}
                    disabled={loading}
                    className="rounded-full bg-[#00a884] px-8 py-3 font-bold text-[#111b21]"
                  >
                    Usar esta foto
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 mx-auto text-[#00a884] font-bold"
                >
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                  Ou escolha uma foto personalizada
                </button>
              )}
            </div>

            {loading && (
              <div className="flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#00a884]" />
              </div>
            )}

            <button
              onClick={() => setStep('name')}
              className="text-sm font-medium text-[#8696a0] hover:text-white"
            >
              Voltar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState } from 'react';
import { usePWAInstall, PlatformCategory } from '../hooks/usePWAInstall';
import { 
  Download, 
  Share, 
  PlusSquare, 
  CheckCircle, 
  Smartphone, 
  Laptop, 
  Monitor, 
  X, 
  ArrowRight, 
  Sparkles,
  Check,
  HelpCircle,
  Zap
} from 'lucide-react';

interface Props {
  variant?: 'banner' | 'button' | 'compact';
  className?: string;
}

export const PWAInstallButton: React.FC<Props> = ({ variant = 'button', className = '' }) => {
  const { isInstallable, isInstalled, platformInfo, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  // If already installed in standalone mode, show clean installed state or hide
  if (isInstalled || installedSuccess) {
    if (variant === 'banner') {
      return (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>App instalado no dispositivo! Funcionando offline.</span>
        </div>
      );
    }
    return null;
  }

  const handleInstallAction = async () => {
    // If the browser supports the automatic native prompt, trigger it directly!
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        setInstalledSuccess(true);
        return;
      }
      if (outcome === 'dismissed') {
        // User dismissed the native dialog, open tutorial modal to assist
        setShowModal(true);
        return;
      }
    }
    // Otherwise open the customized OS tutorial modal
    setShowModal(true);
  };

  // Get icon and label for detected platform
  const getPlatformDetails = () => {
    switch (platformInfo.category) {
      case 'apple':
        return {
          icon: <Smartphone className="h-4 w-4" />,
          label: 'Instalar no iPhone / Apple',
          badge: 'Apple iOS'
        };
      case 'android':
        return {
          icon: <Smartphone className="h-4 w-4" />,
          label: 'Instalar no Android',
          badge: 'Android'
        };
      case 'pc':
      default:
        return {
          icon: <Monitor className="h-4 w-4" />,
          label: 'Instalar no Computador / PC',
          badge: platformInfo.os || 'PC'
        };
    }
  };

  const details = getPlatformDetails();

  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={handleInstallAction}
          className={`flex items-center gap-1.5 rounded-full bg-[#00a884] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#009272] transition-all active:scale-95 ${className}`}
          title={`Instalar OffGrid Link no seu dispositivo (${platformInfo.name})`}
        >
          <Download className="h-3.5 w-3.5 stroke-[2.5]" />
          <span>Instalar App</span>
        </button>

        {showModal && (
          <InstallTutorialModal
            initialCategory={platformInfo.category}
            isInstallable={isInstallable}
            onTriggerInstall={install}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  if (variant === 'banner') {
    return (
      <>
        <div className={`relative overflow-hidden rounded-2xl bg-white p-4 text-zinc-900 shadow-xs border border-zinc-200 ${className}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-[#00a884] border border-emerald-100">
                {details.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-zinc-900">Instalar OffGrid Link</p>
                  <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 border border-zinc-200">
                    {details.badge}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Funciona 100% sem internet, em tela cheia e com inicialização rápida.
                </p>
              </div>
            </div>
            
            <button
              onClick={handleInstallAction}
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-[#00a884] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#009272] transition active:scale-95 shadow-xs"
            >
              <Download className="h-4 w-4" />
              <span>Instalar</span>
            </button>
          </div>
        </div>

        {showModal && (
          <InstallTutorialModal
            initialCategory={platformInfo.category}
            isInstallable={isInstallable}
            onTriggerInstall={install}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <button
        onClick={handleInstallAction}
        className={`flex items-center gap-2 rounded-2xl bg-[#00a884] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#009272] transition active:scale-95 ${className}`}
      >
        <Download className="h-4 w-4 stroke-[2.5]" />
        <span>{details.label}</span>
      </button>

      {showModal && (
        <InstallTutorialModal
          initialCategory={platformInfo.category}
          isInstallable={isInstallable}
          onTriggerInstall={install}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
};

interface InstallModalProps {
  initialCategory: PlatformCategory;
  isInstallable: boolean;
  onTriggerInstall: () => Promise<any>;
  onClose: () => void;
}

function InstallTutorialModal({ initialCategory, isInstallable, onTriggerInstall, onClose }: InstallModalProps) {
  const [selectedTab, setSelectedTab] = useState<PlatformCategory>(initialCategory);
  const [promptAttempted, setPromptAttempted] = useState(false);

  const handlePromptClick = async () => {
    setPromptAttempted(true);
    const result = await onTriggerInstall();
    if (result === 'accepted') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-zinc-200 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#00a884]/15 text-[#00a884]">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">Instalar Aplicativo</h3>
              <p className="text-xs text-zinc-500">OffGrid Link PWA Oficial</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* System Selector Tabs (Apple, Android, PC) */}
        <div className="flex border-b border-zinc-100 bg-zinc-50/70 p-2 gap-1.5 text-xs font-bold">
          <button
            onClick={() => setSelectedTab('apple')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 rounded-xl transition ${
              selectedTab === 'apple'
                ? 'bg-white text-zinc-900 shadow-xs border border-zinc-200/80 font-extrabold'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span>Apple (iOS)</span>
          </button>

          <button
            onClick={() => setSelectedTab('android')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 rounded-xl transition ${
              selectedTab === 'android'
                ? 'bg-white text-[#00a884] shadow-xs border border-zinc-200/80 font-extrabold'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span>Android</span>
          </button>

          <button
            onClick={() => setSelectedTab('pc')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 rounded-xl transition ${
              selectedTab === 'pc'
                ? 'bg-white text-blue-600 shadow-xs border border-zinc-200/80 font-extrabold'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Monitor className="h-4 w-4" />
            <span>Computador / PC</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* Automatic Native Prompt Trigger Button (if supported by the browser) */}
          {isInstallable && (selectedTab === 'android' || selectedTab === 'pc') && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                Instalação Automática Disponível
              </div>
              <p className="text-xs text-emerald-700">
                Seu navegador suporta instalação direta em 1 clique.
              </p>
              <button
                onClick={handlePromptClick}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#00a884] py-3 text-xs font-bold text-white shadow-md hover:bg-[#009272] transition active:scale-95 mt-1"
              >
                <Download className="h-4 w-4" />
                <span>Solicitar Instalação Agora (Abrir Janela)</span>
              </button>
            </div>
          )}

          {/* TUTORIAL APPLE (iOS / iPhone / iPad) */}
          {selectedTab === 'apple' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900 font-bold text-sm">
                  🍏
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-900">Como instalar no iPhone ou iPad</h4>
                  <p className="text-[11px] text-zinc-500">Usando o Safari (navegador padrão)</p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-zinc-700">
                <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Share className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-zinc-900 block">Passo 1: Toque em Compartilhar</span>
                    <span className="text-zinc-600">
                      Na barra inferior do Safari, toque no ícone de <strong>Compartilhar</strong> (o quadrado com uma seta para cima).
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <PlusSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-zinc-900 block">Passo 2: Adicionar à Tela de Início</span>
                    <span className="text-zinc-600">
                      Role o menu de opções para baixo e selecione <strong>"Adicionar à Tela de Início"</strong>.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-700">
                    <Check className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-zinc-900 block">Passo 3: Confirmar "Adicionar"</span>
                    <span className="text-zinc-600">
                      No canto superior direito, toque em <strong>"Adicionar"</strong>. O ícone do OffGrid aparecerá na sua tela inicial!
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-zinc-400 bg-zinc-50 rounded-xl p-2.5 border border-zinc-100">
                💡 <em>No Mac Safari:</em> Clique no menu <strong>Arquivo &gt; Adicionar ao Dock...</strong>
              </p>
            </div>
          )}

          {/* TUTORIAL ANDROID */}
          {selectedTab === 'android' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 font-bold text-sm">
                  🤖
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-900">Como instalar no Android</h4>
                  <p className="text-[11px] text-zinc-500">Google Chrome, Samsung Internet ou Edge</p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-zinc-700">
                <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-800 font-bold">
                    ⋮
                  </div>
                  <div>
                    <span className="font-bold text-zinc-900 block">Passo 1: Abra o Menu do Navegador</span>
                    <span className="text-zinc-600">
                      Toque nos <strong>três pontinhos verticais (⋮)</strong> no canto superior direito do Chrome.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#00a884]">
                    <Download className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-zinc-900 block">Passo 2: Selecione "Instalar Aplicativo"</span>
                    <span className="text-zinc-600">
                      Procure e toque em <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-700">
                    <Check className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-zinc-900 block">Passo 3: Confirmar na Janela</span>
                    <span className="text-zinc-600">
                      Toque em <strong>"Instalar"</strong>. O aplicativo será baixado e funcionará offline com ícone próprio na sua gaveta de apps!
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TUTORIAL PC / COMPUTADOR */}
          {selectedTab === 'pc' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-700 font-bold text-sm">
                  💻
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-900">Como instalar no Computador (Windows / Mac / Linux)</h4>
                  <p className="text-[11px] text-zinc-500">Google Chrome, Microsoft Edge ou Brave</p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-zinc-700">
                <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Download className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-zinc-900 block">Passo 1: Ícone na Barra de Endereços</span>
                    <span className="text-zinc-600">
                      Na barra de endereços do seu navegador (ao lado da estrela de favoritos), clique no ícone de <strong>Instalar</strong> (um monitorzinho ou símbolo ⊕).
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-800 font-bold">
                    ⋮
                  </div>
                  <div>
                    <span className="font-bold text-zinc-900 block">Ou Passo Alternativo via Menu:</span>
                    <span className="text-zinc-600">
                      Clique nos <strong>três pontinhos (⋮) &gt; Salvar e compartilhar &gt; "Instalar OffGrid Link como aplicativo"</strong>.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#00a884]">
                    <Check className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-zinc-900 block">Passo 2: Clique em "Instalar"</span>
                    <span className="text-zinc-600">
                      O app abrirá em uma janela nativa independente, podendo ser fixado na Barra de Tarefas e no menu Iniciar.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Vantagens do App */}
          <div className="rounded-2xl bg-zinc-50 p-3 border border-zinc-200/80 text-[11px] text-zinc-600 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-zinc-800">
              <Zap className="h-3.5 w-3.5 text-[#00a884]" />
              Vantagens do app instalado:
            </div>
            <p>• Abre instantaneamente em tela cheia sem barras de navegador.</p>
            <p>• Funciona mesmo sem conexão com internet (Mesh e cache local).</p>
            <p>• Notificações mais rápidas e menor consumo de bateria.</p>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-zinc-100 bg-zinc-50/70 p-4 text-center">
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-[#00a884] py-3 text-xs font-bold text-white shadow-md hover:bg-[#009272] transition"
          >
            Entendido, fechar tutorial
          </button>
        </div>

      </div>
    </div>
  );
}

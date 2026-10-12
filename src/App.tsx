import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  onSnapshot, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  addDoc, 
  updateDoc, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { User, Conversation, Message, ConnectionStatus } from './types';
import { Layout } from './components/Layout';
import { Login } from './components/Login';
import { ProfileSetup } from './components/ProfileSetup';
import { ChatList } from './components/ChatList';
import { ChatRoom } from './components/ChatRoom';
import { ContactList } from './components/ContactList';
import { Connections } from './components/Connections';
import { Settings } from './components/Settings';
import { StatusList } from './components/StatusList';
import { StatusView } from './components/StatusView';
import NewGroup from './components/NewGroup';
import { PermissionsModal } from './components/PermissionsModal';
import { meshNetwork } from './services/meshNetwork';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  connectionStatus: ConnectionStatus;
  setConnectionStatus: React.Dispatch<React.SetStateAction<ConnectionStatus>>;
  openPermissionsModal: () => void;
  syncOfflineMessagesNow: () => Promise<number>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    internet: typeof navigator !== 'undefined' ? navigator.onLine : true,
    bluetooth: true,
    wifiDirect: true,
    ultrasound: true,
    opticalQR: true,
    localLan: true,
    meshRelay: true,
  });

  const syncOfflineMessagesNow = async (): Promise<number> => {
    if (!user) return 0;
    return await meshNetwork.flushOutboxToServer(user.uid);
  };

  useEffect(() => {
    const handleOnline = async () => {
      setConnectionStatus(prev => ({ ...prev, internet: true }));
      if (user) {
        try {
          await updateDoc(doc(db, 'users', user.uid), { status: 'online', lastSeen: Date.now() });
        } catch {}
        const synced = await meshNetwork.flushOutboxToServer(user.uid);
        if (synced > 0) {
          console.log(`Auto-synced ${synced} offline messages to Firestore server.`);
        }
      }
    };

    const handleOffline = () => {
      setConnectionStatus(prev => ({ ...prev, internet: false }));
      if (user) {
        updateDoc(doc(db, 'users', user.uid), { status: 'offline', lastSeen: Date.now() }).catch(() => {});
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (fUser) => {
      setFirebaseUser(fUser);
      if (fUser) {
        const userRef = doc(db, 'users', fUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            setNeedsOnboarding(true);
            setUser(null);
          } else {
            const userData = userSnap.data() as User;
            setUser(userData);
            const reqOnboarding = !userData.name || userData.name === 'Anonymous';
            setNeedsOnboarding(reqOnboarding);
            
            // Check if permissions prompt has been shown
            const configured = localStorage.getItem('offgrid_permissions_configured') === 'true';
            if (!reqOnboarding && !configured) {
              setShowPermissionsModal(true);
            }

            // Update status to online
            await updateDoc(userRef, { status: 'online', lastSeen: Date.now(), isTyping: false });
            
            // Trigger outbox flush if online
            if (navigator.onLine) {
              meshNetwork.flushOutboxToServer(userData.uid).catch(console.warn);
            }
          }
        } catch (error) {
          console.error('Error fetching user data on auth change:', error);
          setNeedsOnboarding(true);
          setUser(null);
        }
      } else {
        setUser(null);
        setNeedsOnboarding(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      console.error('Sign in with email error:', error);
      throw error;
    }
  };

  const signUpWithEmail = async (name: string, email: string, password: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (cred.user) {
        const userRef = doc(db, 'users', cred.user.uid);
        const publicRef = doc(db, 'users_public', cred.user.uid);
        const publicKey = btoa(Math.random().toString(36).substring(2) + Date.now());
        
        const newUser: User = {
          uid: cred.user.uid,
          name: name.trim() || 'Usuário OffGrid',
          photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cred.user.uid}`,
          email: cred.user.email || email.trim(),
          phoneNumber: null,
          contacts: [],
          status: 'online',
          lastSeen: Date.now(),
          isTyping: false,
          bio: 'Conectado via OffGrid',
          publicKey,
          role: 'user'
        };

        await setDoc(userRef, newUser);
        await setDoc(publicRef, {
          uid: newUser.uid,
          name: newUser.name,
          photoURL: newUser.photoURL,
          status: newUser.status,
          lastSeen: newUser.lastSeen,
          isTyping: false,
          publicKey: newUser.publicKey
        });

        if (newUser.email) {
          await setDoc(doc(db, 'users_search', newUser.email), { uid: newUser.uid });
        }

        setUser(newUser);
        setNeedsOnboarding(false);
        
        // Show permissions modal for new account
        setShowPermissionsModal(true);
      }
    } catch (error) {
      console.error('Sign up with email error:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!firebaseUser) return;
    const userRef = doc(db, 'users', firebaseUser.uid);
    const publicRef = doc(db, 'users_public', firebaseUser.uid);
    const userSnap = await getDoc(userRef);
    
    const publicData = {
      uid: firebaseUser.uid,
      name: data.name || (userSnap.exists() ? userSnap.data().name : (firebaseUser.displayName || 'Anonymous')),
      photoURL: data.photoURL || (userSnap.exists() ? userSnap.data().photoURL : (firebaseUser.photoURL || null)),
      status: data.status || (userSnap.exists() ? userSnap.data().status : 'online'),
      lastSeen: data.lastSeen || (userSnap.exists() ? userSnap.data().lastSeen : Date.now()),
      isTyping: data.isTyping || (userSnap.exists() ? userSnap.data().isTyping : false),
      publicKey: data.publicKey || (userSnap.exists() ? userSnap.data().publicKey : null)
    };

    if (!userSnap.exists()) {
      const publicKey = btoa(Math.random().toString(36).substring(2) + Date.now());
      
      const newUser: User = {
        uid: firebaseUser.uid,
        name: data.name || firebaseUser.displayName || 'Anonymous',
        photoURL: data.photoURL || firebaseUser.photoURL || null,
        email: firebaseUser.email || null,
        phoneNumber: firebaseUser.phoneNumber || null,
        contacts: [],
        status: 'online',
        lastSeen: Date.now(),
        isTyping: false,
        bio: data.bio || '',
        password: data.password || '',
        publicKey,
        role: 'user'
      };
      await setDoc(userRef, newUser);
      await setDoc(publicRef, publicData);

      if (newUser.email) {
        await setDoc(doc(db, 'users_search', newUser.email), { uid: newUser.uid });
      }
      if (newUser.phoneNumber) {
        await setDoc(doc(db, 'users_search', newUser.phoneNumber), { uid: newUser.uid });
      }

      setUser(newUser);
    } else {
      await updateDoc(userRef, data);
      await updateDoc(publicRef, publicData);

      if (data.email) {
        await setDoc(doc(db, 'users_search', data.email), { uid: firebaseUser.uid });
      }
      if (data.phoneNumber) {
        await setDoc(doc(db, 'users_search', data.phoneNumber), { uid: firebaseUser.uid });
      }

      setUser(prev => prev ? { ...prev, ...data } : null);
    }

    setNeedsOnboarding(false);
    
    // Check and trigger permissions modal after profile setup
    const configured = localStorage.getItem('offgrid_permissions_configured') === 'true';
    if (!configured) {
      setShowPermissionsModal(true);
    }
  };

  const logout = async () => {
    if (user) {
      await updateDoc(doc(db, 'users', user.uid), { status: 'offline', lastSeen: Date.now() });
    }
    await signOut(auth);
  };

  useEffect(() => {
    if (!user) return;

    // Listen for new messages across all conversations for notifications
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const conv = change.doc.data() as Conversation;
          const lastMsg = conv.lastMessage;
          
          if (lastMsg && lastMsg.senderId !== user.uid && !lastMsg.seen) {
            const isInChat = window.location.pathname === `/chat/${conv.id}`;
            
            if (!isInChat && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification('Nova mensagem (OffGrid)', {
                  body: lastMsg.text,
                  icon: '/icon.svg'
                });
              } catch {}
            }
          }
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'conversations/notifications');
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#00a884]" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      firebaseUser, 
      loading, 
      signIn, 
      signInWithEmail,
      signUpWithEmail,
      resetPassword,
      logout, 
      updateProfile, 
      connectionStatus, 
      setConnectionStatus,
      openPermissionsModal: () => setShowPermissionsModal(true),
      syncOfflineMessagesNow
    }}>
      <Router>
        <Routes>
          <Route path="/login" element={!firebaseUser ? <Login /> : (needsOnboarding ? <ProfileSetup /> : <Navigate to="/" />)} />
          <Route path="/" element={firebaseUser ? (needsOnboarding ? <ProfileSetup /> : <Layout />) : <Navigate to="/login" />}>
            <Route index element={<ChatList />} />
            <Route path="chat/:conversationId" element={<ChatRoom />} />
            <Route path="contacts" element={<ContactList />} />
            <Route path="connections" element={<Connections />} />
            <Route path="settings" element={<Settings />} />
            <Route path="status" element={<StatusList />} />
            <Route path="status/:uid" element={<StatusView />} />
            <Route path="new-group" element={<NewGroup />} />
          </Route>
        </Routes>

        <PermissionsModal
          isOpen={showPermissionsModal}
          onClose={() => setShowPermissionsModal(false)}
          isMandatoryInitial={true}
        />
      </Router>
    </AuthContext.Provider>
  );
}

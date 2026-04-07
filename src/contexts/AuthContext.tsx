import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { logout as firebaseLogout } from '../services/authService';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-error';

interface AuthContextType {
  user: User | null;
  userData: any | null;
  loading: boolean;
  isAdmin: boolean;
  showPermissionsStep: boolean;
  setShowPermissionsStep: (show: boolean) => void;
  showBetaWelcome: boolean;
  setShowBetaWelcome: (show: boolean) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  isAdmin: false,
  showPermissionsStep: false,
  setShowPermissionsStep: () => {},
  showBetaWelcome: false,
  setShowBetaWelcome: () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPermissionsStep, setShowPermissionsStep] = useState(false);
  const [showBetaWelcome, setShowBetaWelcome] = useState(false);

  const logout = async () => {
    await firebaseLogout();
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        const setupUserDoc = async () => {
          try {
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
              console.log("Creating new user document for:", firebaseUser.email);
              const isSuperAdmin = ['jazaelcaceres@gmail.com', 'johnyov@gmail.com'].includes(firebaseUser.email || '');
              await setDoc(userRef, {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoUrl: firebaseUser.photoURL,
                role: isSuperAdmin ? 'admin' : 'student',
                createdAt: new Date().toISOString()
              });
              setShowPermissionsStep(true);
              setShowBetaWelcome(true);
            }
          } catch (error: any) {
            // If it's a permission error, it might be because the doc doesn't exist yet
            // and the rules are being strict, or it's a race condition.
            if (error.code === 'permission-denied') {
              console.warn("Permission denied during initial user doc check. This is expected for new users.");
              // We'll try to create it anyway if we suspect it's missing
              try {
                const isSuperAdmin = ['jazaelcaceres@gmail.com', 'johnyov@gmail.com'].includes(firebaseUser.email || '');
                await setDoc(userRef, {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  displayName: firebaseUser.displayName,
                  photoUrl: firebaseUser.photoURL,
                  role: isSuperAdmin ? 'admin' : 'student',
                  createdAt: new Date().toISOString()
                });
                setShowPermissionsStep(true);
                setShowBetaWelcome(true);
              } catch (createError) {
                console.error("Failed to create user doc after permission denied:", createError);
              }
            } else {
              console.error("Error checking/creating user doc:", error);
            }
          }
        };

        await setupUserDoc();

        // Listen to user data in Firestore
        const unsubscribeDoc = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            setUserData(doc.data());
          } else {
            setUserData(null);
          }
          setLoading(false);
        }, (error: any) => {
          // If it's a permission error, don't crash the app, just log it.
          // The user might not have a document yet.
          if (error.code === 'permission-denied') {
            console.warn("onSnapshot permission denied for user doc. User might not have a document yet.");
          } else {
            console.error("AuthContext onSnapshot error:", error);
            handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`, firebaseUser);
          }
          setLoading(false);
        });

        return () => unsubscribeDoc();
      } else {
        setUserData(null);
        setShowPermissionsStep(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const isAdmin = userData?.role === 'admin';

  return (
    <AuthContext.Provider value={{ 
      user, 
      userData, 
      loading, 
      isAdmin, 
      showPermissionsStep, 
      setShowPermissionsStep, 
      showBetaWelcome,
      setShowBetaWelcome,
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

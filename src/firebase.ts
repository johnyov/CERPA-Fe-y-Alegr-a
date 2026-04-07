import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import appletConfig from '../firebase-applet-config.json';

/** Web API key de la app Firebase (debe coincidir con la consola del proyecto). */
const FIREBASE_WEB_API_KEY = 'AIzaSyCj4ijgCKXddXKoCFVM6pzk77EFCL0W0Ks';

const firebaseConfig: FirebaseOptions = {
  ...(appletConfig as FirebaseOptions),
  apiKey: FIREBASE_WEB_API_KEY,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

export const signUpWithEmail = async (email: string, pass: string, name: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    const user = result.user;
    await updateProfile(user, { displayName: name });
    return user;
  } catch (error) {
    console.error('Error signing up with email:', error);
    throw error;
  }
};

export const loginWithEmail = async (email: string, pass: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return result.user;
  } catch (error) {
    console.error('Error logging in with email:', error);
    throw error;
  }
};

export const logout = () => signOut(auth);

export const deleteAccount = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('No hay usuario autenticado');

  try {
    // 1. Delete user document from Firestore
    const userRef = doc(db, 'users', user.uid);
    await deleteDoc(userRef);

    // 2. Delete user from Firebase Auth
    await user.delete();
  } catch (error: any) {
    console.error('Error deleting account:', error);
    if (error.code === 'auth/requires-recent-login') {
      throw new Error('REAUTH_REQUIRED');
    }
    throw error;
  }
};

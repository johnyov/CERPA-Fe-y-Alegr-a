import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  User
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, isNewUser: false }; // AuthContext handles doc creation
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

export const signUpWithEmail = async (email: string, pass: string, name: string, role: string = 'student') => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    const user = result.user;
    await updateProfile(user, { displayName: name });
    // AuthContext handles doc creation
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

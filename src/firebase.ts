import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, FacebookAuthProvider, Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyACmkmZdy9aphqqsrbg9fhamW6MV5dlx8Q",
  authDomain: "imdb-clone-80c76.firebaseapp.com",
  projectId: "imdb-clone-80c76",
  storageBucket: "imdb-clone-80c76.firebasestorage.app",
  messagingSenderId: "425795171500",
  appId: "1:425795171500:web:31854e73cca208764c9b09",
  measurementId: "G-W6FEE8ZS92"
};

const firebaseApp = initializeApp(firebaseConfig);

export const auth: Auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export const facebookProvider = new FacebookAuthProvider();
export default firebaseApp;
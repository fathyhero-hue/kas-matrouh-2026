import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCuHBBvyD6q6E0i6MUIqhZ4DDsCkyaRoz4",
  authDomain: "matrouh-cup.firebaseapp.com",
  projectId: "matrouh-cup",
  storageBucket: "matrouh-cup.firebasestorage.app",
  messagingSenderId: "997931641279",
  appId: "1:997931641279:web:529cf175ab96704102190a",
  measurementId: "G-9HBQWREVXK"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
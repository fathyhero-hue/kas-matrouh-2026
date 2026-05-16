import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // 👈 استدعاء مكتبة التخزين

// وضع البيانات مباشرة لحل مشكلة Vercel Environment Variables
const firebaseConfig = {
  apiKey: "AIzaSyCuHBBvyD6q6E0i6MUIqhZ4DDsCkyaRoz4",
  authDomain: "matrouh-cup.firebaseapp.com",
  projectId: "matrouh-cup",
  storageBucket: "matrouh-cup.firebasestorage.app",
  messagingSenderId: "997931641279",
  appId: "1:997931641279:web:529cf175ab96704102190a",
  measurementId: "G-9HBQWREVXK"
};

// تهيئة التطبيق
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const storage = getStorage(app); // 👈 تهيئة خدمة التخزين للصور

export { app, db, storage }; // 👈 تصدير التخزين عشان نقدر نستخدمه في الصفحات
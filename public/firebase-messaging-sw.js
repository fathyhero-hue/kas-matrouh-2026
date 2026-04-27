importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// إعدادات قاعدة البيانات الخاصة ببطولة كأس مطروح
const firebaseConfig = {
  apiKey: "AIzaSyCuHBBvyD6q6E0i6MUIqhZ4DDsCkyaRoz4",
  authDomain: "matrouh-cup.firebaseapp.com",
  projectId: "matrouh-cup",
  storageBucket: "matrouh-cup.firebasestorage.app",
  messagingSenderId: "997931641279",
  appId: "1:997931641279:web:529cf175ab96704102190a",
  measurementId: "G-9HBQWREVXK"
};

// تشغيل الفايربيس في خلفية الموبايل
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// استقبال الإشعارات وعرضها لما يكون الموقع مقفول
messaging.onBackgroundMessage(function(payload) {
  console.log('تم استقبال إشعار في الخلفية: ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png', // اللوجو اللي هيظهر في الإشعار
    badge: '/logo.png',
    dir: 'rtl'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
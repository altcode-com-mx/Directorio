import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAZX1X4OocaycbrAsWmshZpT0KMGJp4snU",
  authDomain: "altcodemx.firebaseapp.com",
  projectId: "altcodemx",
  storageBucket: "altcodemx.firebasestorage.app",
  messagingSenderId: "380861126652",
  appId: "1:380861126652:web:1b8fdc1038c5a31bd5c479",
  measurementId: "G-S1EFLTPVNX",
};

export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);

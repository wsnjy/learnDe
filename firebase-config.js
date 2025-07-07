// Firebase Configuration for DeutschLern App
// Import the functions you need from the SDKs you need
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyDXXtz4y628AJepYk7m1xjWW_FoTSVB3Yk",
    authDomain: "learnde-89185.firebaseapp.com",
    projectId: "learnde-89185",
    storageBucket: "learnde-89185.firebasestorage.app",
    messagingSenderId: "1097876981841",
    appId: "1:1097876981841:web:245a818241b06cc0bed070",
    measurementId: "G-SCGK847KMF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, doc, setDoc, getDoc, onSnapshot };
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Replace each value below with the config from your Firebase project console.
// See setup instructions in the README.
const firebaseConfig = {
  apiKey: "AIzaSyDjU7odRbqdUk6YLvONLuM8iMYyNELQWSQ",
  authDomain: "tune-in-d636f.firebaseapp.com",
  projectId: "tune-in-d636f",
  storageBucket: "tune-in-d636f.firebasestorage.app",
  messagingSenderId: "581958414864",
  appId: "1:581958414864:web:020fb4f2963be1ef029095"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

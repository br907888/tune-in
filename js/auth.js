import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { auth } from "./firebase-config.js";

// --- Tab switching ---
const loginTab = document.getElementById("login-tab");
const signupTab = document.getElementById("signup-tab");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");

loginTab.addEventListener("click", () => {
  loginTab.classList.add("active");
  signupTab.classList.remove("active");
  loginForm.classList.remove("hidden");
  signupForm.classList.add("hidden");
  clearError();
});

signupTab.addEventListener("click", () => {
  signupTab.classList.add("active");
  loginTab.classList.remove("active");
  signupForm.classList.remove("hidden");
  loginForm.classList.add("hidden");
  clearError();
});

// --- Sign Up ---
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const displayName = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;

  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName });
    window.location.href = "profile.html";
  } catch (err) {
    showError(friendlyError(err.code));
  }
});

// --- Log In ---
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "profile.html";
  } catch (err) {
    showError(friendlyError(err.code));
  }
});

// --- Redirect if already logged in ---
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "profile.html";
});

// --- Helpers ---
function showError(message) {
  const el = document.getElementById("auth-error");
  el.textContent = message;
  el.classList.remove("hidden");
}

function clearError() {
  const el = document.getElementById("auth-error");
  el.textContent = "";
  el.classList.add("hidden");
}

function friendlyError(code) {
  const messages = {
    "auth/email-already-in-use": "An account with that email already exists.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-credential": "Incorrect email or password. Please try again.",
    "auth/too-many-requests": "Too many attempts. Please try again later."
  };
  return messages[code] || "Something went wrong. Please try again.";
}

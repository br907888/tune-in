import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { setDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

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
  // Disable hidden form inputs so browser validation ignores them
  signupForm.querySelectorAll("input").forEach(i => i.disabled = true);
  loginForm.querySelectorAll("input").forEach(i => i.disabled = false);
  clearError();
});

signupTab.addEventListener("click", () => {
  signupTab.classList.add("active");
  loginTab.classList.remove("active");
  signupForm.classList.remove("hidden");
  loginForm.classList.add("hidden");
  loginForm.querySelectorAll("input").forEach(i => i.disabled = true);
  signupForm.querySelectorAll("input").forEach(i => i.disabled = false);
  clearError();
});

// Flag to prevent onAuthStateChanged from racing with form submission redirects
let isSubmitting = false;

// --- Sign Up ---
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  isSubmitting = true;

  const submitBtn = signupForm.querySelector(".submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Creating account...";

  const displayName = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;

  let user = null;
  try {
    ({ user } = await createUserWithEmailAndPassword(auth, email, password));
    await updateProfile(user, { displayName });
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      displayName,
      displayNameLower: displayName.toLowerCase(),
      email,
      createdAt: serverTimestamp()
    });
    window.location.href = "home.html";
  } catch (err) {
    // If Auth user was created but a later step failed, delete the partial account
    if (user) await user.delete().catch(() => {});
    isSubmitting = false;
    submitBtn.disabled = false;
    submitBtn.textContent = "Create Account";
    showError(friendlyError(err.code));
  }
});

// --- Log In ---
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  isSubmitting = true;
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "home.html";
  } catch (err) {
    isSubmitting = false;
    showError(friendlyError(err.code));
  }
});

// --- Redirect if already logged in ---
// Only fires when the page loads with an existing session, not during form submissions
onAuthStateChanged(auth, (user) => {
  if (user && !isSubmitting) window.location.href = "home.html";
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

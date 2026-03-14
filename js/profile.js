import {
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { setDoc, doc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const displayNameEl = document.getElementById("display-name");
const emailEl = document.getElementById("user-email");
const editForm = document.getElementById("edit-form");
const editNameInput = document.getElementById("edit-name");
const logoutBtn = document.getElementById("logout-btn");
const statusMsg = document.getElementById("status-msg");

// --- Guard: redirect to login if not authenticated ---
const unsubscribe = onAuthStateChanged(auth, async (user) => {
  unsubscribe();
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  displayNameEl.textContent = user.displayName || "No name set";
  emailEl.textContent = user.email;
  editNameInput.value = user.displayName || "";
  await loadStats(user.uid);
});

// --- Stats: followers, following, queue count ---
async function loadStats(uid) {
  try {
    const [followersSnap, followingSnap, queueSnap] = await Promise.all([
      getDocs(query(collection(db, "follows"), where("followingId", "==", uid))),
      getDocs(query(collection(db, "follows"), where("followerId", "==", uid))),
      getDocs(query(collection(db, "queue"), where("userId", "==", uid)))
    ]);
    document.getElementById("followers-count").textContent = followersSnap.size;
    document.getElementById("following-count").textContent = followingSnap.size;
    document.getElementById("queue-count").textContent = queueSnap.size;
  } catch (err) {
    document.getElementById("followers-count").textContent = "—";
    document.getElementById("following-count").textContent = "—";
    document.getElementById("queue-count").textContent = "—";
  }
}

// --- Update display name ---
editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const newName = editNameInput.value.trim();
  if (!newName) return;

  // Guard: auth.currentUser can be null if Firebase hasn't resolved the session yet
  if (!auth.currentUser) {
    showStatus("Session not ready. Please try again.", true);
    return;
  }

  const saveBtn = editForm.querySelector(".save-btn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    await updateProfile(auth.currentUser, { displayName: newName });
    // setDoc with merge:true acts as upsert — safe for accounts created before Firestore docs were added
    await setDoc(doc(db, "users", auth.currentUser.uid), { displayName: newName, displayNameLower: newName.toLowerCase() }, { merge: true });
    displayNameEl.textContent = newName;
    showStatus("Name updated successfully.");
  } catch (err) {
    showStatus("Failed to update name. Please try again.", true);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save";
  }
});

// --- Log out ---
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

function showStatus(message, isError = false) {
  statusMsg.textContent = message;
  statusMsg.className = isError ? "status error" : "status success";
  setTimeout(() => { statusMsg.textContent = ""; statusMsg.className = "status"; }, 3000);
}

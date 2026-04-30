import {
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { setDoc, doc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { auth, db, storage } from "./firebase-config.js";

const displayNameEl = document.getElementById("display-name");
const emailEl = document.getElementById("user-email");
const editForm = document.getElementById("edit-form");
const editNameInput = document.getElementById("edit-name");
const logoutBtn = document.getElementById("logout-btn");
const statusMsg = document.getElementById("status-msg");
const avatarWrap = document.getElementById("avatar-wrap");
const avatarImg = document.getElementById("avatar-img");
const avatarPlaceholder = document.getElementById("avatar-placeholder");
const avatarInitialsEl = document.getElementById("avatar-initials");
const avatarInput = document.getElementById("avatar-input");

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
  renderAvatar(user.photoURL, user.displayName);
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

// --- Avatar display ---
function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
}

function renderAvatar(photoURL, displayName) {
  avatarInitialsEl.textContent = getInitials(displayName);
  if (photoURL) {
    avatarImg.src = photoURL;
    avatarImg.hidden = false;
    avatarPlaceholder.hidden = true;
  } else {
    avatarImg.hidden = true;
    avatarPlaceholder.hidden = false;
  }
}

avatarImg.addEventListener("error", () => {
  avatarImg.hidden = true;
  avatarPlaceholder.hidden = false;
});

// --- Avatar upload ---
let uploading = false;

avatarWrap.addEventListener("click", () => { if (!uploading) avatarInput.click(); });
avatarWrap.addEventListener("keydown", (e) => {
  if (!uploading && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    avatarInput.click();
  }
});

avatarInput.addEventListener("change", async () => {
  const file = avatarInput.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showStatus("Please select an image file.", true);
    avatarInput.value = "";
    return;
  }
  if (file.size > 3 * 1024 * 1024) {
    showStatus("Image must be under 3 MB.", true);
    avatarInput.value = "";
    return;
  }

  if (!auth.currentUser) {
    showStatus("Session not ready. Please try again.", true);
    return;
  }

  uploading = true;
  showStatus("Uploading...");
  avatarWrap.style.pointerEvents = "none";

  try {
    const storageRef = ref(storage, `avatars/${auth.currentUser.uid}`);
    await new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, file);
      task.on("state_changed", null, reject, () => resolve());
    });
    const downloadURL = await getDownloadURL(storageRef);

    await Promise.all([
      updateProfile(auth.currentUser, { photoURL: downloadURL }),
      setDoc(doc(db, "users", auth.currentUser.uid), { photoURL: downloadURL }, { merge: true })
    ]);

    renderAvatar(downloadURL, auth.currentUser.displayName);
    showStatus("Photo updated.");
  } catch (err) {
    showStatus("Upload failed. Please try again.", true);
  } finally {
    uploading = false;
    avatarWrap.style.pointerEvents = "";
    avatarInput.value = "";
  }
});

// --- Update display name ---
editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const newName = editNameInput.value.trim();
  if (!newName) return;

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
    avatarInitialsEl.textContent = getInitials(newName);
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

let _statusTimer = null;
function showStatus(message, isError = false) {
  clearTimeout(_statusTimer);
  statusMsg.textContent = message;
  statusMsg.className = isError ? "status error" : "status success";
  _statusTimer = setTimeout(() => { statusMsg.textContent = ""; statusMsg.className = "status"; }, 3000);
}

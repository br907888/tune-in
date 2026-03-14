import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  collection, query, where, getDocs, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const usersList = document.getElementById("users-list");
const tabFollowers = document.getElementById("tab-followers");
const tabFollowing = document.getElementById("tab-following");

let currentUid = null;
// Cache both tabs after first load to avoid re-fetching on tab switch
const cache = { followers: null, following: null };
// Discard stale async responses when tabs are switched rapidly
let requestCount = 0;

const params = new URLSearchParams(window.location.search);
const tabParam = params.get("tab") || sessionStorage.getItem("followsTab");
sessionStorage.removeItem("followsTab");
let activeTab = tabParam === "following" ? "following" : "followers";

const unsubscribe = onAuthStateChanged(auth, async (user) => {
  unsubscribe();
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentUid = user.uid;
  setActiveTab(activeTab);
  await loadTab(activeTab);
});

// --- Tab toggle ---
tabFollowers.addEventListener("click", () => {
  if (!currentUid || activeTab === "followers") return;
  activeTab = "followers";
  setActiveTab("followers");
  loadTab("followers");
});

tabFollowing.addEventListener("click", () => {
  if (!currentUid || activeTab === "following") return;
  activeTab = "following";
  setActiveTab("following");
  loadTab("following");
});

function setActiveTab(tab) {
  tabFollowers.classList.toggle("active", tab === "followers");
  tabFollowing.classList.toggle("active", tab === "following");
  document.title = tab === "followers" ? "Tune-In — Followers" : "Tune-In — Following";
}

// --- Load a tab ---
async function loadTab(tab) {
  if (cache[tab]) {
    renderUsers(cache[tab], tab);
    return;
  }

  const thisRequest = ++requestCount;
  usersList.innerHTML = `<p class="empty-state">Loading...</p>`;

  try {
    const isFollowers = tab === "followers";
    const field = isFollowers ? "followingId" : "followerId";
    const uidField = isFollowers ? "followerId" : "followingId";

    const snap = await getDocs(
      query(collection(db, "follows"), where(field, "==", currentUid))
    );

    if (thisRequest !== requestCount) return;

    if (snap.empty) {
      cache[tab] = [];
      renderUsers([], tab);
      return;
    }

    // Fetch user documents for all follows in parallel
    const uids = snap.docs.map(d => d.data()[uidField]);
    const userSnaps = await Promise.all(uids.map(uid => getDoc(doc(db, "users", uid))));

    if (thisRequest !== requestCount) return;

    const users = userSnaps
      .filter(s => s.exists())
      .map(s => ({ uid: s.id, displayName: s.data().displayName || "Unknown User" }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    cache[tab] = users;
    renderUsers(users, tab);
  } catch (err) {
    if (thisRequest !== requestCount) return;
    usersList.innerHTML = `<p class="empty-state" style="color:#f87171;">Failed to load. Please try again.</p>`;
  }
}

// --- Render ---
function renderUsers(users, tab) {
  if (users.length === 0) {
    const msg = tab === "followers"
      ? "Nobody is following you yet."
      : "You're not following anyone yet.";
    usersList.innerHTML = `<p class="empty-state">${msg}</p>`;
    return;
  }

  usersList.innerHTML = users.map(user => `
    <a class="user-card" href="public-profile.html?uid=${encodeURIComponent(user.uid)}"
       data-uid="${user.uid}">
      <span class="user-name">${escapeHtml(user.displayName)}</span>
      <span class="user-arrow">›</span>
    </a>
  `).join("");

  // sessionStorage fallback for npx serve clean URLs
  usersList.querySelectorAll(".user-card").forEach(card => {
    card.addEventListener("click", () => {
      sessionStorage.setItem("viewProfileUid", card.dataset.uid);
    });
  });
}

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

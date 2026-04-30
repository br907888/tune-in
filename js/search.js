import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const resultsContainer = document.getElementById("search-results");

let currentUserId = null;
let requestCount = 0;

// --- Auth guard: disable input until session is confirmed ---
searchInput.disabled = true;
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentUserId = user.uid;
  searchInput.disabled = false;
  searchInput.focus();
});

// --- Debounced search as user types ---
let debounceTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runSearch, 300);
});

// --- Also run on explicit submit ---
searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  clearTimeout(debounceTimer);
  runSearch();
});

async function runSearch() {
  const term = searchInput.value.trim().toLowerCase();

  if (!term) {
    resultsContainer.innerHTML = "";
    return;
  }

  // Track this request — discard results if a newer one has started
  const thisRequest = ++requestCount;
  resultsContainer.innerHTML = `<p class="empty-state">Searching...</p>`;

  try {
    const q = query(
      collection(db, "users"),
      where("displayNameLower", ">=", term),
      where("displayNameLower", "<=", term + "\uf8ff")
    );

    const snapshot = await getDocs(q);

    // Discard stale responses
    if (thisRequest !== requestCount) return;

    const users = [];
    snapshot.forEach(docSnap => {
      if (docSnap.id !== currentUserId) {
        // Use docSnap.id as the uid — it's always the user's UID regardless of document fields
        users.push({ uid: docSnap.id, ...docSnap.data() });
      }
    });

    if (users.length === 0) {
      resultsContainer.innerHTML = `<p class="empty-state">No users found for "${escapeHtml(term)}".</p>`;
      return;
    }

    resultsContainer.innerHTML = users.map(user => `
      <a href="public-profile.html?uid=${encodeURIComponent(user.uid)}" data-uid="${escapeHtml(user.uid)}" class="user-card">
        <div class="user-card-identity">
          ${miniAvatarHtml(user.photoURL || null, user.displayName)}
          <span class="user-name">${escapeHtml(user.displayName)}</span>
        </div>
        <span class="user-arrow">→</span>
      </a>
    `).join("");

    // Store uid in sessionStorage on click so it survives navigation
    resultsContainer.querySelectorAll(".user-card").forEach(card => {
      card.addEventListener("click", () => {
        sessionStorage.setItem("viewProfileUid", card.dataset.uid);
      });
    });

  } catch (err) {
    if (thisRequest !== requestCount) return;
    resultsContainer.innerHTML = `<p class="empty-state" style="color:#f87171;">Search failed. Please try again.</p>`;
  }
}

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
}

function miniAvatarHtml(photoURL, displayName) {
  if (photoURL) {
    return `<div class="mini-avatar"><img src="${escapeHtml(photoURL)}" alt="" /></div>`;
  }
  return `<div class="mini-avatar"><span class="mini-avatar-initials">${escapeHtml(getInitials(displayName))}</span></div>`;
}

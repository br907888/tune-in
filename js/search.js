import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const resultsContainer = document.getElementById("search-results");

let currentUserId = null;

// --- Auth guard ---
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentUserId = user.uid;
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

  resultsContainer.innerHTML = `<p class="empty-state">Searching...</p>`;

  try {
    // Prefix range query on displayNameLower for case-insensitive matching
    const q = query(
      collection(db, "users"),
      where("displayNameLower", ">=", term),
      where("displayNameLower", "<=", term + "\uf8ff")
    );

    const snapshot = await getDocs(q);

    const users = [];
    snapshot.forEach(docSnap => {
      if (docSnap.id !== currentUserId) users.push(docSnap.data());
    });

    if (users.length === 0) {
      resultsContainer.innerHTML = `<p class="empty-state">No users found for "${escapeHtml(term)}".</p>`;
      return;
    }

    resultsContainer.innerHTML = users.map(user => `
      <a href="public-profile.html?uid=${encodeURIComponent(user.uid)}" class="user-card">
        <span class="user-name">${escapeHtml(user.displayName)}</span>
        <span class="user-arrow">→</span>
      </a>
    `).join("");

  } catch (err) {
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

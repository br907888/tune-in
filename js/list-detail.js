import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  collection, query, where, getDocs,
  doc, getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const listTitle = document.getElementById("list-title");
const listDesc = document.getElementById("list-desc");
const itemsList = document.getElementById("items-list");

// Read listId from URL query string with sessionStorage fallback
const params = new URLSearchParams(window.location.search);
const listId = params.get("id") || sessionStorage.getItem("viewListId");
sessionStorage.removeItem("viewListId");

let isOwner = false;

const unsubscribe = onAuthStateChanged(auth, async (user) => {
  unsubscribe();
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  if (!listId) {
    showError("No list specified.");
    return;
  }

  await loadList(user.uid);
});

async function loadList(currentUid) {
  try {
    // Fetch the list document to get name, description, and verify ownership
    const listSnap = await getDoc(doc(db, "lists", listId));

    if (!listSnap.exists()) {
      showError("List not found.");
      return;
    }

    const listData = listSnap.data();
    isOwner = listData.userId === currentUid;

    listTitle.textContent = listData.name;
    document.title = `Tune-In — ${listData.name}`;

    if (listData.description) {
      listDesc.textContent = listData.description;
    }

    await loadItems();
  } catch (err) {
    showError("Failed to load list. Please try again.");
  }
}

async function loadItems() {
  try {
    const snap = await getDocs(
      query(collection(db, "listItems"), where("listId", "==", listId))
    );

    if (snap.empty) {
      itemsList.innerHTML = `<p class="empty-state">This list has no items yet.</p>`;
      return;
    }

    // Sort by addedAt descending — most recently added first
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.addedAt?.seconds ?? Number.MAX_SAFE_INTEGER) - (a.addedAt?.seconds ?? Number.MAX_SAFE_INTEGER));

    itemsList.innerHTML = items.map(item => {
      const rating = Math.min(5, Math.max(0, parseInt(item.rating) || 0));
      return `
        <div class="review-card" data-id="${item.id}">
          <div class="review-header">
            <div>
              <div class="review-title">${escapeHtml(item.title)}</div>
              <div class="review-artist">${escapeHtml(item.artist)}</div>
            </div>
            <div class="review-meta">
              <span class="type-badge type-${safeType(item.type)}">${escapeHtml(item.type)}</span>
              <span class="review-stars">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</span>
            </div>
          </div>
          ${item.reviewText ? `<p class="review-text">${escapeHtml(item.reviewText)}</p>` : ""}
          <div class="review-footer">
            <p class="review-date">${formatDate(item.createdAt)}</p>
            ${isOwner ? `<button class="delete-btn" data-id="${item.id}">Remove</button>` : ""}
          </div>
        </div>
      `;
    }).join("");

  } catch (err) {
    itemsList.innerHTML = `<p class="empty-state" style="color:#f87171;">Failed to load items. Please try again.</p>`;
  }
}

// --- Remove item via event delegation ---
itemsList.addEventListener("click", async (e) => {
  const btn = e.target.closest(".delete-btn");
  if (!btn || !isOwner) return;

  const itemId = btn.dataset.id;
  btn.disabled = true;
  btn.textContent = "Removing...";

  try {
    await deleteDoc(doc(db, "listItems", itemId));
    itemsList.querySelector(`.review-card[data-id="${itemId}"]`).remove();

    if (itemsList.querySelectorAll(".review-card").length === 0) {
      itemsList.innerHTML = `<p class="empty-state">This list has no items yet.</p>`;
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Remove";
  }
});

function showError(message) {
  listTitle.textContent = "Error";
  itemsList.innerHTML = `<p class="empty-state" style="color:#f87171;">${escapeHtml(message)}</p>`;
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp.seconds * 1000);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const VALID_TYPES = new Set(["album", "song"]);
function safeType(type) {
  return VALID_TYPES.has(type) ? type : "";
}

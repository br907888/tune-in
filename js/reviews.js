import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  collection, query, where, getDocs,
  deleteDoc, doc, getDoc, setDoc, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const reviewsList = document.getElementById("reviews-list");
const listModal = document.getElementById("list-modal");
const modalLists = document.getElementById("modal-lists");
const modalClose = document.getElementById("modal-close");

let currentUserId = null;
// All reviews loaded from Firestore — source of truth for filtering
let allReviews = [];
// Map of reviewId → review data, used when adding to a list
const reviewsMap = {};
// Tracks which review is being added to a list
let activeReviewId = null;
// Cached list of user's lists — invalidated when a list is created/deleted elsewhere
let cachedLists = null;

const searchInput = document.getElementById("review-search");
searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim().toLowerCase();
  const filtered = q
    ? allReviews.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.artist.toLowerCase().includes(q)
      )
    : allReviews;
  renderReviews(filtered, q);
});

// --- Auth guard ---
const unsubscribe = onAuthStateChanged(auth, async (user) => {
  unsubscribe();
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentUserId = user.uid;
  await loadReviews(user.uid);
});

function renderReviews(reviews, query = "") {
  if (reviews.length === 0) {
    reviewsList.innerHTML = query
      ? `<p class="empty-state">No reviews match "${escapeHtml(query)}".</p>`
      : `<p class="empty-state">No reviews yet. <a href="review-new.html" style="color:#3dd6c8;">Write your first one.</a></p>`;
    return;
  }

  reviewsList.innerHTML = reviews.map(review => {
    const rating = Math.min(5, Math.max(0, parseInt(review.rating) || 0));
    return `
      <div class="review-card" data-id="${review.id}">
        <div class="review-header">
          <div>
            <div class="review-title">${escapeHtml(review.title)}</div>
            <div class="review-artist">${escapeHtml(review.artist)}</div>
          </div>
          <div class="review-meta">
            <span class="type-badge type-${safeType(review.type)}">${escapeHtml(review.type)}</span>
            <span class="review-stars">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</span>
          </div>
        </div>
        ${review.reviewText ? `<p class="review-text">${escapeHtml(review.reviewText)}</p>` : ""}
        <div class="review-footer">
          <p class="review-date">${formatDate(review.createdAt)}</p>
          <div class="review-actions">
            <button class="add-to-list-btn" data-id="${review.id}">+ List</button>
            <button class="delete-btn" data-id="${review.id}">Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function loadReviews(userId) {
  try {
    const q = query(collection(db, "reviews"), where("userId", "==", userId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      reviewsList.innerHTML = `
        <p class="empty-state">No reviews yet. <a href="review-new.html" style="color:#3dd6c8;">Write your first one.</a></p>
      `;
      return;
    }

    // Sort client-side by createdAt descending
    snapshot.forEach(docSnap => allReviews.push({ id: docSnap.id, ...docSnap.data() }));
    allReviews.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));

    // Cache reviews for use in the Add to List modal
    allReviews.forEach(r => { reviewsMap[r.id] = r; });

    renderReviews(allReviews);

  } catch (err) {
    reviewsList.innerHTML = `<p class="empty-state" style="color:#f87171;">Failed to load reviews. Please try again.</p>`;
  }
}

// --- Event delegation: delete and add-to-list ---
reviewsList.addEventListener("click", async (e) => {
  if (e.target.closest(".delete-btn")) {
    await handleDelete(e.target.closest(".delete-btn"));
    return;
  }
  if (e.target.closest(".add-to-list-btn")) {
    await handleOpenModal(e.target.closest(".add-to-list-btn"));
    return;
  }
});

async function handleDelete(btn) {
  if (!confirm("Delete this review? This cannot be undone.")) return;

  const reviewId = btn.dataset.id;
  btn.disabled = true;
  btn.textContent = "Deleting...";

  try {
    await deleteDoc(doc(db, "reviews", reviewId));
    allReviews = allReviews.filter(r => r.id !== reviewId);
    delete reviewsMap[reviewId];

    // Re-render respecting any active search query
    const q = searchInput.value.trim().toLowerCase();
    const filtered = q ? allReviews.filter(r =>
      r.title.toLowerCase().includes(q) || r.artist.toLowerCase().includes(q)
    ) : allReviews;
    renderReviews(filtered, q);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Delete";
  }
}

async function handleOpenModal(btn) {
  activeReviewId = btn.dataset.id;
  listModal.hidden = false;

  // Use cached lists if available, otherwise fetch
  if (cachedLists) {
    renderModalLists(cachedLists);
    return;
  }

  modalLists.innerHTML = `<p class="modal-loading">Loading lists...</p>`;

  try {
    const snap = await getDocs(
      query(collection(db, "lists"), where("userId", "==", currentUserId))
    );

    cachedLists = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds ?? Number.MAX_SAFE_INTEGER) - (a.createdAt?.seconds ?? Number.MAX_SAFE_INTEGER));

    renderModalLists(cachedLists);
  } catch (err) {
    modalLists.innerHTML = `<p class="modal-empty" style="color:#f87171;">Failed to load lists.</p>`;
  }
}

function renderModalLists(lists) {
  const listButtons = lists.map(list => `
    <button class="modal-list-btn" data-list-id="${list.id}">
      ${escapeHtml(list.name)}
    </button>
  `).join("");

  modalLists.innerHTML = listButtons + `
    <div id="modal-create-row">
      <button class="modal-new-btn" id="modal-new-btn">+ New List</button>
    </div>
  `;

  document.getElementById("modal-new-btn").addEventListener("click", showInlineCreateForm);
}

function showInlineCreateForm() {
  document.getElementById("modal-create-row").innerHTML = `
    <form id="modal-create-form" class="modal-create-form">
      <input type="text" id="modal-list-name" placeholder="List name" required autocomplete="off" />
      <button type="submit" class="modal-create-btn">Create</button>
    </form>
  `;
  document.getElementById("modal-list-name").focus();
  document.getElementById("modal-create-form").addEventListener("submit", handleModalCreate);
}

async function handleModalCreate(e) {
  e.preventDefault();
  const input = document.getElementById("modal-list-name");
  const name = input.value.trim();
  if (!name) return;

  const submitBtn = e.target.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  submitBtn.textContent = "Creating...";

  try {
    const docRef = await addDoc(collection(db, "lists"), {
      userId: currentUserId,
      name,
      description: "",
      createdAt: serverTimestamp()
    });

    const newList = { id: docRef.id, name, description: "", createdAt: null };
    // Prepend so it appears at the top (newest first)
    cachedLists = cachedLists ? [newList, ...cachedLists] : [newList];
    renderModalLists(cachedLists);
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Create";
    input.value = "";
    input.placeholder = "Failed — try again";
  }
}

// --- Modal: select a list ---
modalLists.addEventListener("click", async (e) => {
  const btn = e.target.closest(".modal-list-btn");
  if (!btn || !activeReviewId) return;

  const listId = btn.dataset.listId;
  const review = reviewsMap[activeReviewId];
  if (!review) return;

  const originalText = btn.textContent.trim();
  btn.disabled = true;
  btn.textContent = "Adding...";

  try {
    const itemRef = doc(db, "listItems", `${listId}_${activeReviewId}`);
    const existing = await getDoc(itemRef);

    if (existing.exists()) {
      btn.textContent = "Already in list";
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = originalText;
      }, 1500);
      return;
    }

    await setDoc(itemRef, {
      listId,
      userId: currentUserId,
      reviewId: activeReviewId,
      title: review.title || "",
      artist: review.artist || "",
      type: review.type || "",
      rating: review.rating ?? 0,
      reviewText: review.reviewText || "",
      createdAt: review.createdAt || null,
      addedAt: serverTimestamp()
    });

    btn.textContent = "Added!";
    setTimeout(closeModal, 600);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

// --- Close modal ---
modalClose.addEventListener("click", closeModal);
listModal.addEventListener("click", (e) => {
  if (e.target === listModal) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !listModal.hidden) closeModal();
});

function closeModal() {
  listModal.hidden = true;
  activeReviewId = null;
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

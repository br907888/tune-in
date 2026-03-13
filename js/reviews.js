import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, query, where, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const reviewsList = document.getElementById("reviews-list");

// --- Auth guard ---
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  await loadReviews(user.uid);
});

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
    const reviews = [];
    snapshot.forEach(docSnap => reviews.push({ id: docSnap.id, ...docSnap.data() }));
    reviews.sort((a, b) => {
      const aTime = a.createdAt?.seconds ?? 0;
      const bTime = b.createdAt?.seconds ?? 0;
      return bTime - aTime;
    });

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
              <span class="type-badge">${escapeHtml(review.type)}</span>
              <span class="review-stars">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</span>
            </div>
          </div>
          ${review.reviewText ? `<p class="review-text">${escapeHtml(review.reviewText)}</p>` : ""}
          <div class="review-footer">
            <p class="review-date">${formatDate(review.createdAt)}</p>
            <button class="delete-btn" data-id="${review.id}">Delete</button>
          </div>
        </div>
      `;
    }).join("");

  } catch (err) {
    reviewsList.innerHTML = `<p class="empty-state" style="color:#f87171;">Failed to load reviews. Please try again.</p>`;
  }
}

// --- Delete via event delegation ---
reviewsList.addEventListener("click", async (e) => {
  const btn = e.target.closest(".delete-btn");
  if (!btn) return;

  if (!confirm("Delete this review? This cannot be undone.")) return;

  const reviewId = btn.dataset.id;
  btn.disabled = true;
  btn.textContent = "Deleting...";

  try {
    await deleteDoc(doc(db, "reviews", reviewId));
    const card = reviewsList.querySelector(`.review-card[data-id="${reviewId}"]`);
    card.remove();

    if (reviewsList.querySelectorAll(".review-card").length === 0) {
      reviewsList.innerHTML = `
        <p class="empty-state">No reviews yet. <a href="review-new.html" style="color:#3dd6c8;">Write your first one.</a></p>
      `;
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Delete";
  }
});

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

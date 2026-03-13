import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
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
    snapshot.forEach(doc => reviews.push({ id: doc.id, ...doc.data() }));
    reviews.sort((a, b) => {
      const aTime = a.createdAt?.seconds ?? 0;
      const bTime = b.createdAt?.seconds ?? 0;
      return bTime - aTime;
    });

    reviewsList.innerHTML = reviews.map(review => `
      <div class="review-card">
        <div class="review-header">
          <div>
            <div class="review-title">${escapeHtml(review.title)}</div>
            <div class="review-artist">${escapeHtml(review.artist)}</div>
          </div>
          <div class="review-meta">
            <span class="type-badge">${review.type}</span>
            <span class="review-stars">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</span>
          </div>
        </div>
        ${review.reviewText ? `<p class="review-text">${escapeHtml(review.reviewText)}</p>` : ""}
        <p class="review-date">${formatDate(review.createdAt)}</p>
      </div>
    `).join("");

  } catch (err) {
    reviewsList.innerHTML = `<p class="empty-state" style="color:#f87171;">Failed to load reviews. Please try again.</p>`;
  }
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

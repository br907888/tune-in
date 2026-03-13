import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const profileNameEl = document.getElementById("profile-name");
const profileSubtext = document.getElementById("profile-subtext");
const reviewsList = document.getElementById("reviews-list");

// Read uid from URL query string
const params = new URLSearchParams(window.location.search);
const profileUid = params.get("uid");

// --- Auth guard ---
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  if (!profileUid) {
    showError("No user specified.");
    return;
  }

  // Prevent users from viewing their own public profile — redirect to profile page
  if (profileUid === user.uid) {
    window.location.href = "profile.html";
    return;
  }

  await loadProfile(profileUid);
});

async function loadProfile(uid) {
  try {
    // Fetch user document
    const userSnap = await getDoc(doc(db, "users", uid));

    if (!userSnap.exists()) {
      showError("User not found.");
      return;
    }

    const userData = userSnap.data();
    profileNameEl.textContent = userData.displayName || "Unknown User";
    document.title = `Tune-In — ${userData.displayName || "User"}`;

    // Fetch their reviews
    await loadReviews(uid, userData.displayName);

  } catch (err) {
    showError("Failed to load profile. Please try again.");
  }
}

async function loadReviews(uid, displayName) {
  try {
    const q = query(collection(db, "reviews"), where("userId", "==", uid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      reviewsList.innerHTML = `<p class="empty-state">${escapeHtml(displayName)} hasn't written any reviews yet.</p>`;
      return;
    }

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
        <div class="review-card">
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
          <p class="review-date">${formatDate(review.createdAt)}</p>
        </div>
      `;
    }).join("");

  } catch (err) {
    reviewsList.innerHTML = `<p class="empty-state" style="color:#f87171;">Failed to load reviews.</p>`;
  }
}

function showError(message) {
  profileNameEl.textContent = "Error";
  reviewsList.innerHTML = `<p class="empty-state" style="color:#f87171;">${escapeHtml(message)}</p>`;
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

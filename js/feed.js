import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const feedList = document.getElementById("feed-list");

const unsubscribe = onAuthStateChanged(auth, async (user) => {
  unsubscribe();
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  await loadFeed(user.uid);
});

async function loadFeed(uid) {
  try {
    // Get all users this person follows
    const followsSnap = await getDocs(
      query(collection(db, "follows"), where("followerId", "==", uid))
    );

    if (followsSnap.empty) {
      feedList.innerHTML = `<p class="empty-state">Follow some users to see their reviews here.</p>`;
      return;
    }

    const followingIds = followsSnap.docs.map(d => d.data().followingId);

    // Firestore "in" supports up to 10 values — chunk the list
    const chunks = [];
    for (let i = 0; i < followingIds.length; i += 10) {
      chunks.push(followingIds.slice(i, i + 10));
    }

    // Fetch reviews for all followed users in parallel
    const reviewSnapshots = await Promise.all(
      chunks.map(chunk =>
        getDocs(query(collection(db, "reviews"), where("userId", "in", chunk)))
      )
    );

    const reviews = [];
    reviewSnapshots.forEach(snap => {
      snap.forEach(docSnap => reviews.push({ id: docSnap.id, ...docSnap.data() }));
    });

    if (reviews.length === 0) {
      feedList.innerHTML = `<p class="empty-state">No reviews from people you follow yet.</p>`;
      return;
    }

    // Sort newest first
    reviews.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));

    // Fetch display names for each unique author
    const uniqueUserIds = [...new Set(reviews.map(r => r.userId))];
    const userDocs = await Promise.all(
      uniqueUserIds.map(id => getDoc(doc(db, "users", id)))
    );
    const nameMap = {};
    userDocs.forEach(snap => {
      if (snap.exists()) {
        nameMap[snap.id] = snap.data().displayName || "Unknown User";
      }
    });

    feedList.innerHTML = reviews.map(review => {
      const rating = Math.min(5, Math.max(0, parseInt(review.rating) || 0));
      const authorName = nameMap[review.userId] || "Unknown User";
      return `
        <div class="review-card">
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
            <a class="review-author" href="public-profile.html?uid=${encodeURIComponent(review.userId)}"
               data-uid="${review.userId}">${escapeHtml(authorName)}</a>
            <span class="review-date">${formatDate(review.createdAt)}</span>
          </div>
        </div>
      `;
    }).join("");

    // sessionStorage fallback for npx serve clean URLs
    feedList.querySelectorAll(".review-author").forEach(link => {
      link.addEventListener("click", () => {
        sessionStorage.setItem("viewProfileUid", link.dataset.uid);
      });
    });

  } catch (err) {
    feedList.innerHTML = `<p class="empty-state" style="color:#f87171;">Failed to load feed. Please try again.</p>`;
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

const VALID_TYPES = new Set(["album", "song"]);
function safeType(type) {
  return VALID_TYPES.has(type) ? type : "";
}

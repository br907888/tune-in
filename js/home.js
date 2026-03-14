import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const homeNameEl   = document.getElementById("home-name");
const feedPreview  = document.getElementById("feed-preview");

const unsubscribe = onAuthStateChanged(auth, async (user) => {
  unsubscribe();

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  homeNameEl.textContent = user.displayName || "there";

  await Promise.all([
    loadStats(user.uid),
    loadFeedPreview(user.uid)
  ]);
});

async function loadStats(uid) {
  try {
    const [followersSnap, followingSnap, reviewsSnap, queueSnap] = await Promise.all([
      getDocs(query(collection(db, "follows"),  where("followingId", "==", uid))),
      getDocs(query(collection(db, "follows"),  where("followerId",  "==", uid))),
      getDocs(query(collection(db, "reviews"),  where("userId",      "==", uid))),
      getDocs(query(collection(db, "queue"),    where("userId",      "==", uid)))
    ]);
    document.getElementById("stat-followers").textContent = followersSnap.size;
    document.getElementById("stat-following").textContent = followingSnap.size;
    document.getElementById("stat-reviews").textContent   = reviewsSnap.size;
    document.getElementById("stat-queue").textContent     = queueSnap.size;
  } catch (err) {
    // Leave dashes — non-critical
  }
}

async function loadFeedPreview(uid) {
  try {
    const followSnap = await getDocs(
      query(collection(db, "follows"), where("followerId", "==", uid))
    );

    if (followSnap.empty) {
      feedPreview.innerHTML = `
        <p class="empty-state">
          You're not following anyone yet.<br>
          <a href="search.html" style="color:#3dd6c8;">Find friends to follow →</a>
        </p>`;
      return;
    }

    const followingIds = followSnap.docs.map(d => d.data().followingId);

    // Chunk into groups of 10 (Firestore "in" limit)
    const chunks = [];
    for (let i = 0; i < followingIds.length; i += 10) {
      chunks.push(followingIds.slice(i, i + 10));
    }

    const snapshots = await Promise.all(
      chunks.map(chunk =>
        getDocs(query(collection(db, "reviews"), where("userId", "in", chunk)))
      )
    );

    const all = [];
    snapshots.forEach(snap => snap.forEach(d => all.push({ id: d.id, ...d.data() })));

    if (all.length === 0) {
      feedPreview.innerHTML = `<p class="empty-state">No reviews from people you follow yet.</p>`;
      return;
    }

    all.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    const recent = all.slice(0, 5);

    // Fetch display names for authors in parallel
    const uniqueUids = [...new Set(recent.map(r => r.userId))];
    const userSnaps = await Promise.all(uniqueUids.map(id => getDoc(doc(db, "users", id))));
    const nameMap = {};
    userSnaps.forEach(snap => {
      if (snap.exists()) nameMap[snap.id] = snap.data().displayName || "Unknown";
    });

    feedPreview.innerHTML = recent.map(review => {
      const rating  = Math.min(5, Math.max(0, parseInt(review.rating) || 0));
      const author  = nameMap[review.userId] || "Unknown";
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
            <a class="review-author"
               href="public-profile.html?uid=${review.userId}"
               data-uid="${review.userId}"
               onclick="sessionStorage.setItem('viewProfileUid','${review.userId}')"
               >${escapeHtml(author)}</a>
            <span class="review-date">${formatDate(review.createdAt)}</span>
          </div>
        </div>`;
    }).join("");

  } catch (err) {
    feedPreview.innerHTML = `<p class="empty-state" style="color:#f87171;">Failed to load feed.</p>`;
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

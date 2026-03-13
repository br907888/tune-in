import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const profileNameEl = document.getElementById("profile-name");
const profileSubtext = document.getElementById("profile-subtext");
const followBtn = document.getElementById("follow-btn");
const reviewsList = document.getElementById("reviews-list");

let currentUser = null;
let isFollowing = false;

// Read uid from URL query string, fall back to sessionStorage for servers that strip query strings
const params = new URLSearchParams(window.location.search);
const profileUid = params.get("uid") || sessionStorage.getItem("viewProfileUid");
sessionStorage.removeItem("viewProfileUid");

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

  currentUser = user;
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
    const displayName = userData.displayName || "Unknown User";
    profileNameEl.textContent = displayName;
    document.title = `Tune-In — ${displayName}`;

    // Load follow state and follower count in parallel with reviews
    await Promise.all([
      loadFollowState(currentUser.uid, uid),
      loadReviews(uid, displayName)
    ]);

  } catch (err) {
    showError("Failed to load profile. Please try again.");
  }
}

async function loadFollowState(currentUid, targetUid) {
  const followDocRef = doc(db, "follows", `${currentUid}_${targetUid}`);
  const [followSnap, followerSnap] = await Promise.all([
    getDoc(followDocRef),
    getDocs(query(collection(db, "follows"), where("followingId", "==", targetUid)))
  ]);

  isFollowing = followSnap.exists();
  updateFollowButton();
  profileSubtext.textContent = formatFollowerCount(followerSnap.size);
  followBtn.disabled = false;
}

followBtn.addEventListener("click", async () => {
  if (!currentUser || !profileUid) return;

  followBtn.disabled = true;
  const followDocRef = doc(db, "follows", `${currentUser.uid}_${profileUid}`);

  try {
    if (isFollowing) {
      await deleteDoc(followDocRef);
      isFollowing = false;
    } else {
      await setDoc(followDocRef, {
        followerId: currentUser.uid,
        followingId: profileUid,
        createdAt: serverTimestamp()
      });
      isFollowing = true;
    }

    updateFollowButton();

    // Refresh follower count
    const followerSnap = await getDocs(query(collection(db, "follows"), where("followingId", "==", profileUid)));
    profileSubtext.textContent = formatFollowerCount(followerSnap.size);
  } catch (err) {
    // No-op — button re-enabled in finally
  } finally {
    followBtn.disabled = false;
  }
});

function updateFollowButton() {
  followBtn.textContent = isFollowing ? "Unfollow" : "Follow";
  followBtn.classList.toggle("following", isFollowing);
}

function formatFollowerCount(count) {
  return `${count} ${count === 1 ? "follower" : "followers"}`;
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

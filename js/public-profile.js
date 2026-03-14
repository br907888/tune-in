import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const profileNameEl = document.getElementById("profile-name");
const profileSubtext = document.getElementById("profile-subtext");
const followBtn = document.getElementById("follow-btn");
const reviewsList = document.getElementById("reviews-list");
const listsList = document.getElementById("lists-list");
const queueList = document.getElementById("queue-list");

let currentUser = null;
let isFollowing = false;

// Read uid from URL query string, fall back to sessionStorage for servers that strip query strings
const params = new URLSearchParams(window.location.search);
const profileUid = params.get("uid") || sessionStorage.getItem("viewProfileUid");
sessionStorage.removeItem("viewProfileUid");

// --- Auth guard ---
const unsubscribe = onAuthStateChanged(auth, async (user) => {
  unsubscribe();

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

    // Load follow state, reviews, lists, and queue in parallel
    await Promise.all([
      loadFollowState(currentUser.uid, uid),
      loadReviews(uid, displayName),
      loadLists(uid, displayName),
      loadQueue(uid, displayName)
    ]);

  } catch (err) {
    showError("Failed to load profile. Please try again.");
  }
}

async function loadFollowState(currentUid, targetUid) {
  try {
    const followDocRef = doc(db, "follows", `${currentUid}_${targetUid}`);
    const [followSnap, followerSnap] = await Promise.all([
      getDoc(followDocRef),
      getDocs(query(collection(db, "follows"), where("followingId", "==", targetUid)))
    ]);

    isFollowing = followSnap.exists();
    updateFollowButton();
    profileSubtext.textContent = formatFollowerCount(followerSnap.size);
    followBtn.disabled = false;
  } catch (err) {
    // Leave follow button disabled and follower count blank — don't break the rest of the profile
  }
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
              <span class="type-badge type-${safeType(review.type)}">${escapeHtml(review.type)}</span>
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

async function loadLists(uid, displayName) {
  try {
    const snap = await getDocs(
      query(collection(db, "lists"), where("userId", "==", uid))
    );

    if (snap.empty) {
      listsList.innerHTML = `<p class="empty-state">${escapeHtml(displayName)} hasn't created any lists yet.</p>`;
      return;
    }

    const lists = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds ?? Number.MAX_SAFE_INTEGER) - (a.createdAt?.seconds ?? Number.MAX_SAFE_INTEGER));

    // Fetch item counts for all lists in parallel
    const countSnaps = await Promise.all(
      lists.map(list =>
        getDocs(query(collection(db, "listItems"), where("listId", "==", list.id)))
      )
    );

    listsList.innerHTML = lists.map((list, i) => {
      const count = countSnaps[i].size;
      return `
        <a class="list-card" href="list-detail.html?id=${encodeURIComponent(list.id)}"
           data-id="${list.id}">
          <div class="list-card-body">
            <span class="list-name-link">${escapeHtml(list.name)}</span>
            ${list.description ? `<p class="list-desc">${escapeHtml(list.description)}</p>` : ""}
          </div>
          <div class="list-card-meta">
            <span class="list-count">${count} ${count === 1 ? "item" : "items"}</span>
            <span class="user-arrow">›</span>
          </div>
        </a>
      `;
    }).join("");

    // sessionStorage fallback for npx serve clean URLs
    listsList.querySelectorAll(".list-card").forEach(card => {
      card.addEventListener("click", () => {
        sessionStorage.setItem("viewListId", card.dataset.id);
      });
    });

  } catch (err) {
    listsList.innerHTML = `<p class="empty-state" style="color:#f87171;">Failed to load lists.</p>`;
  }
}

async function loadQueue(uid, displayName) {
  try {
    const snap = await getDocs(
      query(collection(db, "queue"), where("userId", "==", uid))
    );

    if (snap.empty) {
      queueList.innerHTML = `<p class="empty-state">${escapeHtml(displayName)} hasn't added anything to their queue yet.</p>`;
      return;
    }

    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.addedAt?.seconds ?? 0) - (a.addedAt?.seconds ?? 0));

    queueList.innerHTML = items.map(item => `
      <div class="review-card">
        <div class="review-header">
          <div>
            <div class="review-title">${escapeHtml(item.title)}</div>
            <div class="review-artist">${escapeHtml(item.artist)}</div>
          </div>
          <div class="review-meta">
            <span class="type-badge type-${safeType(item.type)}">${escapeHtml(item.type)}</span>
          </div>
        </div>
        <div class="review-footer">
          <span class="review-date">${formatDate(item.addedAt)}</span>
        </div>
      </div>
    `).join("");

  } catch (err) {
    queueList.innerHTML = `<p class="empty-state" style="color:#f87171;">Failed to load queue.</p>`;
  }
}

function showError(message) {
  profileNameEl.textContent = "Error";
  followBtn.style.display = "none";
  const errorHtml = `<p class="empty-state" style="color:#f87171;">${escapeHtml(message)}</p>`;
  reviewsList.innerHTML = errorHtml;
  listsList.innerHTML = errorHtml;
  queueList.innerHTML = errorHtml;
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

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  collection, query, where, getDocs,
  addDoc, deleteDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const queueForm = document.getElementById("queue-form");
const queueTypeInput = document.getElementById("queue-type");
const queueArtist = document.getElementById("queue-artist");
const queueTitle = document.getElementById("queue-title");
const titleLabel = document.getElementById("title-label");
const addBtn = document.getElementById("add-btn");
const statusMsg = document.getElementById("status-msg");
const queueList = document.getElementById("queue-list");

let currentUid = null;

// --- Auth guard ---
const unsubscribe = onAuthStateChanged(auth, async (user) => {
  unsubscribe();
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentUid = user.uid;
  await loadQueue();
});

// --- Type toggle ---
document.querySelectorAll(".type-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    queueTypeInput.value = btn.dataset.type;
    const isSong = btn.dataset.type === "song";
    titleLabel.textContent = isSong ? "Song Title" : "Album Title";
    queueTitle.placeholder = isSong ? "Song title" : "Album title";
  });
});

// --- Add to queue ---
queueForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUid) return;

  const artist = queueArtist.value.trim();
  const title = queueTitle.value.trim();
  const type = queueTypeInput.value;
  if (!artist || !title) return;

  addBtn.disabled = true;
  addBtn.textContent = "Adding...";

  try {
    await addDoc(collection(db, "queue"), {
      userId: currentUid,
      artist,
      title,
      type,
      addedAt: serverTimestamp()
    });

    queueArtist.value = "";
    queueTitle.value = "";
    showStatus("Added to queue.");
    await loadQueue();
  } catch (err) {
    showStatus("Failed to add. Please try again.", true);
  } finally {
    addBtn.disabled = false;
    addBtn.textContent = "Add to Queue";
  }
});

// --- Load queue ---
async function loadQueue() {
  try {
    const snap = await getDocs(
      query(collection(db, "queue"), where("userId", "==", currentUid))
    );

    if (snap.empty) {
      queueList.innerHTML = `<p class="empty-state">Your queue is empty. Add something above.</p>`;
      return;
    }

    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.addedAt?.seconds ?? Number.MAX_SAFE_INTEGER) - (a.addedAt?.seconds ?? Number.MAX_SAFE_INTEGER));

    queueList.innerHTML = items.map(item => `
      <div class="review-card" data-id="${item.id}">
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
          <div class="review-actions">
            <button class="write-review-btn" data-id="${item.id}"
              data-title="${escapeHtml(item.title)}"
              data-artist="${escapeHtml(item.artist)}"
              data-type="${escapeHtml(item.type)}">Write Review</button>
            <button class="delete-btn" data-id="${item.id}">Remove</button>
          </div>
        </div>
      </div>
    `).join("");

  } catch (err) {
    queueList.innerHTML = `<p class="empty-state" style="color:#f87171;">Failed to load queue. Please try again.</p>`;
  }
}

// --- Event delegation: remove and write review ---
queueList.addEventListener("click", async (e) => {
  if (e.target.closest(".delete-btn")) {
    await handleRemove(e.target.closest(".delete-btn"));
    return;
  }
  if (e.target.closest(".write-review-btn")) {
    handleWriteReview(e.target.closest(".write-review-btn"));
    return;
  }
});

async function handleRemove(btn) {
  const itemId = btn.dataset.id;
  btn.disabled = true;
  btn.textContent = "Removing...";

  try {
    await deleteDoc(doc(db, "queue", itemId));
    queueList.querySelector(`.review-card[data-id="${itemId}"]`).remove();

    if (queueList.querySelectorAll(".review-card").length === 0) {
      queueList.innerHTML = `<p class="empty-state">Your queue is empty. Add something above.</p>`;
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Remove";
  }
}

function handleWriteReview(btn) {
  sessionStorage.setItem("prefill", JSON.stringify({
    title: btn.dataset.title,
    artist: btn.dataset.artist,
    type: btn.dataset.type,
    queueId: btn.dataset.id
  }));
  window.location.href = "review-new.html";
}

function showStatus(message, isError = false) {
  statusMsg.textContent = message;
  statusMsg.className = isError ? "status-msg error" : "status-msg success";
  setTimeout(() => {
    statusMsg.textContent = "";
    statusMsg.className = "status-msg";
  }, 3000);
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


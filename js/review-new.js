import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

// --- Auth guard ---
let currentUser = null;
const unsubscribe = onAuthStateChanged(auth, (user) => {
  unsubscribe();
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentUser = user;
});

// --- Queue prefill ---
let prefill = null;
try {
  const raw = sessionStorage.getItem("prefill");
  if (raw) {
    prefill = JSON.parse(raw);
    sessionStorage.removeItem("prefill");
  }
} catch (e) {
  sessionStorage.removeItem("prefill");
}

// --- Type toggle ---
const typeButtons = document.querySelectorAll(".type-btn");
const reviewTypeInput = document.getElementById("review-type");
const titleLabel = document.getElementById("title-label");
const titleInput = document.getElementById("review-title");

typeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    typeButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const selected = btn.dataset.type;
    reviewTypeInput.value = selected;
    titleLabel.textContent = selected === "song" ? "Song Title" : "Album Title";
    titleInput.placeholder = selected === "song" ? "Song title" : "Album title";
  });
});

// Apply prefill from queue if present
if (prefill) {
  document.getElementById("review-artist").value = prefill.artist || "";
  titleInput.value = prefill.title || "";
  if (prefill.type === "album") {
    typeButtons.forEach(b => b.classList.remove("active"));
    document.querySelector('.type-btn[data-type="album"]').classList.add("active");
    reviewTypeInput.value = "album";
    titleLabel.textContent = "Album Title";
    titleInput.placeholder = "Album title";
  }
}

// --- Star rating ---
const starContainer = document.getElementById("star-container");
const stars = document.querySelectorAll(".star");
const ratingInput = document.getElementById("review-rating");
let selectedRating = 0;

stars.forEach((star) => {
  star.addEventListener("mouseenter", () => {
    const val = parseInt(star.dataset.value);
    stars.forEach(s => {
      s.classList.toggle("hovered", parseInt(s.dataset.value) <= val);
    });
  });

  star.addEventListener("click", () => {
    selectedRating = parseInt(star.dataset.value);
    ratingInput.value = selectedRating;
    stars.forEach(s => {
      s.classList.toggle("selected", parseInt(s.dataset.value) <= selectedRating);
    });
  });
});

// mouseleave on the container prevents flickering between individual stars
starContainer.addEventListener("mouseleave", () => {
  stars.forEach(s => s.classList.remove("hovered"));
});

// --- Form submission ---
const form = document.getElementById("review-form");
const statusMsg = document.getElementById("status-msg");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) {
    showStatus("You must be logged in to submit a review.", true);
    return;
  }

  if (selectedRating === 0) {
    showStatus("Please select a star rating.", true);
    return;
  }

  const review = {
    userId: currentUser.uid,
    type: reviewTypeInput.value,
    artist: document.getElementById("review-artist").value.trim(),
    title: document.getElementById("review-title").value.trim(),
    rating: selectedRating,
    reviewText: document.getElementById("review-text").value.trim(),
    createdAt: serverTimestamp()
  };

  const submitBtn = form.querySelector(".submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  try {
    await addDoc(collection(db, "reviews"), review);
  } catch (err) {
    showStatus("Failed to submit review. Please try again.", true);
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Review";
    return;
  }

  // Review submitted — remove from queue if it came from there (best-effort)
  if (prefill?.queueId) {
    await deleteDoc(doc(db, "queue", prefill.queueId)).catch(() => {});
    window.location.href = "queue.html";
  } else {
    window.location.href = "reviews.html";
  }
});

function showStatus(message, isError = false) {
  statusMsg.textContent = message;
  statusMsg.className = isError ? "status-msg error" : "status-msg success";
}

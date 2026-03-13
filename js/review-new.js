import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

// --- Auth guard ---
let currentUser = null;
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentUser = user;
});

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
    window.location.href = "reviews.html";
  } catch (err) {
    showStatus("Failed to submit review. Please try again.", true);
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Review";
  }
});

function showStatus(message, isError = false) {
  statusMsg.textContent = message;
  statusMsg.className = isError ? "status-msg error" : "status-msg success";
}

// nav.js — mobile hamburger menu toggle

const hamburger = document.getElementById("nav-hamburger");
const navLinks  = document.querySelector(".nav-links");

if (!hamburger || !navLinks) throw new Error("nav.js: nav elements not found");

hamburger.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = navLinks.classList.toggle("open");
  hamburger.setAttribute("aria-expanded", isOpen);
  hamburger.textContent = isOpen ? "✕" : "☰";
});

// Close when a nav link is clicked
navLinks.addEventListener("click", (e) => {
  if (e.target.tagName === "A") closeMenu();
});

// Close when clicking outside the nav
document.addEventListener("click", (e) => {
  if (!e.target.closest(".top-nav")) closeMenu();
});

// Close on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});

function closeMenu() {
  navLinks.classList.remove("open");
  hamburger.setAttribute("aria-expanded", "false");
  hamburger.textContent = "☰";
}

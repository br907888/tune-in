// theme.js — light/dark mode toggle
// Applied to <html> so the inline head script can set it before first paint.

const STORAGE_KEY = "tune-in-theme";

const btn = document.getElementById("theme-toggle");
if (!btn) throw new Error("theme.js: no #theme-toggle button found on this page");

function isLight() {
  return document.documentElement.classList.contains("light-mode");
}

function updateIcon() {
  btn.textContent = isLight() ? "☀" : "☾";
  btn.setAttribute("aria-label", isLight() ? "Switch to dark mode" : "Switch to light mode");
}

btn.addEventListener("click", () => {
  document.documentElement.classList.toggle("light-mode");
  localStorage.setItem(STORAGE_KEY, isLight() ? "light" : "dark");
  updateIcon();
});

// Sync icon to whatever state was applied by the inline head script
updateIcon();

const INSPIRE_FUNCTION_URL = "https://us-central1-tune-in-d636f.cloudfunctions.net/inspire";

const inspireBtn = document.getElementById("inspire-btn");
const inspireResult = document.getElementById("inspire-result");
const typeButtons = document.querySelectorAll(".inspire-type-btn");

let selectedType = "song";

// Track recent suggestions to avoid repeats
const HISTORY_KEY = "inspire-history";
const HISTORY_LIMIT = 10;

function getHistory() {
  try { return JSON.parse(sessionStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}

function addToHistory(title, artist) {
  const history = getHistory();
  history.unshift(`${title} by ${artist}`);
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
}

typeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    typeButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedType = btn.dataset.type;
  });
});

inspireBtn.addEventListener("click", async () => {
  inspireBtn.disabled = true;
  inspireBtn.textContent = "Finding something...";
  inspireResult.innerHTML = `<p class="inspire-loading">Asking the AI for a recommendation...</p>`;

  try {
    const res = await fetch(INSPIRE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: selectedType, avoid: getHistory() })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Request failed");
    }

    addToHistory(data.title, data.artist);

    inspireResult.innerHTML = `
      <div class="inspire-result">
        <div class="inspire-result-title">${escapeHtml(data.title)}</div>
        <div class="inspire-result-artist">${escapeHtml(data.artist)}</div>
        <div class="inspire-result-reason">${escapeHtml(data.reason)}</div>
        <button class="inspire-review-btn" id="inspire-review-btn">Review this →</button>
      </div>
    `;

    document.getElementById("inspire-review-btn").addEventListener("click", () => {
      sessionStorage.setItem("prefill", JSON.stringify({
        type: data.type,
        artist: data.artist,
        title: data.title
      }));
      window.location.href = "review-new.html";
    });

  } catch (err) {
    inspireResult.innerHTML = `<p class="inspire-error">${escapeHtml(err.message)}</p>`;
  } finally {
    inspireBtn.disabled = false;
    inspireBtn.textContent = "Inspire Me";
  }
});

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

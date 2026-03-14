import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  collection, query, where, getDocs,
  addDoc, deleteDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

const createForm = document.getElementById("create-list-form");
const listNameInput = document.getElementById("list-name");
const listDescInput = document.getElementById("list-desc");
const createBtn = document.getElementById("create-btn");
const statusMsg = document.getElementById("status-msg");
const listsContainer = document.getElementById("lists-container");

let currentUid = null;

const unsubscribe = onAuthStateChanged(auth, async (user) => {
  unsubscribe();
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentUid = user.uid;
  await loadLists();
});

// --- Create list ---
createForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUid) return;

  const name = listNameInput.value.trim();
  const description = listDescInput.value.trim();
  if (!name) return;

  createBtn.disabled = true;
  createBtn.textContent = "Creating...";

  try {
    await addDoc(collection(db, "lists"), {
      userId: currentUid,
      name,
      description,
      createdAt: serverTimestamp()
    });
    listNameInput.value = "";
    listDescInput.value = "";
    showStatus("List created.");
    await loadLists();
  } catch (err) {
    showStatus("Failed to create list. Please try again.", true);
  } finally {
    createBtn.disabled = false;
    createBtn.textContent = "Create List";
  }
});

// --- Load lists ---
async function loadLists() {
  try {
    const snap = await getDocs(
      query(collection(db, "lists"), where("userId", "==", currentUid))
    );

    if (snap.empty) {
      listsContainer.innerHTML = `<p class="empty-state">No lists yet. Create one above.</p>`;
      return;
    }

    // Sort newest first client-side (avoids composite index requirement)
    const lists = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds ?? Number.MAX_SAFE_INTEGER) - (a.createdAt?.seconds ?? Number.MAX_SAFE_INTEGER));
    const countSnaps = await Promise.all(
      lists.map(list =>
        getDocs(query(collection(db, "listItems"), where("listId", "==", list.id)))
      )
    );

    listsContainer.innerHTML = lists.map((list, i) => {
      const count = countSnaps[i].size;
      return `
        <div class="list-card" data-id="${list.id}">
          <div class="list-card-body">
            <a class="list-name-link" href="list-detail.html?id=${encodeURIComponent(list.id)}"
               data-id="${list.id}">${escapeHtml(list.name)}</a>
            ${list.description ? `<p class="list-desc">${escapeHtml(list.description)}</p>` : ""}
          </div>
          <div class="list-card-meta">
            <span class="list-count">${count} ${count === 1 ? "item" : "items"}</span>
            <button class="delete-btn" data-id="${list.id}">Delete</button>
          </div>
        </div>
      `;
    }).join("");

    // sessionStorage fallback for npx serve clean URLs
    listsContainer.querySelectorAll(".list-name-link").forEach(link => {
      link.addEventListener("click", () => {
        sessionStorage.setItem("viewListId", link.dataset.id);
      });
    });

  } catch (err) {
    listsContainer.innerHTML = `<p class="empty-state" style="color:#f87171;">Failed to load lists.</p>`;
  }
}

// --- Delete list (event delegation) ---
listsContainer.addEventListener("click", async (e) => {
  const btn = e.target.closest(".delete-btn");
  if (!btn) return;

  const listId = btn.dataset.id;
  btn.disabled = true;
  btn.textContent = "Deleting...";

  try {
    // Delete all items in the list first
    const itemsSnap = await getDocs(
      query(collection(db, "listItems"), where("listId", "==", listId))
    );
    await Promise.all(itemsSnap.docs.map(d => deleteDoc(doc(db, "listItems", d.id))));
    await deleteDoc(doc(db, "lists", listId));
    btn.closest(".list-card").remove();

    if (!listsContainer.querySelector(".list-card")) {
      listsContainer.innerHTML = `<p class="empty-state">No lists yet. Create one above.</p>`;
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Delete";
    showStatus("Failed to delete list.", true);
  }
});

function showStatus(message, isError = false) {
  statusMsg.textContent = message;
  statusMsg.className = isError ? "status-msg error" : "status-msg success";
  setTimeout(() => {
    statusMsg.textContent = "";
    statusMsg.className = "status-msg";
  }, 3000);
}

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// QuickNotes API client
// Talks to the JSONPlaceholder practice API using GET, POST and DELETE.

const API_URL = "https://jsonplaceholder.typicode.com/posts";

// Elements on the page
const loadBtn = document.getElementById("load-btn");
const statusEl = document.getElementById("status");
const notesList = document.getElementById("notes-list");
const noteForm = document.getElementById("note-form");
const titleInput = document.getElementById("title-input");
const bodyInput = document.getElementById("body-input");
const submitBtn = document.getElementById("submit-btn");

// Show a message under the button. type is "info", "success" or "error"
function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = type;
}

// Turn the buttons off while a request is running, and back on after
function setBusy(isBusy) {
  loadBtn.disabled = isBusy;
  submitBtn.disabled = isBusy;
  const deleteButtons = notesList.querySelectorAll(".delete-btn");
  for (const button of deleteButtons) {
    button.disabled = isBusy;
  }
}

// One reusable function for every request.
// It calls fetch, checks response.ok and throws an error if the server said no.
async function request(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error("Request failed with status " + response.status);
  }

  // Some responses (like DELETE) can be empty, so read it as text first
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  return { status: response.status, data: data };
}

// The "no notes" message inside the list
function showEmptyMessage() {
  const item = document.createElement("li");
  item.className = "empty";
  item.textContent = "No notes to show.";
  notesList.append(item);
}

function removeEmptyMessage() {
  const empty = notesList.querySelector(".empty");
  if (empty) {
    empty.remove();
  }
}

// Build one <li> for a note.
// We use textContent (not innerHTML) so user text can never run as code.
function createNoteItem(note) {
  const item = document.createElement("li");
  item.className = "note";

  const title = document.createElement("h3");
  title.textContent = note.title;

  const body = document.createElement("p");
  body.textContent = note.body || "";

  item.append(title, body);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", function () {
    deleteNote(note.id, item);
  });
  item.append(deleteBtn);

  return item;
}

// ---------- GET: load notes ----------

async function loadNotes() {
  showStatus("Loading notes...", "info");
  setBusy(true);

  try {
    const result = await request(API_URL + "?_limit=10");
    const notes = result.data;

    notesList.textContent = ""; // clear the old list

    if (notes.length === 0) {
      showEmptyMessage();
      showStatus("The server has no notes yet.", "info");
      return;
    }

    for (const note of notes) {
      notesList.append(createNoteItem(note));
    }
    showStatus("Loaded " + notes.length + " notes from the server.", "success");
  } catch (error) {
    console.error(error);
    showStatus("Sorry, we could not load the notes. Check your connection and try again.", "error");
  } finally {
    setBusy(false); // runs whether it worked or failed
  }
}

loadBtn.addEventListener("click", loadNotes);

// ---------- POST: create a note ----------

async function createNote(event) {
  event.preventDefault(); // stop the page from reloading

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  // Check the input before we send anything
  if (title === "") {
    showStatus("Please enter a title.", "error");
    titleInput.focus();
    return;
  }
  if (title.length > 100) {
    showStatus("The title must be 100 characters or less (yours is " + title.length + ").", "error");
    titleInput.focus();
    return;
  }

  showStatus("Saving note...", "info");
  setBusy(true);

  try {
    const result = await request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ title: title, body: body, userId: 1 })
    });

    removeEmptyMessage();
    notesList.prepend(createNoteItem(result.data)); // new note goes on top
    showStatus("Note created (status " + result.status + ", id " + result.data.id + ").", "success");
    noteForm.reset(); // clear the form
  } catch (error) {
    console.error(error);
    showStatus("Sorry, we could not save your note. Please try again.", "error");
  } finally {
    setBusy(false);
  }
}

noteForm.addEventListener("submit", createNote);

// ---------- DELETE: remove a note ----------

// NOTE about JSONPlaceholder: it is a practice API, so it does NOT really
// save anything. A note we create gets the id 101 every time, but it is never
// stored, and DELETE always answers "200 OK" even for notes that do not exist.
// So my approach is:
//  - we still send the DELETE request, because that is what a real API needs
//  - we only remove the note from the page AFTER the server says OK
//  - we remove the exact <li> that was clicked (not "the note with id 101"),
//    because every new note has the same id
//  - if we reload the notes, the page shows the server's real list again, so
//    notes we created or deleted here will come back or disappear. That is
//    normal for this fake API. A real backend would remember our changes.
async function deleteNote(id, item) {
  showStatus("Deleting note...", "info");
  setBusy(true);

  try {
    await request(API_URL + "/" + id, { method: "DELETE" });

    item.remove();
    if (notesList.children.length === 0) {
      showEmptyMessage();
    }
    showStatus("Note deleted.", "success");
  } catch (error) {
    console.error(error);
    showStatus("Sorry, we could not delete that note. Please try again.", "error");
  } finally {
    setBusy(false);
  }
}

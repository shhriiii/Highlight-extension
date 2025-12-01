// src/shared/storage.js

// Save new note
export async function saveNote(note) {
  const data = await chrome.storage.local.get({ notes: [] });
  data.notes.push(note);
  await chrome.storage.local.set({ notes: data.notes });
}

// Get all notes (optional filter)
export async function getAllNotes() {
  const { notes } = await chrome.storage.local.get({ notes: [] });
  return notes;
}

// Update a note by id
export async function updateNote(id, updates) {
  const data = await chrome.storage.local.get({ notes: [] });
  const updatedNotes = data.notes.map(n =>
    n.id === id ? { ...n, ...updates } : n
  );
  await chrome.storage.local.set({ notes: updatedNotes });
}

// Delete a note by id
export async function deleteNote(id) {
  const data = await chrome.storage.local.get({ notes: [] });
  const updatedNotes = data.notes.filter(n => n.id !== id);
  await chrome.storage.local.set({ notes: updatedNotes });
}


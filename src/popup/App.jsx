// src/popup/App.jsx
import React, { useEffect, useState } from "react";
import { getAllNotes, updateNote, deleteNote } from "../shared/storage";

export default function App() {
  const [notes, setNotes] = useState([]);
  const [mode, setMode] = useState("page"); // "page" or "all"
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadNotes();
  }, [mode]);

  async function loadNotes() {
    const all = await getAllNotes();

    if (mode === "page") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs[0]?.url || "";
        setNotes(all.filter(n => n.url === url));
      });
    } else {
      setNotes(all);
    }
  }

  // ----------- Delete Handler ----------
  async function removeNote(id) {
    await deleteNote(id);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { type: "DELETE_HIGHLIGHT", id });
    });
    loadNotes();
  }

  // ----------- Edit Handler -----------
  async function saveEdit(id, newText) {
    await updateNote(id, { content: newText });

    // notify content script to update tooltip + highlight
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "UPDATE_NOTE_CONTENT",
        id,
        content: newText
      });
    });

    loadNotes();
  }

  const filtered = notes.filter(n =>
    (n.content + n.selectedText).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-80 p-4 bg-gray-900 text-white font-sans">
      <h1 className="text-2xl font-bold mb-3">ContextMemo Notes</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-3">
        <button
          className={`px-3 py-1 rounded ${mode === "page" ? "bg-blue-600" : "bg-gray-700"}`}
          onClick={() => setMode("page")}
        >
          This Page
        </button>
        <button
          className={`px-3 py-1 rounded ${mode === "all" ? "bg-blue-600" : "bg-gray-700"}`}
          onClick={() => setMode("all")}
        >
          All Notes
        </button>
      </div>

      {/* Search Bar */}
      <input
        type="text"
        placeholder="Search notes..."
        className="w-full px-2 py-1 mb-3 rounded bg-gray-800 border border-gray-600"
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* List */}
      {filtered.map((n) => (
        <NoteItem key={n.id} note={n} onSave={saveEdit} onDelete={removeNote} />
      ))}

      {filtered.length === 0 && (
        <p className="text-gray-400 text-sm">No notes found.</p>
      )}
    </div>
  );
}

/* -------------------------
   Single Note Component
----------------------------- */
function NoteItem({ note, onSave, onDelete }) {
  const [edit, setEdit] = useState(false);
  const [value, setValue] = useState(note.content);

  return (
    <div className="border border-gray-700 p-3 rounded mb-3 bg-gray-800">
      
      {/* Selected text */}
      <div className="text-sm text-yellow-300">{note.selectedText}</div>

      {/* URL — ⭐ ADD THIS BLOCK ⭐ */}
      <div className="text-xs text-blue-400 underline break-all mt-1">
        <a href={note.url} target="_blank">{note.url}</a>
      </div>

      {/* Edit mode */}
      {edit ? (
        <>
          <textarea
            className="w-full mt-2 p-2 rounded bg-gray-900 border border-gray-600"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button
            className="mt-2 bg-green-600 w-full py-1 rounded"
            onClick={() => {
              onSave(note.id, value);
              setEdit(false);
            }}
          >
            Save
          </button>
        </>
      ) : (
        <p className="text-gray-300 text-sm mt-1">{note.content}</p>
      )}

      <div className="flex gap-2 mt-2">
        <button className="flex-1 bg-blue-600 py-1 rounded" onClick={() => setEdit(!edit)}>
          Edit
        </button>
        <button className="flex-1 bg-red-600 py-1 rounded" onClick={() => onDelete(note.id)}>
          Delete
        </button>
      </div>

    </div>
  );
}


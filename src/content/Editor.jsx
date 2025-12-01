// src/content/Editor.jsx
import React, { useState } from "react";
import { saveNote } from "../shared/storage";

/* -------------------------
   Helpers: XPath (kept minimal, used only for best-effort)
   ------------------------- */
function getXPathForElement(el) {
  if (!el) return "";
  if (el.id) return `id("${el.id}")`;
  const parts = [];
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    let idx = 1;
    let sib = el.previousSibling;
    while (sib) {
      if (sib.nodeType === Node.ELEMENT_NODE && sib.nodeName === el.nodeName) idx++;
      sib = sib.previousSibling;
    }
    parts.unshift(`${el.nodeName.toLowerCase()}[${idx}]`);
    el = el.parentNode;
  }
  return "/" + parts.join("/");
}

/* -------------------------
   Serialize range to an anchor:
   - selectedText
   - prefix (30 chars)
   - suffix (30 chars)
   - xpathStart/xpathEnd as fallback
   - offsets (kept but not relied on)
   ------------------------- */
function getTextFromNode(node) {
  if (!node) return "";
  return node.nodeType === Node.TEXT_NODE ? node.textContent : node.innerText || "";
}

function gatherSurroundingText(range, maxChars = 30) {
  // gather prefix: walk left from range.startContainer
  let prefix = "";
  try {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    // find index of start node among text nodes
    const startNode = range.startContainer.nodeType === 3 ? range.startContainer : range.startContainer.querySelector ? (function findFirstText(n) {
      const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT, null, false);
      return w.nextNode();
    })(range.startContainer) : null;

    const endNode = range.endContainer.nodeType === 3 ? range.endContainer : range.endContainer.querySelector ? (function findFirstText(n) {
      const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT, null, false);
      return w.nextNode();
    })(range.endContainer) : null;

    const startIndex = startNode ? nodes.indexOf(startNode) : -1;
    const endIndex = endNode ? nodes.indexOf(endNode) : -1;

    // build prefix by concatenating text backwards
    if (startIndex >= 0) {
      let need = maxChars;
      for (let i = startIndex; i >= 0 && need > 0; --i) {
        const txt = nodes[i].textContent || "";
        const take = Math.min(need, txt.length);
        prefix = (txt.slice(Math.max(0, txt.length - take)) + prefix);
        need -= take;
      }
    }

    // build suffix by concatenating forwards
    let suffix = "";
    if (endIndex >= 0) {
      let need = maxChars;
      for (let i = endIndex; i < nodes.length && need > 0; ++i) {
        const txt = nodes[i].textContent || "";
        const take = Math.min(need, txt.length);
        suffix += txt.slice(0, take);
        need -= take;
      }
    }

    return { prefix: prefix.replace(/\s+/g, " "), suffix: suffix.replace(/\s+/g, " ") };
  } catch (e) {
    return { prefix: "", suffix: "" };
  }
}

function serializeRange(range) {
  try {
    const selectedText = range.toString();
    const surrounding = gatherSurroundingText(range, 30);

    const startEl = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
    const endEl = range.endContainer.nodeType === 3 ? range.endContainer.parentElement : range.endContainer;

    return {
      selectedText: selectedText,
      prefix: surrounding.prefix,
      suffix: surrounding.suffix,
      xpathStart: getXPathForElement(startEl),
      xpathEnd: getXPathForElement(endEl),
      startOffset: range.startOffset,
      endOffset: range.endOffset
    };
  } catch (e) {
    console.warn("serializeRange failed", e);
    return {
      selectedText: range.toString(),
      prefix: "",
      suffix: ""
    };
  }
}

/* -------------------------
   Editor UI
   ------------------------- */
export default function Editor({ range, close }) {
  const [text, setText] = useState("");

  async function save() {
  const locator = serializeRange(range);

  const note = {
    id: crypto.randomUUID(),
    url: location.href,
    content: text,
    selectedText: range.toString(),
    locator,
    createdAt: Date.now()
  };

  await saveNote(note);

  // 🔥 Force close editor immediately (shadow DOM safe)
  const host = document.querySelector('[data-contextmemo-editor]');
  if (host) host.remove();

  // Optional alert (non-blocking)
  setTimeout(() => {
    chrome.runtime.sendMessage({ type: "NOTE_SAVED" });
  }, 50);

  // Also call React's close() fallback
  try { close(); } catch (e) {}
}


  return (
    <div className="p-3 bg-white rounded-xl shadow-xl border w-64">
      <textarea
        className="w-full h-20 border border-gray-300 p-2 rounded-md"
        placeholder="Write your note..."
        onChange={(e) => setText(e.target.value)}
        value={text}
      />
      <button
        onClick={save}
        className="w-full mt-2 bg-blue-600 text-white py-1 rounded-md">
        Save Note
      </button>
    </div>
  );
}

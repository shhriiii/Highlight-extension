// src/content/index.jsx
import { createRoot } from "react-dom/client";
import Editor from "./Editor.jsx";

console.log("ContextMemo content script loaded");

/* -------------------------
   Highlight wrapper & tooltip
   ------------------------- */
function wrapRangeWithHighlight(range, noteId) {
  const span = document.createElement("span");
  span.dataset.contextmemoId = noteId;
  span.style.background = "rgba(245,183,36,0.6)";
  span.style.borderRadius = "3px";
  span.style.padding = "0 2px";
  try {
    range.surroundContents(span);
    return span;
  } catch (e) {
    // fallback for multi-node selections (handles wiki/multi-node)
    const contents = range.extractContents();
    span.appendChild(contents);
    range.insertNode(span);
    return span;
  }
}

function attachTooltipEvents(el, noteContent) {
  let tooltip;
  el.addEventListener("mouseenter", () => {
    tooltip = document.createElement("div");
    tooltip.textContent = noteContent;
    tooltip.style.position = "absolute";
    tooltip.style.background = "#333";
    tooltip.style.color = "#fff";
    tooltip.style.padding = "8px";
    tooltip.style.borderRadius = "6px";
    tooltip.style.fontSize = "12px";
    tooltip.style.maxWidth = "320px";
    tooltip.style.whiteSpace = "pre-wrap";
    tooltip.style.zIndex = 2147483647;

    const rect = el.getBoundingClientRect();
    tooltip.style.top = `${rect.top + window.scrollY - 48}px`;
    tooltip.style.left = `${rect.left + window.scrollX}px`;

    document.body.appendChild(tooltip);
  });
  el.addEventListener("mouseleave", () => {
    if (tooltip) tooltip.remove();
  });
}

/* -------------------------
   Smart range finder: search across text nodes using prefix/suffix + selectedText
   Works even when DOM was reflowed / mid-node <sup> inserted
   ------------------------- */

function normalizeSpaces(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function findRangeByAnchor(anchor) {
  if (!anchor || !anchor.selectedText) return null;

  const target = normalizeSpaces(anchor.selectedText);
  const prefix = normalizeSpaces(anchor.prefix || "");
  const suffix = normalizeSpaces(anchor.suffix || "");
  const maxNodesWindow = 40; // how many consecutive text nodes we'll try

  // gather all text nodes under body
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    // skip whitespace-only tiny nodes to speed up
    nodes.push(node);
  }

  // Try sliding window concatenation: for each starting node, concat ahead until long enough
  for (let i = 0; i < nodes.length; i++) {
    let built = "";
    let lengths = []; // lengths of each node appended
    for (let j = i; j < Math.min(nodes.length, i + maxNodesWindow); j++) {
      const t = nodes[j].textContent || "";
      lengths.push(t.length);
      built += t;
      // if built length exceeds target + context, attempt match
      if (built.length >= Math.max(1, target.length)) {
        // normalize built (collapse whitespace) but keep mapping of indices by reconstructing
        const builtNorm = normalizeSpaces(built);
        const pos = builtNorm.indexOf(target);
        if (pos !== -1) {
          // verify prefix/suffix context if present
          const prefixOk = !prefix || builtNorm.slice(Math.max(0, pos - prefix.length), pos) === prefix;
          const suffixOk = !suffix || builtNorm.slice(pos + target.length, pos + target.length + suffix.length) === suffix;
          if (prefixOk && suffixOk) {
            // map normalized pos back to node+offset
            // We need to find the start offset in original node sequence.
            // Easiest pragmatic approach: we re-scan node texts, building normalized as we go,
            // and stop when we've matched `pos` characters.
            let normCursor = 0;
            let startNode = null, startOffset = 0;
            let endNode = null, endOffset = 0;
            let matched = 0;
            // helper to step through nodes and their normalized characters
            for (let k = i, acc = 0; k <= j; k++) {
              const raw = nodes[k].textContent || "";
              const rawNorm = raw.replace(/\s+/g, " ");
              for (let r = 0; r < rawNorm.length; r++) {
                if (normCursor === pos) {
                  startNode = nodes[k];
                  startOffset = r;
                }
                if (normCursor === pos + target.length - 1) {
                  endNode = nodes[k];
                  endOffset = r + 1;
                }
                normCursor++;
                if (startNode && endNode) break;
              }
              if (startNode && endNode) break;
            }
            // If we couldn't map properly via normalized scan fallback to simple offsets using original concatenation
            if (!startNode || !endNode) {
              // fallback: find in raw built string (not normalized). This may be approximate but often works.
              const rawPos = built.indexOf(anchor.selectedText);
              if (rawPos !== -1) {
                let accLen = 0;
                let foundStart = false;
                let sNode = null, sOff = 0, eNode = null, eOff = 0;
                for (let k = i; k <= j; k++) {
                  const raw = nodes[k].textContent || "";
                  if (!foundStart && accLen + raw.length > rawPos) {
                    sNode = nodes[k];
                    sOff = rawPos - accLen;
                    foundStart = true;
                  }
                  if (foundStart && accLen + raw.length >= rawPos + anchor.selectedText.length) {
                    eNode = nodes[k];
                    eOff = rawPos + anchor.selectedText.length - accLen;
                    break;
                  }
                  accLen += raw.length;
                }
                startNode = startNode || sNode;
                startOffset = startOffset || sOff;
                endNode = endNode || eNode;
                endOffset = endOffset || eOff;
              }
            }

            if (startNode && endNode) {
              try {
                const range = document.createRange();
                range.setStart(startNode, Math.max(0, startOffset));
                range.setEnd(endNode, Math.max(0, endOffset));
                return range;
              } catch (e) {
                // if setting range fails, continue searching
                continue;
              }
            }
          }
        }
      }
    }
  }

  // final fallback: try simple findRangeByExact (find first occurrence of selectedText)
  const fallback = simpleFindRange(anchor.selectedText);
  return fallback;
}

function simpleFindRange(target) {
  if (!target) return null;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while ((node = walker.nextNode())) {
    const idx = node.textContent.indexOf(target);
    if (idx !== -1) {
      try {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + target.length);
        return range;
      } catch (e) {
        continue;
      }
    }
  }
  return null;
}

/* -------------------------
   Convert serialized locator -> Range
   ------------------------- */
function createRangeFromSerialized(serial) {
  if (!serial) return null;

  // Try using anchor (selectedText + prefix/suffix) first
  const rangeFromAnchor = findRangeByAnchor(serial);
  if (rangeFromAnchor) return rangeFromAnchor;

  // Next attempt: XPath-based (best-effort)
  try {
    if (serial.xpathStart && serial.xpathEnd) {
      const startEl = resolveXPath(serial.xpathStart);
      const endEl = resolveXPath(serial.xpathEnd);
      if (startEl && endEl) {
        const range = document.createRange();
        function nodeAndOffset(el, offset) {
          if (!el) return { node: el, offset: 0 };
          for (let i = 0; i < el.childNodes.length; i++) {
            const ch = el.childNodes[i];
            if (ch.nodeType === Node.TEXT_NODE) return { node: ch, offset: Math.min(offset, ch.textContent.length) };
          }
          return { node: el, offset: 0 };
        }
        const start = nodeAndOffset(startEl, serial.startOffset || 0);
        const end = nodeAndOffset(endEl, serial.endOffset || 0);
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);
        return range;
      }
    }
  } catch (e) {
    // ignore and fallback
  }

  // fallback to simple text search
  return simpleFindRange(serial.selectedText);
}

/* small helper to resolve xpath */
function resolveXPath(xpath) {
  if (!xpath) return null;
  try {
    if (xpath.startsWith('id("')) {
      const m = xpath.match(/^id\("(.+)"\)$/);
      return m ? document.getElementById(m[1]) : null;
    }
    const res = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return res && res.singleNodeValue ? res.singleNodeValue : null;
  } catch (e) {
    return null;
  }
}

/* -------------------------
   Restore highlights for page
   ------------------------- */
function restoreHighlightsForCurrentUrl() {
  chrome.storage.local.get(["notes"], (res) => {
    const notes = Array.isArray(res.notes) ? res.notes : [];
    const sameUrlNotes = notes.filter(n => n.url === window.location.href);
    sameUrlNotes.forEach(n => {
      const serial = n.locator || { selectedText: n.selectedText, prefix: "", suffix: "" };
      const r = createRangeFromSerialized(serial);
      if (!r) return;
      const el = wrapRangeWithHighlight(r, n.id);
      if (el) attachTooltipEvents(el, n.content);
    });
  });
}

/* -------------------------
   Floating editor: open editor near selection
   ------------------------- */
function openFloatingEditor() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  if (!selection.toString().trim()) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  const container = document.createElement("div");
  container.dataset.contextmemoEditor = "true";
  container.style.position = "absolute";
  container.style.left = `${rect.left + window.scrollX}px`;
  container.style.top = `${rect.bottom + window.scrollY + 8}px`;
  // use very large z-index to avoid being hidden by site widgets
  container.style.zIndex = "2147483647";

  const shadow = container.attachShadow({ mode: "open" });
  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);
  document.body.appendChild(container);

  const root = createRoot(mountPoint);
  root.render(
    <Editor
      range={range}
      close={() => {
        try { container.remove(); } catch (e) {}
        // after closing attempt to highlight the last saved note (non-blocking)
        chrome.storage.local.get(["notes"], (res) => {
          const notes = Array.isArray(res.notes) ? res.notes : [];
          const last = notes[notes.length - 1];
          if (!last) return;
          if (last.url === window.location.href) {
            const r = createRangeFromSerialized(last.locator || { selectedText: last.selectedText });
            if (!r) return;
            const el = wrapRangeWithHighlight(r, last.id);
            if (el) attachTooltipEvents(el, last.content);
          }
        });
      }}
    />
  );
}

/* -------------------------
   Boot: restore highlights and listen for messages
   ------------------------- */
if (document.readyState === "complete" || document.readyState === "interactive") {
  restoreHighlightsForCurrentUrl();
} else {
  document.addEventListener("DOMContentLoaded", restoreHighlightsForCurrentUrl);
}

chrome.runtime.onMessage.addListener((msg) => {

  // =========================
  // 1) OPEN EDITOR (existing)
  // =========================
  if (msg && msg.type === "OPEN_EDITOR") {
    openFloatingEditor();
  }

  // =========================
  // 2) DELETE HIGHLIGHT
  // =========================
  if (msg.type === "DELETE_HIGHLIGHT") {
    document
      .querySelectorAll(`[data-contextmemo-id="${msg.id}"]`)
      .forEach(el => el.remove());
  }

  // =========================
  // 3) UPDATE NOTE CONTENT
  // =========================
  if (msg.type === "UPDATE_NOTE_CONTENT") {
    document
      .querySelectorAll(`[data-contextmemo-id="${msg.id}"]`)
      .forEach(el => {
        // store latest content inside element
        el._content = msg.content;
      });
  }
});


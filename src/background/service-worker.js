// src/background/service-worker.js

// Create a single named context menu item
function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "add-contextmemo",
      title: "Add ContextMemo",
      contexts: ["selection"]
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn("Context menu creation error:", chrome.runtime.lastError);
      } else {
        console.log("ContextMemo context menu created.");
      }
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed → create context menu");
  createContextMenu();
});

// Also create on startup (helps when service worker restarts)
createContextMenu();

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "add-contextmemo") {
    if (!tab || !tab.id) return;

    chrome.tabs.sendMessage(tab.id, { type: "OPEN_EDITOR" }, () => {
      if (chrome.runtime.lastError) {
        // If content script not ready yet, retry a short time later
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { type: "OPEN_EDITOR" }, () => {});
        }, 250);
      }
    });
  }
});

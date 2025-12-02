# ContextMemo — Chrome Highlight & Notes Extension

ContextMemo is a Chrome extension that lets you **highlight text on any webpage**, attach notes to it, and automatically **restore your highlights** when you revisit the page.  
Built using **React + Vite + Manifest V3**.

---
## Youtube and Documentation Link 

 **YouTube:** [HighLight Extension](https://youtu.be/-4SaK5Ml8w4?si=u4GkVcPzWF41TYFh)
 **Documentation** [Google Drive Link](https://drive.google.com/file/d/1z7lvMmPMgOqLrZZathSfIMNdaSJeGm-5/view?usp=drivesdk)
---

##  Features

### Text Selection → Floating Note Editor
- Select any text → Right-click → **Add ContextMemo**
- A floating editor appears beside the selected text
- Notes are saved instantly and anchored to the exact text

###  Persistent Highlights (Even After Reload)
- Highlights reappear when you open the same page again
- Works across sessions and browser restarts  
- Uses **XPath + Fallback Text Search** for maximum reliability

### Popup Dashboard
- View notes for:
  - **This Page**
  - **All Pages**
- Search notes by text
- Edit or delete notes
- Notes update instantly on the webpage (live sync)

###  Tooltips on Hover
- Hovering over a highlighted text shows the attached note
- Clean and minimal tooltip UI

### Storage
- Uses `chrome.storage.local`
- Automatically manages array of notes:
```json
{
  "id": "uuid",
  "url": "https://example.com/page",
  "selectedText": "the exact text user selected",
  "content": "user’s note text",
  "locator": {
    "prefix": "text that appears before the selected text",
    "selectedText": "the exact highlighted text",
    "suffix": "text that appears after the selected text"
  },
  "createdAt": 1712345678901
}
```
### 1) Installation (Development Build)
```
git clone https://github.com/shhriiii/Highlight-extension.git
cd Highlight-extension
npm install
rm -rf dist
npm install
npm run build
npx vite build --config vite.content.config.js

mkdir -p dist/popup
mv dist/popup.html dist/popup/popup.html

cp src/manifest.json dist/
cp -r public/icons dist/
```
### 2) Load extension in Chrome
- Open: chrome://extensions/
- Enable Developer Mode
- Click Load Unpacked
- Select the dist/ folder

### Tech Stack
-React (Vite)
-Chrome Extensions Manifest V3
-Shadow DOM
-DOM Range API
-Tailwind CSS (Popup UI)




// js/background.js

// --- Constants ---
const CONTEXT_MENU_ID = "CONTEXTUAL_VOCAB_HELPER";

// --- Initialization ---

// Function to create the context menu item
function setupContextMenu() {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "Define with Contextual Vocab Helper",
    contexts: ["selection"] // Show only when text is selected
  }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error creating context menu:", chrome.runtime.lastError.message);
    } else {
      console.log("Context menu created successfully.");
    }
  });
}

// Run setupContextMenu when the extension is first installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log("Contextual Vocab Helper Extension Installed/Updated.");
  setupContextMenu();
});

// --- Event Listeners ---

// Listen for clicks on the context menu item
chrome.contextMenus.onClicked.addListener((info, tab) => {
  // Check if the click is from our menu item and if text was selected
  if (info.menuItemId === CONTEXT_MENU_ID && info.selectionText) {
    const selectedText = info.selectionText.trim();
    console.log(`Context menu clicked. Selected text: "${selectedText}"`);
    console.log("Tab information:", tab); // Useful for later scripting

    // --- Placeholder for future logic ---
    // 1. Get API Key from storage
    // 2. Get context using chrome.scripting.executeScript
    // 3. Construct Prompt
    // 4. Call Gemini API
    // 5. Handle response (success/error)
    // 6. Send result to popup (or store for popup)
    // --- End Placeholder ---

    // For now, let's store the selection and a 'loading' state
    // so the popup can pick it up when opened.
    chrome.storage.local.set({
        status: 'loading',
        selection: selectedText,
        data: null, // Clear previous data
        error: null // Clear previous error
    }).then(() => {
      console.log("Set status to loading and stored selection.");
      // Optionally, you could try to open the popup here, but it's often
      // better user experience to let them click the extension icon after selecting.
      // chrome.action.openPopup(); // Requires Chrome 99+ and user interaction context
    }).catch(error => {
       console.error("Error setting initial state in storage:", error);
    });

  } else {
    console.log("Context menu clicked, but not for our item or no text selected:", info);
  }
});

// Optional: Add a listener for messages (if needed later for communication
// between popup/options and background)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in background:", message);
  // Example: Handle a request from popup or options page
  if (message.action === "getApiKey") {
    chrome.storage.sync.get(['geminiApiKey'], (result) => {
      if (chrome.runtime.lastError) {
        console.error("Error getting API key:", chrome.runtime.lastError);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ apiKey: result.geminiApiKey });
      }
    });
    return true; // Indicates response will be sent asynchronously
  }
  // Add other message handlers as needed
});

console.log("Background service worker started."); // Helps confirm the script is running
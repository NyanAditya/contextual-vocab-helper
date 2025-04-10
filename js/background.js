// js/background.js

// --- Constants ---
const CONTEXT_MENU_ID = "CONTEXTUAL_VOCAB_HELPER";
// IMPORTANT: Replace with the correct Gemini API endpoint.
// Use the model appropriate for your key/needs (e.g., gemini-1.5-flash, gemini-pro)
const GEMINI_API_ENDPOINT_START = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyCZcVPXJIdqOZyhyzo8yUHCBQep7UH7WDE";

// --- Initialization ---

function setupContextMenu() {
  // Use chrome.contextMenus.update to ensure it doesn't create duplicates
  // or error out if it already exists from a previous load.
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "Define with Contextual Vocab Helper",
    contexts: ["selection"]
  }, () => {
    if (chrome.runtime.lastError) {
      // It might error if the menu item already exists, which is fine.
      // Log other errors.
      if (!chrome.runtime.lastError.message.includes('already exists')) {
          console.error("Error creating/updating context menu:", chrome.runtime.lastError.message);
      }
    } else {
      console.log("Context menu created/updated successfully.");
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Contextual Vocab Helper Extension Installed/Updated.");
  setupContextMenu();
  // Clear any previous results on install/update
  chrome.storage.local.set({ status: 'idle', selection: null, data: null, error: null, context: null });
});

// --- Core Logic ---

// Function injected into the page to get context
function getContextAroundSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return ""; // No selection
    }

    let range = selection.getRangeAt(0);
    let node = selection.anchorNode;

    // Try to find a suitable parent block element (e.g., <p>, <div>, <li>)
    // Go up a maximum of 5 levels to prevent infinite loops or overly broad context
    let attempts = 0;
    while (node && attempts < 5) {
        // Check if it's an element node and a block-level element or common container
        if (node.nodeType === Node.ELEMENT_NODE) {
             const displayStyle = window.getComputedStyle(node).display;
             if (['block', 'list-item', 'table-cell'].includes(displayStyle) || ['P', 'DIV', 'LI', 'BLOCKQUOTE', 'TD', 'ARTICLE', 'SECTION'].includes(node.tagName)) {
                // Return the text content of this block, limited to a reasonable length
                const contextText = node.textContent || node.innerText || "";
                return contextText.trim().substring(0, 1500); // Limit context length
             }
        }
         // If it's the body, stop searching upwards
         if (node.nodeName === 'BODY') break;

        node = node.parentNode;
        attempts++;
    }

    // Fallback: Use the immediate parent's text content if no suitable block found
    const fallbackNode = selection.anchorNode.parentNode;
    if (fallbackNode) {
        const fallbackText = fallbackNode.textContent || fallbackNode.innerText || "";
         return fallbackText.trim().substring(0, 1000); // Shorter limit for fallback
    }

    return ""; // No context found
}


// Function to build the prompt for Gemini
function buildPrompt(selectedText, contextText) {
    // Basic check to avoid sending useless context
    const relevantContext = contextText && contextText.includes(selectedText) ? contextText : "Not available";

    return `You are an expert lexicographer and contextual analyzer.
Analyze the 'Selected Text' based *only* on its usage within the provided 'Context'. If the context is "Not available" or doesn't seem relevant, analyze the selected text based on its most common meaning(s).

Context: """
${relevantContext}
"""

Selected Text: "${selectedText}"

Provide the following information strictly in Markdown format:

1.  **Definition:** A concise explanation of what "${selectedText}" means *specifically in the context provided*. If context is not available or irrelevant, provide the most common definition(s). Keep definitions brief.
2.  **Type:** The grammatical type or nature of "${selectedText}" as used (e.g., Verb, Noun, Adjective, Adverb, Idiom, Phrasal Verb, Proper Noun). If multiple types are possible, list the most likely one based on the context or common usage.
3.  **Examples:** Provide 1-2 clear and distinct example sentences demonstrating the usage of "${selectedText}" with the *same meaning* as defined above. Do not reuse the original context sentence. Make examples concise.

Format the output clearly using Markdown headings (e.g., \`### Definition\`) and bullet points or numbered lists for examples. Be concise in all parts of the response.`;
}

// Main handler for the context menu click event
async function handleContextClick(info, tab) {
    const selectedText = info.selectionText.trim();
    if (!selectedText) return; // Should not happen due to 'selection' context, but check anyway

    console.log(`Handling click for: "${selectedText}"`);

    let apiKey = null;
    let contextText = "";
    let prompt = "";
    let finalStatus = "error"; // Default to error unless successful
    let finalData = null;
    let finalError = "An unknown error occurred.";

    try {
        // 1. Get API Key
        const storageResult = await chrome.storage.sync.get(['geminiApiKey']);
        apiKey = storageResult.geminiApiKey;

        if (!apiKey) {
            console.error("Gemini API Key not found in storage.");
            finalError = "Gemini API Key not set. Please set it in the extension options.";
            throw new Error(finalError); // Jump to catch block for storage update
        }
        console.log("API Key retrieved.");

        // 2. Get Context
        const injectionResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: getContextAroundSelection,
        });

        if (injectionResults && injectionResults[0] && injectionResults[0].result) {
            contextText = injectionResults[0].result;
            console.log(`Context fetched: "${contextText.substring(0, 100)}..."`);
        } else {
            console.warn("Could not fetch context from page.");
            contextText = ""; // Ensure it's an empty string if fetching fails
        }

        // 3. Construct Prompt
        prompt = buildPrompt(selectedText, contextText);
        console.log("Prompt constructed.");
        // console.log("--- PROMPT START ---"); // Uncomment for debugging prompt
        // console.log(prompt);
        // console.log("--- PROMPT END ---");

        // 4. Call Gemini API
        console.log("Calling Gemini API...");
        const apiUrl = `${GEMINI_API_ENDPOINT_START}${apiKey}`;
        const requestBody = {
            contents: [{
                parts: [{ "text": prompt }]
            }],
            // Optional: Add safety settings if needed
            // safetySettings: [
            //   { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            //   // Add other categories as needed
            // ],
             generationConfig: {
                 // Optional: Control output parameters
                 temperature: 0.7, // Adjust creativity vs predictability
                 maxOutputTokens: 500, // Limit response length
             }
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        console.log(`API Response Status: ${response.status}`);

        if (!response.ok) {
            let errorBodyText = await response.text(); // Try to get error details
             try { // Try parsing as JSON, might fail if plain text error
                 const errorJson = JSON.parse(errorBodyText);
                 finalError = `API Error ${response.status}: ${errorJson.error?.message || errorBodyText}`;
             } catch {
                 finalError = `API Error ${response.status}: ${errorBodyText || response.statusText}`;
             }
            console.error("API Error Details:", finalError);
            throw new Error(finalError); // Jump to catch block
        }

        const responseData = await response.json();
        console.log("API Response Data:", responseData);

        // 5. Handle Response (Extract Markdown)
        // Navigate the Gemini response structure (this might vary slightly based on model/version)
        if (responseData.candidates && responseData.candidates[0] && responseData.candidates[0].content && responseData.candidates[0].content.parts && responseData.candidates[0].content.parts[0] && responseData.candidates[0].content.parts[0].text) {
            finalData = responseData.candidates[0].content.parts[0].text.trim();
            finalStatus = "success";
            finalError = null; // Clear error on success
            console.log("Successfully extracted Markdown from API response.");
        } else if (responseData.promptFeedback && responseData.promptFeedback.blockReason) {
            // Handle cases where the content was blocked by safety settings
            finalError = `Content blocked by API safety settings. Reason: ${responseData.promptFeedback.blockReason}`;
            console.warn(finalError);
             finalData = `*The request was blocked by safety filters: ${responseData.promptFeedback.blockReason}*`; // Provide some feedback in the popup
             finalStatus = "success"; // Treat as success in terms of flow, but data indicates blocking
             // Or set finalStatus = "error" if you prefer that handling
        }
        else {
            finalError = "Could not parse the expected content from the Gemini API response structure.";
            console.error(finalError, responseData);
             throw new Error(finalError); // Jump to catch block
        }

    } catch (error) {
        console.error("Error during handleContextClick:", error);
        // Ensure finalError is set if it hasn't been already
        finalError = finalError || error.message || "An unexpected error occurred during processing.";
        finalStatus = "error";
        finalData = null; // Ensure data is null on error
    } finally {
        // 6. Store Results (always executed, whether success or error)
        console.log(`Storing final state: ${finalStatus}`);
        await chrome.storage.local.set({
            status: finalStatus,
            selection: selectedText,
            data: finalData,
            error: finalError,
            context: contextText.substring(0, 200) // Store a snippet of context for preview
        });
        console.log("Final state stored in local storage.");
    }
}


// --- Event Listeners ---

// Listen for clicks on the context menu item
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID && info.selectionText) {
    const selectedText = info.selectionText.trim();
    console.log(`Context menu clicked for: "${selectedText}"`);

    // Immediately set status to loading and store selection/context
    chrome.storage.local.set({
        status: 'loading',
        selection: selectedText,
        data: null,
        error: null,
        context: null // Context will be updated later in handleContextClick
    }).then(() => {
        console.log("Set status to loading and stored selection.");
        // Now call the main async handler function
        handleContextClick(info, tab); // Don't await here, let it run in the background
    }).catch(error => {
       console.error("Error setting initial loading state in storage:", error);
       // Attempt to set error state if initial set fails
        chrome.storage.local.set({
            status: 'error',
            selection: selectedText,
            data: null,
            error: "Failed to initialize processing.",
            context: null
        });
    });

  }
});

// Optional: Keep the message listener if needed for future features
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in background:", message);
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
});

console.log("Background service worker started or refreshed.");
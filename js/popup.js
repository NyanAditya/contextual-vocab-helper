// js/popup.js

// --- DOM Elements ---
const loadingStateDiv = document.getElementById('loadingState');
const errorStateDiv = document.getElementById('errorState');
const noSelectionStateDiv = document.getElementById('noSelectionState');
const resultsStateDiv = document.getElementById('resultsState');

const loadingSelectionSpan = document.getElementById('loadingSelection');
const errorMessageP = document.getElementById('errorMessage');
const errorSelectionSpan = document.getElementById('errorSelection');
const openOptionsButton = document.getElementById('openOptionsButton');

const resultSelectedTextH2 = document.getElementById('resultSelectedText');
const resultsContentDiv = document.getElementById('resultsContent');
const copyButton = document.getElementById('copyButton');
const contextPreviewP = document.getElementById('contextPreview');

let rawMarkdownContent = ''; // Store raw markdown for copying

// --- Utility Functions ---

// Function to switch visibility between states
function showState(stateToShow) {
    loadingStateDiv.style.display = 'none';
    errorStateDiv.style.display = 'none';
    noSelectionStateDiv.style.display = 'none';
    resultsStateDiv.style.display = 'none';

    switch (stateToShow) {
        case 'loading':
            loadingStateDiv.style.display = 'block';
            break;
        case 'error':
            errorStateDiv.style.display = 'block';
            break;
        case 'no-selection':
            noSelectionStateDiv.style.display = 'block';
             break;
        case 'results':
            resultsStateDiv.style.display = 'block';
            break;
        default:
            console.error("Unknown state:", stateToShow);
            noSelectionStateDiv.style.display = 'block'; // Default fallback
    }
}

// Function to update the UI based on storage data
function updateUI(storageData) {
    const { status, selection, data, error, context } = storageData;

    console.log("Popup received data:", storageData);

    if (!status || status === 'idle') {
         // If popup opened without context menu click, or process hasn't started
        showState('no-selection');
        return;
    }

    switch (status) {
        case 'loading':
            loadingSelectionSpan.textContent = selection || '...';
            showState('loading');
            break;

        case 'error':
            errorMessageP.textContent = error || 'An unknown error occurred.';
            errorSelectionSpan.textContent = selection || 'N/A';
            showState('error');
            break;

        case 'success':
            if (data && selection) {
                resultSelectedTextH2.textContent = selection;
                try {
                     // Configure marked - enable GitHub Flavored Markdown (GFM) and breaks
                    marked.setOptions({
                        gfm: true,
                        breaks: true, // Interpret carriage returns as <br>
                        mangle: false, // Recommended for security/compatibility
                        headerIds: false // Don't generate header IDs
                    });
                    // Render Markdown
                    const htmlContent = marked.parse(data);
                    resultsContentDiv.innerHTML = htmlContent;
                    rawMarkdownContent = data; // Store for copy button

                    // Display context preview if available
                    if (context) {
                       contextPreviewP.textContent = `Context: "${context}"`;
                       contextPreviewP.style.display = 'block';
                       contextPreviewP.title = `Full Context Used:\n${context}`; // Show full on hover
                    } else {
                       contextPreviewP.style.display = 'none';
                    }

                } catch (renderError) {
                    console.error("Markdown rendering error:", renderError);
                    errorMessageP.textContent = `Failed to render the result: ${renderError.message}`;
                    errorSelectionSpan.textContent = selection;
                    showState('error');
                    break; // Exit case 'success'
                }
                showState('results');
            } else {
                errorMessageP.textContent = 'Received success status but no data or selection.';
                 errorSelectionSpan.textContent = selection || 'N/A';
                showState('error');
            }
            break;

        default:
            console.error("Unknown status received:", status);
            showState('no-selection'); // Fallback
    }
}

// --- Event Listeners ---

// 1. Initial load: Get current state from storage when popup opens
document.addEventListener('DOMContentLoaded', () => {
    console.log("Popup DOM loaded. Fetching initial state...");
    // Get all relevant keys at once
    chrome.storage.local.get(['status', 'selection', 'data', 'error', 'context'], (result) => {
        if (chrome.runtime.lastError) {
            console.error("Error getting initial state:", chrome.runtime.lastError);
            errorMessageP.textContent = `Error loading data: ${chrome.runtime.lastError.message}`;
             errorSelectionSpan.textContent = "N/A";
             showState('error');
        } else {
            updateUI(result);
        }
    });
});

// 2. Listen for storage changes while popup is open
chrome.storage.onChanged.addListener((changes, areaName) => {
    // Listen only to changes in 'local' storage
    if (areaName === 'local') {
        console.log("Storage changed:", changes);
        // We need to get the full state again as changes might only contain partial updates
        chrome.storage.local.get(['status', 'selection', 'data', 'error', 'context'], (result) => {
             if (chrome.runtime.lastError) {
                 console.error("Error getting state after change:", chrome.runtime.lastError);
                 // Avoid overwriting existing error if possible
                 if (errorStateDiv.style.display !== 'block') {
                     errorMessageP.textContent = `Error loading updated data: ${chrome.runtime.lastError.message}`;
                     errorSelectionSpan.textContent = "N/A";
                     showState('error');
                 }
            } else {
                updateUI(result);
            }
        });
    }
});

// 3. Listener for the "Copy" button
copyButton.addEventListener('click', () => {
    if (rawMarkdownContent) {
        navigator.clipboard.writeText(rawMarkdownContent)
            .then(() => {
                // Visual feedback: Temporarily change button text
                const originalText = copyButton.textContent;
                copyButton.textContent = 'Copied!';
                copyButton.disabled = true;
                setTimeout(() => {
                    copyButton.textContent = originalText;
                    copyButton.disabled = false;
                }, 1500); // Change back after 1.5 seconds
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
                // Optionally show an error message to the user
            });
    }
});

// 4. Listener for the "Check API Key" button
openOptionsButton.addEventListener('click', () => {
    // API to open the extension's options page
    if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
    } else {
        // Fallback for older browsers? (Less likely needed for manifest v3)
        window.open(chrome.runtime.getURL('html/options.html'));
    }
     // Close the popup after opening options
     window.close();
});
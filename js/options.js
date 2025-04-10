// js/options.js

const apiKeyInput = document.getElementById('apiKey');
const saveButton = document.getElementById('saveButton');
const statusMessage = document.getElementById('statusMessage');

// Function to display status messages
function showStatus(message, type = 'success', duration = 3000) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`; // Apply class for styling
    statusMessage.style.display = 'block'; // Make it visible

    // Clear message after 'duration' milliseconds
    if (duration > 0) {
        setTimeout(() => {
            statusMessage.textContent = '';
            statusMessage.style.display = 'none';
            statusMessage.className = 'status-message'; // Reset class
        }, duration);
    }
}

// Function to save the API Key
function saveOptions(event) {
    event.preventDefault(); // Prevent potential form submission if it were inside a <form>
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        showStatus('API Key cannot be empty.', 'error');
        return;
    }

    // Use chrome.storage.sync to save (syncs across devices if user is logged in)
    chrome.storage.sync.set({ 'geminiApiKey': apiKey }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving API key:", chrome.runtime.lastError);
            showStatus(`Error saving key: ${chrome.runtime.lastError.message}`, 'error', 5000);
        } else {
            console.log("API Key saved successfully.");
            showStatus('API Key saved successfully!', 'success');
            // Optional: Add visual feedback to the input or button
        }
    });
}

// Function to load the saved API Key when the options page opens
function loadOptions() {
    chrome.storage.sync.get(['geminiApiKey'], (result) => {
        if (chrome.runtime.lastError) {
            console.error("Error loading API key:", chrome.runtime.lastError);
            showStatus(`Error loading key: ${chrome.runtime.lastError.message}`, 'error', 5000);
        } else if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
            console.log("API Key loaded.");
            // Optionally show a silent status that key is loaded? Or just leave it.
            // showStatus('API Key loaded.', 'success', 1500); // Example
        } else {
            console.log("No API Key found in storage.");
            // Optional: showStatus('Enter your API Key.', 'info');
        }
    });
}

// --- Event Listeners ---

// Add listener to the save button
saveButton.addEventListener('click', saveOptions);

// Add listener to run loadOptions when the page content is fully loaded
document.addEventListener('DOMContentLoaded', loadOptions);

// Optional: Allow saving by pressing Enter in the input field
apiKeyInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        saveOptions(event);
    }
});
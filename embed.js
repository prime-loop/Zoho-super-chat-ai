document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.getElementById('chatContainer');
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    const refreshButton = document.getElementById('refreshButton');
    const draftEmailButton = document.getElementById('draftEmailButton');

    // --- CONFIGURATION ---
    // Replace with your ACTUAL N8N PRODUCTION WEBHOOK URLS
    const N8N_CHAT_WEBHOOK_URL = 'https://backend.api.outpilot.app/webhook/a12d5d4a-344c-446a-b5da-dea9891fffc5/chat';
    const N8N_EMAIL_DRAFTER_WEBHOOK_URL = 'https://backend.api.outpilot.app/webhook/Email_Drafter';
    // ---------------------

    let sessionId = localStorage.getItem('chatSessionId') || `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('chatSessionId', sessionId);

    console.log("Using sessionId:", sessionId);

    // Function to determine if running inside Zoho Desk
    function isInsideZohoDesk() {
        return typeof ZOHODESK !== 'undefined' && ZOHODESK !== null;
    }

    // Generic request function
    async function makeRequest(url, method, body, isZohoContext = false) {
        console.log(`Making ${method} request to ${url} with body:`, body);
        try {
            let response;
            if (isZohoContext && isInsideZohoDesk()) {
                console.log("Using ZOHODESK.request()");
                // ZOHODESK.request() structure might differ, adjust as per Zoho docs
                // It often requires a settings object
                const settings = {
                    url: url,
                    type: method.toUpperCase(),
                    headers: { "Content-Type": "application/json" },
                    data: JSON.stringify(body),
                    // 'contentType' might be needed for Zoho depending on how it handles JSON
                };
                response = await ZOHODESK.request(settings);
                // Zoho SDK might return stringified JSON, parse if needed
                if (typeof response === 'string') {
                    try {
                        response = JSON.parse(response);
                    } catch (e) {
                        console.warn("Response from ZOHODESK.request was not valid JSON:", response);
                        // Handle as plain text or throw error
                    }
                }
                // ZOHODESK.request() usually wraps the actual data, e.g., in response.data or response.response
                // For now, let's assume it gives a similar structure or you'll adapt it
                // We also need to simulate the 'ok' and 'status' properties for consistency
                // This is a placeholder - you'll need to inspect the actual Zoho response object
                const simulatedFetchResponse = {
                    ok: true, // Assume success if no error thrown by ZOHODESK.request
                    status: 200, // Assume 200
                    json: async () => response.response ? JSON.parse(response.response) : response, // Adjust based on actual structure
                    text: async () => response.response || JSON.stringify(response)
                };
                return simulatedFetchResponse;

            } else {
                console.log("Using fetch()");
                response = await fetch(url, {
                    method: method.toUpperCase(),
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            return response; // For fetch, this is the Response object
        } catch (error) {
            console.error('Request failed:', error);
            addMessageToChat(`Error: ${error.message}`, 'status-message');
            throw error; // Re-throw to be caught by callers if needed
        }
    }


    function addMessageToChat(htmlContent, type = 'ai-message') {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', type);
        messageDiv.innerHTML = htmlContent; // Use innerHTML for Markdown rendering
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    async function handleChatSubmit() {
        const messageText = chatInput.value.trim();
        if (!messageText) return;

        addMessageToChat(marked.parse(messageText), 'user-message'); // Render user message as MD too (optional)
        chatInput.value = '';

        try {
            const response = await makeRequest(N8N_CHAT_WEBHOOK_URL, 'POST', {
                chatInput: messageText,
                sessionId: sessionId
            }, isInsideZohoDesk());

            const data = await response.json(); // For fetch, this parses JSON body
            console.log('Chat response from n8n:', data);
            if (data.response) {
                addMessageToChat(marked.parse(data.response), 'ai-message');
            } else {
                addMessageToChat("Received an empty response.", 'status-message');
            }
        } catch (error) {
            // Error already logged by makeRequest
        }
    }

    async function handleRefresh() {
        addMessageToChat("Refreshing product data...", 'status-message');
        try {
            const response = await makeRequest(N8N_CHAT_WEBHOOK_URL, 'POST', {
                chatInput: "",
                sessionId: sessionId,
                action: "refresh"
            }, isInsideZohoDesk());

            const data = await response.json();
            console.log('Refresh response from n8n:', data);
            addMessageToChat(marked.parse(data.response || "Data refreshed! (No specific message)"), 'status-message');
        } catch (error) {
             // Error already logged by makeRequest
        }
    }

    async function handleDraftEmail() {
        let ticketId = "199939000000322001"; // Placeholder for GitHub Pages testing
        let orgId = "60041429812";    // Placeholder for GitHub Pages testing

        if (isInsideZohoDesk()) {
            try {
                // These are examples, actual methods might vary
                const ticketData = await ZOHODESK.get("ticket");
                ticketId = ticketData.id;
                const orgData = await ZOHODESK.get("portal.id"); // Or however you get orgId
                orgId = orgData; // Adjust based on actual object structure
                console.log("Fetched from Zoho: ticketId=", ticketId, "orgId=", orgId);
            } catch (e) {
                console.error("Failed to get ticket/org ID from Zoho SDK:", e);
                alert("Error: Could not retrieve ticket/org details from Zoho Desk.");
                return;
            }
        }

        addMessageToChat(`Attempting to draft email for ticket ${ticketId}...`, 'status-message');
        try {
            const response = await makeRequest(N8N_EMAIL_DRAFTER_WEBHOOK_URL, 'POST', {
                ticketId: ticketId,
                orgId: orgId
            }, isInsideZohoDesk());

            if (response.status === 200) { // Check status code
                alert('Success! Email draft creation request sent.');
                addMessageToChat('Email draft request successful.', 'status-message');
            } else {
                // This case should be caught by makeRequest's error handling if !response.ok
                const errorData = await response.text();
                alert(`Email draft request failed. Status: ${response.status}. Message: ${errorData}`);
                addMessageToChat(`Email draft request failed: ${errorData}`, 'status-message');
            }
        } catch (error) {
            // Error already logged by makeRequest. Alert is handled there for general errors.
            // If you want a specific alert for draft email failure:
            // alert(`Failed to send email draft request: ${error.message}`);
        }
    }

    sendButton.addEventListener('click', handleChatSubmit);
    chatInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleChatSubmit();
        }
    });
    refreshButton.addEventListener('click', handleRefresh);
    draftEmailButton.addEventListener('click', handleDraftEmail);

    // Initial message if needed
    addMessageToChat("AI Assistant loaded. Session ID: " + sessionId, 'status-message');

    // Zoho Desk specific initialization (if needed when SDK is present)
    if (isInsideZohoDesk()) {
        ZOHODESK.extension.onload(async function (app) {
            console.log("Zoho Desk Extension Loaded!", app);
            // You can fetch initial data here if needed, e.g., ticket details
            // const ticket = await ZOHODESK.get("ticket");
            // console.log("Current Ticket:", ticket);
        }).catch(function (err) {
            console.error("Zoho Desk Extension onload error:", err);
        });
    }
});

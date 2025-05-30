document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.getElementById('chatContainer');
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    const refreshButton = document.getElementById('refreshButton');
    const draftEmailButton = document.getElementById('draftEmailButton');

    // --- CONFIGURATION ---
    // Make sure these are your correct n8n PRODUCTION WEBHOOK URLS
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
        console.log(`Making ${method} request to ${url} with body:`, JSON.stringify(body)); // Log stringified body for cleaner console
        try {
            let response;
            if (isZohoContext && isInsideZohoDesk()) {
                console.log("Using ZOHODESK.request()");
                const settings = {
                    url: url,
                    type: method.toUpperCase(),
                    headers: { "Content-Type": "application/json" },
                    data: JSON.stringify(body),
                    // Note: ZOHODESK.request might have its own way of handling 'ok' and 'status'.
                    // The promise it returns usually resolves on success and rejects on error.
                    // The 'response' object from ZOHODESK.request might be the parsed data directly,
                    // or a string that needs parsing, or an object wrapping the data.
                    // This part might need fine-tuning based on actual ZOHODESK.request() behavior.
                };

                // Simulating a fetch-like response object from ZOHODESK.request result
                // This is a common pattern, but adjust if ZOHODESK.request behaves differently.
                let zohoResponseData;
                try {
                    zohoResponseData = await ZOHODESK.request(settings);
                    console.log("ZOHODESK.request successful, raw response:", zohoResponseData);
                } catch (zohoError) {
                    // ZOHODESK.request often throws an error object for non-2xx responses
                    console.error("ZOHODESK.request error object:", zohoError);
                    // Attempt to create a fetch-like error response
                    const errorStatus = zohoError.status || 500; // Or some default
                    const errorText = zohoError.message || JSON.stringify(zohoError);
                    return {
                        ok: false,
                        status: errorStatus,
                        json: async () => { throw new Error(errorText); }, // or return error object if parsable
                        text: async () => errorText
                    };
                }

                // Assuming zohoResponseData is the parsed JSON or needs parsing
                let parsedData;
                if (typeof zohoResponseData === 'string') {
                    try {
                        parsedData = JSON.parse(zohoResponseData);
                    } catch (e) {
                        console.warn("Response from ZOHODESK.request was string but not valid JSON:", zohoResponseData);
                        parsedData = zohoResponseData; // Treat as plain text
                    }
                } else {
                    parsedData = zohoResponseData; // Assume it's already an object/parsed
                }
                
                // Check if the actual response is nested (e.g., in a 'response' or 'data' property from the Zoho SDK wrapper)
                // This is highly dependent on Zoho's SDK structure. Inspect zohoResponseData to confirm.
                // For now, let's assume parsedData is the direct response body.

                return {
                    ok: true, // Assume success if no error was thrown by ZOHODESK.request
                    status: 200, // Assume 200
                    json: async () => parsedData,
                    text: async () => (typeof parsedData === 'string' ? parsedData : JSON.stringify(parsedData))
                };

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
                console.error(`HTTP error! status: ${response.status}, message: ${errorText}`, response);
                // Add message to chat here as a fallback, though individual handlers might do it too.
                addMessageToChat(`Request Error: ${response.status} - ${errorText.substring(0,100)}...`, 'status-message');
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            return response; // For fetch, this is the Response object
        } catch (error) {
            console.error('Request failed:', error.message); // Log only message to avoid huge objects in console
            // Don't add to chat here if specific handlers will, to avoid double messages
            // addMessageToChat(`Error: ${error.message}`, 'status-message');
            throw error; // Re-throw to be caught by callers if needed
        }
    }


    function addMessageToChat(htmlContent, type = 'ai-message') {
        console.log(`addMessageToChat called with type: ${type}, raw content length: ${htmlContent ? htmlContent.length : 0}`);
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', type);
        messageDiv.innerHTML = htmlContent; // Use innerHTML for Markdown rendering (marked.parse should return HTML string)
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    async function handleChatSubmit() {
        console.log("handleChatSubmit triggered");
        const messageText = chatInput.value.trim();
        if (!messageText) return;

        addMessageToChat(marked.parse(messageText), 'user-message'); // Render user message as MD
        chatInput.value = '';
        const currentIsZoho = isInsideZohoDesk();

        try {
            const response = await makeRequest(N8N_CHAT_WEBHOOK_URL, 'POST', {
                chatInput: messageText,
                sessionId: sessionId
            }, currentIsZoho);

            const data = await response.json();
            console.log('Chat response from n8n:', data);

            if (data && data.output !== undefined) { // Check if data exists and data.output is not undefined
                addMessageToChat(marked.parse(data.output), 'ai-message');
            } else {
                addMessageToChat("Received no valid content in 'output' field from AI.", 'status-message');
                console.warn("Response from n8n (chat) did not contain a 'output' key or data was null. Full data:", data);
            }
        } catch (error) {
            console.error('Error in handleChatSubmit:', error);
            addMessageToChat(`Failed to get AI response: ${error.message}`, 'status-message');
        }
    }

    async function handleRefresh() {
        console.log("handleRefresh triggered");
        addMessageToChat("Refreshing product data...", 'status-message');
        const currentIsZoho = isInsideZohoDesk();

        try {
            const response = await makeRequest(N8N_CHAT_WEBHOOK_URL, 'POST', {
                chatInput: "", // Empty chatInput for refresh action
                sessionId: sessionId,
                action: "refresh"
            }, currentIsZoho);

            const data = await response.json();
            console.log('Refresh response from n8n:', data);

            // Assuming refresh also returns its message in data.output
            if (data && data.output !== undefined) {
                addMessageToChat(marked.parse(data.output), 'status-message');
            } else {
                addMessageToChat("Data refresh action completed, but no specific message received in 'output'.", 'status-message');
                console.warn("Response from n8n (refresh) did not contain an 'output' key or data was null. Full data:", data);
            }
        } catch (error) {
            console.error('Error in handleRefresh:', error);
            addMessageToChat(`Failed to refresh data: ${error.message}`, 'status-message');
        }
    }

    async function handleDraftEmail() {
        console.log("handleDraftEmail triggered");
        let ticketId = "TEST_TICKET_123_GH_PAGES"; // Placeholder for GitHub Pages testing
        let orgId = "TEST_ORG_456_GH_PAGES";    // Placeholder for GitHub Pages testing
        const currentIsZoho = isInsideZohoDesk();

        if (currentIsZoho) {
            try {
                console.log("Attempting to fetch ticket details from ZOHODESK SDK...");
                const ticketDetails = await ZOHODESK.get("ticket"); // Example: fetches entire ticket object
                const portalDetails = await ZOHODESK.get("portal"); // Example: fetches portal details

                if (ticketDetails && ticketDetails.id) {
                    ticketId = ticketDetails.id;
                } else {
                    console.warn("Could not get ticket.id from ZOHODESK.get('ticket')", ticketDetails);
                }

                if (portalDetails && portalDetails.id) { // Assuming portal.id is what you mean by orgId
                    orgId = portalDetails.id;
                } else {
                     console.warn("Could not get portal.id for orgId from ZOHODESK.get('portal')", portalDetails);
                }
                console.log("Fetched from Zoho: ticketId=", ticketId, "orgId=", orgId);

            } catch (e) {
                console.error("Failed to get ticket/org ID from Zoho SDK:", e);
                alert("Error: Could not retrieve ticket/org details from Zoho Desk. Using placeholders.");
                // Optionally, you could choose to return here or proceed with placeholders
            }
        }

        addMessageToChat(`Attempting to draft email for ticket ${ticketId}...`, 'status-message');
        try {
            const response = await makeRequest(N8N_EMAIL_DRAFTER_WEBHOOK_URL, 'POST', {
                ticketId: ticketId,
                orgId: orgId
            }, currentIsZoho);

            // For draft email, the recap only specified HTTP 200 for success alert.
            // It didn't mention a response body being displayed.
            if (response.status === 200) {
                alert('Success! Email draft creation request sent.'); // Browser alert as requested
                addMessageToChat('Email draft request successful.', 'status-message');
            } else {
                // This path should ideally be caught by makeRequest's !response.ok
                // but as a fallback if makeRequest's ZOHODESK part doesn't perfectly mimic fetch:
                const errorText = await response.text();
                alert(`Email draft request may have failed. Status: ${response.status}. Message: ${errorText}`);
                addMessageToChat(`Email draft request returned status ${response.status}: ${errorText}`, 'status-message');
            }
        } catch (error) {
            console.error('Error in handleDraftEmail:', error);
            alert(`Failed to send email draft request: ${error.message}`); // Alert for thrown errors
            addMessageToChat(`Failed to draft email: ${error.message}`, 'status-message');
        }
    }

    // Event Listeners
    if (sendButton) {
        sendButton.addEventListener('click', handleChatSubmit);
    } else {
        console.error("Send button not found!");
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                handleChatSubmit();
            }
        });
    } else {
        console.error("Chat input not found!");
    }

    if (refreshButton) {
        refreshButton.addEventListener('click', handleRefresh);
    } else {
        console.error("Refresh button not found!");
    }

    if (draftEmailButton) {
        draftEmailButton.addEventListener('click', handleDraftEmail);
    } else {
        console.error("Draft email button not found!");
    }

    // Initial message
    addMessageToChat("AI Assistant loaded. Session ID: " + sessionId, 'status-message');
    console.log("Chat widget initialized. Markdown parser (marked):", typeof marked);


    // Zoho Desk specific initialization
    if (isInsideZohoDesk()) {
        console.log("Attempting Zoho Desk Extension onload registration.");
        ZOHODESK.extension.onload(async function (app) {
            console.log("Zoho Desk Extension Loaded successfully!", app);
            // You can fetch initial data here if needed using app.get() or ZOHODESK.get()
            // Example:
            // try {
            //     const initialTicketData = await ZOHODESK.get("ticket");
            //     console.log("Initial Ticket Data on load:", initialTicketData);
            //     addMessageToChat(`Working on ticket: ${initialTicketData.subject || initialTicketData.id}`, 'status-message');
            // } catch (e) {
            //     console.error("Error fetching initial ticket data in onload:", e);
            // }
        }).catch(function (err) {
            console.error("Zoho Desk Extension onload registration error:", err);
        });
    } else {
        console.log("Not running inside Zoho Desk. Skipping ZOHODESK.extension.onload().");
    }
});

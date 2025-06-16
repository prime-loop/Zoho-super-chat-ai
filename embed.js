document.addEventListener('DOMContentLoaded', () => {
  /* ========== DOM refs ========== */
  const statusBar       = document.getElementById('statusBar');
  const tabChat         = document.getElementById('tab-chat');
  const tabActions      = document.getElementById('tab-actions');
  const contentChat     = document.getElementById('content-chat');
  const contentActions  = document.getElementById('content-actions');

  const chatContainer   = document.getElementById('chatContainer');
  const chatInput       = document.getElementById('chatInput');
  const sendButton      = document.getElementById('sendButton');

  const refreshButton   = document.getElementById('refreshButton');
  const draftEmailBtn   = document.getElementById('draftEmailButton');
  const productWindow   = document.getElementById('productWindow');

  /* ========== Config ========== */
  const CHAT_URL  = "https://backend.api.outpilot.app/webhook/a12d5d4a-344c-446a-b5da-dea9891fffc5/chat";
  const DRAFT_URL = "https://backend.api.outpilot.app/webhook/Email_Drafter";
  const REFRESH_DATA_URL = "https://backend.api.outpilot.app/webhook/Refresh_Data";

  /* ========== Globals ========== */
  let isSDKReady = false;
  let sessionId = localStorage.getItem('chatSessionId') || 
    `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  localStorage.setItem('chatSessionId', sessionId);
  let isRefreshingData = false;
  let orderSummary = null;
  

  /* ========== Helpers ========== */
  // FIXED: Enhanced markdown parser
    const markedParse = (content) => {
    console.log('🔍 Parsing markdown content:', content?.substring(0, 100) + '...');
    
    if (!content || typeof content !== 'string') {
    console.warn('⚠️ Invalid content for markdown parsing');
    return content || '';
    }
    
    try {
    // tweak 1: enable single line breaks → <br>
    // tweak 2: wrap in a container with extra line-height & margin
    const options = {
      gfm: true,
      breaks: true
    };
    
    const rawHtml = typeof marked === 'function'
      ? marked.parse(content, options)
      : marked.parse(content, options);
    
    const styled = `
      <div style="
        line-height: 1.6;
        margin: 1em 0;
      ">
        ${rawHtml}
      </div>
    `;
    
    console.log('✅ Markdown parsed successfully with extra spacing');
    return styled;
    } catch (error) {
    console.error('❌ Markdown parsing error:', error);
    return content;
    }
    };
  function updateStatus(message, isError = false) {
    statusBar.textContent = message;
    statusBar.style.background = isError ? '#ffe6e6' : '#e8f4f8';
    statusBar.style.color = isError ? '#d00' : '#666';
  }

  function enableUI() {
    chatInput.disabled = false;
    sendButton.disabled = false;
    refreshButton.disabled = false;
    draftEmailBtn.disabled = false;
    chatInput.placeholder = "Type your message…";
  }

  function addMsg(html, cls = 'ai-message') {
    const div = document.createElement('div');
    div.className = `message ${cls}`;
    div.innerHTML = html;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  // Helper function to deep search for organization data in any object
  function findOrgDataInObject(obj, path = '') {
    if (!obj || typeof obj !== 'object') return null;
    
    console.log(`🔍 Searching for org data in ${path}:`, obj);
    
    // Direct property checks
    const orgKeys = ['orgId', 'organizationId', 'org_id', 'organization_id'];
    const nameKeys = ['orgName', 'organizationName', 'companyName', 'name', 'org_name', 'organization_name'];
    
    for (const key of orgKeys) {
      if (obj[key]) {
        const orgId = obj[key].toString();
        let orgName = 'UNKNOWN_ORG_NAME';
        
        // Look for corresponding name
        for (const nameKey of nameKeys) {
          if (obj[nameKey]) {
            orgName = obj[nameKey];
            break;
          }
        }
        
        console.log(`✅ Found org data at ${path}.${key}:`, { orgId, orgName });
        return { orgId, orgName };
      }
    }
    
    // Deep search in nested objects
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        const result = findOrgDataInObject(value, `${path}.${key}`);
        if (result) return result;
      }
    }
    
    return null;
  }

  // Simple request function using fetch
  async function request(url, body) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res;
    } catch (error) {
      console.error('Request failed:', error);
      throw error;
    }
  }

  // FIXED: Function to call Refresh Data webhook with timeout and array response handling
  async function callRefreshDataWebhook(emailId) {
    console.log('🔄 Calling Refresh Data webhook with email:', emailId);
    
    try {
      // Create AbortController for timeout (30 seconds since it takes <10 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout
      
      const response = await fetch(REFRESH_DATA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId: emailId }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Refresh Data webhook failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Refresh Data webhook response:', data);
      
      // FIXED: Handle array response format [{"Order_Summary": "..."}]
      let orderSummaryData = null;
      
      if (Array.isArray(data) && data.length > 0 && data[0].Order_Summary) {
        // Response is an array: [{"Order_Summary": "..."}]
        orderSummaryData = data[0];
        orderSummary = data[0].Order_Summary;
        console.log('✅ Order Summary received from array format:', orderSummary);
      } else if (data && data.Order_Summary) {
        // Response is an object: {"Order_Summary": "..."}
        orderSummaryData = data;
        orderSummary = data.Order_Summary;
        console.log('✅ Order Summary received from object format:', orderSummary);
      } else {
        console.error('❌ Invalid response structure:', data);
        throw new Error('Invalid response format: missing Order_Summary');
      }
      
      return orderSummaryData;
      
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Refresh Data request timed out after 30 seconds');
      }
      console.error('❌ Refresh Data webhook failed:', error);
      throw error;
    }
  }

  // Enhanced getMeta with better organization data extraction
  async function getMeta() {
    let meta = {
      ticketId:      'UNKNOWN_TICKET',
      orgId:         'UNKNOWN_ORG',
      orgName:       'UNKNOWN_ORG_NAME',
      department:    'UNKNOWN_DEPT',
      departmentId:  'UNKNOWN_DEPT_ID',
      senderEmail:   'UNKNOWN_EMAIL',
      contactId:     'UNKNOWN_CONTACT_ID',
      subject:       'UNKNOWN_SUBJECT',
      priority:      'UNKNOWN_PRIORITY',
      status:        'UNKNOWN_STATUS',
      description:   'UNKNOWN_DESCRIPTION',
      emailThreads:  [],
      threadCount:   0
    };
    
    if (!isSDKReady || typeof ZOHODESK === 'undefined') {
      console.warn('SDK not ready or available');
      return meta;
    }

    try {
      console.log('=== Step 1: Getting basic ticket data ===');
      
      const ticketResponse = await ZOHODESK.get("ticket");
      console.log('Full ticket response:', ticketResponse);
      
      if (ticketResponse && 
          ticketResponse.status === 'success' && 
          ticketResponse.ticket && 
          ticketResponse.ticket.id) {
        
        const ticket = ticketResponse.ticket;
        console.log('Extracting data from ticket:', ticket);
        
        // Extract all available basic data
        meta.ticketId = ticket.id?.toString() || meta.ticketId;
        meta.subject = ticket.subject || meta.subject;
        meta.status = ticket.status || meta.status;
        meta.priority = ticket.priority || meta.priority;
        meta.description = ticket.description || meta.description;
        meta.senderEmail = ticket.email || meta.senderEmail;
        meta.contactId = ticket.contactId?.toString() || meta.contactId;
        meta.departmentId = ticket.departmentId?.toString() || meta.departmentId;
        meta.threadCount = parseInt(ticket.threadCount) || 0;
        
        // Try to get organization ID from ticket data first
        const ticketOrgData = findOrgDataInObject(ticket, 'ticket');
        if (ticketOrgData) {
          meta.orgId = ticketOrgData.orgId;
          meta.orgName = ticketOrgData.orgName;
        }
        
        console.log('✅ Basic data extracted:', {
          ticketId: meta.ticketId,
          subject: meta.subject,
          status: meta.status,
          departmentId: meta.departmentId,
          contactId: meta.contactId,
          threadCount: meta.threadCount,
          orgId: meta.orgId
        });
      }
      
      // Step 2: Get user data (we know this works)
      if (meta.orgId === 'UNKNOWN_ORG') {
        console.log('=== Step 2: Getting user data for organization info ===');
        try {
          const userResponse = await ZOHODESK.get("user");
          console.log('🔍 Full user response structure:', userResponse);
          
          if (userResponse && userResponse.status === 'success' && userResponse.user) {
            console.log('🔍 User object contents:', userResponse.user);
            
            // Search for org data in user object
            const userOrgData = findOrgDataInObject(userResponse.user, 'user');
            if (userOrgData) {
              meta.orgId = userOrgData.orgId;
              meta.orgName = userOrgData.orgName;
              console.log('✅ Found organization data from user:', { orgId: meta.orgId, orgName: meta.orgName });
            }
          }
        } catch (userErr) {
          console.error('User method failed:', userErr);
        }
      }
      
      // Step 3: Get portal data (we know this works too)
      if (meta.orgId === 'UNKNOWN_ORG') {
        console.log('=== Step 3: Getting portal data for organization info ===');
        try {
          const portalResponse = await ZOHODESK.get("portal");
          console.log('🔍 Full portal response structure:', portalResponse);
          
          if (portalResponse && portalResponse.status === 'success' && portalResponse.portal) {
            console.log('🔍 Portal object contents:', portalResponse.portal);
            
            // Search for org data in portal object
            const portalOrgData = findOrgDataInObject(portalResponse.portal, 'portal');
            if (portalOrgData) {
              meta.orgId = portalOrgData.orgId;
              meta.orgName = portalOrgData.orgName;
              console.log('✅ Found organization data from portal:', { orgId: meta.orgId, orgName: meta.orgName });
            } else {
              // Manual check for common portal properties
              const portal = portalResponse.portal;
              console.log('🔍 Manual portal property check:', {
                hasOrgId: !!portal.orgId,
                hasOrganizationId: !!portal.organizationId,
                hasId: !!portal.id,
                hasName: !!portal.name,
                hasCompanyName: !!portal.companyName,
                allKeys: Object.keys(portal)
              });
              
              // Sometimes portal.id IS the org ID
              if (portal.id && !portal.orgId && !portal.organizationId) {
                meta.orgId = portal.id.toString();
                meta.orgName = portal.name || portal.companyName || meta.orgName;
                console.log('✅ Using portal.id as organization ID:', { orgId: meta.orgId, orgName: meta.orgName });
              }
            }
          }
        } catch (portalErr) {
          console.error('Portal method failed:', portalErr);
        }
      }
      
      // Step 4: Try some other documented SDK properties
      if (meta.orgId === 'UNKNOWN_ORG') {
        console.log('=== Step 4: Trying other SDK properties ===');
        
        const otherMethods = ['account', 'context', 'extension.context'];
        
        for (const method of otherMethods) {
          try {
            console.log(`🔍 Trying ZOHODESK.get("${method}")...`);
            const response = await ZOHODESK.get(method);
            console.log(`${method} response:`, response);
            
            if (response && response.status === 'success') {
              const data = response[method] || response.data || response;
              const orgData = findOrgDataInObject(data, method);
              if (orgData) {
                meta.orgId = orgData.orgId;
                meta.orgName = orgData.orgName;
                console.log(`✅ Found organization data from ${method}:`, { orgId: meta.orgId, orgName: meta.orgName });
                break;
              }
            }
          } catch (methodErr) {
            console.log(`❌ ${method} failed:`, methodErr.message);
          }
        }
      }
      
      // Set department name using the ID
      if (meta.departmentId !== 'UNKNOWN_DEPT_ID') {
        meta.department = `Department ID: ${meta.departmentId}`;
        console.log('✅ Department set with ID:', meta.department);
      }
      
      console.log('=== Final metadata collected ===', meta);
      
    } catch (e) {
      console.error('❌ getMeta() error:', e);
      updateStatus('Error fetching ticket data: ' + e.message, true);
    }
    
    return meta;
  }

  /* ========== Chat handler ========== */
  async function handleSend() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    addMsg(markedParse(text), 'user-message');
    chatInput.value = '';
    sendButton.disabled = true;

    try {
      updateStatus('Fetching complete ticket data...');
      const meta = await getMeta();
      
      // Create comprehensive payload
      const payload = { 
        sessionId, 
        chatInput: text, 
        ...meta,
        requestTime: new Date().toISOString(),
        summary: {
          hasTicketId: meta.ticketId !== 'UNKNOWN_TICKET',
          hasOrgData: meta.orgId !== 'UNKNOWN_ORG',
          hasDepartmentId: meta.departmentId !== 'UNKNOWN_DEPT_ID',
          hasContactData: meta.contactId !== 'UNKNOWN_CONTACT_ID'
        }
      };
      
      console.log('📤 Sending comprehensive payload to backend:', payload);
      
      updateStatus('Sending message with complete data...');
      const res = await request(CHAT_URL, payload);
      const data = await res.json();
      addMsg(markedParse(data.output ?? '*[no output]*'));
      updateStatus(`Ready - Org: ${meta.orgId !== 'UNKNOWN_ORG' ? '✅' : '❌'} - Session: ${sessionId.slice(-8)}`);
    } catch (err) {
      console.error('Chat error:', err);
      addMsg(`⚠️ Error: ${err.message}`, 'status-message');
      updateStatus('Error sending message', true);
    } finally {
      sendButton.disabled = false;
    }
  }

  /* ========== Enhanced Refresh handler - Order Summary Focus ========== */
  async function handleRefresh() {
    if (isRefreshingData) {
      console.log('⏳ Refresh already in progress, ignoring click');
      return;
    }

    refreshButton.disabled = true;
    isRefreshingData = true;
    productWindow.innerHTML = 'Loading order information...';
    updateStatus('Fetching order data...');
    
    try {
      // Step 1: Get basic ticket metadata for email
      const meta = await getMeta();
      await new Promise(r => setTimeout(r, 300));
      
      // Step 2: Call Refresh Data webhook if we have email
      if (meta.senderEmail && meta.senderEmail !== 'UNKNOWN_EMAIL') {
        updateStatus('Fetching order summary from backend...');
        productWindow.innerHTML = 'Fetching order summary... (usually takes under 10 seconds)';
        
        try {
          await callRefreshDataWebhook(meta.senderEmail);
          console.log('✅ Order summary updated successfully');
        } catch (webhookError) {
          console.error('❌ Refresh Data webhook failed:', webhookError);
          orderSummary = `**Error fetching order summary:**\n\n${webhookError.message}`;
        }
      } else {
        console.warn('⚠️ No email found, skipping Refresh Data webhook');
        orderSummary = '**No Order Data Available**\n\nNo customer email found - cannot fetch order summary';
      }
      
      // Step 3: Display Order Summary (this is the main content now)
      if (orderSummary) {
        // Display the order summary in markdown format
        productWindow.innerHTML = markedParse(orderSummary);
      } else {
        productWindow.innerHTML = markedParse(`
**Order Information**

*No order data available yet*

Click "Refresh Data" to fetch order summary for: **${meta.senderEmail}**

*Last updated: ${new Date().toLocaleTimeString()}*
        `.trim());
      }
      
      updateStatus(`Order data refreshed - Session: ${sessionId.slice(-8)}`);
    } catch (error) {
      console.error('Refresh error:', error);
      productWindow.innerHTML = markedParse(`
**Error Loading Order Information**

${error.message}

*Please try clicking "Refresh Data" again*
      `.trim());
      updateStatus('Error refreshing order data', true);
    } finally {
      refreshButton.disabled = false;
      isRefreshingData = false;
    }
  }

  /* ========== Draft handler ========== */
  async function handleDraft() {
    draftEmailBtn.disabled = true;
    updateStatus('Creating draft email...');
    
    try {
      const meta = await getMeta();
      const res = await request(DRAFT_URL, meta);
      
      if (res.ok) {
        addMsg(`✉️ Draft email request sent successfully.`, 'status-message');
        updateStatus('Draft email created successfully');
      }
    } catch (e) {
      console.error('Draft error:', e);
      addMsg(`⚠️ Draft request failed: ${e.message}`, 'status-message');
      updateStatus('Error creating draft email', true);
    } finally {
      draftEmailBtn.disabled = false;
    }
  }

  /* ========== Tabs ========== */
  function showTab(tab) {
    if (tab === 'chat') {
      tabChat.classList.add('active');
      tabActions.classList.remove('active');
      contentChat.classList.add('active');
      contentActions.classList.remove('active');
    } else {
      tabChat.classList.remove('active');
      tabActions.classList.add('active');
      contentChat.classList.remove('active');
      contentActions.classList.add('active');
    }
  }

  /* ========== Event Listeners ========== */
  tabChat.addEventListener('click', () => showTab('chat'));
  tabActions.addEventListener('click', () => showTab('actions'));

  /* ========== Enhanced SDK Detection and Initialization ========== */
  async function checkSDK() {
    if (typeof ZOHODESK !== 'undefined') {
      console.log('ZOHODESK object found:', ZOHODESK);
      console.log('Available ZOHODESK methods:', Object.keys(ZOHODESK));
      
      isSDKReady = true;
      updateStatus(`SDK Ready - Session: ${sessionId.slice(-8)}`);
      
      // Trigger initial refresh data webhook on extension load
      try {
        const meta = await getMeta();
        if (meta.senderEmail && meta.senderEmail !== 'UNKNOWN_EMAIL') {
          console.log('🚀 Extension loaded, triggering initial Refresh Data webhook');
          updateStatus('Loading order summary...');
          
          try {
            await callRefreshDataWebhook(meta.senderEmail);
            console.log('✅ Initial order summary loaded successfully');
            updateStatus(`Ready with order data - Session: ${sessionId.slice(-8)}`);
          } catch (initialWebhookError) {
            console.error('❌ Initial Refresh Data webhook failed:', initialWebhookError);
            orderSummary = `**Initial Load Failed**\n\n${initialWebhookError.message}\n\n*Click "Refresh Data" to try again*`;
            updateStatus(`SDK Ready (order load failed) - Session: ${sessionId.slice(-8)}`, true);
          }
        }
      } catch (metaError) {
        console.error('❌ Failed to get initial metadata:', metaError);
      }
    } else {
      console.warn('ZOHODESK object not found');
      updateStatus('SDK not available - Limited functionality', true);
    }
    
    // Enable UI regardless
    enableUI();
    
    // Attach event handlers
    sendButton.addEventListener('click', handleSend);
    chatInput.addEventListener('keypress', e => { 
      if (e.key === 'Enter' && !sendButton.disabled) handleSend(); 
    });
    refreshButton.addEventListener('click', handleRefresh);
    draftEmailBtn.addEventListener('click', handleDraft);

    // Initial messages
    addMsg(`🚀 AI Assistant loaded with order data integration!`, 'status-message');
    
    // Auto-refresh to load order data
    handleRefresh();
  }

  // Wait a bit for SDK to load, then check
  setTimeout(checkSDK, 1000);
});

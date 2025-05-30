// ▶︎ TEST CONFIG — override in production manifest if needed
const TEST_SESSION = "199939000000322001";
const TEST_ORG     = "60041429812";

// ▶︎ ENDPOINTS
const CHAT_URL  = "https://backend.api.outpilot.app/webhook/a12d5d4a-344c-446a-b5da-dea9891fffc5/chat";
const DRAFT_URL = "https://backend.api.outpilot.app/webhook/Email_Drafter";

// ▶︎ ELEMENTS
const thread   = document.getElementById("thread");
const input    = document.getElementById("q");
const btnSend  = document.getElementById("send");
const btnRef   = document.getElementById("refresh");
const btnDraft = document.getElementById("draft");

// ▶︎ STATE
let sessionId = TEST_SESSION;
let orgId     = TEST_ORG;

// ▶︎ UTILS
function appendMsg(html, who) {
  const el = document.createElement("div");
  el.className = `msg ${who}`;
  el.innerHTML = html;
  thread.append(el);
  thread.scrollTop = thread.scrollHeight;
}

function appendSys(text) {
  appendMsg(`<em>${text}</em>`, "ai");
}

// Chooses Zoho’s request (bypasses CORS) or fetch
async function callApi(url, body) {
  console.log("▶︎ calling", url, "with", body);
  // If in Zoho Desk widget, use ZOHODESK.request
  if (window.ZOHODESK && ZOHODESK.request) {
    return ZOHODESK.request({
      url,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(res => JSON.parse(res));
  }
  // Fallback to fetch
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return res.json();
  } catch (err) {
    clearTimeout(timer);
    console.error("✖ callApi error:", err);
    throw err;
  }
}

// ▶︎ EVENT HANDLERS
btnSend.onclick = async () => {
  const text = input.value.trim();
  if (!text) return;
  appendMsg(marked.parse(text), "me");
  input.value = "";
  try {
    const resp = await callApi(CHAT_URL, { sessionId, orgId, text });
    console.log("◉ chat response:", resp);
    if (resp.sessionId) sessionId = resp.sessionId;
    appendMsg(marked.parse(resp.answer || resp.text || ""), "ai");
  } catch (e) {
    appendSys(`⚠️ Chat failed: ${e.message}`);
  }
};

btnRef.onclick = async () => {
  try {
    await callApi(CHAT_URL, { sessionId, orgId, action: "refresh" });
    appendSys("🔄 Product data refreshed.");
  } catch (e) {
    appendSys(`⚠️ Refresh failed: ${e.message}`);
  }
};

btnDraft.onclick = async () => {
  try {
    const resp = await callApi(DRAFT_URL, { sessionId, orgId });
    console.log("◉ draft response:", resp);
    appendMsg(`<strong>Draft Email:</strong><pre>${resp.emailBody}</pre>`, "ai");
  } catch (e) {
    appendSys(`⚠️ Draft failed: ${e.message}`);
  }
};

// ▶︎ INITIAL LOG
console.log("AI SuperChat widget loaded. sessionId:", sessionId, "orgId:", orgId);

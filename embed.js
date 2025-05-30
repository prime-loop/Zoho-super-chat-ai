// embed.js

// ─── CONFIG ─────────────────────────────────────────────
const CHAT_URL   = "https://backend.api.outpilot.app/webhook/a12d5d4a-344c-446a-b5da-dea9891fffc5/chat";
const DRAFT_URL  = "https://backend.api.outpilot.app/webhook/Email_Drafter";
const sessionId  = "199939000000322001";  // for chat memory
const ticketId   = sessionId;             // if your ticketId == sessionId in test
const orgId      = "60041429812";         // for draft flow
// ────────────────────────────────────────────────────────

// ─── DOM REFERENCES ─────────────────────────────────────
const thread   = document.getElementById("thread");
const input    = document.getElementById("q");
const btnSend  = document.getElementById("send");
const btnRef   = document.getElementById("refresh");
const btnDraft = document.getElementById("draft");
// ────────────────────────────────────────────────────────

// ─── HELPERS ────────────────────────────────────────────
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

async function callApi(url, body) {
  // Use Zoho's request if available (no CORS)
  if (window.ZOHODESK && ZOHODESK.request) {
    const raw = await ZOHODESK.request({
      url,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return JSON.parse(raw);
  }
  // Fallback to fetch
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
// ────────────────────────────────────────────────────────

// ─── EVENT: Send Chat Message ───────────────────────────
btnSend.onclick = async () => {
  const chatInput = input.value.trim();
  if (!chatInput) return;
  appendMsg(marked.parse(chatInput), "me");
  input.value = "";
  try {
    const { answer, sessionId: newSid } = await callApi(CHAT_URL, {
      chatInput,
      sessionId
    });
    if (newSid) sessionId = newSid;
    appendMsg(marked.parse(answer || ""), "ai");
  } catch (err) {
    console.error("Chat error:", err);
    appendSys("⚠️ Chat failed. Check console.");
  }
};
// ────────────────────────────────────────────────────────

// ─── EVENT: Refresh Products (just another chat call) ────
btnRef.onclick = async () => {
  try {
    await callApi(CHAT_URL, { chatInput: "", sessionId, action: "refresh" });
    appendSys("🔄 Product data refreshed.");
  } catch (err) {
    console.error("Refresh error:", err);
    appendSys("⚠️ Refresh failed.");
  }
};
// ────────────────────────────────────────────────────────

// ─── EVENT: Create Draft Email ──────────────────────────
btnDraft.onclick = async () => {
  try {
    const resp = await callApi(DRAFT_URL, { ticketId, orgId });
    // you can render resp.emailBody inline if you like
    alert("✅ Draft creation started successfully.");
  } catch (err) {
    console.error("Draft error:", err);
    alert("❌ Draft creation failed.");
  }
};
// ────────────────────────────────────────────────────────

// ─── LOAD LOG ──────────────────────────────────────────
console.log("Widget ready – sessionId:", sessionId, "ticketId:", ticketId, "orgId:", orgId);

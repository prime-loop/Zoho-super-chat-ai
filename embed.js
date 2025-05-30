// embed.js

// ▶︎ CONFIGURATION (your test values)
const sessionId = "199939000000322001";
const orgId     = "60041429812";
const CHAT_URL  = "https://backend.api.outpilot.app/webhook/a12d5d4a-344c-446a-b5da-dea9891fffc5/chat";
const DRAFT_URL = "https://backend.api.outpilot.app/webhook/Email_Drafter";

// ▶︎ UI REFERENCES
const thread   = document.getElementById("thread");
const input    = document.getElementById("q");
const btnSend  = document.getElementById("send");
const btnRef   = document.getElementById("refresh");
const btnDraft = document.getElementById("draft");

// ▶︎ UTILITIES
async function postFlow(url, body) {
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
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  } catch (e) {
    clearTimeout(timer);
    appendSys("⚠️ Request failed or timed out.");
    throw e;
  }
}

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

// ▶︎ EVENT HANDLERS
btnSend.onclick = async () => {
  const text = input.value.trim();
  if (!text) return;
  appendMsg(marked.parse(text), "me");
  input.value = "";
  try {
    const { answer } = await postFlow(CHAT_URL, { sessionId, orgId, text });
    appendMsg(marked.parse(answer), "ai");
  } catch {}  
};

btnRef.onclick = () =>
  postFlow(CHAT_URL, { sessionId, orgId, action: "refresh" })
    .then(() => appendSys("🔄 Product data refreshed."))
    .catch(() => {});

btnDraft.onclick = async () => {
  try {
    const { emailBody } = await postFlow(DRAFT_URL, { sessionId, orgId });
    appendMsg(`<strong>Draft Email:</strong><pre>${emailBody}</pre>`, "ai");
  } catch {}
};

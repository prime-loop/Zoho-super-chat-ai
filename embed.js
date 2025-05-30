// embed.js

// --- 1) CONFIGURE these for your test run ---
const ticketId = "199939000000322001";
const orgId    = "60041429812";

const CHAT_URL  = "https://backend.api.outpilot.app/webhook/a12d5d4a-344c-446a-b5da-dea9891fffc5/chat";
const DRAFT_URL = "https://backend.api.outpilot.app/webhook/Email_Drafter";
// -------------------------------------------------

// grab container
const root = document.getElementById("root");

// render the UI
root.innerHTML = `
  <style>
    .msg { margin:6px 0; padding:8px; border-radius:4px; line-height:1.4; }
    .me  { background:#e1f5fe; text-align:right; }
    .ai  { background:#f1f8e9; }
    #thread { height:320px; overflow-y:auto; padding:8px; border-bottom:1px solid #ccc; }
    #input-area { padding:8px; display:flex; gap:8px; }
    #input-area input { flex:1; padding:6px; }
    #btns    { padding:8px; display:flex; gap:8px; }
  </style>
  <div id="thread"></div>
  <div id="input-area">
    <input id="q" placeholder="Type your message…" />
    <button id="send">Send</button>
  </div>
  <div id="btns">
    <button id="refresh">Refresh product data</button>
    <button id="draft">Create draft</button>
  </div>
`;

const thread = document.getElementById("thread");

// helper: append a message and autoscroll
function pushMsg(html, cls) {
  thread.insertAdjacentHTML("beforeend", `<div class="msg ${cls}">${html}</div>`);
  thread.scrollTop = thread.scrollHeight;
}

// helper: call your flow with 90 sec timeout
async function postFlow(url, body) {
  const ctrl  = new AbortController();
  const timer = setTimeout(()=>ctrl.abort(), 90000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  } catch (e) {
    clearTimeout(timer);
    alert("Request failed or timed out.");
    throw e;
  }
}

// Send chat
document.getElementById("send").onclick = async () => {
  const text = document.getElementById("q").value.trim();
  if (!text) return;
  pushMsg(marked.parse(text), "me");
  document.getElementById("q").value = "";
  try {
    const { answer } = await postFlow(CHAT_URL, { ticketId, orgId, text });
    pushMsg(marked.parse(answer), "ai");
  } catch {}
};

// Refresh button
document.getElementById("refresh").onclick = () =>
  postFlow(CHAT_URL, { ticketId, orgId, action: "refresh" })
    .then(() => alert("Products refreshed"))
    .catch(() => {});

// Draft button
document.getElementById("draft").onclick = async () => {
  try {
    const { emailBody } = await postFlow(DRAFT_URL, { ticketId, orgId });
    // render the draft with simple <pre>
    pushMsg(`<strong>Draft Email:</strong><pre>${emailBody}</pre>`, "ai");
  } catch {}
};

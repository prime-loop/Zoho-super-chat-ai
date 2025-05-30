// embed.js

// grab the container
const root = document.getElementById("root");
let ticketId = null;

// pull in Desk context
ZOHODESK.get("ticket.id").then(id => ticketId = id);

// render the chat UI + buttons
root.innerHTML = `
  <style>
    .msg { margin:4px 0; padding:6px; border-radius:4px; }
    .me  { background:#e1f5fe; }
    .ai  { background:#f1f8e9; }
  </style>
  <div id="thread" style="height:400px; overflow-y:auto; padding:8px; border-bottom:1px solid #ccc;"></div>
  <div style="padding:8px;">
    <input id="q" placeholder="Type message…" style="width:70%; padding:6px;">
    <button id="send">Send</button>
  </div>
  <hr style="margin:8px 0;">
  <div style="padding:8px;">
    <button id="refresh">Refresh product data</button>
    <button id="draft">Create draft</button>
  </div>
`;

// helper to call your n8n flows with timeout
const postFlow = async (url, body) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
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
};

// helper to append a message
const pushMsg = (html, cls) => {
  const th = document.getElementById("thread");
  th.insertAdjacentHTML("beforeend", `<div class="msg ${cls}">${html}</div>`);
  th.scrollTop = th.scrollHeight;
};

// send chat messages
document.getElementById("send").onclick = async () => {
  const text = document.getElementById("q").value.trim();
  if (!text) return;
  pushMsg(marked.parse(text), "me");
  document.getElementById("q").value = "";
  try {
    const { answer } = await postFlow(
      "https://backend.api.outpilot.app/webhook/a12d5d4a-344c-446a-b5da-dea9891fffc5/chat",
      { ticketId, text }
    );
    pushMsg(marked.parse(answer), "ai");
  } catch (e) { console.error(e); }
};

// refresh button
document.getElementById("refresh").onclick = () =>
  postFlow("https://n8n.YOURDOMAIN.com/webhook/refresh", { ticketId })
    .then(() => alert("Products refreshed"))
    .catch(() => {});

// draft button
document.getElementById("draft").onclick = () =>
  postFlow("https://backend.api.outpilot.app/webhook/Email_Drafter", { ticketId })
    .then(() => alert("Draft created"))
    .catch(() => {});

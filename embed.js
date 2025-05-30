// Minimal Zoho Desk chat + buttons
const root = document.getElementById("root");
let ticketId = null;
ZOHODESK.get("ticket.id").then(id => ticketId = id);

root.innerHTML = `
  <style>
    .msg{margin:4px 0;padding:6px;border-radius:4px;}
    .me{background:#e1f5fe} .ai{background:#f1f8e9}
  </style>
  <div id="thread"></div>
  <input id="q" placeholder="Type message…" style="width:80%">
  <button id="send">Send</button>
  <hr>
  <button id="refresh">Refresh product data</button>
  <button id="draft">Create draft</button>
`;

const $thread = document.getElementById("thread");
const $q      = document.getElementById("q");

const postFlow = async (url, body) => {
  const ctrl  = new AbortController();
  const timer = setTimeout(()=>ctrl.abort(), 90000);
  const res   = await fetch(url, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(body),
    signal: ctrl.signal
  }).catch(()=>{throw new Error("timeout")});
  clearTimeout(timer);
  if(!res.ok) throw new Error(res.statusText);
  return res.json();
};

const pushMsg = (html, cls) =>
  $thread.insertAdjacentHTML("beforeend", `<div class="msg ${cls}">${html}</div>`);

document.getElementById("send").onclick = async () => {
  const text = $q.value.trim(); if(!text) return;
  pushMsg(marked.parse(text), "me"); $q.value = "";
  const {answer} = await postFlow(
    "https://backend.api.outpilot.app/webhook/a12d5d4a-344c-446a-b5da-dea9891fffc5/chat",
    {ticketId, text}
  );
  pushMsg(marked.parse(answer), "ai");
};

document.getElementById("refresh").onclick = () =>
  postFlow("https://backend.api.outpilot.app/webhook/Email_Drafter", {ticketId})
    .then(()=>alert("Products refreshed"))
    .catch(()=>alert("Refresh failed or timed-out"));

document.getElementById("draft").onclick = () =>
  postFlow("https://backend.api.outpilot.app/webhook/Email_Drafter", {ticketId})
    .then(()=>alert("Draft created"))
    .catch(()=>alert("Draft failed or timed-out"));

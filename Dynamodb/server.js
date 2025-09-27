// server.js
const express = require("express");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");

const app = express();
const PORT   = process.env.PORT || 3000;
const TABLE  = process.env.DDB_TABLE || "TestWrites";
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-south-1";

// Auto-uses EC2 IAM role credentials
const ddb = new DynamoDBClient({ region: REGION });
const doc = DynamoDBDocumentClient.from(ddb);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aviz Academy • DynamoDB Mini Writer</title>
<meta name="description" content="We built this tiny page to help you understand DynamoDB writes via EC2 IAM Role. — Aviz Academy">
<style>
  :root{
    --bg1:#0f172a; --bg2:#1e293b; --brand:#7c3aed;
    --accent:#22c55e; --muted:#94a3b8; --text:#e2e8f0;
    --card:#0b1224f2;
  }
  *{box-sizing:border-box}
  body{
    margin:0; background:linear-gradient(135deg,var(--bg1),var(--bg2));
    color:var(--text); font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Inter,Arial;
  }
  header{padding:40px 16px;text-align:center;
    background:radial-gradient(1200px 500px at 50% -100px, rgba(124,58,237,.35), transparent 60%);
  }
  .brand{display:inline-flex;align-items:center;gap:12px;margin-bottom:8px}
  .logo{width:36px;height:36px;border-radius:10px;
    background:conic-gradient(from 220deg,#a78bfa,#22d3ee,#22c55e,#f59e0b,#a78bfa);
    box-shadow:0 6px 30px rgba(124,58,237,.35), inset 0 0 12px rgba(255,255,255,.25);
  }
  h1{margin:0;font-size:28px;font-weight:700}
  .sub{color:var(--muted);max-width:720px;margin:8px auto 0;font-size:14px}
  main{display:grid;place-items:center;padding:24px}
  .card{
    width:min(720px,92vw); background:var(--card); backdrop-filter: blur(8px);
    border:1px solid rgba(148,163,184,.18); border-radius:18px; padding:20px;
    box-shadow:0 12px 50px rgba(2,6,23,.45);
  }
  .row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  @media(max-width:640px){.row{grid-template-columns:1fr}}
  label{display:block;margin-bottom:6px;color:#cbd5e1;font-size:13px}
  input{width:100%;padding:12px 14px;border-radius:12px;
    border:1px solid rgba(148,163,184,.25);background:#0b1224;color:var(--text)}
  input:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(124,58,237,.25)}
  .actions{display:flex;gap:10px;align-items:center;margin-top:12px}
  button{
    all:unset;cursor:pointer;padding:12px 16px;border-radius:12px;font-weight:600;
    background:linear-gradient(135deg,var(--brand),#22d3ee);
    box-shadow:0 8px 30px rgba(124,58,237,.35);
  }
  .status{margin-top:14px;font-family:ui-monospace,monospace;font-size:13px;
    color:#cbd5e1;background:#0b1224;padding:12px;border-radius:12px;border:1px dashed rgba(148,163,184,.3)}
  .ok{color:var(--accent)}
  .err{color:#fda4af}
  footer{color:var(--muted);text-align:center;font-size:12px;padding:24px}
</style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="logo"></div>
      <h1>We built this to understand DynamoDB — <span style="color:#c4b5fd">Aviz Academy</span></h1>
    </div>
    <p class="sub">A super-minimal webpage that writes to Amazon DynamoDB from an EC2 instance using its IAM role. No access keys required.</p>
  </header>

  <main>
    <section class="card">
      <div class="row">
        <div>
          <label for="name">Your Name</label>
          <input id="name" name="name" placeholder="e.g., Skanda" required>
        </div>
        <div>
          <label for="message">Message</label>
          <input id="message" name="message" placeholder="Anything you like…" required>
        </div>
      </div>
      <div class="actions">
        <button id="saveBtn">Save to DynamoDB</button>
      </div>
      <div id="status" class="status">Ready.</div>
      <div id="recent" class="status" style="margin-top:10px">No recent writes yet.</div>
    </section>
  </main>

  <footer>
    <span>© Aviz Academy • DynamoDB Learning Mini App</span>
  </footer>

<script>
const el=(id)=>document.getElementById(id);
const saveBtn=el('saveBtn'),statusEl=el('status'),recentEl=el('recent');
const nameEl=el('name'),msgEl=el('message');

saveBtn.addEventListener('click',async()=>{
  const name=nameEl.value.trim(),message=msgEl.value.trim();
  if(!name||!message){
    statusEl.textContent="Please fill both fields.";statusEl.className="status err";return;
  }
  statusEl.textContent="Saving to DynamoDB…";statusEl.className="status";
  try{
    const r=await fetch('/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,message})});
    const text=await r.text();
    if(!r.ok){throw new Error(text);}
    const data=JSON.parse(text);
    statusEl.innerHTML="<span class='ok'>Saved!</span> Item id: <b>"+data.id+"</b>";
    statusEl.className="status ok";
    recentEl.textContent=JSON.stringify({id:data.id,name,message,ts:data.ts},null,2);
    nameEl.value="";msgEl.value="";
  }catch(err){
    statusEl.textContent="Error: "+err.message;statusEl.className="status err";
  }
});
</script>
</body>
</html>`);
});

// API: write endpoint
app.post("/submit", async (req, res) => {
  try {
    const id = randomUUID();
    const ts = Math.floor(Date.now()/1000);
    const { name = "", message = "" } = req.body || {};
    const item = { id, ts, name, message, app: "aviz-academy-ddb-mini" };

    await doc.send(new PutCommand({ TableName: TABLE, Item: item }));
    res.type("json").status(200).send(JSON.stringify({ ok:true, id, ts }, null, 2));
  } catch (err) {
    console.error("[SubmitError]", err);
    res.status(500).send("Error: " + err.name + " - " + err.message);
  }
});

// Health check
app.get("/healthz", (_req, res) => res.send("ok"));

app.listen(PORT, () => {
  console.log(
    "Listening on http://0.0.0.0:" + PORT +
    " (Table: " + TABLE + ", Region: " + REGION + ")"
  );
});

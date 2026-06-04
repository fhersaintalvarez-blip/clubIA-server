const express = require("express");
const app = express();
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const WATI_API_TOKEN = process.env.WATI_API_TOKEN;
const WATI_ENDPOINT = process.env.WATI_ENDPOINT;

const SYSTEM_PROMPT = "Eres el asistente de ProPadel Merida. Canchas: $1200 lun-jue, $600 vie TGI Fridays, $900 sab-dom con desayuno solo reserva directa. Clases: $550 individual, $300 x2, $250 x3, $200 x4. Baby Paddle 3-5 anos martes y jueves 10am $800 mes. Liga ProPadel activa. Horario 7-21hrs. Responde corto en espanol como WhatsApp.";

const conversaciones = {};

app.post("/webhook", async function(req, res) {
  res.sendStatus(200);
  try {
    const body = req.body;
    if (!body) { return; }
    if (body.eventType !== "message") { return; }
    const from = body.waId;
    const text = body.text;
    if (!from || !text) { return; }
    console.log("Mensaje: " + text);
    if (!conversaciones[from]) { conversaciones[from] = []; }
    conversaciones[from].push({ role: "user", content: text });
    if (conversaciones[from].length > 10) {
      conversaciones[from] = conversaciones[from].slice(-10);
    }
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: conversaciones[from]
      })
    });
    const aiData = await aiRes.json();
    if (aiData.error) {
      console.log("Error IA: " + aiData.error.message);
    }
    const reply = (aiData.content && aiData.content[0]) ? aiData.content[0].text : "Hola, en breve te atendemos.";
    console.log("Respuesta: " + reply);
    conversaciones[from].push({ role: "assistant", content: reply });
    const watiRes = await fetch(WATI_ENDPOINT + "/api/v1/sendSessionMessage/" + from, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + WATI_API_TOKEN
      },
      body: JSON.stringify({ messageText: reply })
    });
    const watiData = await watiRes.json();
    console.log("Wati: " + JSON.stringify(watiData));
  } catch (err) {
    console.error("Error: " + err.message);
  }
});

app.get("/", function(req, res) {
  res.send("ClubIA activo");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log("ClubIA en puerto " + PORT);
});

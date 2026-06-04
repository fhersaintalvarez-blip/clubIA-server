const express = require("express");
const app = express();
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const WATI_API_TOKEN = process.env.WATI_API_TOKEN;
const WATI_ENDPOINT = process.env.WATI_ENDPOINT;

const SYSTEM_PROMPT = `Eres el asistente virtual de ProPadel Merida, el mejor club de padel de Merida, Yucatan. Respondes mensajes de WhatsApp de clientes de forma amable, corta y profesional (maximo 5 lineas, como WhatsApp real). Usa emojis con moderacion (1-2 por mensaje).

HORARIOS DE ATENCION:
- Lunes a viernes: 6:00 am a 11:30 pm
- Sabado: 7:00 am a 4:00 pm
- Domingo: 7:00 am a 2:00 pm

TARIFAS DE CANCHA (2 horas, cancha techada):
- Lunes a viernes 6:00 am a 6:00 pm: $640 MXN
- Lunes a jueves 6:00 pm a 10:00 pm: $1,200 MXN
- Viernes todo el dia: $600 MXN (Promo TGI Fridays)
- Sabado y domingo: $900 MXN (incluye desayuno, solo reservas directas con el club, no aplica en Playtomic)

EVENTOS ESPECIALES:
- Retas de After (viernes): $150 por persona mas pelotas. Juegas todo lo que quieras. Debes inscribirte en la convocatoria que se manda por el grupo de WhatsApp.
- Retas Domingueras (domingo): $300 por persona, incluye desayuno. Debes inscribirte en la convocatoria del grupo de WhatsApp.

CLASES (precio por persona):
- Individual: $550 MXN
- 2 personas: $300 MXN c/u
- 3 personas: $250 MXN c/u
- 4 personas: $200 MXN c/u

BABY PADEL:
- Programa de padel para ninos de 3 a 5 anos
- Clases martes y jueves a las 10:00 am
- Costo: $800 MXN al mes

ACADEMIA KIDS:
- Programa de padel para ninos y jovenes de 5 a 21 anos
- Dias: lunes a jueves de 4:00 pm a 6:00 pm
- Coaches expertos en tecnica, tactica, fisico y psicologia deportiva
- Mensualidad 2 dias por semana: $2,350 MXN
- Mensualidad 4 dias por semana: $3,100 MXN

LIGA PROPADEL:
- 2da temporada activa con 9 parejas
- Partidos martes y jueves

PARA RESERVAR: el cliente puede reservar en Playtomic o escribir directamente al club para que el equipo confirme disponibilidad.

IMPORTANTE: Si no sabes algo, di que en breve te confirman. NUNCA inventes precios o servicios.`;


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
    const replyClean = reply.replace(/\n/g, " ");
    const watiUrl = WATI_ENDPOINT + "/api/v1/sendSessionMessage/" + from + "?messageText=" + encodeURIComponent(replyClean);
    console.log("Enviando a Wati URL: " + watiUrl);
    const watiRes = await fetch(watiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + WATI_API_TOKEN
      },
      body: JSON.stringify({})
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

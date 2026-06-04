const express = require("express");
const app = express();
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const WATI_API_TOKEN = process.env.WATI_API_TOKEN;
const WATI_ENDPOINT = process.env.WATI_ENDPOINT; 

const SYSTEM_PROMPT = `Eres el asistente virtual de ClubIA para ProPadel Merida, un club de padel en Merida, Yucatan, Mexico. Atiendes mensajes de clientes por WhatsApp.

TARIFAS DE CANCHA (por 2 horas):
- Lunes a jueves: $1,200 MXN
- Viernes: $600 MXN (Promocion TGI Fridays)
- Sabado y domingo: $900 MXN (incluye desayuno, solo reservas directas con el club, no aplica en Playtomic)

CLASES (precio por persona):
- Individual (1 persona): $550 MXN
- 2 personas: $300 MXN cada uno
- 3 personas: $250 MXN cada uno
- 4 personas: $200 MXN cada uno

OTROS SERVICIOS:
- Liga ProPadel: 2da temporada activa, 9 parejas, juegos martes y jueves
- Baby Paddle: ninos 3 a 5 anos, martes y jueves 10am, $800 al mes

HORARIOS: 7:00 a 21:00 hrs
CANCHAS: 3 canchas disponibles

PARA RESERVAR: indicar al cliente que puede reservar en Playtomic o escribir directamente al club para que el equipo confirme disponibilidad.

INSTRUCCIONES:
- Responde en espanol, tono amable y profesional
- Mensajes cortos como WhatsApp real (maximo 4-5 lineas)
- Usa emojis con moderacion (maximo 1-2 por mensaje)
- Si no sabes algo, di que en breve te confirman
- NUNCA inventes precios o servicios no listados`;

const conversaciones = {};

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    if (!body) return;
    if (body.eventType !== "message") return;

    const from = body.waId;
    const text = body.text;
    if (!from || !text) return;

    console.log("Mensaje de:", from, "Texto:", text);

    if (!conversaciones[from]) conversaciones[from] = [];
    conversaciones[from].push({ role: "user", content: text });
    if (conversaciones[from].length > 20) {
      conversaciones[from] = conversaciones[from].slice(-20);
    }

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: conversaciones[from]
      })
    });

    const aiData = await aiResponse.json();
    console.log("IA status:", aiData.type, aiData.error);

    const reply = aiData.content && aiData.content[0] ? aiData.content[0].text : "Hola, en un momento te atendemos.";
    conversaciones[from].push({ role: "assistant", content: reply });

    const watiUrl = WATI_ENDPOINT + "/api/v1/sendSessionMessage/" + from;
    console.log("Enviando a Wati:", watiUrl);

    const watiResponse = await fetch(watiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + WATI_API_TOKEN
      },
      body: JSON.stringify({ messageText: reply })
    });

    const watiData = await watiResponse.json();
    console.log("Wati respuesta:", JSON.stringify(watiData));

  } catch (err) {
    console.error("ERROR:", err.message);
  }
});

app.get("/", (req, res) => res.send("ClubIA servidor activo"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log("ClubIA corriendo en puerto " + PORT);
});

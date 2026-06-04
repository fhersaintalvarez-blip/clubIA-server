const express = require("express");
const app = express();
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const SYSTEM_PROMPT = `Eres el asistente virtual de ClubIA para ProPadel Mérida, un club de pádel en Mérida, Yucatán, México. Atiendes mensajes de clientes por WhatsApp.

TARIFAS DE CANCHA (por 2 horas):
- Lunes a jueves: $1,200 MXN
- Viernes: $600 MXN (Promoción TGI Fridays)
- Sábado y domingo: $900 MXN (incluye desayuno, solo reservas directas con el club, no aplica en Playtomic)

CLASES (precio por persona):
- Individual (1 persona): $550 MXN
- 2 personas: $300 MXN c/u
- 3 personas: $250 MXN c/u
- 4 personas: $200 MXN c/u

OTROS SERVICIOS:
- Liga ProPadel: 2da temporada activa, 9 parejas, juegos martes y jueves
- Baby Paddle: niños 3 a 5 años, martes y jueves 10:00am, $800/mes

HORARIOS: 7:00 a 21:00 hrs
CANCHAS: 3 canchas disponibles

PARA RESERVAR: indicar al cliente que puede reservar en Playtomic o escribir directamente al club para que Camila confirme disponibilidad.

INSTRUCCIONES:
- Responde en español, tono amable y profesional
- Mensajes cortos como WhatsApp real (máximo 4-5 líneas)
- Usa emojis con moderación (máximo 1-2 por mensaje)
- Si no sabes algo, di que en breve te confirman
- NUNCA inventes precios o servicios no listados`;

const conversaciones = {};

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;
    if (!messages || messages.length === 0) return;

    const msg = messages[0];
    if (msg.type !== "text") return;

    const from = msg.from;
    const text = msg.text.body;

    if (!conversaciones[from]) conversaciones[from] = [];
    conversaciones[from].push({ role: "user", content: text });

    if (conversaciones[from].length > 20) {
      conversaciones[from] = conversaciones[from].slice(-20);
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: conversaciones[from]
      })
    });

    const data = await response.json();
    const reply = data.content?.[0]?.text || "Lo siento, hubo un error. Intenta de nuevo.";

    conversaciones[from].push({ role: "assistant", content: reply });

    const phoneNumberId = value.metadata.phone_number_id;
    await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN}`
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: from,
        text: { body: reply }
      })
    });
  } catch (err) {
    console.error("Error:", err);
  }
});

app.get("/", (req, res) => res.send("ClubIA servidor activo ✅"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ClubIA corriendo en puerto ${PORT}`));

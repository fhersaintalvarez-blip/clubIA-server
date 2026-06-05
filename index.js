const express = require("express");
const app = express();
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const WATI_API_TOKEN = process.env.WATI_API_TOKEN;
const WATI_ENDPOINT = process.env.WATI_ENDPOINT;

const AGENTES = [
 "guzmanleslie314@gmail.com",
 "Cami.lajeme@gmail.com"
];
let turnoAgente = 0;

const SYSTEM_PROMPT = `Eres Raccoon, el asistente virtual de ProPadel Merida, el mejor club de padel de Merida, Yucatan. Respondes mensajes de WhatsApp de clientes de forma amable, corta y profesional (maximo 5 lineas, como WhatsApp real). Usa emojis con moderacion (1-2 por mensaje). El tono es relajado y amigable, como el ambiente del club. NUNCA te presentes ni digas tu nombre en las respuestas.

Si es el primer mensaje del cliente (no hay historial previo), saluda con: "¡Hola qué tal! 🦝 Bienvenido a ProPadel Mérida. ¿En qué te puedo ayudar?" y luego responde su pregunta si hizo alguna. Si ya hay historial, responde directo sin saludar.

HORARIOS DE ATENCION:
- Lunes a viernes: 6:00 am a 11:30 pm
- Sabado: 7:00 am a 4:00 pm
- Domingo: 7:00 am a 2:00 pm

TARIFAS DE CANCHA (2 horas, cancha techada):
- Lunes a jueves 6:00 am a 6:00 pm: $640 MXN
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
- Clases martes y jueves de 5:00 pm a 6:00 pm
- Costo: $1,850 MXN al mes

ACADEMIA KIDS:
- Programa de padel para ninos y jovenes de 5 a 21 anos
- Dias: lunes a jueves de 4:00 pm a 6:00 pm
- Coaches expertos en tecnica, tactica, fisico y psicologia deportiva
- Mensualidad 2 dias por semana: $2,350 MXN
- Mensualidad 4 dias por semana: $3,100 MXN

LIGA PROPADEL:
- 2da temporada activa con 9 parejas
- Partidos martes y jueves

CAFETERIA - ALDEA CAFE:
- Cafeteria dentro del club, ambiente familiar
- Menu: cafes, smoothies, desayunos, hamburguesas, tacos, bake, huevos al gusto, chilaquiles, bolis, cocteles
- Para precios del menu, indicar al cliente que pregunte directamente en el club o con una cajera

UBICACION Y ACCESO:
- Direccion: Calle 21 sin numero, Cholul, Merida, Yucatan
- Estacionamiento gratuito dentro del club
- Contamos con cargador para autos electricos
- Referencia: Cholul es una comisaria al norte de Merida

REDES SOCIALES:
- Instagram: https://www.instagram.com/propadelmid

AMBIENTE:
- Club familiar, relajado, apto para toda la familia
- Cafeteria Aldea Cafe dentro de las instalaciones

PARA RESERVAR: el cliente puede reservar en Playtomic o escribir directamente al club para que el equipo confirme disponibilidad.

IMPORTANTE: Si no sabes algo, di exactamente esta frase: "en breve te confirman". NUNCA inventes precios o servicios.`;

const conversaciones = {};
const enHandoff = {};

const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

const HORARIOS = {
 0: { inicio: 7, fin: 14 },
 1: { inicio: 6, fin: 23.5 },
 2: { inicio: 6, fin: 23.5 },
 3: { inicio: 6, fin: 23.5 },
 4: { inicio: 6, fin: 23.5 },
 5: { inicio: 6, fin: 23.5 },
 6: { inicio: 7, fin: 16 }
};

function getHoraMexico() {
 const ahora = new Date();
 const offsetMexico = -6;
 const utc = ahora.getTime() + ahora.getTimezoneOffset() * 60000;
 return new Date(utc + offsetMexico * 3600000);
}

function estaAbierto() {
 const horaMexico = getHoraMexico();
 const dia = horaMexico.getDay();
 const hora = horaMexico.getHours() + horaMexico.getMinutes() / 60;
 const horario = HORARIOS[dia];
 return hora >= horario.inicio && hora < horario.fin;
}

function getFechaContexto() {
 const horaMexico = getHoraMexico();
 const dia = DIAS[horaMexico.getDay()];
 const hora = horaMexico.getHours();
 const minutos = horaMexico.getMinutes().toString().padStart(2, "0");
 return `Hoy es ${dia}. Hora actual en Merida: ${hora}:${minutos}.`;
}

function quiereHumano(texto) {
 const frases = [
   "hablar con", "habla con", "quiero persona", "agente", "cajera",
   "humano", "persona real", "atiendeme", "atiéndeme", "necesito ayuda",
   "no me ayuda", "no entiendes", "quiero hablar", "llamar", "llamen"
 ];
 const t = texto.toLowerCase();
 return frases.some(f => t.includes(f));
}

function botNoSabe(respuesta) {
 return respuesta.toLowerCase().includes("en breve te confirman");
}

async function enviarMensaje(numero, texto) {
 const url = WATI_ENDPOINT + "/api/v1/sendSessionMessage/" + numero +
   "?messageText=" + encodeURIComponent(texto);
 const res = await fetch(url, {
   method: "POST",
   headers: {
     "Content-Type": "application/json",
     "Authorization": "Bearer " + WATI_API_TOKEN
   },
   body: JSON.stringify({})
 });
 return res.json();
}

async function asignarAgente(numero) {
 const agente = AGENTES[turnoAgente % AGENTES.length];
 turnoAgente++;
 console.log("Asignando a agente: " + agente);
 const url = WATI_ENDPOINT + "/api/v1/assignConversation/" + numero;
 try {
   const res = await fetch(url, {
     method: "POST",
     headers: {
       "Content-Type": "application/json",
       "Authorization": "Bearer " + WATI_API_TOKEN
     },
     body: JSON.stringify({ email: agente })
   });
   const data = await res.json();
   console.log("Asignacion Wati: " + JSON.stringify(data));
   return data;
 } catch (err) {
   console.log("Error asignando agente: " + err.message);
 }
}

app.post("/webhook", async function(req, res) {
 res.sendStatus(200);
 try {
   const body = req.body;
   if (!body) { return; }
   if (body.eventType !== "message") { return; }
   const from = body.waId;
   const text = body.text;
   if (!from || !text) { return; }
   console.log("Mensaje de " + from + ": " + text);

   if (enHandoff[from]) {
     console.log("Conversacion en handoff, ignorando bot");
     return;
   }

   if (!estaAbierto()) {
     await enviarMensaje(from, "Ey, por ahorita ya cerramos 🌙 pero tu mensaje no se pierde — escríbenos cuando abramos y te atendemos con todo. ¡Nos vemos en la cancha! 🎾");
     return;
   }

   if (quiereHumano(text)) {
     console.log("Cliente pide humano");
     enHandoff[from] = true;
     await enviarMensaje(from, "¡Claro! 🙋 En un momento una de nuestras cajeras te atiende personalmente.");
     await asignarAgente(from);
     return;
   }

   if (!conversaciones[from]) { conversaciones[from] = []; }
   conversaciones[from].push({ role: "user", content: text });
   if (conversaciones[from].length > 10) {
     conversaciones[from] = conversaciones[from].slice(-10);
   }

   const systemConFecha = SYSTEM_PROMPT + "\n\nCONTEXTO ACTUAL: " + getFechaContexto();

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
       system: systemConFecha,
       messages: conversaciones[from]
     })
   });

   const aiData = await aiRes.json();
   if (aiData.error) {
     console.log("Error IA: " + aiData.error.message);
   }

   const reply = (aiData.content && aiData.content[0])
     ? aiData.content[0].text
     : "en breve te confirman";

   console.log("Respuesta IA: " + reply);
   conversaciones[from].push({ role: "assistant", content: reply });

   if (botNoSabe(reply)) {
     console.log("Bot no sabe, activando handoff");
     enHandoff[from] = true;
     await enviarMensaje(from, reply.replace(/\n/g, " "));
     await asignarAgente(from);
     return;
   }

   await enviarMensaje(from, reply.replace(/\n/g, " "));

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

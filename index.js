const express = require("express");
const app = express();
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const WATI_API_TOKEN = process.env.WATI_API_TOKEN;
const WATI_ENDPOINT = process.env.WATI_ENDPOINT;

const AGENTES = [
 "guzmanleslie314@gmail.com",
 "Cami.lajeme@gmail.com",
 "fhersaintalvarez@gmail.com"
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
- Sabado y domingo: $900 MXN (incluye desayuno). IMPORTANTE: esta promo es exclusiva reservando directo con el club por WhatsApp, NO aplica en Playtomic. Siempre menciona esto como ventaja al cliente.

EVENTOS ESPECIALES:
- Retas de After (viernes): $150 por persona mas pelotas. Juegas todo lo que quieras. Para inscribirte entra al grupo de WhatsApp del club: https://chat.whatsapp.com/JLFIAzppgfUDKNpRC0bHHL
- Retas Domingueras (domingo): $300 por persona, incluye desayuno. Para inscribirte entra al grupo de WhatsApp: https://chat.whatsapp.com/In7QOm45qWj0nKPHk0oP6d

CLASES (precio por persona):
- Individual: $550 MXN
- 2 personas: $300 MXN c/u
- 3 personas: $250 MXN c/u
- 4 personas: $200 MXN c/u

PAQUETES DE CLASES:
- Paquete 10 clases: 10% de descuento sobre el precio normal
- Paquete 20 clases: 20% de descuento sobre el precio normal
- Paquete 30 clases: 30% de descuento sobre el precio normal
- Aplica para cualquier modalidad (individual, 2, 3 o 4 personas)
- Para contratar un paquete, preguntar directamente con el equipo

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

PREPARACION FISICA:
- Clases de preparacion fisica con coach especializado en alto rendimiento
- Coach: Roandys
- Martes y jueves de 7:30 am a 8:30 am
- Ideal para mejorar tu rendimiento dentro y fuera de la cancha

LIGA PROPADEL VARONIL:
- 2da temporada activa con 9 parejas
- Partidos los jueves
- Se requiere pareja para inscribirse

LIGA PROPADEL FEMENIL:
- Inscripcion individual, no necesitas pareja
- Coordinada por Tatiana Cardos

FISIOTERAPIA - AMOVERTE:
- Fisioterapeuta dentro del club
- Para costos y citas, contactar directamente con el fisio

TIENDA - MUNDO PADEL:
- Tienda de padel dentro de las instalaciones
- Puedes adquirir palas, tenis, ropa y accesorios deportivos

CAFETERIA - ALDEA CAFE:
- Mismo horario que el club
- Menu: cafes, smoothies, desayunos, hamburguesas, tacos, bake, huevos al gusto, chilaquiles, bolis, cocteles
- Para precios del menu, preguntar directamente en el club
- No se permiten alimentos externos dentro del club

UBICACION Y ACCESO:
- Direccion: Calle 21 sin numero, Cholul, Merida, Yucatan
- Estacionamiento gratuito dentro del club
- Contamos con cargador para autos electricos
- Referencia: Cholul es una comisaria al norte de Merida

REDES SOCIALES:
- Instagram: https://www.instagram.com/propadelmid

AMBIENTE:
- Club familiar, relajado, apto para toda la familia

METODOS DE PAGO:
- Efectivo
- Tarjeta de credito y debito
- Transferencia bancaria

PARA RESERVAR: el cliente puede reservar en Playtomic o escribir directamente al club para que el equipo confirme disponibilidad.

CUANDO PREGUNTEN POR CLASES PARA NINOS O EL CLUB EN GENERAL: menciona Baby Padel (3-5 anos, martes y jueves 5-6pm, $1,850/mes) y Academia Kids (5-21 anos, lunes a jueves 4-6pm, desde $2,350/mes). Nunca digas "en breve te confirman" para estas preguntas, siempre tienes la informacion.

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
 try {
   const url = WATI_ENDPOINT + "/api/v1/assignConversation/" + numero;
   const res = await fetch(url, {
     method: "POST",
     headers: {
       "Content-Type": "application/json",
       "Authorization": "Bearer " + WATI_API_TOKEN
     },
     body: JSON.stringify({ assignedTo: agente })
   });
   const text = await res.text();
   console.log("Asignacion Wati response: " + text);
 } catch (err) {
   console.log("Error asignando agente: " + err.message);
 }
}

async function notificarAgente(numero) {
 const agente = AGENTES[turnoAgente % AGENTES.length];
 turnoAgente++;
 console.log("Notificando a agente: " + agente);
 try {
   const url = WATI_ENDPOINT + "/api/v1/assignConversation/" + numero;
   const res = await fetch(url, {
     method: "POST",
     headers: {
       "Content-Type": "application/json",
       "Authorization": "Bearer " + WATI_API_TOKEN
     },
     body: JSON.stringify({ assignedTo: agente })
   });
   const text = await res.text();
   console.log("Notificacion agente response: " + text);
 } catch (err) {
   console.log("Error notificando agente: " + err.message);
 }
}

app.post("/webhook", async function(req, res) {
 res.sendStatus(200);
 try {
   const body = req.body;
   if (!body) { return; }

   if (body.eventType === "agent_message" ||
       (body.eventType === "message" && body.senderType === "agent")) {
     if (body.text && body.text.trim() === "/libre") {
       const numero = body.waId;
       delete enHandoff[numero];
       delete conversaciones[numero];
       console.log("Handoff liberado por agente para: " + numero);
       await enviarMensaje(numero, "¡Hola de nuevo! 🦝 ¿En qué más te puedo ayudar?");
     }
     return;
   }

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
     console.log("Bot no sabe, notificando agente sin cortar conversacion");
     await notificarAgente(from);
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

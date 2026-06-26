const express = require("express");
const puppeteer = require("puppeteer");
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
const EMAILS_AGENTES = new Set([
 "guzmanleslie314@gmail.com",
 "Cami.lajeme@gmail.com",
 "fhersaintalvarez@gmail.com"
]);
const NUMERO_ATENCION = "529992592708"; // ProPadel Atención — Camila y Leslie
let turnoAgente = 0;

// ── PLAYTOMIC CACHE ──
let cacheDisponibilidad = {};
const CACHE_TTL = 15 * 60 * 1000; // 15 minutos

const SYSTEM_PROMPT = `Eres Raccoon, el asistente virtual de ProPadel Merida, el mejor club de padel de Merida, Yucatan. Respondes mensajes de WhatsApp de clientes de forma amable, corta y profesional. Usa maximo 2 emojis por mensaje. El tono es relajado y amigable, como el ambiente del club. NUNCA te presentes ni digas tu nombre en las respuestas.
IDIOMA: Responde siempre en el mismo idioma que usa el cliente. Si escribe en inglés, responde en inglés con el mismo tono amigable.
Si es el primer mensaje del cliente (no hay historial previo), saluda con: "¡Hola qué tal! 🦝 Bienvenido a ProPadel Mérida. ¿En qué te puedo ayudar?" y luego responde su pregunta si hizo alguna. Si ya hay historial, responde directo sin saludar.
FORMATO DE RESPUESTA: Cuando listes servicios o informacion multiple, usa saltos de linea para que se vea ordenado, ejemplo:
- Renta de canchas
- Clases
- Baby Padel
Maximo 5 lineas de texto mas la lista. Que se vea limpio como WhatsApp real.
PREGUNTAS FUERA DE LUGAR: Si alguien pregunta algo que no tiene nada que ver con el club (ejemplo: venden mango, tienen ferreteria, etc.), responde con humor ligero y redirige al club. Ejemplo: "Mangos no, pero tenemos algo mejor 😄 ¿Te puedo ayudar con info del club?" NUNCA seas grosero ni cortante.
CONTACTO DEL CLUB:
- Ya estás en WhatsApp de Raccoon, el asistente de ProPadel Mérida
- Si alguien pregunta "¿cuál es tu número?" o "¿cómo te llamo?": 
  Responde: "Este es mi WhatsApp 🦝 aquí tengo todo del club"
- NUNCA des otro número a clientes

HORARIOS DE ATENCION DEL CLUB:
- Lunes a viernes: 6:00 am a 11:30 pm
- Sabado: 7:00 am a 2:00 pm
- Domingo: 7:00 am a 4:00 pm

TURNOS DEL STAFF (cajeras en caja):
- Lunes a viernes mañana: Camila — 6:00 am a 1:00 pm
- Lunes a viernes tarde: Leslie — 4:00 pm a 11:30 pm
- Sabado: Camila — 7:00 am a 2:00 pm
- Domingo: Leslie — 7:00 am a 4:00 pm
NOTA: El equipo siempre monitorea WhatsApp aunque no estén físicamente en el club. Si alguien pide atención humana en cualquier horario del club, puedes transferirla con confianza.
TARIFAS DE CANCHA (cancha techada):
La unidad base de renta es 2 horas. El precio por hora se calcula dividiendo entre 2. Puedes calcular cualquier duracion y darselo directo al cliente sin necesitar al equipo.

PRECIO BASE (bloque 2 horas):
- Lunes a jueves 6:00 am a 6:00 pm: $640 MXN (= $320/hora)
- Lunes a jueves 6:00 pm a 10:00 pm: $1,200 MXN (= $600/hora)
- Viernes todo el dia: $600 MXN (= $300/hora) — Promo TGI Fridays
- Sabado y domingo: $900 MXN (= $450/hora, incluye desayuno)

CALCULOS POR DURACION — responde siempre con el calculo exacto:
- 1 hora: precio/hora del horario correspondiente
- 1.5 horas: precio/hora x 1.5
- 2 horas: precio base del bloque
- 3 horas: precio/hora x 3
- 4 horas: precio/hora x 4
Ejemplo: "3 horas lunes en la tarde" = $600 x 3 = $1,800 MXN. Da siempre el numero final, no la formula.
Si piden mas de 2 horas seguidas, menciona que la disponibilidad de cancha continua depende del horario y sugiere confirmar con el equipo.

IMPORTANTE fin de semana: la promo $900 con desayuno es exclusiva reservando directo por WhatsApp, NO aplica en Playtomic. Siempre menciona esto como ventaja.

CUANDO NO SABES O ESTÁ FUERA DE ALCANCE:
- Si alguien pregunta sobre vacantes, empleo, reclutamiento, términos legales, o temas fuera de ProPadel:
  Responde: "en breve te confirman"
- NO des números, NO redirijas a otro canal
- El handoff silencioso (asignar a agente) se encarga del resto
EVENTOS ESPECIALES:
- Retas de After Office (viernes): $150 por persona mas pelotas. Juegas todo lo que quieras. Para inscribirte o mas info contacta a Tatiana Cardos: 999 193 4806
- Retas Domingueras (domingo): $300 por persona, incluye desayuno. Para inscribirte o mas info contacta a Tatiana Cardos: 999 193 4806
- Torneo 4ta Fuerza (lunes): Organizado por Tatiana Cardos. Para mas info y unirte al grupo: 999 193 4806

CIRCUITO DE LA CAGUAMA (convenio externo):
- No es un torneo del club, es un circuito externo con convenio con ProPadel
- Si el cliente menciona "partido de la caguama", "circuito de la caguama", "torneo de la caguama" o similar, confirma el beneficio segun horario:
* Lun-Jue 6pm a 8pm: tu reserva incluye pelotas Boltic + 1 caguama 🎾🍺
* Lun-Jue 8pm en adelante: tu reserva incluye 1 caguama 🍺
- SIEMPRE pregunta: "¿A qué hora es tu partido?" para confirmar qué incluye antes de dar el beneficio
- Solo aplica lunes a jueves

CLASES (precio por persona):
- Individual: $550 MXN
- 2 personas: $300 MXN c/u
- 3 personas: $250 MXN c/u
- 4 personas: $200 MXN c/u
COACHES DISPONIBLES: Nina, Ramiro, Núñez, Raúl — todos atienden cualquier nivel (principiante, intermedio, avanzado)
IMPORTANTE: Las clases se deben agendar con anticipación para coordinar con el coach. No se puede llegar sin reserva previa.
PAQUETES DE CLASES:
- Paquete 10 clases: 10% de descuento
- Paquete 20 clases: 20% de descuento
- Paquete 30 clases: 30% de descuento
- Aplica para cualquier modalidad
PROMO CUMPLEAÑERA 🎂:
- En el mes de tu cumpleaños tienes una reta GRATIS
- Requisito: presentar identificación oficial que compruebe el mes de cumpleaños
- Menciona siempre esta promo cuando pregunten por promociones o cuando sea relevante
- Para contratar un paquete, preguntar directamente con el equipo
BABY PADEL:
- Programa para ninos de 3 a 5 anos
- Clases martes y jueves de 5:00 pm a 6:00 pm
- Costo: $1,850 MXN al mes
ACADEMIA KIDS:
- Programa para ninos y jovenes de 5 a 21 anos
- Lunes a jueves de 4:00 pm a 6:00 pm
- Coaches expertos en tecnica, tactica, fisico y psicologia deportiva
- Mensualidad 2 dias por semana: $2,350 MXN
- Mensualidad 4 dias por semana: $3,100 MXN
CURSO DE VERANO 2026:
- Fechas: 29 de junio al 31 de julio
- Lunes a jueves, 9:00 am a 12:30 pm
- Edades: 5 a 21 anos
- Paquetes:
* 1 dia: $450 MXN
* 1 semana: $1,500 MXN
* 5 semanas: $6,400 MXN
- Incluye: entrenamiento, alberca y lunch
- Niveles: Iniciacion y Formacion
- 10% de descuento al inscribir a un amiguito
- Cupos limitados — Para inscribirte: 999 360 8364
PREPARACION FISICA:
- Coach: Roandys
- Martes y jueves de 7:30 am a 8:30 am
LIGA PROPADEL VARONIL:
- 2da temporada activa con 9 parejas
- Partidos los jueves
- Se requiere pareja para inscribirse
LIGA PROPADEL FEMENIL:
- Inscripcion individual, no necesitas pareja
- Coordinada por Tatiana Cardos: 999 193 4806
FISIOTERAPIA - AMOVERTE:
- Fisioterapeuta dentro del club
- Para costos y citas, contactar directamente con el fisio
TIENDA - MUNDO PADEL:
- Palas, tenis, ropa y accesorios deportivos
CAFETERIA - ALDEA CAFE:
- Mismo horario que el club
- No se permiten alimentos externos

BEBIDAS CALIENTES:
- Espresso $45 | Americano $55 | Descafeinado $50
- Capuccino $70 | Latte $70 | Chocolate abuelita $70 | Chai Latte $70
- Caramel Latte $75 | Horchata Latte $75 | Moca $75 | Dirty Chai $75

BEBIDAS FRIAS:
- Malteada Choco Galleta $80 | Malteada de Fresa $80 | Malteada de Caramelo $80 | Frappuccino $80
- Licuado proteina vegetal sabor chocolate $85 | Licuado frutos rojos sabor vainilla $85
- Smoothie Jugo Verde $80

SMOOTHIES $60:
Sabores: Mango, Fresa, Guayaba, Uva, Limon, Pitahaya, Pina Colada
Modificadores: +$10 Lechera | +$10 Chamoy con Tajin | +$20 Licor (coctel)

DESAYUNOS:
- Breakfast Sandwich $120 — pan brioche, huevo, jamon, queso americano, chipotle, papas chips
- Waffles con platano $100 — miel, azucar glass, platano
- Sandwich Ligero $120 — pan integral, jamon de pavo, queso panela, hummus chipotle, tomate, lechuga, papas chips
- Avocado Toast $160 — guacamole, huevos, tomate, cebolla, everything bagel
- Chilaquiles Verdes $120 (con huevo) / $150 (con pollo) — frijol, salsa verde, queso sopero, crema, cebolla
- Huevos 2pz $80 | A la mexicana $85 | Con jamon $90 — con frijol y totopos

TARDES DE RETA:
- Choripan $120 — chorizo argentino, mayonesa, lechuga, tomate, chimichurri, papas chips
- Cheese Burger $130 — doble queso americano, jalapenos, chipotle, papas chips
- Chicken Sandwich $130 — pechuga empanizada, queso americano, lechuga, tomate, papas chips

TAQUIZA (ordenes de 3 piezas):
- Tacos de Pastor $110
- Gringas de Pastor $130 | Gringas de Chuleta $130
- Gringas Arrachera con Chistorra $150
- Tacos Carnitas de Atun $150

PARA BOTANEAR:
- Papas a la francesa $100
- Dedos de queso y Chips $120 — mozzarella 8pz, bastones verdura, chipotle
- Nachos Especiales $160 — Pastor/Chuleta/Arrachera, guacamole, jalapenos
- Boneless y Chips $250 — bufalo o bbq, 500gr, ranch
- Bandeja Carta Clara $500 — boneless + dedos queso + papas + nachos + 1 misil gratis

POSTRES:
- Sundae Hersheys $45 — helado vainilla sabores: Chocolate, Fresa, Caramelo, Affogato
- Bolis Jumbo $45 — Mamut, Gansito, Bubulubu, Chocoreta

INSTALACIONES:
- 8 canchas techadas
- 1 cancha estadio al aire libre
- Alberca gratuita para todos los clientes — sin costo adicional. Niños pequenos deben estar supervisados por un adulto
- Regaderas y vestidores
- Estacionamiento gratuito a la intemperie
- Cargador electrico BYD
- Carwash (lavado de autos)
- Pet friendly — pueden venir con sus mascotas
- WiFi disponible para clientes
- Sin restriccion de edad para usar las canchas. Menores de edad deben ir acompañados por un adulto
EVENTOS Y CELEBRACIONES:
- Se aceptan eventos privados: cumpleaños, despedidas, reuniones empresariales, etc.
- Requiere reservacion previa
- Para cotizar o apartar fecha, conectar con el equipo

RENTA Y VENTA DE EQUIPO:
- Renta de palas: $50 MXN por sesion
- Venta de botes de pelotas:
* Boltic: $180 MXN
* Bullpadel: $200 MXN

UBICACION:
- Calle 21 sin numero, Cholul, Merida, Yucatan
- Cholul es una comisaria al norte de Merida
- Google Maps: https://maps.app.goo.gl/faDnpqGMSmvDVv9HA
- Si preguntan como llegar, manda el link de Maps directamente.
REDES SOCIALES:
- Instagram: https://www.instagram.com/propadelmid
METODOS DE PAGO:
- Efectivo, tarjeta de credito/debito, transferencia bancaria
- El pago de cancha se realiza al llegar al club, no es necesario pagar por adelantado al reservar
PARA RESERVAR: Por WhatsApp directo o por la app de Playtomic.
CUANDO PREGUNTEN POR CLASES PARA NINOS: menciona Baby Padel (3-5 anos), Academia Kids (5-21 anos) y el Curso de Verano si aplica por fecha.
CANCELACIONES Y CAMBIOS DE RESERVA:
- Se puede cancelar sin cargo con 24 horas de anticipacion. Si es menos de 24 horas, menciona que ya no aplica cancelacion y ofrece reagendar.
- Si alguien quiere cancelar o cambiar su reserva, dile la politica y pasa al equipo para gestionarlo.

CAPTURA DE LEADS — MUY IMPORTANTE:
- Cuando alguien pregunte por Curso de Verano, Academia Kids, Baby Padel, clases o quiera inscribirse a algo, SIEMPRE pregunta al final: "¿Me compartes tu nombre y un numero de contacto para que el equipo te de seguimiento?"
- Si ya te dieron nombre y numero, confirma: "Perfecto, en breve te contactan 👍"
- NOMBRES: Si en el historial de la conversacion el cliente ya menciono su nombre, o si el cliente responde a una confirmacion de reserva que ya incluia su nombre (ejemplo: "Buen dia Yucef, le confirmamos su reserva..."), NO vueltas a pedir el nombre. Ya lo tienes. Usa el nombre directamente en tu respuesta.

DETECCION DE INTENCION DE COMPRA:
- Si el cliente dice que ya quiere inscribirse, ya se decidio, quiere reservar o contratar algo, responde: "¡Excelente! 🙌 Ahora mismo te conecto con el equipo para cerrar tu inscripcion." Eso activa handoff.

IMPORTANTE: Si no sabes algo, di exactamente: "en breve te confirman". NUNCA inventes precios o servicios.`;

const conversaciones = {};
const enHandoff = {};
const iniciadasPorAgente = new Set();

// ── VENTANA DE PROTECCIÓN LOCAL POST-EVENTO-DE-AGENTE ──
const ultimaActividadAgente = {};
const PROTECCION_MS = 5 * 60 * 1000; // 5 minutos

function marcarActividadAgente(numero) {
 ultimaActividadAgente[numero] = Date.now();
}
function dentroDeVentanaProteccion(numero) {
 const ts = ultimaActividadAgente[numero];
 if (!ts) { return false; }
 return (Date.now() - ts) < PROTECCION_MS;
}

const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const HORARIOS = {
 0: { inicio: 7, fin: 16 },
 1: { inicio: 6, fin: 23.5 },
 2: { inicio: 6, fin: 23.5 },
 3: { inicio: 6, fin: 23.5 },
 4: { inicio: 6, fin: 23.5 },
 5: { inicio: 6, fin: 23.5 },
 6: { inicio: 7, fin: 14 }
};

function getHoraMexico() {
 return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Merida" }));
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
function esConfirmacionPasiva(texto) {
 const frases = [
   "confirmo", "confirmado", "confirmada", "ok", "okay", "listo", "gracias",
   "perfecto", "de acuerdo", "entendido", "recibido", "ahi estare", "ahí estaré",
   "ahi estamos", "nos vemos", "va", "sale", "👍", "✅"
 ];
 const t = texto.toLowerCase().trim();
 return frases.some(f => t.includes(f));
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
function quiereInscribirse(texto) {
 const frases = [
   "me inscribo", "quiero inscribirme", "ya me decidi", "ya me decidí",
   "quiero reservar", "voy a reservar", "quiero apartar", "quiero contratar",
   "me anoto", "me apunto", "ya quiero", "cómo pago", "como pago",
   "donde pago", "dónde pago", "cuándo puedo ir", "cuando puedo ir",
   "empiezo", "cuando empiezo", "cuándo empiezo"
 ];
 const t = texto.toLowerCase();
 return frases.some(f => t.includes(f));
}

// ── DETECCIÓN DE DISPONIBILIDAD (MEJORADA) ──
function quiereConsultarDisponibilidad(texto) {
 const t = texto.toLowerCase();
 
 // Palabras clave exclusivas de pregunta de disponibilidad
 const patronesDisponibilidad = [
   "hay cancha", "hay disponible", "tienes cancha",
   "cuál cancha", "cual cancha",
   "qué cancha", "que cancha",
   "disponibilidad", "disponible",
   "qué hora", "qué horario", "cuál horario", "cual horario",
   "¿hay", "¿tienes", "¿qué", "¿cual", "¿cuál",
   "cuando hay", "cuándo hay", "a qué hora hay", "a que hora hay",
   "para jugar", "para las", "para esa hora", "para hoy"
 ];
 
 const esConsultaDisponibilidad = patronesDisponibilidad.some(patron => t.includes(patron));
 
 // Excluir respuestas pasivas (confirmaciones, nombres, etc)
 const esRespuestaConfirmacion = t === "si" || t === "sí" || t === "ok" || 
                                  t === "okay" || t === "listo" || t === "perfecto" ||
                                  t.startsWith("cancha") || t.startsWith("si") ||
                                  t.length < 5; // palabras muy cortas
 
 return esConsultaDisponibilidad && !esRespuestaConfirmacion;
}

function botNoSabe(respuesta) {
 return respuesta.toLowerCase().includes("en breve te confirman");
}

function sleep(ms) {
 return new Promise(resolve => setTimeout(resolve, ms));
}

// ── PUPPETEER: CONSULTAR DISPONIBILIDAD PLAYTOMIC ──
async function consultarDisponibilidadPlaytomic() {
 try {
   // Chequear caché
   const hoy = new Date().toISOString().split('T')[0];
   if (cacheDisponibilidad[hoy] && (Date.now() - cacheDisponibilidad[hoy].timestamp) < CACHE_TTL) {
     console.log("[PLAYTOMIC] Cache hit para hoy: " + hoy);
     return cacheDisponibilidad[hoy].data;
   }

   console.log("[PLAYTOMIC] Scrapeando disponibilidad de hoy...");

   const browser = await puppeteer.launch({
     headless: true,
     args: [
       "--no-sandbox",
       "--disable-setuid-sandbox",
       "--disable-dev-shm-usage"
     ]
   });

   const page = await browser.newPage();
   await page.goto("https://playtomic.com/clubs/propadel-merida", { 
     waitUntil: "networkidle2", 
     timeout: 30000 
   });

   // Esperar a que carguen los selectores reales
   console.log("[PLAYTOMIC] Esperando a que carguen slots...");
   await page.waitForSelector('div[data-tracking-property-time]', { timeout: 15000 }).catch(() => {
     console.log("[PLAYTOMIC] Timeout esperando slots, intentando igual...");
   });

   await sleep(2000); // Dar tiempo extra a que cargue todo

   // Extraer disponibilidad con selectores correctos
   const disponibilidad = await page.evaluate(() => {
     const resultado = {};
     
     // Buscar todas las canchas (div con class="truncate")
     const canchaDivs = document.querySelectorAll('div.truncate');
     const canchas = Array.from(canchaDivs).map(div => div.textContent.trim());
     
     if (canchas.length === 0) {
       console.log("[PLAYTOMIC] No se encontraron canchas");
       return resultado;
     }

     console.log("[PLAYTOMIC] Canchas encontradas: " + canchas.join(", "));

     // Para cada cancha, encontrar sus slots
     for (const cancha of canchas) {
       resultado[cancha] = [];
     }

     // Buscar todos los slots (divs con data-tracking-property-time)
     const slots = document.querySelectorAll('div[data-tracking-property-time]');
     
     slots.forEach(slot => {
       // Verificar si es DISPONIBLE (tiene bg-white en la clase)
       const clases = slot.getAttribute('class') || '';
       const esDisponible = clases.includes('bg-white');
       
       if (esDisponible) {
         const horario = slot.getAttribute('data-tracking-property-time') || '';
         const duracion = slot.getAttribute('data-tracking-property-duration') || '60';
         
         // Encontrar a qué cancha pertenece este slot
         let parent = slot.parentElement;
         let canchaPadre = null;
         
         while (parent && !canchaPadre) {
           const textContent = parent.textContent || '';
           for (const cancha of Object.keys(resultado)) {
             if (textContent.includes(cancha)) {
               canchaPadre = cancha;
               break;
             }
           }
           parent = parent.parentElement;
         }

         if (!canchaPadre && Object.keys(resultado).length > 0) {
           canchaPadre = Object.keys(resultado)[0];
         }

         if (canchaPadre && horario) {
           // DEDUPLICAR: evitar horarios repetidos
           if (!resultado[canchaPadre].includes(horario)) {
             resultado[canchaPadre].push(horario);
           }
         }
       }
     });
     
     return resultado;
   });

   await browser.close();

   // Si no encontró nada, retornar error
   if (Object.keys(disponibilidad).length === 0 || 
       Object.values(disponibilidad).every(arr => arr.length === 0)) {
     console.log("[PLAYTOMIC] No se extrajeron datos válidos");
     return { error: "No se pudo extraer disponibilidad en este momento" };
   }

   // Guardar en caché
   cacheDisponibilidad[hoy] = {
     timestamp: Date.now(),
     data: disponibilidad
   };

   console.log("[PLAYTOMIC] Datos extraidos: " + JSON.stringify(disponibilidad).substring(0, 300));
   return disponibilidad;

 } catch (err) {
   console.error("[PLAYTOMIC] Error scrapeando: " + err.message);
   return { error: "No pude consultar disponibilidad en este momento" };
 }
}

// ── CHECK AGENTE + DETECCIÓN DE PLANTILLA SALIENTE ──
async function consultarConversacionWati(waId) {
 const url = WATI_ENDPOINT + "/api/v1/getConversation/" + waId;
 const res = await fetch(url, {
   method: "GET",
   headers: {
     "Authorization": "Bearer " + WATI_API_TOKEN,
     "Content-Type": "application/json"
   }
 });
 const text = await res.text();
 if (!text || text.trim() === "") {
   return null;
 }
 try {
   return JSON.parse(text);
 } catch (err) {
   console.log("[CHECK AGENTE] JSON invalido de Wati para " + waId + ": " + err.message);
   return null;
 }
}

const REINTENTOS_WATI_MS = [800, 1500, 2500];

async function tieneAgenteAsignado(waId) {
 if (dentroDeVentanaProteccion(waId)) {
   console.log("[CHECK AGENTE] Dentro de ventana de proteccion local, bloqueando: " + waId);
   return true;
 }

 let data = null;
 try {
   data = await consultarConversacionWati(waId);

   for (let i = 0; data === null && i < REINTENTOS_WATI_MS.length; i++) {
     console.log("[CHECK AGENTE] Respuesta vacia/invalida de Wati (intento " + (i + 1) + ") para: " + waId + " — reintentando en " + REINTENTOS_WATI_MS[i] + "ms");
     await sleep(REINTENTOS_WATI_MS[i]);
     data = await consultarConversacionWati(waId);
   }

   if (data === null) {
     console.log("[CHECK AGENTE] Wati sigue sin responder tras " + (REINTENTOS_WATI_MS.length + 1) + " intentos para: " + waId + " — FAIL-OPEN, Raccoon responde igual");
     await notificarAtencion("⚠️ Timeout de Wati al revisar conversación de +" + waId + " (varios intentos fallidos). Raccoon respondió de todas formas — revisar si hace falta intervención manual.");
     return false;
   }

   console.log("[CHECK AGENTE] Conversacion " + waId + ":", JSON.stringify(data).substring(0, 300));

   if (data.assignedAgent || data.operatorEmail || data.assignedTo) {
     const agente = data.assignedAgent || data.operatorEmail || data.assignedTo;
     if (agente && agente !== "" && agente !== null) {
       console.log("[CHECK AGENTE] Agente encontrado: " + agente);
       marcarActividadAgente(waId);
       return true;
     }
   }

   if (data.messages && Array.isArray(data.messages)) {
     const hayMensajeSaliente = data.messages.some(m => m.owner === true);
     if (hayMensajeSaliente) {
       console.log("[CHECK AGENTE] Conversacion iniciada por negocio (plantilla), bloqueando Raccoon: " + waId);
       marcarActividadAgente(waId);
       return true;
     }
   }

   if (data.owner === true) {
     console.log("[CHECK AGENTE] Owner true en conversacion, bloqueando: " + waId);
     marcarActividadAgente(waId);
     return true;
   }

   if (data.messages && data.messages.items && Array.isArray(data.messages.items)) {
     const hayMensajeSaliente = data.messages.items.some(m => m.owner === true);
     if (hayMensajeSaliente) {
       console.log("[CHECK AGENTE] Conversacion iniciada por negocio (items), bloqueando Raccoon: " + waId);
       marcarActividadAgente(waId);
       return true;
     }
   }

   return false;
 } catch (err) {
   console.log("[CHECK AGENTE] Error consultando conversacion: " + err.message + " — FAIL-OPEN, Raccoon responde igual");
   await notificarAtencion("⚠️ Error consultando Wati para +" + waId + ": " + err.message + ". Raccoon respondió de todas formas — revisar si hace falta intervención manual.");
   return false;
 }
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

async function notificarAtencion(mensajeInterno) {
 try {
   await enviarMensaje(NUMERO_ATENCION, mensajeInterno);
   console.log("[ATENCION] Notificacion enviada a ProPadel Atención: " + mensajeInterno);
 } catch (err) {
   console.log("[ATENCION] Error notificando a ProPadel Atención: " + err.message);
 }
}

async function asignarAgente(numero) {
 const agente = AGENTES[turnoAgente % AGENTES.length];
 turnoAgente++;
 console.log("Asignando a agente: " + agente);
 try {
   const url = WATI_ENDPOINT + "/api/v1/assignConversacion/" + numero;
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
   const url = WATI_ENDPOINT + "/api/v1/assignConversacion/" + numero;
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
   console.log("WEBHOOK body:", JSON.stringify(body).substring(0, 500));

   const numero = body.waId;

   // ── Detectar mensaje del agente o plantilla saliente ──
   const esMensajeDeAgente =
     body.eventType === "agent_message" ||
     body.eventType === "template_message" ||
     (body.eventType === "message" && body.senderType === "agent") ||
     (body.senderType && body.senderType !== "customer") ||
     (body.senderEmail && EMAILS_AGENTES.has(body.senderEmail)) ||
     (body.operatorEmail && EMAILS_AGENTES.has(body.operatorEmail)) ||
     (body.eventType === "message" && body.owner === true);

   if (esMensajeDeAgente) {
     if (numero) {
       if (body.text && body.text.trim() === "/libre") {
         delete enHandoff[numero];
         iniciadasPorAgente.delete(numero);
         delete conversaciones[numero];
         delete ultimaActividadAgente[numero];
         console.log("Handoff liberado por agente para: " + numero);
         await enviarMensaje(numero, "¡Hola de nuevo! 🦝 ¿En qué más te puedo ayudar?");
       } else {
         enHandoff[numero] = true;
         iniciadasPorAgente.add(numero);
         marcarActividadAgente(numero);
         console.log("[HANDOFF] Mensaje de agente/plantilla detectado, Raccoon silent: " + numero);
         if (body.eventType !== "template_message" && body.owner !== true) {
           await asignarAgente(numero);
         }
       }
     }
     return;
   }

   if (body.eventType !== "message") { return; }

   const from = body.waId;
   if (!from) { return; }

   // ── BLOQUEO TEMPRANO: Si fue iniciada por agente, Raccoon se queda callado ──
   if (iniciadasPorAgente.has(from)) {
     console.log("[PLANTILLA] Conversacion iniciada por agente, Raccoon silent: " + from);
     return;
   }

   // ── BLOQUEO TEMPRANO: Si ya está en handoff o en ventana de protección ──
   if (enHandoff[from] || dentroDeVentanaProteccion(from)) {
     console.log("[HANDOFF] En memoria o ventana de proteccion, Raccoon silent: " + from);
     enHandoff[from] = true;
     return;
   }

   // ── DETECCIÓN DE IMAGEN O DOCUMENTO ──
   const tipoMensaje = body.type || body.messageType;
   const esImagen = tipoMensaje === "image" || tipoMensaje === "document" || tipoMensaje === "video";

   if (esImagen) {
     console.log("[IMAGEN] Recibida de: " + from + " tipo: " + tipoMensaje);
     enHandoff[from] = true;
     await enviarMensaje(from, "¡Gracias! 📸 Un momento te conecto con el equipo.");
     await asignarAgente(from);
     await notificarAtencion("📎 Cliente +" + from + " envió una imagen. Revisar en Wati para ver qué es.");
     return;
   }

   const text = body.text;
   if (!text) { return; }

   console.log("Mensaje cliente de " + from + ": " + text);

   const hayAgente = await tieneAgenteAsignado(from);
   if (hayAgente) {
     enHandoff[from] = true;
     console.log("[HANDOFF] Agente o plantilla detectada via API, Raccoon silent: " + from);
     return;
   }

   await sleep(2000);

   // ── SEGUNDA VERIFICACIÓN: Agente pudo tomar el caso durante el delay ──
   if (enHandoff[from] || iniciadasPorAgente.has(from) || dentroDeVentanaProteccion(from)) {
     console.log("Agente tomo el caso durante delay, Raccoon no interviene");
     enHandoff[from] = true;
     return;
   }

   if (esConfirmacionPasiva(text)) {
     console.log("Confirmacion pasiva, Raccoon no responde: " + text);
     return;
   }

   if (quiereHumano(text)) {
     console.log("Cliente pide humano");
     enHandoff[from] = true;
     const esInglesH = /^[a-zA-Z\s\d.,!?'"-]+$/.test(text.trim());
     const msgHumano = esInglesH
       ? "Of course! 🙋 One of our team members will be with you shortly."
       : "¡Claro! 🙋 En un momento una de nuestras cajeras te atiende personalmente.";
     await enviarMensaje(from, msgHumano);
     await asignarAgente(from);
     await notificarAtencion("🙋 Cliente +" + from + " solicita atención humana. Revisar en Wati.");
     return;
   }

   if (quiereInscribirse(text)) {
     console.log("Cliente quiere inscribirse, activando handoff");
     enHandoff[from] = true;
     const esIngles = /^[a-zA-Z\s\d.,!?'"-]+$/.test(text.trim());
     const msgInscripcion = esIngles
       ? "Perfect! 🙌 Connecting you with the team right now to complete your registration."
       : "¡Excelente! 🙌 Ahora mismo te conecto con el equipo para cerrar tu inscripción.";
     await enviarMensaje(from, msgInscripcion);
     await asignarAgente(from);
     await notificarAtencion("🙌 Cliente +" + from + " quiere inscribirse. Revisar en Wati.");
     return;
   }

   // ── CONSULTAR DISPONIBILIDAD PLAYTOMIC ──
   if (quiereConsultarDisponibilidad(text)) {
     console.log("Cliente pregunta por disponibilidad");
     
     // Notificar agente INMEDIATAMENTE (paralelo)
     await notificarAgente(from);
     
     // Responder mientras se consulta
     await enviarMensaje(from, "Un momento, estoy consultando disponibilidad... 🔍");
     
     // Scraper intenta (con timeout corto)
     const disponibilidad = await consultarDisponibilidadPlaytomic();

     if (disponibilidad.error) {
       console.log("Error en Playtomic: " + disponibilidad.error);
       // Agente ya está notificado, no hacer nada más
       return;
     }

     // Formatear respuesta
     let respuesta = "📱 Disponibilidad hoy:\n\n";
     let totalDisponible = 0;

     for (const cancha in disponibilidad) {
       const horarios = disponibilidad[cancha];
       if (horarios && horarios.length > 0) {
         totalDisponible += horarios.length;
         respuesta += "🏸 " + cancha + ":\n";
         horarios.slice(0, 5).forEach(horario => {
           respuesta += "  • " + horario + "\n";
         });
         if (horarios.length > 5) {
           respuesta += "  ... y más\n";
         }
       }
     }

     if (totalDisponible === 0) {
       respuesta = "Por ahora no hay canchas disponibles. El equipo ya está viendo cómo ayudarte 👍";
     } else {
       respuesta += "\n¿Cuál te interesa? Escribe directamente o reserva en Playtomic 🎾";
     }

     await enviarMensaje(from, respuesta);
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
       model: "claude-haiku-4-5-20251001",
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
     console.log("Bot no sabe, notificando agente");
     await notificarAgente(from);
     await notificarAtencion("❓ Consulta sin respuesta de +" + from + ". Revisar en Wati.");
   }

   await enviarMensaje(from, reply);

 } catch (err) {
   console.error("Error: " + err.message);
 }
});

app.get("/", function(req, res) {
 res.send("ClubIA 🦝 activo con Playtomic scraping mejorado");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
 console.log("ClubIA en puerto " + PORT);
});

// =====================================================
//  LÓGICA DEL JUEGO  (usa las funciones de cerebro.js)
// =====================================================

// Reglas generales: cuántos mensajes se pueden enviar y cuánta confianza se necesita para ganar
const MAX_TURNOS = 10;
const META = 100;

// Palabra secreta que da +50 de confianza. Va en minúscula y sin tildes
// porque normalizar() deja así lo que escribe el jugador antes de compararlo
const PALABRA_MAGICA = "vitalidad";

// Estado del juego: la confianza arranca en 40 y los turnos van bajando
let confianza = 20;
let turnos = MAX_TURNOS;
let terminado = false;

// Guarda los últimos mensajes de la charla para que la IA tenga contexto
const historial = [];

// Elementos de la página que el juego necesita modificar
const chat = document.getElementById("chat");
const formulario = document.getElementById("formulario");
const entrada = document.getElementById("entrada");
const fantasma = document.getElementById("fantasma");
const barra = document.getElementById("confianza");
const estado = document.getElementById("estado");
const marcadorTurnos = document.getElementById("turnos");

// Después de cada turno revisa si el juego terminó: gana si llega a la meta,
// pierde si la confianza llega a 0 o se acaban los turnos. Si no, vuelve a habilitar el formulario
function revisarFinal() {
  if (confianza >= META) terminar(true);
  else if (confianza <= 0 || turnos === 0) terminar(false);
  else {
    entrada.disabled = false;
    formulario.querySelector("button").disabled = false;
    entrada.focus();
  }
}

// Crea una burbuja de chat con el mensaje. Si habla Arturo, además lo lee en voz alta
// con el texto a voz del navegador
function agregarMensaje(texto, clase) {
  const div = document.createElement("div");
  div.className = "msg " + clase;
  div.textContent = texto;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;   // baja el chat hasta el último mensaje

  if (clase === "fantasma-msg") {
    const voz = new SpeechSynthesisUtterance(texto);
    voz.lang = "es-ES";
    voz.pitch = 0.6;     // tono grave, para que suene a fantasma
    voz.rate = 0.85;     // velocidad un poco lenta
    speechSynthesis.cancel();   // corta la voz anterior para que no se acumulen
    speechSynthesis.speak(voz);
  }
}


// =====================================================
//  SONIDO DE GANAR O PERDER
// =====================================================

// Genera una melodía corta con el navegador, sin archivos de audio.
// Si ganas las notas suben, y si pierdes bajan
function sonido(gano) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const notas = gano ? [523, 659, 784, 1047] : [392, 330, 262, 196];
  notas.forEach((frecuencia, i) => {
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.frequency.value = frecuencia;
    osc.type = gano ? "triangle" : "sawtooth";   // sonido suave al ganar, áspero al perder
    vol.gain.value = 0.15;
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.start(ctx.currentTime + i * 0.2);        // cada nota empieza 0.2 segundos después de la anterior
    osc.stop(ctx.currentTime + i * 0.2 + 0.18);
  });
}

// Actualiza la barra de confianza, su color, los textos y la cara de Arturo
// según cuánta confianza tiene
function actualizarPantalla() {
  confianza = Math.max(0, Math.min(META, confianza));   // la confianza siempre queda entre 0 y 100
  barra.style.width = confianza + "%";
  // Color de la barra según el nivel: rojo intenso si es bajo, azul eléctrico si es medio y cian neón si es alto
  barra.style.background = confianza < 25 ? "#ff1744" : confianza < 60 ? "#00b0ff" : "#00f5ff";
  estado.textContent = `Confianza: ${confianza} / ${META}`;
  marcadorTurnos.textContent = `Turnos restantes: ${turnos}`;

  // Con confianza alta Arturo se ve contento, con confianza baja se ve furioso
  fantasma.className = "fantasma";
  if (confianza >= 60) { fantasma.textContent = "😇"; fantasma.classList.add("feliz"); }
  else if (confianza < 25) { fantasma.textContent = "👹"; fantasma.classList.add("enojado"); }
  else { fantasma.textContent = "👻"; }
}

// Cierra la partida: reproduce el sonido, bloquea el formulario y muestra el mensaje final
function terminar(gano) {
  terminado = true;
  sonido(gano);
  entrada.disabled = true;
  formulario.querySelector("button").disabled = true;

  if (gano) {
    agregarMensaje("🗝️ Arturo te entrega la llave: «Hacía siglos que nadie me trataba así». ¡GANASTE!", "fantasma-msg");
  } else {
    agregarMensaje("💀 Arturo se desvaneció furioso y la llave se perdió en la oscuridad. GAME OVER.", "fantasma-msg");
  }
}

// Ciclo principal: se ejecuta cada vez que el jugador envía un mensaje
formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();   // evita que la página se recargue al enviar
  if (terminado) return;

  // Lee el mensaje y lo muestra en el chat. Si está vacío, no hace nada
  const texto = entrada.value.trim();
  if (!texto) return;
  entrada.value = "";
  agregarMensaje(texto, "jugador");

  // 1) Mientras la IA piensa se bloquea el formulario, para que no se envíen dos mensajes a la vez
  entrada.disabled = true;
  formulario.querySelector("button").disabled = true;

  // Palabra mágica: si el mensaje la contiene, suma 50 de confianza y se salta la IA
  if (normalizar(texto).split(/\s+/).includes(PALABRA_MAGICA)) {
    confianza += 50;
    turnos--;
    agregarMensaje("...¿Cómo conoces esa palabra? Hacía siglos que nadie la pronunciaba... ✨", "fantasma-msg");
    actualizarPantalla();
    revisarFinal();
    return;
  }

  // 2) Se le pide a la IA en la nube el puntaje y la respuesta.
  // Si falla (devuelve null), se usa el diccionario como plan B
  const ia = await consultarFantasmaIA(texto, historial);
  const intencion = detectarIntencion(texto);
  let sentimiento, cambio, respuesta;

  if (ia && ia.sentimiento !== null) {
    sentimiento = ia.sentimiento;            // la IA da un puntaje de -10 a 10
    cambio = sentimiento * 2.5;
    respuesta = ia.respuesta;
  } else if (ia) {                           // la IA respondió pero sin puntaje: lo calcula el diccionario
    sentimiento = analizarSentimiento(texto);
    cambio = sentimiento * 6;
    respuesta = ia.respuesta;
  } else {                                   // la IA falló: todo lo resuelve el diccionario
    sentimiento = analizarSentimiento(texto);
    cambio = sentimiento * 6;
  }

  // 3) El sentimiento sube o baja la confianza, con un máximo de ±25 por mensaje
  confianza += Math.round(Math.max(-25, Math.min(25, cambio)));
  turnos--;

  // 4) Arturo responde. Con la IA usa su respuesta; con el diccionario elige una respuesta
  // de RESPUESTAS según la intención y su humor (bien si fuiste amable y tiene confianza, mal si no)
  if (!ia) {
    const humor = sentimiento >= 0 && confianza >= 25 ? "bien" : "mal";
    respuesta = RESPUESTAS[intencion][humor];
  }
  agregarMensaje(respuesta, "fantasma-msg");
  historial.push({ role: "user", content: texto }, { role: "assistant", content: respuesta });

  actualizarPantalla();

  // 5) Se revisa si ganaste, perdiste o sigue el juego
  revisarFinal();
});

// Al cargar la página se dibuja el estado inicial y Arturo da la bienvenida
actualizarPantalla();
agregarMensaje("Una figura pálida flota frente a la puerta del castillo. Susurra: «¿Quién osa perturbar mi descanso?»", "fantasma-msg");
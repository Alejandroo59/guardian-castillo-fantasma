// ============================ LÉXICO ============================ 

const LEXICO = {
  // positivas
  gracias: 1, hermoso: 3, genial: 2, poderoso: 3, amigo: 6, admiro: 3, valiente: 2, lindo: 2, bello: 2, fabuloso: 3, magnifico: 4, estupendo: 3, capaz: 2, fuerte: 3, guapo: 2, quiero: 1, adoro: 2, inteligente: 2, autentico: 3, increible: 3, asombroso: 3, inigualable: 4, unico: 4, maravilloso: 3, audaz: 3,
  // negativas
  feo: -3, tonto: -3, idiota: -4, odio: -4, cobarde: -3, basura: -4, bobo: -3, apagado: -4, inutil: -5, inservible: -6, estupido: -5, malo: -2, descolorido: -3, imbecil: -3, absurdo: -2, aburrido: -2, incapaz: -4, irreal: -5, maldito: -3, cruel: -2, malvado: -3, escoria: -2, bruto: -3, debil: -3, diminuto: -4
};


function normalizar(texto) {
  return texto
    .toLowerCase()                                      // todo a minúscula
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // quita tildes
    .replace(/[^a-zñ\s]/g, " ")                         // quita signos
    .trim();
}


// ============================ NEGADORES ============================ 

const NEGADORES = ["no", "nunca", "jamas", "tampoco"];


function analizarSentimiento(texto) {
  const palabras = normalizar(texto).split(/\s+/);   // separa en palabras
  let puntaje = 0;

  palabras.forEach((palabra, i) => {
    let valor = LEXICO[palabra] || 0;                // puntaje de la palabra (0 si no existe)

    // "no eres feo": la negación invierte el valor
    if (valor !== 0 && (NEGADORES.includes(palabras[i - 1]) || NEGADORES.includes(palabras[i - 2]))) {
      valor = -valor;
    }
    puntaje += valor;
  });

  if (texto.includes("!") && puntaje < 0) puntaje -= 1;   // gritar empeora el insulto
  return puntaje;
}


// ============================ INTENCIONES ============================ 

const INTENCIONES = [
  { nombre: "saludo",       claves: ["hola", "buenas", "saludos", "hey"] },
  { nombre: "llave",        claves: ["llave", "puerta", "abrir", "tesoro"] },
  { nombre: "nombre",       claves: ["nombre", "llamas", "quien"] },
  { nombre: "chiste",       claves: ["chiste", "gracioso", "risa", "broma"] },
  { nombre: "comida",       claves: ["comida", "hambre", "comer", "pescado"] },
  { nombre: "asustar",      claves: ["susto", "tenebroso", "miedo", "terror"] },
  { nombre: "recordar",     claves: ["recuerdas", "pasada", "humano", "cuerpo"] },
  { nombre: "despedida",    claves: ["adios", "chao", "bye", "hasta"] }
];


function detectarIntencion(texto) {
  const palabras = normalizar(texto).split(/\s+/);
  for (const intencion of INTENCIONES) {
    if (intencion.claves.some(c => palabras.includes(c))) return intencion.nombre;
  }
  return "desconocida";          // si no entendió nada
}


// ============================ RESPUESTAS ============================ 

const RESPUESTAS = {
  saludo: {
    bien: "¡Saludos, humano!, llevo en este castillo hace siglos, desde que morí.",
    mal:  "Ya no me duele caminar, pero, ¿por qué me molestaría en hacerlo igualmente?"
  },
  llave: {
    bien: "¿Vienes por la llave? Admiro tu capacidad de venir a este lugar abandonado, pero no te la daré así sin más.",
    mal:  "Solo a mí me pertenece esa llave, no eres digno, consideraría irme si fuera tú."
  },
  nombre: {
    bien: "Mi nombre era Arturo, aunque aún me puedes llamar así. ¿Y tú?",
    mal:  "Mi nombre es 'te va a pasar algo muy malo si sigues aquí'."
  },
  chiste: {
    bien: "¿Sabes por qué nunca invito a nadie a mi castillo? Porque cada vez que digo «pasen», se me atraviesan las paredes! 💀",
    mal:  "¿Un chiste? soy un fantasma, debería darte miedo, no risa."
  },
  comida: {
    bien: "Me encantaba comer pescado, aunque tenía muchas escamas, era delicioso y único siempre que lo probaba :().",
    mal:  "Aunque no pueda comer ahora, me encantaría intentarlo contigo, que mala persona eres."
  },
  asustar: {
    bien: "Todavía tengo algunos trucos que suelen funcionar con los visitantes, ¿quieres que te muestre alguno? seré amable contigo, pues te ves agradable.",
    mal:  "¿Y todavía quieres que te asuste? No te quedarán ganas de pisar este castillo otra vez, tendrás pesadillas y no volverás a descansar luego de lo que te haga."
  },
  recordar: {
    bien: "Me encantaba mi vida, salía a pasear, a ver plantas, animales, era libre... Pero ahora estoy muerto y atado a esta prisión, vaya, que bonito era todo.",
    mal:  "¿Qué te interesa mi vida pasada? Apenas y tienes algo de decencia, mejor vive la tuya."
  },
  despedida: {
    bien: "Espero que vuelvas a visitarme, eres la única persona que me ha agradado y me ha hecho sentir bien, nadie quiere a un fantasma.",
    mal:  "¡No te quiero volver a ver en mi vida! O bueno, en mi muerte"
  },
  desconocida: {
    bien: "Quizás estoy muy viejo para entender lo que dicen los jóvenes de hoy en día, ¿quizás quieres utilizar otras palabras? Me caíste bien.",
    mal:  "Es irreal esta situación y no te estás portando bien, exprésate mejor... o vete."
  }
};

// Le pide la respuesta al SERVIDOR (nunca a NVIDIA directo, porque la clave es secreta).
// Si algo falla devuelve null y el juego usa el diccionario.
async function consultarFantasmaIA(texto, historial) {
  try {
    const respuesta = await fetch("/api/fantasma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje: texto, historial }),
      signal: AbortSignal.timeout(20000)
    });
    if (!respuesta.ok) return null;
    return await respuesta.json();     // { sentimiento: -10..10, respuesta: "..." }
  } catch (error) {
    return null;
  }
}
// ══════════════════════════════════════════════════════════════
// SEKAI — VILLAGGIO CENTRALE — Dati simulati
// 30 avatar + 10 luoghi. Tutto modulare ed espandibile.
// ══════════════════════════════════════════════════════════════

// ── LUOGHI DEL VILLAGGIO ──
// x,y in coordinate-mondo (0..WORLD_W, 0..WORLD_H). r = raggio d'interesse.
const VILLAGE_PLACES = [
  { id:'plaza',    name:'Piazza Centrale',          icon:'⛲', x:1500, y:1000, type:'social',  color:'#d9b06a',
    desc:'Il cuore del villaggio. Qui ci si incontra, ci si saluta, si resta.' },
  { id:'tree',     name:'Grande Albero dei Ricordi', icon:'🌳', x:850,  y:760,  type:'rest',    color:'#5a8a4a',
    desc:'Un albero antico. Si dice custodisca i ricordi di chi ha sostato sotto i suoi rami.' },
  { id:'library',  name:'Biblioteca delle Storie',   icon:'📚', x:2150, y:700,  type:'quiet',   color:'#9a6a3a',
    desc:'Migliaia di storie scritte dagli abitanti. Ognuno può aggiungerne una.' },
  { id:'cafe',     name:'Caffè delle Conversazioni', icon:'☕', x:1950, y:1320, type:'social',  color:'#b5703a',
    desc:'Profumo di tè e parole lente. Il posto delle conversazioni che contano.' },
  { id:'garden',   name:'Giardino della Serenità',   icon:'🌸', x:700,  y:1380, type:'quiet',   color:'#c77a8a',
    desc:'Petali nell\u2019aria e silenzio gentile. Un luogo per ritrovarsi.' },
  { id:'fountain', name:'Fontana Centrale',          icon:'💧', x:1500, y:1140, type:'rest',    color:'#5a9ac0',
    desc:'L\u2019acqua canta piano. Lanciare un pensiero qui, dicono, lo rende vero.' },
  { id:'forest',   name:'Sentiero per la Foresta',   icon:'🌲', x:380,  y:520,  type:'path',    color:'#3f7a3a',
    desc:'Il bosco chiama. Da qui parte il sentiero verso la Foresta dei Sogni.' },
  { id:'lake',     name:'Sentiero per il Lago',      icon:'🌙', x:380,  y:1700, type:'path',    color:'#4a6a9a',
    desc:'Oltre le colline, l\u2019acqua quieta del Lago della Luna.' },
  { id:'port',     name:'Porto delle Avventure',     icon:'\u26f5', x:2520, y:1500, type:'path', color:'#3a7a9a',
    desc:'Barche pronte a salpare. Ogni viaggio comincia da una partenza.' },
  { id:'events',   name:'Area Eventi',               icon:'🎪', x:2400, y:1080, type:'social',  color:'#a05ab0',
    desc:'Palchi e lanterne. Qui il villaggio si raduna per celebrare.' },
];

// ── BANCHE NOMI / PASSIONI / STORIE (per generare avatar vari) ──
const NAMES = [
  'Hikari','Sora','Ren','Yuki','Kaze','Nao','Aki','Mei','Tao','Lumi',
  'Iro','Nami','Riku','Hoshi','Kumo','Suzu','Haru','Tsuki','Kai','Mira',
  'Noa','Sena','Yumi','Ren\u014d','Aoi','Kira','Tama','Suki','Yori','Ame',
];

const PASSIONS_POOL = [
  'disegno','musica','astronomia','cucina','poesia','giardinaggio','fotografia',
  'lettura','origami','t\u00e8','viaggi','ceramica','danza','canto','scrittura',
  'osservare le nuvole','collezionare conchiglie','calligrafia','passeggiate notturne',
  'stelle cadenti','piante grasse','vecchie mappe','quaderni vuoti','pioggia',
];

const PETS = [
  {n:'gatto',e:'🐱'},{n:'volpe',e:'🦊'},{n:'civetta',e:'🦉'},{n:'coniglio',e:'🐰'},
  {n:'tartaruga',e:'🐢'},{n:'cerbiatto',e:'🦌'},{n:'pettirosso',e:'🐦'},{n:'riccio',e:'🦔'},
  {n:'gatto nero',e:'🐈\u200d\u2b1b'},{n:'rana',e:'🐸'},{n:'lucciola',e:'\u2728'},{n:'nessuno',e:'\ud83c\udf3f'},
];

const PHRASES_POOL = [
  'Le cose belle accadono piano.',
  'Mi piace il rumore della pioggia sui tetti.',
  'Ogni sconosciuto \u00e8 una storia non ancora letta.',
  'Cammino lenta, ma arrivo lontano.',
  'Cerco la bellezza nelle cose piccole.',
  'Il silenzio non \u00e8 vuoto, \u00e8 pieno di risposte.',
  'Colleziono tramonti.',
  'Sto imparando a non avere fretta.',
  'Le radici crescono al buio, poi fioriscono.',
  'Resto dove mi sento a casa.',
  'Un t\u00e8 caldo aggiusta quasi tutto.',
  'Mi perdo volentieri, \u00e8 cos\u00ec che trovo.',
  'Ho sempre un quaderno in tasca.',
  'Guardo le stelle e mi sento meno solo.',
  'La gentilezza \u00e8 la mia lingua madre.',
];

const STORIES_POOL = [
  'Arrivata al villaggio una mattina di nebbia, non se n\u2019\u00e8 pi\u00f9 andata.',
  'Costruisce piccole barche di carta e le lascia andare sulla fontana.',
  'Conosce il nome di ogni albero del sentiero per la foresta.',
  'Dicono abbia letto ogni storia della Biblioteca, due volte.',
  'Tiene un diario di tutte le persone che ha salutato.',
  'Ha attraversato il mare per arrivare qui, cercando un posto tranquillo.',
  'Suona una melodia diversa per ogni ora del giorno.',
  'Raccoglie foglie cadute e ne fa quadri.',
  'Aspetta qualcuno che forse non torner\u00e0, ma sorride lo stesso.',
  'Ha piantato il fiore pi\u00f9 raro del Giardino della Serenit\u00e0.',
  'Sa preparare il t\u00e8 perfetto per ogni stato d\u2019animo.',
  'Parla poco, ma quando lo fa tutti ascoltano.',
];

const AVATAR_COLORS = [
  {skin:'#f3cda0', hair:'#3a2a1a', cloth:'#3a6a8a'},
  {skin:'#e8b890', hair:'#5a3a2a', cloth:'#8a4a5a'},
  {skin:'#fdddb8', hair:'#1a1a2a', cloth:'#4a7a4a'},
  {skin:'#c89060', hair:'#2a2a3a', cloth:'#a05a3a'},
  {skin:'#f0c8a0', hair:'#7a4a2a', cloth:'#5a4a8a'},
  {skin:'#d8a878', hair:'#3a3a4a', cloth:'#3a8a7a'},
  {skin:'#fce0c0', hair:'#9a6a3a', cloth:'#b06a8a'},
  {skin:'#b08050', hair:'#1a1a1a', cloth:'#6a8a3a'},
  {skin:'#f5d0a8', hair:'#c89030', cloth:'#3a5a9a'},
  {skin:'#e0b088', hair:'#5a2a5a', cloth:'#9a8a3a'},
];

// ── GENERATORE AVATAR ──
function pickN(arr, n) {
  const copy = [...arr], out = [];
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}
function rint(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }

function generateAvatars(count) {
  const avatars = [];
  const usedNames = new Set();
  for (let i = 0; i < count; i++) {
    let name = NAMES[i % NAMES.length];
    if (usedNames.has(name)) name = name + ' ' + (rint(2, 99));
    usedNames.add(name);

    const pet = PETS[rint(0, PETS.length - 1)];
    const col = AVATAR_COLORS[rint(0, AVATAR_COLORS.length - 1)];

    avatars.push({
      id: 'npc_' + i,
      name,
      age: rint(16, 42),
      passions: pickN(PASSIONS_POOL, rint(2, 4)),
      story: STORIES_POOL[rint(0, STORIES_POOL.length - 1)],
      pet: pet.n, petEmoji: pet.e,
      phrase: PHRASES_POOL[rint(0, PHRASES_POOL.length - 1)],
      colors: col,
      // stato dinamico (riempito dal motore)
    });
  }
  return avatars;
}

// Esponi globalmente
window.VILLAGE_PLACES = VILLAGE_PLACES;
window.generateAvatars = generateAvatars;
window.VILLAGE_NAMES = NAMES;

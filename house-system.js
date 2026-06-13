// ══════════════════════════════════════════════════════════════
// SEKAI — SISTEMA CASA
// Ogni utente ha una casetta nel villaggio che cresce con lui.
// Non si compra nulla — si arricchisce vivendo Sekai.
// ══════════════════════════════════════════════════════════════
'use strict';

const HouseSystem = {

  // ── SCHEMA DEFAULT ──
  _default(userId, username) {
    return {
      userId,
      username,
      name: `Casa di ${username}`,
      founded_at: new Date().toISOString(),
      last_visit: new Date().toISOString(),
      visits: 1,
      streak: 1,
      // Ornamenti (0 = non ancora guadagnato)
      lanterns: 0,      // si accende ogni 3 ritorni consecutivi, max 3
      plants: 0,        // una pianta ogni 3 persone salutate, max 3
      books: 0,         // un libro ogni storia scritta, max 3
      paintings: 0,     // un quadro ogni passione condivisa, max 2
      flowers: false,   // fiori sul davanzale (streak 7+)
      chair: false,     // sedia in veranda (5 conversazioni)
      // Personalizzazione
      door_color: '#8a5a3a',
      roof_color: '#5a3a2a',
      wall_color: '#e8d8b8',
      // Messaggi lasciati sulla porta (max 5)
      door_messages: [],
      // Statistiche
      greetings: 0,     // persone salutate
      conversations: 0, // conversazioni avviate
      stories: 0,       // pensieri scritti
      passions_shared: 0,
    };
  },

  // ── CARICA / CREA ──
  load(userId, username) {
    const key = `sekai_house_${userId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const h = JSON.parse(raw);
        // Aggiorna streak e visita
        this._updateVisit(h);
        this.save(h);
        return h;
      } catch(e) {}
    }
    // Prima visita — crea casa
    const h = this._default(userId, username);
    this.save(h);
    return h;
  },

  save(house) {
    localStorage.setItem(`sekai_house_${house.userId}`, JSON.stringify(house));
  },

  // ── AGGIORNA VISITA / STREAK ──
  _updateVisit(h) {
    const now = new Date();
    const last = new Date(h.last_visit);
    const diffDays = Math.floor((now - last) / 86400000);
    h.visits++;
    h.last_visit = now.toISOString();
    if (diffDays <= 1) {
      h.streak++;
    } else {
      h.streak = 1;
    }
    // Aggiorna ornamenti in base allo streak
    this._recalcOrnaments(h);
  },

  // ── RICALCOLA ORNAMENTI ──
  _recalcOrnaments(h) {
    h.lanterns  = Math.min(3, Math.floor(h.streak / 3));
    h.plants    = Math.min(3, Math.floor(h.greetings / 3));
    h.books     = Math.min(3, Math.floor(h.stories / 1));
    h.paintings = Math.min(2, Math.floor(h.passions_shared / 2));
    h.flowers   = h.streak >= 7;
    h.chair     = h.conversations >= 5;
  },

  // ── LIVELLO CASA (1-5) ──
  level(h) {
    const score = h.lanterns + h.plants + h.books + h.paintings
                + (h.flowers?2:0) + (h.chair?1:0);
    if (score >= 12) return 5;
    if (score >= 7)  return 4;
    if (score >= 4)  return 3;
    if (score >= 1)  return 2;
    return 1;
  },

  // ── PROSSIMO TRAGUARDO ──
  nextMilestone(h) {
    if (!h.flowers && h.streak < 7)
      return `Torna ancora ${7 - h.streak} ${7-h.streak===1?'giorno':'giorni'} di fila → fiori sul davanzale 🌸`;
    if (h.plants < 3 && h.greetings < 9)
      return `Saluta ancora ${3 - (h.greetings%3)} persone → nuova pianta 🌿`;
    if (h.books < 3 && h.stories < 3)
      return `Scrivi ${3 - h.stories} pensier${3-h.stories===1?'o':'i'} in Biblioteca → libro sul tavolo 📖`;
    if (!h.chair && h.conversations < 5)
      return `Conversa ancora con ${5 - h.conversations} persone → sedia in veranda 🪑`;
    if (h.paintings < 2)
      return `Condividi ancora ${4 - h.passions_shared*2} passioni → quadro sul muro 🖼️`;
    return 'La tua casa è piena di vita. ✦';
  },

  // ── AZIONI CHE ARRICCHISCONO LA CASA ──
  onGreeting(h) {
    h.greetings++;
    this._recalcOrnaments(h);
    this.save(h);
    return h.greetings % 3 === 0 ? `Nuova pianta in casa! 🌿 (${h.plants}/3)` : null;
  },

  onConversation(h) {
    h.conversations++;
    this._recalcOrnaments(h);
    this.save(h);
    return h.chair && h.conversations === 5 ? 'Una sedia è apparsa sulla tua veranda! 🪑' : null;
  },

  onStory(h) {
    h.stories++;
    this._recalcOrnaments(h);
    this.save(h);
    return h.stories <= 3 ? `Un libro è apparso in casa! 📖 (${h.books}/3)` : null;
  },

  onPassionShared(h) {
    h.passions_shared++;
    this._recalcOrnaments(h);
    this.save(h);
    return h.paintings > 0 && h.passions_shared % 2 === 0
      ? `Un nuovo quadro sul muro! 🖼️ (${h.paintings}/2)` : null;
  },

  // ── LASCIA MESSAGGIO SULLA PORTA ──
  leaveMessage(h, authorName, text) {
    if (!text || text.length > 120) return false;
    h.door_messages = h.door_messages || [];
    h.door_messages.unshift({
      author: authorName,
      text: text.slice(0, 120),
      at: new Date().toISOString(),
    });
    h.door_messages = h.door_messages.slice(0, 5); // max 5
    this.save(h);
    return true;
  },

  // ── DESCRIZIONE LIVELLO ──
  levelLabel(lvl) {
    return ['','Casetta appena arrivata','Casa con qualche luce','Casa con giardino',
            'Casa con veranda','Casa piena di vita'][lvl] || '';
  },

  // ── STATS LEGGIBILI ──
  stats(h) {
    return {
      level:         this.level(h),
      levelLabel:    this.levelLabel(this.level(h)),
      streak:        h.streak,
      visits:        h.visits,
      founded:       new Date(h.founded_at).toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'}),
      ornaments: {
        lanterns:  `${h.lanterns}/3`,
        plants:    `${h.plants}/3`,
        books:     `${h.books}/3`,
        paintings: `${h.paintings}/2`,
        flowers:   h.flowers,
        chair:     h.chair,
      },
      next: this.nextMilestone(h),
    };
  },
};

// Esponi globalmente
window.HouseSystem = HouseSystem;

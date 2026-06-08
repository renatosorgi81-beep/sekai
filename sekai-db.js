// ══════════════════════════════════════════════
// SEKAI — Database Layer (Supabase)
// Includi questo file in demo.html e avatar-builder.html
// ══════════════════════════════════════════════

const SUPABASE_URL  = 'https://oegkgicuigpcwoneradf.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lZ2tnaWN1aWdwY3dvbmVyYWRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NjQ3OTQsImV4cCI6MjA5NjQ0MDc5NH0.rRaCqvdX5lmgEgZDjGutZHvnO2Bwy_vp5c-URZANyAE';

// ── CHIAMATA API BASE ──
async function sbFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': options.prefer || 'return=representation',
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error: ${res.status} ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ══ UTENTI ═════════════════════════════════════

const SekaiDB = {

  // ── Registrazione ──
  async register(email, password, username, birthDate) {
    // 1. Verifica email non esistente
    const existing = await sbFetch(`users?email=eq.${encodeURIComponent(email)}&select=id`);
    if (existing && existing.length > 0) throw new Error('Email già registrata.');

    // 2. Verifica username non esistente
    const existingUser = await sbFetch(`users?username=eq.${encodeURIComponent(username)}&select=id`);
    if (existingUser && existingUser.length > 0) throw new Error('Nome utente già in uso.');

    // 3. Crea utente (password hashata lato client con SHA-256 semplice)
    const pwHash = await hashPassword(password);
    const users = await sbFetch('users', {
      method: 'POST',
      body: JSON.stringify({
        email,
        username,
        birth_date: birthDate,
        password_hash: pwHash,
        paid: false,
        has_avatar: false,
      }),
    });
    return users[0];
  },

  // ── Login ──
  async login(email, password) {
    const pwHash = await hashPassword(password);

    // Account demo speciale
    if (email === 'renatosorgi81@gmail.com' && password === 'tecno5181') {
      const users = await sbFetch(`users?email=eq.${encodeURIComponent(email)}&select=*`);
      if (!users || users.length === 0) throw new Error('Account demo non trovato. Esegui prima il setup SQL.');
      const user = users[0];
      // Carica avatar se esiste
      user.avatar = await SekaiDB.getAvatar(user.id);
      await SekaiDB.updateLastSeen(user.id);
      return user;
    }

    const users = await sbFetch(
      `users?email=eq.${encodeURIComponent(email)}&password_hash=eq.${encodeURIComponent(pwHash)}&select=*`
    );
    if (!users || users.length === 0) throw new Error('Email o password errati.');
    const user = users[0];
    user.avatar = await SekaiDB.getAvatar(user.id);
    await SekaiDB.updateLastSeen(user.id);
    return user;
  },

  // ── Aggiorna ultimo accesso ──
  async updateLastSeen(userId) {
    await sbFetch(`users?id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ last_seen: new Date().toISOString() }),
      prefer: 'return=minimal',
    });
  },

  // ── Segna come pagante ──
  async setPaid(userId) {
    await sbFetch(`users?id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ paid: true, paid_at: new Date().toISOString() }),
      prefer: 'return=minimal',
    });
  },

  // ══ AVATAR ═══════════════════════════════════

  // ── Salva avatar ──
  async saveAvatar(userId, avatarData) {
    const payload = {
      user_id: userId,
      name: avatarData.name,
      gender: avatarData.gender,
      face: avatarData.face,
      hair: avatarData.hair,
      hair_color: avatarData.hairColor,
      eyes: avatarData.eyes,
      eye_color: avatarData.eyeColor,
      brows: avatarData.brows,
      nose: avatarData.nose,
      mouth: avatarData.mouth,
      skin: avatarData.skin,
      cloth: avatarData.cloth,
      cloth_color: avatarData.clothColor,
      accessory: avatarData.accessory,
      svg_string: avatarData.svgString || '',
      personality: avatarData.personality || [],
      passions: avatarData.passions || [],
      values: avatarData.values || [],
      life_phase: avatarData.lifePhase || '',
      social_style: avatarData.socialStyle || '',
      gift: avatarData.gift || '',
      silence_mode: avatarData.silenceMode || '',
      favorite_area: avatarData.favoriteArea || '',
      love_text: avatarData.loveText || '',
      learning_text: avatarData.learningText || '',
      understand_text: avatarData.understandText || '',
      dream_text: avatarData.dreamText || '',
      strength_text: avatarData.strengthText || '',
      avatar_code: avatarData.code || '',
      updated_at: new Date().toISOString(),
    };

    // Upsert — crea o aggiorna
    const result = await sbFetch('avatars', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(payload),
    });

    // Aggiorna flag has_avatar sull'utente
    await sbFetch(`users?id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ has_avatar: true }),
      prefer: 'return=minimal',
    });

    return result;
  },

  // ── Carica avatar ──
  async getAvatar(userId) {
    const data = await sbFetch(`avatars?user_id=eq.${userId}&select=*`);
    if (!data || data.length === 0) return null;
    const av = data[0];
    // Rimappa i campi snake_case → camelCase per il frontend
    return {
      name: av.name,
      gender: av.gender,
      face: av.face,
      hair: av.hair,
      hairColor: av.hair_color,
      eyes: av.eyes,
      eyeColor: av.eye_color,
      brows: av.brows,
      nose: av.nose,
      mouth: av.mouth,
      skin: av.skin,
      cloth: av.cloth,
      clothColor: av.cloth_color,
      accessory: av.accessory,
      svgString: av.svg_string,
      personality: av.personality || [],
      passions: av.passions || [],
      values: av.values || [],
      lifePhase: av.life_phase,
      socialStyle: av.social_style,
      gift: av.gift,
      silenceMode: av.silence_mode,
      favoriteArea: av.favorite_area,
      loveText: av.love_text,
      learningText: av.learning_text,
      understandText: av.understand_text,
      dreamText: av.dream_text,
      strengthText: av.strength_text,
      code: av.avatar_code,
      lastAppearanceChange: av.last_appearance_change,
      sekaiJoinedAt: av.created_at,  // data primo ingresso in Sekai
    };
  },

  // ── Verifica se può cambiare aspetto (ogni 30 giorni) ──
  canChangeAppearance(avatar) {
    if (!avatar?.lastAppearanceChange) return true;
    const last = new Date(avatar.lastAppearanceChange);
    const now = new Date();
    const diffDays = (now - last) / (1000 * 60 * 60 * 24);
    return diffDays >= 30;
  },

  daysUntilAppearanceChange(avatar) {
    if (!avatar?.lastAppearanceChange) return 0;
    const last = new Date(avatar.lastAppearanceChange);
    const now = new Date();
    const diffDays = (now - last) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.ceil(30 - diffDays));
  },

  // ══ SEGNALAZIONI ══════════════════════════════

  async sendReport(reporterId, reportedUserId, contentType, contentText, reason) {
    return await sbFetch('reports', {
      method: 'POST',
      body: JSON.stringify({
        reporter_id: reporterId,
        reported_user_id: reportedUserId,
        content_type: contentType,
        content_text: contentText,
        reason,
        status: 'pending',
      }),
    });
  },

  // ══ ADMIN ═════════════════════════════════════

  async getReports(status = 'pending') {
    return await sbFetch(`reports?status=eq.${status}&select=*&order=created_at.desc`);
  },

  async updateReport(reportId, status, adminNote) {
    return await sbFetch(`reports?id=eq.${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, admin_note: adminNote }),
    });
  },

  async banUser(userId) {
    return await sbFetch(`users?id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ banned: true, banned_at: new Date().toISOString() }),
    });
  },

  // ══ SESSIONE LOCALE ════════════════════════════

  saveSession(user) {
    const session = {
      id: user.id,
      email: user.email,
      username: user.username,
      paid: user.paid,
      has_avatar: user.has_avatar,
      avatar: user.avatar || null,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem('sekai_session_v2', JSON.stringify(session));
    return session;
  },

  loadSession() {
    const raw = localStorage.getItem('sekai_session_v2');
    if (!raw) return null;
    try {
      const s = JSON.parse(raw);
      // Sessione valida per 7 giorni
      const age = (new Date() - new Date(s.savedAt)) / (1000 * 60 * 60 * 24);
      if (age > 7) { localStorage.removeItem('sekai_session_v2'); return null; }
      return s;
    } catch(e) { return null; }
  },

  clearSession() {
    localStorage.removeItem('sekai_session_v2');
  },
};

// ── HASH PASSWORD (SHA-256 browser) ──
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'sekai_salt_2025');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

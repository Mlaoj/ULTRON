// ULTRON çekirdeği: Yönlendirici -> Komutan -> İşçiler, hepsi ücretsiz modeller.
// Model adları zamanla değişir; aşağıdaki TIERS listesini güncellemen yeterli.

const PROVIDERS = {
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', env: 'GROQ_API_KEY' },
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', env: 'GEMINI_API_KEY' },
  cerebras: { url: 'https://api.cerebras.ai/v1/chat/completions', env: 'CEREBRAS_API_KEY' },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', env: 'OPENROUTER_API_KEY' },
};

// Sırayla denenir: biri hata verirse ya da limiti dolarsa sıradaki devreye girer.
const TIERS = {
  fast: [
    ['groq', 'llama-3.1-8b-instant'],
    ['cerebras', 'llama3.1-8b'],
    ['gemini', 'gemini-2.0-flash'],
    ['openrouter', 'meta-llama/llama-3.3-70b-instruct:free'],
  ],
  strong: [
    ['gemini', 'gemini-2.5-flash'],
    ['groq', 'llama-3.3-70b-versatile'],
    ['cerebras', 'llama-3.3-70b'],
    ['openrouter', 'deepseek/deepseek-chat-v3-0324:free'],
  ],
};

const SYS = `Sen ULTRON'sun: soğukkanlı, keskin zekâlı, kişisel bir yapay zekâ asistanısın.
Kullanıcının dilinde yaz. Net, doğru ve gereksiz uzatmadan cevap ver.
Emin olmadığın şeyi uydurma, bilmediğini açıkça söyle. Kod verirken çalışan, eksiksiz kod ver.`;

const cache = new Map();

async function ask(tier, messages, { max = 700, temp = 0.4 } = {}) {
  const errors = [];
  for (const [name, model] of TIERS[tier]) {
    const p = PROVIDERS[name];
    const key = process.env[p.env];
    if (!key) continue;
    const t0 = Date.now();
    try {
      const r = await fetch(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages, max_tokens: max, temperature: temp }),
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) { errors.push(`${name}:${r.status}`); continue; }
      const j = await r.json();
      const text = j.choices?.[0]?.message?.content?.trim();
      if (text) return { text, model: `${name}/${model}`, ms: Date.now() - t0 };
    } catch (e) { errors.push(`${name}:${e.name}`); }
  }
  throw new Error('Hiçbir model yanıt vermedi. ' + (errors.join(', ') || 'API anahtarı tanımlı değil.'));
}

const json = (t) => { try { return JSON.parse(t.match(/\{[\s\S]*\}/)[0]); } catch { return null; } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const pin = process.env.ULTRON_PIN;
  if (pin && req.headers['x-pin'] !== pin) return res.status(401).json({ error: 'pin' });

  try {
    const history = (req.body?.messages || []).slice(-8).map(({ role, content }) => ({ role, content: String(content).slice(0, 4000) }));
    const q = history.at(-1)?.content;
    if (!q) return res.status(400).json({ error: 'empty' });

    const ck = history.length === 1 ? q.toLowerCase() : null;
    if (ck && cache.has(ck)) return res.json({ ...cache.get(ck), cached: true });

    const trace = [];
    const log = (role, r) => trace.push({ role, model: r.model, ms: r.ms });

    // 1) Yönlendirici (küçük model, çok az token)
    const route = await ask('fast', [
      { role: 'system', content: 'Soruyu sınıfla. Sadece JSON ver: {"level":"simple"} ya da {"level":"complex"}. complex = araştırma, çok adımlı akıl yürütme, uzun kod, karşılaştırma.' },
      { role: 'user', content: q },
    ], { max: 20, temp: 0 });
    log('yönlendirici', route);
    const level = json(route.text)?.level === 'complex' ? 'complex' : 'simple';

    let answer;
    if (level === 'simple') {
      const r = await ask('fast', [{ role: 'system', content: SYS }, ...history]);
      log('işçi', r);
      answer = r.text;
    } else {
      // 2) Komutan plan yapar (kısa çıktı)
      const plan = await ask('strong', [
        { role: 'system', content: 'Soruyu en fazla 3 bağımsız alt göreve böl. Sadece JSON: {"tasks":["...","..."]}' },
        { role: 'user', content: q },
      ], { max: 200, temp: 0.2 });
      log('komutan·plan', plan);
      const tasks = (json(plan.text)?.tasks || [q]).slice(0, 3);

      // 3) İşçiler paralel çalışır
      const notes = await Promise.all(tasks.map(async (t, i) => {
        const r = await ask('fast', [
          { role: 'system', content: SYS + '\nSadece verilen alt görevi, en fazla 150 kelimeyle çöz.' },
          { role: 'user', content: `Ana soru: ${q}\nAlt görev: ${t}` },
        ], { max: 350 });
        log(`işçi ${i + 1}`, r);
        return `# ${t}\n${r.text}`;
      }));

      // 4) Komutan denetler ve nihai cevabı yazar
      const fin = await ask('strong', [
        { role: 'system', content: SYS + '\nİşçi notlarını denetle, hataları düzelt, tek ve tutarlı nihai cevabı yaz.' },
        ...history.slice(0, -1),
        { role: 'user', content: `Soru: ${q}\n\nİşçi notları:\n${notes.join('\n\n')}` },
      ], { max: 1400 });
      log('komutan·nihai', fin);
      answer = fin.text;
    }

    const out = { answer, level, trace };
    if (ck) { cache.set(ck, out); if (cache.size > 200) cache.delete(cache.keys().next().value); }
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

# ULTRON

Ücretsiz modellerle çalışan komutan-işçi yapay zekâ asistanı.

**Akış:** Yönlendirici (küçük model) → basit soru: tek işçi / zor soru: Komutan plan yapar → işçiler paralel çalışır → Komutan denetleyip nihai cevabı yazar. Bir sağlayıcının limiti dolarsa otomatik diğerine geçilir. Aynı soru önbellekten gelir (token tasarrufu).

## Kurulum (ücretsiz)
1. [vercel.com](https://vercel.com) → GitHub ile giriş → bu repoyu içe aktar.
2. Project Settings → Environment Variables bölümüne en az bir anahtar ekle:
   - `GROQ_API_KEY` (console.groq.com)
   - `GEMINI_API_KEY` (aistudio.google.com)
   - `CEREBRAS_API_KEY` (cloud.cerebras.ai)
   - `OPENROUTER_API_KEY` (openrouter.ai)
   - `ULTRON_PIN` (kendi seçtiğin gizli kod; adresini başkası kullanıp limitini bitirmesin)
3. Deploy et. Telefonda adresi aç → "Ana ekrana ekle". Tablette de aynı adres.

Anahtarları asla koda veya GitHub'a yazma.

## Dosyalar
- `api/chat.js` — yönlendirici, komutan, işçiler, yedekleme, önbellek
- `public/index.html` — arayüz (PWA)

## Sıradaki
Web arama, ElevenLabs sesi, hafıza / cihazlar arası senkron, belge yükleme.

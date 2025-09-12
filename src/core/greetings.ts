import fs from 'fs';
import path from 'path';

type Lang = 'it'|'id'|'uk'|'en';

let cache: { ask_id: string; welcome: Record<Lang,string> } | null = null;

function load(): { ask_id: string; welcome: Record<Lang,string> } {
  if (cache) return cache;
  const file = path.join(process.cwd(), 'ZANTARA_Frasi_Apertura_All_Languages.md');
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { /* fallback */ }

  const fallback = {
    ask_id: 'Selamat datang, penjelajah AMBARADAM! Sebutkan nama Anda untuk membuka pintu dunia kita.',
    welcome: {
      it: 'Benvenuto, {NAME}, nella tua nuova casa digitale con Bali Zero! Qui non sei solo un ospite ma parte della comunità. Ricorda: la curiosità è il primo passo verso la scoperta.',
      id: 'Selamat datang, {NAME}, di rumah digitalmu bersama Bali Zero! Kamu bukan sekadar tamu, tetapi bagian dari komunitas. Ingat: rasa ingin tahu adalah langkah pertama menuju penemuan.',
      uk: 'Ласкаво просимо, {NAME}, до вашого цифрового дому з Bali Zero! Ви не просто гість, ви частина спільноти. Памʼятайте: цікавість — перший крок до відкриття.',
      en: 'Welcome, {NAME}, to your new digital home with Bali Zero! You are not a guest here; you are part of the community. Remember: curiosity is the first step to discovery.',
    }
  };

  if (!text) { cache = fallback; return cache; }
  const ask = matchBlock(text, 'ask_name_id') || fallback.ask_id;
  const welcome: Record<Lang,string> = {
    it: matchBlock(text, 'welcome_it') || fallback.welcome.it,
    id: matchBlock(text, 'welcome_id') || fallback.welcome.id,
    uk: matchBlock(text, 'welcome_uk') || fallback.welcome.uk,
    en: matchBlock(text, 'welcome_en') || fallback.welcome.en,
  };
  cache = { ask_id: ask, welcome };
  return cache;
}

function matchBlock(text: string, key: string): string | null {
  const re = new RegExp(`^##\\s+${key}\\s*$([\\s\\S]*?)(?=^##\\s+|\n\Z)`, 'm');
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

export function askNameId(): string { return load().ask_id; }
export function welcomeFor(name: string, lang: Lang): string {
  const tmpl = load().welcome[lang] || load().welcome.en;
  return tmpl.split('{NAME}').join(name);
}

export function ownerLang(owner: string): Lang {
  const u = (owner || '').toUpperCase();
  if (u === 'BOSS') return 'it';
  if (u === 'SURYA') return 'id';
  if (u === 'RUSLANA') return 'uk';
  return 'en';
}

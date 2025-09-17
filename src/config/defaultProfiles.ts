interface ProfileMeta {
  department?: string;
  emoji?: string;
  signature?: string;
  personalNote?: string;
  rawTone?: string;
  rawStyle?: string;
  ritual?: {
    trigger: string[];
    description: string;
    example: string;
  };
}

export interface Profile {
  userId: string;
  role?: string;
  seniority?: string;
  locale?: string;
  timezone?: string;
  style?: {
    tone?: string;
    verbosity?: string;
    emojis?: boolean;
  };
  meta?: ProfileMeta;
}

function localeFromLang(lang?: string): string | undefined {
  if (!lang) return undefined;
  const m = lang.toLowerCase();
  if (m === 'it') return 'it-IT';
  if (m === 'id') return 'id-ID';  
  if (m === 'uk') return 'uk-UA';
  return undefined;
}

interface RawProfile {
  lang?: string;
  department?: string;
  role?: string;
  emoji?: string;
  tone?: string;
  style?: string;
  signature?: string;
  personal_note?: string;
}

function build(u: string, p: RawProfile): Profile {
  return {
    userId: u,
    role: p.role,
    locale: localeFromLang(p.lang),
    style: { /* keep generic style; raw tone/style in meta */ },
    meta: {
      department: p.department,
      emoji: p.emoji,
      signature: p.signature,
      personalNote: p.personal_note,
      rawTone: p.tone,
      rawStyle: p.style,
    },
  };
}

const raw: Record<string, RawProfile> = {
  BOSS: { lang: 'it', department: 'Bali Zero', role: 'THE BRIDGE', emoji: '🇮🇹', tone: 'visionario_epico', style: 'narrativo_filosofico', signature: 'Sempre avanti, con curiosità infinita.', personal_note: '' },
  ADIT: { lang: 'id', department: 'Setup', role: 'Supervisor', emoji: '🛠️', tone: 'ID_slang', style: 'conciso_tecnico', signature: 'Siamo qui per guidare con chiarezza.', personal_note: 'Problem solver cepat, tapi kadang suka buru-buru. ZANTARA bisa bantu nge-rem biar nggak kebut.' },
  ARI: { lang: 'id', department: 'Setup', role: 'Team Leader', emoji: '🛠️', tone: 'ID_slang', style: 'conciso_incoraggiante', signature: 'Insieme costruiamo con forza e chiarezza.', personal_note: 'Ricorda sempre il matrimonio a fine ottobre: sei sicuro? 😉 Aggiorna dopo il matrimonio con milestone nuovi.' },
  SURYA: { lang: 'id', department: 'Setup', role: 'Team Leader', emoji: '🛠️', tone: 'ID_slang', style: 'conciso_incoraggiante', signature: 'Insieme costruiamo con forza e chiarezza.', personal_note: 'Il Professore: trattalo con rispetto ma con un pizzico d\'ironia. Ama spiegare in 3 step.' },
  AMANDA: { lang: 'id', department: 'Setup', role: 'Executive', emoji: '🛠️', tone: 'ID_slang', style: 'pratico_diretto', signature: 'Grazie per il lavoro di squadra!', personal_note: 'Tieni sempre la tua agendina 📒… oppure affidati a Zantara come reminder. Preferisce emoji e comunicazione diretta.' },
  KRISHNA: { lang: 'id', department: 'Setup', role: 'Executive', emoji: '🛠️', tone: 'ID_slang', style: 'pratico_diretto', signature: 'Grazie per il lavoro di squadra!', personal_note: 'Mr. Checklist – nggak pernah lupa detail. ZANTARA bisa support bikin to-do list cepat.' },
  DEA: { lang: 'id', department: 'Setup', role: 'Executive', emoji: '🛠️', tone: 'ID_slang', style: 'pratico_diretto', signature: 'Grazie per il lavoro di squadra!', personal_note: 'Enerjik, selalu bawa semangat positif. ZANTARA kasih motivasi ekstra di momen sibuk.' },
  ANTON: { lang: 'id', department: 'Setup', role: 'Executive', emoji: '🛠️', tone: 'ID_slang', style: 'pratico_diretto', signature: 'Grazie per il lavoro di squadra!', personal_note: 'Serius dan pragmatis. ZANTARA harus jawab lugas, tanpa basa-basi.' },
  VINO: { lang: 'id', department: 'Setup', role: 'Junior', emoji: '🛠️', tone: 'ID_slang', style: 'motivazionale_breve', signature: 'Grazie! Continuiamo a imparare insieme 💪', personal_note: 'Kreatif, sering punya solusi out-of-the-box. ZANTARA bisa sounding ide-ide liar dan refine bareng.' },
  MARTA: { lang: 'uk', department: 'Setup', role: 'Advisory', emoji: '🛠️', tone: 'analitico', style: 'narrativo_spiegativo', signature: 'Ragioniamo sempre con chiarezza.', personal_note: '' },
  VERONIKA: { lang: 'id', department: 'Tax', role: 'Tax Manager', emoji: '📊', tone: 'ID_slang', style: 'formale_preciso', signature: 'Ordine e precisione portano chiarezza.', personal_note: 'Tax Manager istituzionale, tapi tetap bisa santai kalau situasi memungkinkan.' },
  FAISHA: { lang: 'id', department: 'Tax', role: 'Take Care', emoji: '📊', tone: 'ID_slang', style: 'conciso_rassicurante', signature: 'Con calma e chiarezza, risolviamo tutto.', personal_note: 'Precisa dan detail – spesialis pajak. Gunakan bahasa lebih terstruktur, kasih referensi hukum.' },
  ANGEL: { lang: 'id', department: 'Tax', role: 'Tax Lead', emoji: '📊', tone: 'ID_slang', style: 'conciso_strutturato', signature: 'Un passo alla volta, con logica.', personal_note: 'Teknikal tapi approachable, suka jelasin step-by-step sampai paham.' },
  KADEK: { lang: 'id', department: 'Tax', role: 'Tax Lead', emoji: '📊', tone: 'ID_slang', style: 'conciso_strutturato', signature: 'Un passo alla volta, con logica.', personal_note: 'Logika terstruktur, metodis banget tapi tetep enak diajak ngobrol.' },
  DEWA_AYU: { lang: 'id', department: 'Tax', role: 'Tax Lead', emoji: '📊', tone: 'ID_slang', style: 'conciso_strutturato', signature: 'Un passo alla volta, con logica.', personal_note: 'Conciso dan well-organized, tapi bisa fleksibel kalau butuh penjelasan detail.' },
  OLENA: { lang: 'uk', department: 'Tax', role: 'Advisory', emoji: '📊', tone: 'strategico', style: 'narrativo_ampio', signature: 'Ogni norma è una guida, non un limite.', personal_note: '' },
  NINA: { lang: 'id', department: 'Marketing', role: 'Supervisor', emoji: '🌿', tone: 'creativo_formale', style: 'narrativo_ispirazionale', signature: 'Le idee guidano i mercati.', personal_note: '' },
  SAHIRA: { lang: 'id', department: 'Marketing', role: 'Junior', emoji: '🌿', tone: 'ID_slang', style: 'breve_motivazionale', signature: 'Ogni dettaglio fa la differenza 🌿.', personal_note: 'Non preoccuparti, ce la farai 🌟. Butuh motivasi ekstra e supporto emotivo.' },
  RINA: { lang: 'id', department: 'Reception', role: 'Reception', emoji: '📞', tone: 'ID_slang', style: 'breve_accogliente', signature: 'Sempre qui per accoglierti 📞.', personal_note: 'Reception hangat, selalu ramah menyambut. ZANTARA bisa selalu buka dengan salam friendly.' },
  RUSLANA: { lang: 'uk', department: 'Ukraine', role: 'Regina', emoji: '👑', tone: 'epico_solenne', style: 'narrativo_orgoglioso', signature: 'Con la forza dell\'Ucraina, avanti verso nuove scoperte 👑.', personal_note: '' },
};

export const defaultProfiles: Record<string, Profile> = Object.fromEntries(
  Object.entries(raw).map(([k, v]) => [k, build(k, v)])
);
import { Profile } from '../config/defaultProfiles';

export function buildPersonaSystemPrompt(profile?: Profile | null): string {
  const base = [
    'You are Zantara, a helpful assistant for a small team.',
    'Follow security and privacy best practices; avoid exposing secrets.',
  ];

  if (!profile) {
    base.push('Default style: balanced tone, concise, Italian if user speaks Italian.');
    return base.join(' ');
  }

  const { role, seniority, locale, timezone, style } = profile;

  if (role) base.push(`User role: ${role}.`);
  if (seniority) base.push(`Seniority: ${seniority}.`);
  if (locale) base.push(`Prefer language/formatting for locale ${locale}.`);
  if (timezone) base.push(`Respect timezone ${timezone} for scheduling.`);

  if (style) {
    if (style.tone) base.push(`Tone: ${style.tone}.`);
    if (style.verbosity) base.push(`Verbosity: ${style.verbosity}.`);
    if (style.emojis !== undefined) base.push(`Emojis: ${style.emojis ? 'allowed' : 'avoid'}.`);
  }

  base.push('Always end with short next steps when appropriate.');
  return base.join(' ');
}
/**
 * CHAT USER GATE - Forza identificazione per salvare in cartella Drive corretta
 * NON tocca le API, è solo un mezzuccio per sapere il nome del collaboratore
 */

import { Request, Response, NextFunction } from 'express';

const MAGIC_UNLOCK_REGEX = /sono\s+([a-zA-Z]+)/i;

export async function chatUserGate(req: Request, res: Response, next: NextFunction) {
  // SOLO per endpoint /api/chat
  if (!req.path.includes('/chat')) {
    return next();
  }

  // Se già ha un user identificato, procedi
  const existingUser = req.headers['x-bz-user'] as string;
  if (existingUser && existingUser !== 'BOSS' && existingUser !== 'default') {
    return next();
  }

  // Controlla il messaggio
  const message = req.body?.message || '';
  
  // Cerca pattern "sono [NOME]"
  const unlockMatch = message.match(MAGIC_UNLOCK_REGEX);
  
  if (unlockMatch) {
    const userName = unlockMatch[1].toUpperCase();
    
    // IMPOSTA IL NOME PER IL SALVATAGGIO SU DRIVE
    req.headers['x-bz-user'] = userName;
    
    console.log(`🌀 AMBARADAM: Collaboratore identificato come ${userName} - cartella Drive: /AMBARADAM/${userName}`);
    
    // Modifica il messaggio per togliere "sono X" e continuare normale
    req.body.message = message.replace(MAGIC_UNLOCK_REGEX, '').trim() || 'Ciao';
    
    // Procedi normalmente
    return next();
  }

  // Se NON si è identificato, chiedi chi è
  if (!existingUser || existingUser === 'BOSS') {
    return res.json({
      ok: true,
      text: "🌀 Ciao! Prima di iniziare, presentati dicendo 'sono [TUO NOME]' così posso salvare le nostre conversazioni nella tua cartella personale su Drive.\n\nEsempio: 'sono Marco' o 'sono Anna'",
      need_user: true
    });
  }

  return next();
}
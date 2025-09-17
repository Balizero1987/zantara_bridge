/**
 * AMBARADAM GATE MIDDLEWARE
 * Forza l'utente a identificarsi con "sono [NOME]" prima di accedere
 * Messaggio da ZANTARA per controllo accessi categorico
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../core/firestore';

const MAGIC_UNLOCK_REGEX = /sono\s+([a-zA-Z]+)/i;
const UNLOCK_VARIATIONS = [
  /sono\s+([a-zA-Z]+)/i,
  /i\s+am\s+([a-zA-Z]+)/i,
  /mi\s+chiamo\s+([a-zA-Z]+)/i,
  /my\s+name\s+is\s+([a-zA-Z]+)/i,
  /saya\s+([a-zA-Z]+)/i  // Indonesian
];

interface AmbaradamSession {
  unlocked: boolean;
  name: string;
  timestamp: Date;
  ip?: string;
}

export async function ambaradamGate(req: Request, res: Response, next: NextFunction) {
  // Skip per health checks e endpoint pubblici
  if (req.path === '/health' || req.path === '/metrics' || req.path.startsWith('/diag')) {
    return next();
  }

  // Check if already has valid user header (backward compatibility)
  const existingUser = req.headers['x-bz-user'] as string;
  if (existingUser && existingUser !== 'BOSS') {
    // User già autenticato via header
    return next();
  }

  const message = req.body?.message || req.body?.text || '';
  const sessionId = req.headers['x-session-id'] as string || req.ip;
  
  try {
    // Recupera sessione da Firestore
    const sessionDoc = await db.collection('ambaradam_sessions').doc(sessionId).get();
    const session = sessionDoc.exists ? sessionDoc.data() as AmbaradamSession : null;

    // Check unlock attempts
    let unlockMatch = null;
    let userName = null;

    for (const regex of UNLOCK_VARIATIONS) {
      unlockMatch = message.match(regex);
      if (unlockMatch) {
        userName = unlockMatch[1].toUpperCase();
        break;
      }
    }

    // Se trova pattern di sblocco
    if (unlockMatch && userName) {
      const newSession: AmbaradamSession = {
        unlocked: true,
        name: userName,
        timestamp: new Date(),
        ip: req.ip
      };

      // Salva sessione
      await db.collection('ambaradam_sessions').doc(sessionId).set(newSession);
      
      // Set header for downstream
      req.headers['x-bz-user'] = userName;
      
      // Log evento importante
      console.log(JSON.stringify({
        type: 'AMBARADAM_UNLOCK',
        user: userName,
        ip: req.ip,
        timestamp: new Date()
      }));

      // Risposta di benvenuto
      return res.json({
        ok: true,
        text: `🌀 Porta AMBARADAM aperta. Benvenuto, ${userName}.\n\n⚡ "Una strategia chiara è un atto di coraggio: richiede dire no a mille buone opportunità per dire sì a una sola cosa eccezionale."\n— 99 Prinsip Bali Zero\n\nOra puoi parlarmi liberamente. Come posso aiutarti oggi?`,
        unlocked: true,
        need_user: false
      });
    }

    // Se NON è sbloccato
    if (!session || !session.unlocked) {
      // Messaggio sfida multilingua
      const challengeMessages = [
        "😐 Siapa kamu?\nDatang diam-diam, langsung bicara.\nKalau mau masuk, sebutkan **nama pintumu**.\nTanpa itu, gerbang ini tidak akan terbuka.",
        "\n🔒 Chi sei? Presentati prima di entrare.\nDì 'sono [TUO NOME]' per aprire la porta AMBARADAM.",
        "\n🚪 Who are you? Say 'I am [YOUR NAME]' to unlock access."
      ];

      return res.json({
        ok: false,
        text: challengeMessages.join('\n\n'),
        need_user: true,
        locked: true
      });
    }

    // Session valida, procedi
    req.headers['x-bz-user'] = session.name;
    
    // Aggiorna ultimo accesso
    await db.collection('ambaradam_sessions')
      .doc(sessionId)
      .update({ 
        lastAccess: new Date(),
        requestCount: (session as any).requestCount ? (session as any).requestCount + 1 : 1
      });

    return next();

  } catch (error) {
    console.error('AMBARADAM Gate error:', error);
    // In caso di errore, applica policy restrittiva
    return res.status(503).json({
      ok: false,
      text: "🔥 Sistema AMBARADAM temporaneamente offline. Riprova.",
      error: 'gate_error'
    });
  }
}

/**
 * Funzione per pulire sessioni vecchie (da chiamare con cron)
 */
export async function cleanOldSessions() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const oldSessions = await db.collection('ambaradam_sessions')
    .where('timestamp', '<', oneDayAgo)
    .get();

  const batch = db.batch();
  oldSessions.forEach(doc => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log(`Cleaned ${oldSessions.size} old AMBARADAM sessions`);
}
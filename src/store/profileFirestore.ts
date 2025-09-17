import { db } from '../core/firestore';
import { Profile, defaultProfiles } from '../config/defaultProfiles';

const COLL = 'userProfiles';

const profileFirestoreStore = {
  async get(userId: string): Promise<Profile | null> {
    const snap = await db.collection(COLL).doc(userId).get();
    if (!snap.exists) {
      // Fallback to defaults and write-back
      const def = defaultProfiles[userId];
      if (def) {
        // Auto-detect ID_slang for Indonesian users
        let enhancedDef = { ...def };
        if (def.locale === 'id-ID' && (!def.meta?.rawTone || def.meta.rawTone === 'collaborativo')) {
          enhancedDef = {
            ...def,
            meta: {
              ...def.meta,
              rawTone: 'ID_slang'
            }
          };
        }
        
        await db.collection(COLL).doc(userId).set({
          role: enhancedDef.role || null,
          seniority: enhancedDef.seniority || null,
          locale: enhancedDef.locale || null,
          timezone: enhancedDef.timezone || null,
          style: enhancedDef.style || null,
          meta: enhancedDef.meta || null,
          updatedAt: Date.now(),
          seededFromDefault: true,
        }, { merge: true });
        return enhancedDef;
      }
      return null;
    }

    const data = snap.data();
    if (!data) return null;
    
    return {
      userId,
      role: data.role,
      seniority: data.seniority,
      locale: data.locale,
      timezone: data.timezone,
      style: data.style,
      meta: data.meta,
    };
  },

  async set(profile: Profile): Promise<Profile> {
    const clean = {
      role: profile.role || null,
      seniority: profile.seniority || null,
      locale: profile.locale || null,
      timezone: profile.timezone || null,
      style: profile.style || null,
      updatedAt: Date.now(),
    };

    await db.collection(COLL).doc(profile.userId).set(clean, { merge: true });
    return profile;
  },
};

export default profileFirestoreStore;
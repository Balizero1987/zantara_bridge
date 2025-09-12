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
        await db.collection(COLL).doc(userId).set({
          role: def.role || null,
          seniority: def.seniority || null,
          locale: def.locale || null,
          timezone: def.timezone || null,
          style: def.style || null,
          meta: def.meta || null,
          updatedAt: Date.now(),
          seededFromDefault: true,
        }, { merge: true });
        return def;
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
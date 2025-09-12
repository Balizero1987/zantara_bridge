import { Profile, defaultProfiles } from '../config/defaultProfiles';

const mem = new Map<string, Profile>(Object.entries(defaultProfiles));

// Seed example: empty. Could prefill during tests.
const profileMemoryStore = {
  async get(userId: string): Promise<Profile | null> {
    return mem.get(userId) || null;
  },

  async set(profile: Profile): Promise<Profile> {
    const merged = { ...(mem.get(profile.userId) || {}), ...profile };
    mem.set(merged.userId, merged);
    return merged;
  },
};

export default profileMemoryStore;
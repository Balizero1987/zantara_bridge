import { Router } from "express";
import { db } from "../core/firestore";

const router = Router();

router.get("/", async (req, res) => {
  try {
    // Trigger stats
    const triggersSnap = await db.collection("triggers").get();
    const triggers: { name: string; count: number }[] = [];
    triggersSnap.forEach(doc => {
      triggers.push({ name: doc.id, count: doc.data().count || 0 });
    });

    // Mood trend (ultimi 7 giorni)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const convSnap = await db.collection("conversations")
      .where("startedAt", ">=", weekAgo.toISOString())
      .get();

    let moodSum = 0, moodCount = 0;
    const dailyMood: Record<string, { sum: number; count: number }> = {};

    convSnap.forEach(doc => {
      const conv = doc.data();
      const trend = conv.moodTrend || [];
      const startedAt = new Date(conv.startedAt);
      const dayKey = startedAt.toISOString().split("T")[0]; // YYYY-MM-DD

      if (!dailyMood[dayKey]) dailyMood[dayKey] = { sum: 0, count: 0 };

      trend.forEach((m: number) => {
        moodSum += m;
        moodCount++;
        dailyMood[dayKey].sum += m;
        dailyMood[dayKey].count++;
      });
    });

    const moodAvg = moodCount ? moodSum / moodCount : 0;

    const moodTrend = Object.entries(dailyMood).map(([day, data]) => ({
      day,
      avg: data.count ? data.sum / data.count : 0
    }));

    return res.json({
      ok: true,
      stats: {
        topTriggers: triggers.sort((a, b) => b.count - a.count).slice(0, 5),
        avgMood: moodAvg,
        totalConversations: convSnap.size,
        moodTrend
      },
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
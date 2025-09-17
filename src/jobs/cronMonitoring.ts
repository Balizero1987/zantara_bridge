import cron from "node-cron";
import fetch from "node-fetch";

const BASE_URL =
  process.env.BASE_URL ||
  "https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app";

export function startMonitoringCron() {
  cron.schedule("*/30 * * * *", async () => {
    console.log("🩺 Avvio monitoring heartbeat...");

    try {
      const res = await fetch(`${BASE_URL}/api/monitoring`);
      const data = await res.json();

      if (!data.ok) {
        console.error("❌ Monitoring failed:", data);
        // TODO: inviare alert Slack/Telegram
      } else {
        console.log("✅ Monitoring OK", data.ts);
        
        // Log status di ogni servizio
        Object.entries(data.monitoring).forEach(([service, status]: [string, any]) => {
          if (status.ok === false) {
            console.warn(`⚠️ ${service.toUpperCase()}: ${status.error || 'Service down'}`);
          }
        });
      }
    } catch (err: any) {
      console.error("❌ Errore monitoring:", err.message);
    }
  });

  console.log("🩺 Monitoring cron job started - heartbeat every 30 minutes");
}
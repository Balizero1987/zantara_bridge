# 🩺 Dashboard Monitoring React Component

## DashboardMonitoring.tsx

```tsx
import React, { useEffect, useState } from "react";

export default function DashboardMonitoring() {
  const [data, setData] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app/api/monitoring");
        const d = await res.json();
        setData(d.monitoring);
        setLastUpdate(d.ts);
      } catch (error) {
        console.error("Error fetching monitoring data:", error);
      }
    }
    
    fetchData();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!data) return <p className="text-center">⏳ Caricamento monitoring...</p>;

  const services = ["health", "stats", "assistant", "gmail", "calendar", "conversations"];

  // Count healthy vs failed services
  const healthyCount = services.filter(s => data[s]?.ok).length;
  const totalCount = services.length;

  return (
    <div className="p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">🩺 Monitoring AMBARADAM</h1>
        <p className="text-sm text-gray-500 mt-2">
          Last update: {new Date(lastUpdate).toLocaleString()}
        </p>
        <div className="mt-4">
          <span className={`text-2xl font-bold ${healthyCount === totalCount ? 'text-green-600' : 'text-red-600'}`}>
            {healthyCount}/{totalCount} Services Healthy
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {services.map(s => (
          <div key={s} className={`p-4 shadow-lg rounded-xl text-center ${
            data[s]?.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          } border-2`}>
            <h2 className="font-semibold text-lg mb-2">{s.toUpperCase()}</h2>
            {data[s]?.ok ? (
              <>
                <p className="text-green-600 font-bold text-xl">✅ OK</p>
                {data[s].timestamp && (
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(data[s].timestamp).toLocaleTimeString()}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-red-600 font-bold text-xl">❌ FAIL</p>
                {data[s].error && (
                  <p className="text-xs text-red-700 mt-1 truncate" title={data[s].error}>
                    {data[s].error}
                  </p>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* System Overview */}
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h2 className="text-xl font-bold mb-4">📊 System Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{totalCount}</p>
            <p className="text-sm text-gray-600">Total Services</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{healthyCount}</p>
            <p className="text-sm text-gray-600">Healthy</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-red-600">{totalCount - healthyCount}</p>
            <p className="text-sm text-gray-600">Failed</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## React Router Integration

```tsx
// In App.tsx or routes configuration
import DashboardMonitoring from "./components/DashboardMonitoring";

<Route path="/monitoring" element={<DashboardMonitoring />} />
```

## API Endpoint

Endpoint: `GET /api/monitoring`

Response:
```json
{
  "ok": true,
  "monitoring": {
    "health": {"ok": true, "ts": 1726431234567},
    "stats": {"ok": true, "stats": {...}},
    "assistant": {"ok": false, "error": "Service timeout"},
    "gmail": {"ok": true, "lastCheck": "2025-09-15T..."},
    "calendar": {"ok": true, "deadlines": 5},
    "conversations": {"ok": true, "stats": {...}}
  },
  "ts": "2025-09-15T20:45:00Z"
}
```

## Features

- 🩺 **Real-time Monitoring**: Auto-refresh ogni 60 secondi
- 📊 **Visual Status**: Cards verde/rosso per ogni servizio
- 🔍 **Error Details**: Tooltip con dettagli errori
- 📈 **System Overview**: Contatori servizi sani/falliti
- ⏰ **Last Update**: Timestamp ultimo aggiornamento
- 🎯 **Responsive**: Layout adattivo mobile/desktop

Accessibile su: `https://zantara-dashboard.netlify.app/monitoring`

Perfetto per il monitoraggio in tempo reale dello stato di tutti i servizi AMBARADAM! 🚀✨
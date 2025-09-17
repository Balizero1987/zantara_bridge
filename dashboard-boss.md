# 📊 Dashboard Boss React Component

## DashboardBoss.tsx

```tsx
import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line, CartesianGrid } from "recharts";

export default function DashboardBoss() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      const res = await fetch("/api/conversations/stats");
      const data = await res.json();
      setStats(data.stats);
    }
    fetchData();
  }, []);

  if (!stats) return <p className="text-center">⏳ Caricamento dati...</p>;

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold text-center">📊 Dashboard Boss – Conversazioni</h1>

      {/* Trigger più usati */}
      <div className="bg-white shadow-lg rounded-2xl p-4">
        <h2 className="text-lg font-semibold mb-4">🔥 Top Trigger</h2>
        <BarChart width={500} height={300} data={stats.topTriggers}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="count" fill="#00C49F" />
        </BarChart>
      </div>

      {/* Mood medio */}
      <div className="bg-white shadow-lg rounded-2xl p-4 text-center">
        <h2 className="text-lg font-semibold mb-2">😊 Mood medio (ultimi 7 giorni)</h2>
        <p className="text-3xl font-bold">{stats.avgMood.toFixed(2)}</p>
      </div>

      {/* Mood trend */}
      <div className="bg-white shadow-lg rounded-2xl p-4">
        <h2 className="text-lg font-semibold mb-4">📈 Mood trend giornaliero</h2>
        <LineChart width={600} height={300} data={stats.moodTrend}>
          <CartesianGrid stroke="#ccc" />
          <XAxis dataKey="day" />
          <YAxis domain={[-1, 1]} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="avg" stroke="#8884d8" />
        </LineChart>
      </div>

      {/* KPI conversazioni */}
      <div className="bg-white shadow-lg rounded-2xl p-4 text-center">
        <h2 className="text-lg font-semibold mb-2">💬 Conversazioni totali (7 giorni)</h2>
        <p className="text-3xl font-bold">{stats.totalConversations}</p>
      </div>
    </div>
  );
}
```

## API Endpoint

Utilizza l'endpoint:
```
GET /api/conversations/stats
```

Risposta:
```json
{
  "ok": true,
  "stats": {
    "topTriggers": [
      {"name": "KITAS", "count": 25},
      {"name": "TAX", "count": 18},
      {"name": "MEETING", "count": 12}
    ],
    "avgMood": 0.3,
    "totalConversations": 47,
    "moodTrend": [
      {"day": "2025-09-09", "avg": 0.2},
      {"day": "2025-09-10", "avg": 0.5},
      {"day": "2025-09-11", "avg": -0.1},
      {"day": "2025-09-12", "avg": 0.4},
      {"day": "2025-09-13", "avg": 0.3},
      {"day": "2025-09-14", "avg": 0.6},
      {"day": "2025-09-15", "avg": 0.2}
    ]
  },
  "timestamp": "2025-09-15T..."
}
```

## Features

- 📊 **Top Triggers**: Grafico a barre delle parole chiave più usate
- 😊 **Mood Score**: Media numerica del sentiment del team
- 📈 **Mood Trend**: Grafico a linee dell'andamento giornaliero mood (ultimi 7 giorni)
- 💬 **KPI Conversations**: Numero totale conversazioni settimanali
- ⚡ **Real-time**: Dati aggiornati da Firestore

## Mood Trend Analysis

Il grafico LineChart mostra l'evoluzione giornaliera del mood del team:
- **Asse Y**: da -1 (molto negativo) a +1 (molto positivo)
- **Asse X**: ultimi 7 giorni (formato YYYY-MM-DD)
- **Line Chart**: linea continua che evidenzia trend crescenti/decrescenti

Perfetto per la Dashboard Boss per monitorare l'andamento emotivo e operativo del team AMBARADAM! 📈✨
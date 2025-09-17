export interface Summary {
  short: string;           // sintesi in 1 frase
  bullets: string[];       // lista a punti (5–10 max)
  narrative?: string;      // sintesi epica in stile AMBARADAM
}

export type Mood = "curious" | "stressed" | "relaxed" | "excited" | "neutral";

export interface Conversation {
  id: string;              // es. conv_2025_09_15_ARI_001
  collab: string;          // nome collaboratore
  participants?: string[]; // opzionale: per conversazioni di gruppo
  startedAt: string;       // ISO date
  lastMessageAt: string;   // ISO date
  status: "open" | "closed";
  tags: string[];          // es. ["visa", "KITAS", "deadline"]
  summary: Summary;
  questLinked?: string;    // ID quest associata
  moodTrend?: Mood[];      // andamento emozionale durante la chat
}

export interface Message {
  id: string;
  sender: "collab" | "ZANTARA";
  text: string;
  timestamp: string;       // ISO date
  mood?: Mood;             // stato emotivo rilevato
  trigger?: string;        // keyword che ha attivato rituale/risposta
}

export interface Artifact {
  id: string;
  type: "note" | "driveFile" | "calendarEvent";
  fileId?: string;         // se esiste su Drive
  link?: string;           // link pubblico/file
  createdAt: string;       // ISO date
}

export interface ConversationRecord extends Conversation {
  messages?: Message[];
  artifacts?: Artifact[];
}
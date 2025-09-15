import OpenAI from "openai";

export const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  project: process.env.OPENAI_PROJECT,
});

// Backwards compatibility
export const openai = client;

export const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

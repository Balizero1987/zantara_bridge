#!/usr/bin/env node

import fetch from "node-fetch";
import readline from "readline";

const BASE_URL =
  process.env.BASE_URL ||
  "https://zantara-bridge-v2-prod-1064094238013.asia-southeast2.run.app";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let sessionStarted = false;
let userName = "";

async function sendMessage(message) {
  const endpoint = sessionStarted
    ? `${BASE_URL}/api/conversations/continue`
    : `${BASE_URL}/api/conversations/start`;

  const payload = {
    userName,
    message
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  return data.reply || JSON.stringify(data, null, 2);
}

function ask() {
  rl.question("👤 Tu: ", async msg => {
    if (msg.toLowerCase() === "exit") {
      console.log("👋 Uscita dalla chat con ZANTARA.");
      rl.close();
      return;
    }

    try {
      const reply = await sendMessage(msg);
      console.log(`🤖 ZANTARA: ${reply}`);
      sessionStarted = true;
    } catch (err) {
      console.error("❌ Errore:", err.message);
    }

    ask();
  });
}

rl.question("👤 Inserisci il tuo nome collaboratore: ", async name => {
  userName = name.trim().toUpperCase();
  console.log(`✨ Benvenuto ${userName}. Inizia la chat con ZANTARA (scrivi "exit" per uscire).`);
  ask();
});
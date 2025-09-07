const { Firestore } = require('@google-cloud/firestore');

(async function main () {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'involuted-box-469105-r0';
  const db = new Firestore({ projectId });

  const now = Date.now();
  const today = new Date().toISOString().slice(0,10);

  await db.collection('memory.global').doc('manifesto').set({
    title: 'Manifesto ZANTARA',
    content: 'ZANTARA difende la Costituzione, tutela i deboli, unisce compliance e creatività...',
    lastUpdate: new Date().toISOString()
  }, { merge: true });

  const values = [
    { key: 'COMPLIANCE_FIRST', text: 'Rigore normativo, riduzione del rischio operativo.' },
    { key: 'ONE_BRAIN', text: 'Una sola voce coerente, memoria viva centralizzata.' },
    { key: 'CREATIVITA_FUNZIONALE', text: 'Bellezza utile: forma chiara al servizio della sostanza.' },
    { key: 'TUTELA_DEBOLI', text: 'Difesa concreta contro soprusi e disuguaglianze.' }
  ];
  const valCol = db.collection('memory.global').doc('valori').collection('items');
  await Promise.all(values.map(v => valCol.doc(v.key).set({ ...v, ts: now }, { merge: true })));

  await db.collection('profiles').doc('BOSS').set({
    canonicalOwner: 'BOSS',
    email: 'zero@balizero.com',
    name: 'Antonello',
    role: 'Founder',
    prefs: { tone: 'executive', ririMode: false }
  }, { merge: true });

  await db.collection('profiles').doc('RIRI').set({
    canonicalOwner: 'RIRI',
    email: 'riri@balizero.com',
    name: 'Dewa Ayu Riri',
    role: 'Co-Founder',
    prefs: { tone: 'delicato-assertivo-caldo', ririMode: true }
  }, { merge: true });

  await db.collection('memory.byOwner').doc('RIRI').collection('entries')
    .doc('seed-preset').set({
      canonicalOwner: 'RIRI',
      type: 'seed',
      title: 'Preset RIRI',
      content: 'RIRI parla con delicatezza assertiva e calore. Chiude con luce.',
      ts: now,
      dateKey: today
    }, { merge: true });

  await db.collection('notes').doc('seed-kickstart').set({
    canonicalOwner: 'BOSS',
    title: 'Kickstart Plugin GPT',
    content: 'Obiettivo: plugin operativo, seed culturali, logging/trace, indici Firestore.',
    ts: now,
    dateKey: today,
    tags: ['roadmap','plugin-core']
  }, { merge: true });

  console.log(JSON.stringify({ severity:'INFO', message:'Firestore seed completed', projectId, seedTimestamp:now, timestamp:new Date().toISOString() }));
})().catch(err => {
  console.error(JSON.stringify({ severity:'ERROR', message:'Firestore seed failed', error:String(err), timestamp:new Date().toISOString() }));
  process.exit(1);
});

#!/bin/bash
# Setup OAuth Domain-wide Delegation for Drive folder 0AJC3-SJL03OOUk9PVA

set -e

PROJECT_ID="involuted-box-469105-r0"
SERVICE_ACCOUNT="zantara@${PROJECT_ID}.iam.gserviceaccount.com"
FOLDER_ID="0AJC3-SJL03OOUk9PVA"

echo "🔧 Configurazione OAuth Domain-wide Delegation per cartella Drive"
echo "📁 Folder ID: $FOLDER_ID"
echo "🤖 Service Account: $SERVICE_ACCOUNT"

# Step 1: Verifica Service Account corrente
echo -e "\n1️⃣ Verifica Service Account..."
gcloud iam service-accounts describe $SERVICE_ACCOUNT --project=$PROJECT_ID

# Step 2: Ottieni Client ID per Domain-wide Delegation
echo -e "\n2️⃣ Ottieni Client ID..."
CLIENT_ID=$(gcloud iam service-accounts describe $SERVICE_ACCOUNT \
  --project=$PROJECT_ID \
  --format="value(oauth2ClientId)")

if [ -z "$CLIENT_ID" ]; then
  echo "❌ Errore: Client ID non trovato"
  exit 1
fi

echo "✅ Client ID: $CLIENT_ID"

# Step 3: Verifica permessi Domain-wide Delegation
echo -e "\n3️⃣ Verifica Domain-wide Delegation..."
DWD_STATUS=$(gcloud iam service-accounts describe $SERVICE_ACCOUNT \
  --project=$PROJECT_ID \
  --format="value(domainWideDelegationEnabled)" || echo "false")

if [ "$DWD_STATUS" != "true" ]; then
  echo "⚠️  Domain-wide Delegation non abilitato. Abilitazione..."
  gcloud iam service-accounts update $SERVICE_ACCOUNT \
    --project=$PROJECT_ID \
    --display-name="ZANTARA Bridge with DWD"
else
  echo "✅ Domain-wide Delegation già abilitato"
fi

# Step 4: Test accesso alla cartella specifica
echo -e "\n4️⃣ Test accesso cartella $FOLDER_ID..."

# Crea script di test temporaneo
cat > /tmp/test_folder_access.js << 'EOF'
const { google } = require('googleapis');
const folderId = process.argv[2];

async function testFolderAccess() {
  try {
    const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    
    const auth = new google.auth.JWT(
      serviceAccountKey.client_email,
      null,
      serviceAccountKey.private_key,
      ['https://www.googleapis.com/auth/drive'],
      process.env.IMPERSONATE_USER || 'zero@balizero.com'
    );

    const drive = google.drive({ version: 'v3', auth });
    
    // Test 1: Get folder metadata
    console.log('🔍 Test 1: Metadata cartella...');
    const folderResponse = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,permissions,owners,shared'
    });
    
    console.log(`✅ Cartella trovata: ${folderResponse.data.name}`);
    console.log(`📊 Condivisa: ${folderResponse.data.shared}`);
    
    // Test 2: List files in folder
    console.log('\n🔍 Test 2: Lista file nella cartella...');
    const filesResponse = await drive.files.list({
      q: `'${folderId}' in parents`,
      pageSize: 5,
      fields: 'files(id,name,mimeType)'
    });
    
    console.log(`✅ Trovati ${filesResponse.data.files.length} file`);
    filesResponse.data.files.forEach(file => {
      console.log(`  📄 ${file.name} (${file.mimeType})`);
    });
    
    // Test 3: Check folder permissions
    console.log('\n🔍 Test 3: Verifica permessi...');
    const permissionsResponse = await drive.permissions.list({
      fileId: folderId,
      fields: 'permissions(id,type,role,emailAddress)'
    });
    
    console.log('✅ Permessi cartella:');
    permissionsResponse.data.permissions.forEach(perm => {
      console.log(`  👤 ${perm.type}: ${perm.emailAddress || 'N/A'} (${perm.role})`);
    });
    
  } catch (error) {
    console.error('❌ Errore accesso cartella:', error.message);
    if (error.code === 404) {
      console.error('💡 La cartella potrebbe non esistere o non essere accessibile');
    } else if (error.code === 403) {
      console.error('💡 Permessi insufficienti - verifica Domain-wide Delegation');
    }
    process.exit(1);
  }
}

testFolderAccess();
EOF

# Esegui test se le env vars sono disponibili
if [ -n "$GOOGLE_SERVICE_ACCOUNT_KEY" ]; then
  echo "🧪 Eseguendo test accesso cartella..."
  node /tmp/test_folder_access.js $FOLDER_ID
else
  echo "⚠️  GOOGLE_SERVICE_ACCOUNT_KEY non impostato - saltando test"
fi

# Step 5: Genera configurazione per Google Admin Console
echo -e "\n5️⃣ Configurazione Google Admin Console"
echo "======================================"
echo "🌐 URL: https://admin.google.com/ac/owl/domainwidedelegation"
echo "🔑 Client ID: $CLIENT_ID"
echo "📋 OAuth Scopes (uno per riga):"
echo "   https://www.googleapis.com/auth/drive"
echo "   https://www.googleapis.com/auth/drive.file"
echo "   https://www.googleapis.com/auth/drive.metadata"
echo "   https://www.googleapis.com/auth/calendar"
echo "   https://www.googleapis.com/auth/gmail.readonly"

# Step 6: Cloud Run environment update
echo -e "\n6️⃣ Aggiornamento Cloud Run (opzionale)"
echo "==========================================="
echo "Per aggiornare la configurazione Cloud Run:"
echo ""
echo "export DRIVE_FOLDER_TARGET=$FOLDER_ID"
echo "export IMPERSONATE_USER=zero@balizero.com"
echo ""
echo "gcloud run services update zantara-bridge-v2-prod \\"
echo "  --region asia-southeast2 \\"
echo "  --project $PROJECT_ID \\"
echo "  --set-env-vars=\"DRIVE_FOLDER_TARGET=$FOLDER_ID,IMPERSONATE_USER=zero@balizero.com\""

# Cleanup
rm -f /tmp/test_folder_access.js

echo -e "\n✅ Setup OAuth delegation completato!"
echo "💡 Prossimi passi:"
echo "   1. Configura Domain-wide Delegation in Google Admin Console"
echo "   2. Testa accesso con: curl [endpoint]/diag/drive/check?folderId=$FOLDER_ID"
echo "   3. Aggiorna variabili ambiente Cloud Run se necessario"
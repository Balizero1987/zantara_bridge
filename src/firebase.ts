import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    // Try to use service account from environment or file
    let serviceAccountKey;
    
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Use the default credentials
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.GOOGLE_CLOUD_PROJECT || 'involuted-box-469105-r0'
      });
    } else {
      throw new Error('No Firebase credentials found');
    }

    if (serviceAccountKey) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountKey),
        projectId: serviceAccountKey.project_id || process.env.GOOGLE_CLOUD_PROJECT || 'involuted-box-469105-r0'
      });
    }

    console.log('✅ Firebase Admin SDK initialized successfully');
    
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    
    // Initialize with default credentials as fallback
    try {
      admin.initializeApp({
        projectId: process.env.GOOGLE_CLOUD_PROJECT || 'involuted-box-469105-r0'
      });
      console.log('✅ Firebase initialized with default credentials');
    } catch (fallbackError) {
      console.error('❌ Firebase fallback initialization failed:', fallbackError);
      // Continue without Firebase - features will be disabled
    }
  }
}

export const firestore = admin.firestore();
export const auth = admin.auth();

// Configure Firestore settings
firestore.settings({
  ignoreUndefinedProperties: true
});

export default admin;
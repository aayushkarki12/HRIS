import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth';

// Public web config - safe to expose client-side (unlike the Admin SDK
// service-account key the backend uses in app/core/firebase.py). Get these
// values from the Firebase console: Project Settings > General > Your apps
// > Web app > SDK setup and configuration.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
  }
  return app;
}

export function isFirebaseConfigured(): boolean {
  return !!(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
}

/** Renders an invisible reCAPTCHA bound to the DOM element with this id - required by Firebase before sending an SMS. */
export function createRecaptchaVerifier(containerId: string): RecaptchaVerifier {
  return new RecaptchaVerifier(getAuth(getFirebaseApp()), containerId, { size: 'invisible' });
}

/** Sends the OTP SMS. phoneNumber must be E.164 (e.g. "+15551234567"). */
export function sendPhoneOtp(phoneNumber: string, verifier: RecaptchaVerifier): Promise<ConfirmationResult> {
  return signInWithPhoneNumber(getAuth(getFirebaseApp()), phoneNumber, verifier);
}

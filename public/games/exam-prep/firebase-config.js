// Public Firebase web-app configuration (not a secret). Fill from Firebase Console > Project settings > Your apps.
// Enable Email/Password and Google providers under Authentication > Sign-in method.
// Create Firestore and enforce rules restricting /students/{uid} to request.auth.uid == uid.
// Without configuration the app does not claim to create accounts or sync student records.
window.EXAMPRO_FIREBASE_CONFIG = window.EXAMPRO_FIREBASE_CONFIG || null;

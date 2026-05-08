// Firebase integration — filled in after Firebase project setup.
// All functions are stubs that will be replaced with real Firebase calls.
// The GameContext currently uses local state; swap useLocalGame → useFirebaseGame when ready.

export const firebaseConfigured = !!(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_DATABASE_URL
)

// TODO: Replace stubs below with real Firebase Realtime Database calls.
// import { initializeApp } from 'firebase/app'
// import { getDatabase, ref, set, onValue, update, push } from 'firebase/database'
//
// const app = initializeApp({
//   apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
//   authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
//   databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
//   projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
//   appId:             import.meta.env.VITE_FIREBASE_APP_ID,
// })
// export const db = getDatabase(app)

import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth }  from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentSingleTabManager, persistentLocalCache } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

declare global {
    var __FS_READY__: boolean | undefined;
}

let fs;
if (!globalThis.__FS_READY__) {
    try {
        fs = initializeFirestore(app, {
            localCache: persistentLocalCache({
                tabManager: persistentSingleTabManager({ })
            })
        })
    } catch {
        fs = getFirestore(app);
    }
    globalThis.__FS_READY__ = true;
} else {
    fs = getFirestore(app);
}
export const firestore = fs;
export const auth = getAuth(app);
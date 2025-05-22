// src/lib/stores/authStore.ts
import { writable, type Writable } from 'svelte/store';
import { auth } from '$lib/firebase/client';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import type { UserSessionData } from '$lib/types';

interface AuthState {
    firebaseUser: FirebaseUser | null;
    customClaims: UserSessionData | null;
    isLoading: boolean;
    error: Error | null;
}

const initialAuthState: AuthState = {
    firebaseUser: null,
    customClaims: null,
    isLoading: true,
    error: null,
};

export const authStore: Writable<AuthState> = writable(initialAuthState);

onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            await user.getIdToken(true);
            const idTokenResult = await user.getIdTokenResult();
            const claims = idTokenResult.claims;

            const sessionData: UserSessionData = {
                email: user.email || '',
                hasGanoAIAccess: claims.hasGanoAIAccess === true,
                ganoAIUserId: user.uid,
                // Pastikan claims.ganoAICompanyId adalah string atau undefined
                ganoAICompanyId: typeof claims.ganoAICompanyId === 'string' ? claims.ganoAICompanyId : undefined,
                hasRipenessAccess: claims.hasRipenessAccess === true,
                ripenessUserId: user.uid,
                // Pastikan claims.ripenessCompanyId adalah string atau undefined
                ripenessCompanyId: typeof claims.ripenessCompanyId === 'string' ? claims.ripenessCompanyId : undefined,
            };

            authStore.set({ firebaseUser: user, customClaims: sessionData, isLoading: false, error: null });
        } catch (e: any) {
            console.error("Error processing auth state:", e);
            authStore.set({ firebaseUser: null, customClaims: null, isLoading: false, error: e });
            // Pertimbangkan untuk signOut jika ada error serius dalam memproses token/claims
            // await auth.signOut();
        }
    } else {
        authStore.set({ firebaseUser: null, customClaims: null, isLoading: false, error: null });
    }
}, (error) => {
    console.error("onAuthStateChanged error:", error);
    authStore.set({ firebaseUser: null, customClaims: null, isLoading: false, error });
});

export async function clientSideLogout() {
    await auth.signOut();
}
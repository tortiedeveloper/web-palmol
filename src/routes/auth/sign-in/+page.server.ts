// src/routes/auth/sign-in/+page.server.ts
import { fail, redirect, type Actions } from "@sveltejs/kit";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { ganoAIApp, ganoAIDb } from "$lib/firebase/ganoAIClient";
import { ripenessApp, ripenessDb } from "$lib/firebase/ripenessClient";
import type { CompanyUser, UserSessionData } from "$lib/types";

const SESSION_COOKIE_NAME = "app_session";

const login: import('@sveltejs/kit').Action = async ({ cookies, request }) => {
    const data = await request.formData();
    const email = data.get('email') as string;
    const password = data.get('password') as string;

    if (!email || !password) {
        return fail(400, { error: "Email dan password harus diisi." });
    }

    let sessionData: UserSessionData = {
        email: email,
        hasGanoAIAccess: false,
        hasRipenessAccess: false,
    };
    let ganoAIChecked = false;
    let ripenessChecked = false;

    try {
        const authGanoAI = getAuth(ganoAIApp);
        const userCredentialGanoAI = await signInWithEmailAndPassword(authGanoAI, email, password);
        const userGanoAI = userCredentialGanoAI.user;
        ganoAIChecked = true;

        if (userGanoAI) {
            sessionData.ganoAIUserId = userGanoAI.uid;
            const companyUserRefGanoAI = doc(ganoAIDb, "companyUser", userGanoAI.uid);
            const companyUserSnapGanoAI = await getDoc(companyUserRefGanoAI);
            if (companyUserSnapGanoAI.exists()) {
                const companyUserDataGanoAI = companyUserSnapGanoAI.data() as CompanyUser;
                sessionData.hasGanoAIAccess = true;
                sessionData.ganoAICompanyId = companyUserDataGanoAI.companyId;
                sessionData.isGanoAIPremium = companyUserDataGanoAI.membership === 'premium';
            }
        }
    } catch (error) {
        ganoAIChecked = true;
        console.warn("Login GanoAI gagal:", (error as Error).message);
    }

    if ((sessionData.isGanoAIPremium && sessionData.hasGanoAIAccess) || !sessionData.hasGanoAIAccess) {
        try {
            const authRipeness = getAuth(ripenessApp);
            const userCredentialRipeness = await signInWithEmailAndPassword(authRipeness, email, password);
            const userRipeness = userCredentialRipeness.user;
            ripenessChecked = true;

            if (userRipeness) {
                sessionData.ripenessUserId = userRipeness.uid;
                const companyUserRefRipeness = doc(ripenessDb, "companyUser", userRipeness.uid);
                const companyUserSnapRipeness = await getDoc(companyUserRefRipeness);
                if (companyUserSnapRipeness.exists()) {
                    const companyUserDataRipeness = companyUserSnapRipeness.data() as CompanyUser;
                    sessionData.hasRipenessAccess = true;
                    sessionData.ripenessCompanyId = companyUserDataRipeness.companyId;
                }
            }
        } catch (error) {
            ripenessChecked = true;
            console.warn("Login Ripeness gagal:", (error as Error).message);
        }
    } else {
        // Jika GanoAI berhasil dan bukan premium, kita anggap Ripeness tidak perlu dicek untuk login ini
        ripenessChecked = true; 
    }

    if (sessionData.hasGanoAIAccess || sessionData.hasRipenessAccess) {
        cookies.set(SESSION_COOKIE_NAME, JSON.stringify(sessionData), {
            path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax', maxAge: 60 * 60 * 24 * 30
        });

        let redirectTo = '/'; // Fallback
        if (sessionData.hasGanoAIAccess) { // Prioritaskan GanoAI jika punya akses kedua-duanya
            redirectTo = '/dashboards/analytics-gano';
        } else if (sessionData.hasRipenessAccess) {
            redirectTo = '/dashboards/analytics-ripeness';
        }
        throw redirect(302, redirectTo);
    } else {
         if (ganoAIChecked && ripenessChecked) {
            return fail(401, { error: "Kredensial salah atau Anda tidak memiliki akses ke layanan." });
        }
        return fail(500, {error: "Gagal memproses login."});
    }
};

export const actions: Actions = { login };
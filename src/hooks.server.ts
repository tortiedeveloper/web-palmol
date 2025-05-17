// src/hooks.server.ts
import { redirect, type Handle } from '@sveltejs/kit';
import type { UserSessionData } from '$lib/types';

const SESSION_COOKIE_NAME = "app_session";
const PROTECTED_ROUTES_PREFIX = ['/dashboards', '/apps', '/monitoring', '/pengaturan']; 
const AUTH_ROUTES_PREFIX = ['/auth']; // Ini adalah grup rute autentikasi umum
const LOGOUT_PATH = '/auth/logout'; // Definisikan path logout secara spesifik

export const handle: Handle = async ({ event, resolve }) => {
    const sessionCookie = event.cookies.get(SESSION_COOKIE_NAME);
    event.locals.user = undefined; 

    if (sessionCookie) {
        try {
            const parsedCookie = JSON.parse(sessionCookie);
            if (parsedCookie && typeof parsedCookie.email === 'string' && 
                (typeof parsedCookie.hasGanoAIAccess === 'boolean' || typeof parsedCookie.hasRipenessAccess === 'boolean') &&
                (parsedCookie.hasGanoAIAccess || parsedCookie.hasRipenessAccess) ) {
                event.locals.user = parsedCookie as UserSessionData;
            } else {
                event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
            }
        } catch (error) {
            console.error("[HOOKS] Error parsing session cookie, deleting:", error);
            event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
        }
    }
    
    const currentPath = event.url.pathname;

    // Rute Terproteksi
    if (PROTECTED_ROUTES_PREFIX.some(prefix => currentPath.startsWith(prefix)) && !event.locals.user) {
        console.log(`[HOOKS] Protected route access denied for ${currentPath}, redirecting to sign-in.`);
        throw redirect(303, `/auth/sign-in?redirectTo=${encodeURIComponent(currentPath)}`);
    }

    // Rute Autentikasi (jika sudah login)
    // PERBAIKAN KUNCI: JANGAN REDIRECT JIKA PATH SAAT INI ADALAH LOGOUT_PATH
    if (currentPath !== LOGOUT_PATH && AUTH_ROUTES_PREFIX.some(prefix => currentPath.startsWith(prefix)) && event.locals.user) {
        let redirectTo = '/'; 
        const loggedInUser = event.locals.user;

        if (loggedInUser.hasGanoAIAccess) {
            redirectTo = '/dashboards/analytics-gano';
        } else if (loggedInUser.hasRipenessAccess) {
            redirectTo = '/dashboards/analytics-ripeness';
        } else {
            console.warn("[HOOKS] User session exists but no valid access determined. Clearing session.");
            event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
            event.locals.user = undefined; 
            redirectTo = '/auth/sign-in';
        }
        
        if (redirectTo !== currentPath) {
            console.log(`[HOOKS] User already logged in, redirecting from ${currentPath} to: ${redirectTo}`);
            throw redirect(303, redirectTo);
        }
    }
    
    return resolve(event); 
};
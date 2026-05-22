// src/routes/api/gano-active-company/+server.ts
import { json, error as SvelteKitError, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { UserSessionData } from '$lib/types';

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
    const userSession = locals.user;

    // 1. Verifikasi user login
    if (!userSession || !userSession.hasGanoAIAccess) {
        throw SvelteKitError(401, 'Unauthorized: Anda tidak memiliki akses GanoAI.');
    }

    try {
        const body = await request.json();
        const { companyId } = body;

        if (!companyId || typeof companyId !== 'string') {
            throw SvelteKitError(400, 'companyId wajib diisi dan harus string.');
        }

        // 2. Update session cookie
        const updatedSession: UserSessionData = {
            ...userSession,
            ganoAIActiveCompanyId: companyId,
        };

        // Ambil expires dari cookie yang ada atau set default 5 hari
        const existingCookie = cookies.get('app_session');
        let maxAge = 60 * 60 * 24 * 5; // 5 hari default
        
        cookies.set('app_session', JSON.stringify(updatedSession), {
            path: '/',
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            maxAge: maxAge,
            sameSite: 'lax',
        });

        console.log(`[API GanoActiveCompany] User ${userSession.email} switched to company: ${companyId}`);

        return json({ 
            status: 'success', 
            message: 'Kebun aktif berhasil diubah.',
            activeCompanyId: companyId 
        });

    } catch (error: any) {
        console.error('[API GanoActiveCompany] Error:', error);
        if (error.status && error.body) {
            throw error;
        }
        throw SvelteKitError(500, error.message || 'Gagal mengubah kebun aktif.');
    }
};

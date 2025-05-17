// src/routes/+layout.server.ts
import { getMenuItems } from '$lib/helpers/menu';
import type { LayoutServerLoad } from './$types';
import type { UserSessionData } from '$lib/types'; // Pastikan tipe ini ada di $lib/types

export const load: LayoutServerLoad = async ({ locals }) => {
    // locals.user diisi oleh hooks.server.ts
    const userSession = locals.user as UserSessionData | undefined; 

    return {
        userSession: userSession, // Untuk digunakan di Topbar atau bagian lain dari layout
        menuItemsForLayout: getMenuItems(userSession) // Menu yang sudah difilter, ganti nama agar tidak bentrok
    };
};
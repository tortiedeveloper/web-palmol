// src/hooks.client.ts (ULTRA MINIMAL TEST v2)
import type { HandleFetch } from '@sveltejs/kit';
import { browser } from '$app/environment'; // Pastikan ini diimpor jika digunakan

console.log('[HOOKS.CLIENT - ULTRA MINIMAL v2] File evaluated.');

export const handleFetch: HandleFetch = async ({ request, fetch, event }) => {
    // 'event' di sini adalah RequestEvent dari SvelteKit
    if (browser) { // Pastikan hanya berjalan di browser
        // Log ini akan muncul untuk SETIAP fetch yang dibuat oleh SvelteKit di klien
        console.log(
            `[HOOKS.CLIENT - ULTRA MINIMAL v2] handleFetch INTERCEPTED: ${request.method} ${request.url}, Current Route ID: ${event.route.id}`
        );
    }
    
    return fetch(request); // Selalu panggil fetch asli
};
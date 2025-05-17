// src/app.d.ts
import type { UserSessionData } from '$lib/types'; // Impor tipe session Anda

declare global {
    namespace App {
        interface Error {
            message: string;
            errorId?: string; // Jika Anda menggunakan errorId seperti di hook
        }
        interface Locals {
            user?: UserSessionData; // Tambahkan properti user di sini
        }
        // interface PageData {} // Biarkan SvelteKit yang mengisi ini per rute
        // interface Platform {}
    }
}

export {}; // Baris ini penting agar file dianggap sebagai module
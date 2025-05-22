// src/routes/apps/palmol/+page.server.ts
import type { PageServerLoad } from './$types';
import { ripenessDbAdmin } from '$lib/server/adminRipeness';
import admin from 'firebase-admin';
import { error as svelteKitError, redirect } from '@sveltejs/kit';
// Pastikan tipe PKS dan PKSRawDates (atau nama yang Anda gunakan) diimpor dari $lib/types
import type { PKS, UserSessionData, PKSRawDates } from '$lib/types';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
dayjs.locale('id');

function formatAdminTimestampToDisplay(timestamp: admin.firestore.Timestamp | string | undefined | null): string {
    if (!timestamp) return 'N/A';
    try {
        const dateObj = (typeof timestamp === 'string') ? new Date(timestamp) : timestamp.toDate();
        if (isNaN(dateObj.getTime())) return 'Invalid Date';
        return dayjs(dateObj).format('DD MMM YYYY, HH:mm'); // Format lebih panjang untuk tampilan
    } catch (e) {
        console.error("Error formatting admin timestamp:", e);
        return 'Format Error';
    }
}

function serializeAdminTimestamp(timestamp: admin.firestore.Timestamp | undefined | null): string | null {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
    }
    return null;
}

export const load: PageServerLoad = async ({ locals }) => {
    const userSession = locals.user as UserSessionData | undefined;

    if (!userSession?.hasRipenessAccess || !userSession.ripenessCompanyId) {
        throw redirect(303, '/auth/sign-in');
    }
    const companyIdToLoad = userSession.ripenessCompanyId;

    if (!ripenessDbAdmin) {
        console.error("[Palmol PKS List Load] Ripeness Admin DB tidak terinisialisasi!");
        throw svelteKitError(503, "Layanan data PKS tidak tersedia saat ini.");
    }
    const db = ripenessDbAdmin;

    console.log(`[Palmol PKS List Load] Memuat daftar PKS untuk Ripeness company: ${companyIdToLoad}`);

    try {
        const pksColRef = db.collection('pks');
        const q = pksColRef.where('companyId', '==', companyIdToLoad).orderBy('pksName', 'asc');
        const pksSnapshot = await q.get();

        if (pksSnapshot.empty) {
            return {
                pksList: [],
                message: 'Tidak ada PKS yang terdaftar untuk perusahaan Anda saat ini.'
            };
        }

        const pksList = pksSnapshot.docs.map(doc => {
            const data = doc.data();
            const createdDateFirestore = data.date?.createdDate as admin.firestore.Timestamp | undefined;
            const updatedDateFirestore = data.date?.updatedDate as admin.firestore.Timestamp | undefined;
            const validDateFirestore = data.date?.validDate as admin.firestore.Timestamp | undefined;
            const lastUpdatedFirestore = data.lastUpdated as admin.firestore.Timestamp | undefined;

            const relevantDateForUpdateDisplay = updatedDateFirestore || lastUpdatedFirestore || createdDateFirestore;

            const pksItem: PKS = {
                id: doc.id,
                pksId: data.pksId || doc.id,
                companyId: data.companyId,
                pksName: data.pksName || `PKS Tanpa Nama (${doc.id.substring(0, 6)})`,
                avatar: data.avatar || null,
                address: data.address || 'Alamat tidak tersedia',
                email: data.email || null,
                phoneNumber: data.phoneNumber || null,
                location: data.location,
                membership: data.membership || null,
                
                // Ini adalah string yang sudah diformat untuk tampilan langsung
                createdDateFormatted: formatAdminTimestampToDisplay(createdDateFirestore),
                updatedDateFormatted: formatAdminTimestampToDisplay(relevantDateForUpdateDisplay),

                // Ini adalah string ISO untuk objek 'date' (jika tipe PKS.date sudah diubah ke PKSRawDates)
                date: {
                    createdDate: serializeAdminTimestamp(createdDateFirestore),
                    updatedDate: serializeAdminTimestamp(updatedDateFirestore), // atau relevantDateForUpdate jika lebih cocok
                    validDate: serializeAdminTimestamp(validDateFirestore)
                } as PKSRawDates // Lakukan cast ke tipe yang benar jika PKS.date didefinisikan
            };
            return pksItem;
        });

        return {
            pksList: pksList,
            message: null
        };

    } catch (error: any) {
        console.error("[Palmol PKS List] Error mengambil daftar PKS:", error);
        throw svelteKitError(500, `Gagal memuat daftar PKS: ${error.message}`);
    }
};
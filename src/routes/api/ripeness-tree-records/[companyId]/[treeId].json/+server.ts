// src/routes/api/ripeness-tree-records/[companyId]/[treeId].json/+server.ts
import { json, error as svelteKitError, type RequestEvent } from '@sveltejs/kit';
import type { UserSessionData, TreeRecord, TimelineEventType } from '$lib/types';
import { ripenessDbAdmin } from '$lib/server/adminRipeness';
import admin from 'firebase-admin';

interface ApiParams { // Definisikan tipe Params secara eksplisit
    companyId: string;
    treeId: string;
}

function serializeAdminTimestamp(timestamp: admin.firestore.Timestamp | undefined | null): string | null {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
    }
    return null;
}

export const GET = async (event: RequestEvent): Promise<Response> => {
    const params = event.params as unknown as ApiParams; // Gunakan assertion ganda
    const locals = event.locals;

    const userSession = locals.user as UserSessionData | undefined;
    const { companyId: companyIdFromParam, treeId } = params;

    if (!userSession?.hasRipenessAccess) {
        throw svelteKitError(403, 'Akses ditolak.');
    }
    if (userSession.ripenessCompanyId !== companyIdFromParam) {
        throw svelteKitError(403, 'Akses ditolak ke data perusahaan ini.');
    }
    if (!treeId) {
        throw svelteKitError(400, 'ID Pohon diperlukan.');
    }
    if (!ripenessDbAdmin) {
        console.error("[API RipenessTreeRecords] Ripeness Admin DB tidak terinisialisasi!");
        throw svelteKitError(503, "Layanan data Ripeness tidak tersedia.");
    }

    console.log(`[API RipenessTreeRecords] Fetching records for company: ${companyIdFromParam}, tree: ${treeId}`);

    try {
        const usersMap = new Map<string, string>();
        const usersColRef = ripenessDbAdmin.collection('users');
        const companyUsersQuery = usersColRef.where('companyId', '==', companyIdFromParam);
        const usersSnapshot = await companyUsersQuery.get();
        usersSnapshot.forEach(userDoc => {
            usersMap.set(userDoc.id, userDoc.data().name || 'Tanpa Nama');
        });

        const recordsRef = ripenessDbAdmin.collection(`company/${companyIdFromParam}/tree/${treeId}/record`);
        const recordsQuery = recordsRef.orderBy("date.createdDate", "desc");
        const recordsSnapshot = await recordsQuery.get();

        const timelineEvents: TimelineEventType[] = [];

        for (const recordDoc of recordsSnapshot.docs) {
            const recordData = recordDoc.data();
            const recordCreatedDateFirestore = recordData.date?.createdDate as admin.firestore.Timestamp | undefined;
            let jsRecordCreatedDate: Date | null = null;

            if (recordCreatedDateFirestore && typeof recordCreatedDateFirestore.toDate === 'function') {
                jsRecordCreatedDate = recordCreatedDateFirestore.toDate();
            }

            if (!jsRecordCreatedDate || isNaN(jsRecordCreatedDate.getTime())) {
                console.warn(`[API RipenessTreeRecords] Invalid or missing createdDate for record ${recordDoc.id}, skipping.`);
                continue;
            }

            let reportedBy = recordData.userId ? (usersMap.get(recordData.userId) || recordData.userId) : 'Sistem';
            
            let eventTitle = "Update Kematangan Buah";
            let eventBadge: string | undefined = "Update"; // Default badge

            if (recordData.fruitCounts) {
                const fc = recordData.fruitCounts;
                eventTitle = `Matang: ${fc.matang || 0}, Mentah: ${fc.belumMatang || 0}, Busuk: ${fc.terlaluMatang || 0}`;
                if ((fc.matang || 0) > 0) eventBadge = "Panen";
                else if ((fc.terlaluMatang || 0) > 0) eventBadge = "Busuk";
                else if ((fc.belumMatang || 0) > 0) eventBadge = "Mentah";
            } else if (recordData.status) { // Fallback ke status jika ada
                eventTitle = recordData.status;
                eventBadge = recordData.status;
            }

            timelineEvents.push({
                originalDateISO: jsRecordCreatedDate.toISOString(),
                title: eventTitle,
                description: recordData.description || "Tidak ada deskripsi.",
                badge: eventBadge,
                imageUrl: recordData.img,
                reportedBy: reportedBy
            });
        }
        
        return json({ timelineEvents });

    } catch (error: any) {
        console.error(`[API RipenessTreeRecords] Error fetching records for tree ${treeId}:`, error);
        throw svelteKitError(500, `Gagal mengambil riwayat pohon Ripeness: ${error.message}`);
    }
};
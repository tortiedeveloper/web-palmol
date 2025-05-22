// src/routes/api/gano-tree-records/[companyId]/[treeId]/+server.ts
import { json, error as svelteKitError, type RequestEvent } from '@sveltejs/kit';
// RequestHandler tidak lagi diimpor secara eksplisit karena kita mengetik GET secara langsung
import type { UserSessionData, TreeRecord, TimelineEventType } from '$lib/types';
import { ganoAIDbAdmin } from '$lib/server/adminGanoAI';
import admin from 'firebase-admin';

interface ApiRouteParams {
    companyId: string;
    treeId: string;
}

function serializeAdminTimestamp(timestamp: admin.firestore.Timestamp | undefined | null): string | null {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
    }
    return null;
}

function getStatusDisplayForRecord(status: string | undefined): { text: string, badgeText: string, color: string, icon: string } {
    const s = status?.toLowerCase();
    if (s === 'sick') return { text: 'Terindikasi Sakit (Ganoderma)', badgeText: 'Sakit', color: 'danger', icon: 'mdi:virus-off-outline' };
    if (s === 'recovered') return { text: 'Sudah Pulih', badgeText: 'Pulih', color: 'success', icon: 'mdi:leaf-check-outline' };
    if (s === 'maintenance') return { text: 'Dalam Perawatan', badgeText: 'Perawatan', color: 'info', icon: 'mdi:tools' };
    return { text: status || 'N/A', badgeText: status || 'N/A', color: 'secondary', icon: 'mdi:help-circle-outline' };
}

export const GET = async (event: RequestEvent): Promise<Response> => {
    // PERBAIKAN: Gunakan assertion ganda
    const params = event.params as unknown as ApiRouteParams;
    const locals = event.locals;

    const userSession = locals.user as UserSessionData | undefined;
    const { companyId: companyIdFromParam, treeId } = params;

    if (!userSession?.hasGanoAIAccess) {
        throw svelteKitError(403, 'Akses ditolak.');
    }
    if (userSession.ganoAICompanyId !== companyIdFromParam) {
        throw svelteKitError(403, 'Akses ditolak ke data perusahaan ini.');
    }
    if (!treeId) {
        throw svelteKitError(400, 'ID Pohon diperlukan.');
    }
    if (!ganoAIDbAdmin) {
        console.error("[API GanoTreeRecords] GanoAI Admin DB tidak terinisialisasi!");
        throw svelteKitError(503, "Layanan data GanoAI tidak tersedia.");
    }

    console.log(`[API GanoTreeRecords] Fetching records for company: ${companyIdFromParam}, tree: ${treeId}`);

    try {
        const usersMap = new Map<string, string>();
        const usersColRef = ganoAIDbAdmin.collection('users');
        const companyUsersQuery = usersColRef.where('companyId', '==', companyIdFromParam);
        const usersSnapshot = await companyUsersQuery.get();
        usersSnapshot.forEach(userDoc => {
            usersMap.set(userDoc.id, userDoc.data().name || 'Tanpa Nama');
        });

        const recordsRef = ganoAIDbAdmin.collection(`company/${companyIdFromParam}/tree/${treeId}/record`);
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
                console.warn(`[API GanoTreeRecords] Invalid or missing createdDate for record ${recordDoc.id}, skipping.`);
                continue;
            }

            let reportedBy = recordData.userId ? (usersMap.get(recordData.userId) || recordData.userId) : 'Sistem';
            const statusInfo = getStatusDisplayForRecord(recordData.status);

            timelineEvents.push({
                originalDateISO: jsRecordCreatedDate.toISOString(),
                title: recordData.status ? statusInfo.text : "Update Riwayat",
                description: recordData.description || "Tidak ada deskripsi.",
                badge: recordData.status ? statusInfo.badgeText : undefined,
                imageUrl: recordData.img,
                reportedBy: reportedBy
            });
        }
        
        return json({ timelineEvents });

    } catch (error: any) {
        console.error(`[API GanoTreeRecords] Error fetching records for tree ${treeId}:`, error);
        throw svelteKitError(500, `Gagal mengambil riwayat pohon: ${error.message}`);
    }
};
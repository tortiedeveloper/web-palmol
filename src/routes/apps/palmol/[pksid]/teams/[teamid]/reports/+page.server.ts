// src/routes/apps/palmol/[pksid]/teams/[teamid]/reports/+page.server.ts
import type { PageServerLoad } from './$types';
import { ripenessDb } from '$lib/firebase/ripenessClient';
import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    Timestamp, 
    type Timestamp as FirebaseTimestampType, 
    type QueryDocumentSnapshot 
} from 'firebase/firestore';
import { error as svelteKitError, redirect } from '@sveltejs/kit';
import type { PKSReport, UserSessionData, User, PKSUser, AppError } from '$lib/types';

export const load: PageServerLoad = async ({ params, url, locals }) => {
    const userSession = locals.user as UserSessionData | undefined;
    const pksid_from_params = params.pksid; 
    const teamid_from_params = params.teamid; 
    
    if (!userSession || !userSession.hasRipenessAccess || !userSession.ripenessCompanyId) {
        throw redirect(303, '/auth/sign-in');
    }
    
    if (!pksid_from_params || !teamid_from_params) {
        throw svelteKitError(400, 'ID PKS dan ID Tim diperlukan.');
    }
    
    const pksCheckRef = doc(ripenessDb, 'pks', pksid_from_params);
    const pksCheckSnap = await getDoc(pksCheckRef);
    if (!pksCheckSnap.exists() || pksCheckSnap.data()?.companyId !== userSession.ripenessCompanyId) {
        throw svelteKitError(403, 'Akses ditolak ke PKS ini.');
    }

    // Baca parameter startDate dan endDate dari URL
    const startDateStr = url.searchParams.get('startDate'); // Format YYYY-MM-DD
    const endDateStr = url.searchParams.get('endDate');   // Format YYYY-MM-DD
    
    let filterStartDate: Date | undefined = undefined;
    let filterEndDate: Date | undefined = undefined;
    let isCurrentlyFiltered = false;

    if (startDateStr && endDateStr) {
        const parsedStartDate = new Date(startDateStr + "T00:00:00Z"); // Tambah Z untuk UTC
        const parsedEndDate = new Date(endDateStr + "T23:59:59.999Z"); // Tambah Z untuk UTC

        // Validasi tanggal
        if (!isNaN(parsedStartDate.getTime()) && !isNaN(parsedEndDate.getTime()) && parsedStartDate <= parsedEndDate) {
            filterStartDate = parsedStartDate;
            filterEndDate = parsedEndDate;
            isCurrentlyFiltered = true;
        } else {
            console.warn("Format tanggal filter tidak valid atau rentang tidak benar:", startDateStr, endDateStr);
            // Anda bisa memilih untuk mengabaikan filter atau menampilkan error
        }
    }

    try {
        const pksDocRef = doc(ripenessDb, 'pks', pksid_from_params);
        const pksDocSnap = await getDoc(pksDocRef);
        let namaPKS = `PKS (${pksid_from_params})`;
        if (pksDocSnap.exists()) {
            namaPKS = pksDocSnap.data()?.pksName || namaPKS;
        }

        const teamDocRef = doc(ripenessDb, `pks/${pksid_from_params}/teams`, teamid_from_params);
        const teamDocSnap = await getDoc(teamDocRef);
        let teamName = `Tim (${teamid_from_params})`;
        if (teamDocSnap.exists()) {
            teamName = teamDocSnap.data()?.teamName || teamName;
        } else {
            throw svelteKitError(404, `Tim dengan ID ${teamid_from_params} tidak ditemukan.`);
        }

        const usersMap = new Map<string, string>();
        const reportsColRef = collection(ripenessDb, `pks/${pksid_from_params}/reports`);
        let q = query(reportsColRef, where('teamId', '==', teamid_from_params));

        if (isCurrentlyFiltered && filterStartDate && filterEndDate) {
            const startTimestamp = Timestamp.fromDate(filterStartDate);
            const endTimestamp = Timestamp.fromDate(filterEndDate);
            q = query(q, where('date', '>=', startTimestamp), where('date', '<=', endTimestamp));
        }
        // Selalu urutkan, bahkan jika tidak difilter
        q = query(q, orderBy('date', 'desc')); 
        
        const reportsSnapshot = await getDocs(q);
        
        const reportListPromises = reportsSnapshot.docs.map(async (reportDoc: QueryDocumentSnapshot) => {
            const data = reportDoc.data();
            const berat = Number(data.jumlahBerat) || 0;
            
            let formattedDate = 'N/A';
            const reportDateFirestore = data.date as FirebaseTimestampType | undefined;
            let originalDateSerializable: string | null = null;

            if (reportDateFirestore && typeof reportDateFirestore.toDate === 'function') {
                const jsDate = reportDateFirestore.toDate();
                formattedDate = jsDate.toLocaleDateString('id-ID', {
                    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                originalDateSerializable = jsDate.toISOString();
            }

            let userName = data.userId || 'Tidak diketahui';
            if (data.userId) {
                if (usersMap.has(data.userId)) {
                    userName = usersMap.get(data.userId)!;
                } else {
                    try {
                        const userDocRef = doc(ripenessDb, 'pksUsers', data.userId); // Ganti 'pksUsers' jika nama koleksi berbeda
                        const userDocSnap = await getDoc(userDocRef);
                        if (userDocSnap.exists()) {
                            const userData = userDocSnap.data() as PKSUser;
                            const nameFromDb = userData.name || data.userId;
                            usersMap.set(data.userId, nameFromDb);
                            userName = nameFromDb;
                        } else {
                            usersMap.set(data.userId, data.userId); 
                        }
                    } catch (userError) {
                        console.error(`Gagal mengambil data pengguna untuk ID ${data.userId}:`, userError);
                        usersMap.set(data.userId, data.userId); 
                    }
                }
            }

            return {
                id: reportDoc.id,
                date: formattedDate,
                originalDate: originalDateSerializable,
                img: data.imgUrl || data.img || null,
                jumlahBerat: berat,
                userId: data.userId,
                userName: userName,
                teamId: data.teamId, 
            } as PKSReport;
        });

        const reportList = await Promise.all(reportListPromises);
        const totalBeratGlobalTim = reportList.reduce((acc, report) => acc + report.jumlahBerat, 0);
        
        let message: string | null = null;
        if (reportList.length === 0) {
            message = isCurrentlyFiltered ? 'Tidak ada laporan untuk rentang tanggal yang dipilih.' : 'Belum ada laporan untuk tim ini.';
        }

        return {
            pksId: pksid_from_params, 
            teamId: teamid_from_params, 
            namaPKS, 
            teamName, 
            reportList,
            totalBeratTim: totalBeratGlobalTim, 
            message,
            // Kembalikan string tanggal yang diterima dari URL untuk diisi kembali ke FlatPicker
            startDate: isCurrentlyFiltered ? startDateStr : undefined, 
            endDate: isCurrentlyFiltered ? endDateStr : undefined,
            isCurrentlyFiltered
        };

    } catch (errorObj: any) {
        console.error(`Error mengambil laporan (PKS: ${pksid_from_params}, Tim: ${teamid_from_params}):`, errorObj);
        if (errorObj.status && typeof errorObj.message === 'string') {
             throw errorObj;
        }
        throw svelteKitError(500, `Gagal memuat laporan tim: ${errorObj.message}`);
    }
};
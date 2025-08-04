// src/routes/apps/spread-potential-gano/+page.server.ts
import { redirect, error as svelteKitError, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Tree, UserSessionData } from '$lib/types';
import { ganoAIDbAdmin } from '$lib/server/adminGanoAI';
import admin from 'firebase-admin';
import { env } from '$env/dynamic/private';

interface FinancialParameters {
	hargaTbsPerKg: number;
	produksiTbsTahunanPerPohon: number;
	tingkatDiskontoTahunan: number;
	probabilitasInfeksiKritis: number;
	kurvaPenurunanHasil: number[];
	biayaPerPohon: number;
	hargaBibit: number;
}

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371e3;
	const φ1 = (lat1 * Math.PI) / 180;
	const φ2 = (lat2 * Math.PI) / 180;
	const Δφ = ((lat2 - lat1) * Math.PI) / 180;
	const Δλ = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
		Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

function serializeAdminTimestamp(
	timestamp: admin.firestore.Timestamp | undefined | null
): string | null {
	if (timestamp && typeof timestamp.toDate === 'function') {
		return timestamp.toDate().toISOString();
	}
	return null;
}

function hitungKerugianNpvPerPohon(params: FinancialParameters): { total: number; breakdown: number[] } {
	const breakdown: number[] = [];
	for (let i = 0; i < params.kurvaPenurunanHasil.length; i++) {
		const tahun = i + 1;
		const persentaseKerugian = params.kurvaPenurunanHasil[i];
		const kerugianRupiah =
			params.produksiTbsTahunanPerPohon * persentaseKerugian * params.hargaTbsPerKg;
		const kerugianSaatIni = kerugianRupiah / Math.pow(1 + params.tingkatDiskontoTahunan, tahun);
		breakdown.push(kerugianSaatIni);
	}
	const totalKerugianPendapatan = breakdown.reduce((sum, val) => sum + val, 0);
	const total = totalKerugianPendapatan + (params.hargaBibit || 0);
	return { total, breakdown };
}

async function getAiAnalysis(summaryForAI: any) {
	try {
		const prompt = `Anda adalah seorang konsultan ahli agribisnis kelapa sawit. Berikan laporan analisis dan rekomendasi profesional berdasarkan data wabah Ganoderma berikut. Gunakan format Markdown dengan subjudul yang jelas.

		Data Laporan:
		- Jumlah Pohon Terinfeksi Saat Ini: ${summaryForAI.jumlahPohonSakit}
		- Jumlah Pohon Sehat di Zona Kritis (risiko tinggi): ${summaryForAI.jumlahPohonZonaKritis}
		- Total Proyeksi Kerugian Pendapatan (NPV): Rp ${summaryForAI.totalPotensiKerugian.toLocaleString('id-ID')}
		- Total Estimasi Biaya Perawatan (Investasi): Rp ${summaryForAI.totalBiayaInvestasi.toLocaleString('id-ID')}
		- Proyeksi Return on Investment (ROI): ${summaryForAI.proyeksiROI}%
		- Biaya Penggantian Bibit per Pohon: Rp ${summaryForAI.hargaBibit.toLocaleString('id-ID')}

		Tolong buat laporan dengan struktur berikut:

		### Ringkasan Eksekutif
		(Berikan gambaran umum situasi dalam 2-3 kalimat.)

		### Analisis Risiko & Urgensi
		(Jelaskan tingkat kegawatan berdasarkan jumlah pohon sakit dan kritis. Apa risiko terbesarnya jika tidak ditangani?)

		### Analisis Finansial (ROI)
		(Jelaskan apakah investasi perawatan ini layak secara finansial berdasarkan angka ROI. Sebutkan perbandingan antara biaya dan potensi pendapatan yang diselamatkan.)

		### Rekomendasi Tindakan
		(Berikan 2-3 poin rekomendasi tindakan yang paling prioritas untuk dilakukan oleh manajer perkebunan.)`;

		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': env.YOUR_SITE_URL || 'http://localhost',
				'X-Title': env.YOUR_SITE_NAME || 'GanoAI Dashboard'
			},
			body: JSON.stringify({
				model: 'google/gemini-flash-1.5',
				messages: [{ role: 'user', content: prompt }]
			})
		});

		if (!response.ok) {
			const errorBody = await response.text();
			throw new Error(`OpenRouter API error: ${response.status} ${errorBody}`);
		}

		const result = await response.json();
		return result.choices[0].message.content;
	} catch (error: any) {
		console.error('Gagal mengambil analisis AI:', error.message);
		return 'Analisis AI tidak tersedia saat ini karena terjadi kesalahan koneksi.';
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	const userSession = locals.user as UserSessionData | undefined;
	if (!userSession?.hasGanoAIAccess || !userSession.ganoAICompanyId) {
		throw redirect(303, '/auth/sign-in');
	}
	const companyIdToLoad = userSession.ganoAICompanyId;
	if (!ganoAIDbAdmin) {
		throw svelteKitError(503, 'Layanan data GanoAI tidak tersedia.');
	}
	try {
		const companyRef = ganoAIDbAdmin.collection('company').doc(companyIdToLoad);
		const companyDoc = await companyRef.get();
		if (!companyDoc.exists) {
			throw svelteKitError(404, `Data perusahaan tidak ditemukan.`);
		}
		const companyData = companyDoc.data();
		const companyName = companyData?.company_name || 'Perusahaan Anda';

		const settingsRef = ganoAIDbAdmin.collection('company_settings').doc(companyIdToLoad);
		const settingsDoc = await settingsRef.get();
		if (!settingsDoc.exists) {
			throw svelteKitError(404, `Pengaturan finansial untuk perusahaan Anda tidak ditemukan.`);
		}
		const financialParams = settingsDoc.data() as FinancialParameters;
		if (financialParams.biayaPerPohon === undefined) financialParams.biayaPerPohon = 0;
		if (financialParams.hargaBibit === undefined) financialParams.hargaBibit = 0;

		const treesColRef = ganoAIDbAdmin.collection(`company/${companyIdToLoad}/tree`);
		const allTreesSnapshot = await treesColRef.get();
		const allTrees: Tree[] = [];
		allTreesSnapshot.forEach((doc) => {
			const data = doc.data();
			if (data.location?.latitude != null && data.location?.longitude != null) {
				allTrees.push({
					id: doc.id,
					...data,
					date: {
						createdDate: serializeAdminTimestamp(
							data.date?.createdDate as admin.firestore.Timestamp | undefined
						),
						updatedDate: serializeAdminTimestamp(
							data.date?.updatedDate as admin.firestore.Timestamp | undefined
						)
					}
				} as Tree);
			}
		});

		const sickTrees = allTrees.filter((t) => t.last_status === 'sick');
		const healthyTrees = allTrees.filter((t) => t.last_status !== 'sick');
		const threatenedTrees = new Map<
			string,
			{ tree: Tree; source: { id: string; name: string; distance: number }; level: 'critical' | 'warning' }
		>();
		const hotspotMap = new Map<string, { sickTree: Tree; criticalThreatsCount: number }>();
		sickTrees.forEach((st) => hotspotMap.set(st.id!, { sickTree: st, criticalThreatsCount: 0 }));

		for (const sickTree of sickTrees) {
			for (const healthyTree of healthyTrees) {
				const distance = getDistanceInMeters(
					sickTree.location!.latitude,
					sickTree.location!.longitude,
					healthyTree.location!.latitude,
					healthyTree.location!.longitude
				);
				if (distance <= 100) {
					const existingThreat = threatenedTrees.get(healthyTree.id!);
					const isNewThreatCritical = distance <= 10;
					if (
						!existingThreat ||
						(isNewThreatCritical && existingThreat.level === 'warning') ||
						distance < existingThreat.source.distance
					) {
						threatenedTrees.set(healthyTree.id!, {
							tree: healthyTree,
							source: {
								id: sickTree.id!,
								name: sickTree.name,
								distance: parseFloat(distance.toFixed(2))
							},
							level: isNewThreatCritical ? 'critical' : 'warning'
						});
					}
				}
			}
		}

		const criticalZoneTrees: any[] = [];
		const warningZoneTrees: any[] = [];
		for (const threat of threatenedTrees.values()) {
			if (threat.level === 'critical') {
				criticalZoneTrees.push({ tree: threat.tree, source: threat.source });
				const hotspot = hotspotMap.get(threat.source.id);
				if (hotspot) hotspot.criticalThreatsCount++;
			} else {
				warningZoneTrees.push({ tree: threat.tree, source: threat.source });
			}
		}
		const hotspots = Array.from(hotspotMap.values())
			.sort((a, b) => b.criticalThreatsCount - a.criticalThreatsCount)
			.slice(0, 5);

		const { total: kerugianNpvPerPohon, breakdown: kerugianBreakdownPerPohon } =
			hitungKerugianNpvPerPohon(financialParams);

		const kerugianPastiDariPohonSakit = sickTrees.length * kerugianNpvPerPohon;
		const potensiKerugianDariPohonKritis =
			criticalZoneTrees.length * kerugianNpvPerPohon * financialParams.probabilitasInfeksiKritis;
		const totalProyeksiKerugianPendapatan =
			kerugianPastiDariPohonSakit + potensiKerugianDariPohonKritis;

		const biayaPerawatanPohonSakit = sickTrees.length * financialParams.biayaPerPohon;
		const potensiBiayaPerawatanPohonKritis =
			criticalZoneTrees.length *
			financialParams.biayaPerPohon *
			financialParams.probabilitasInfeksiKritis;
		const totalEstimasiBiayaPerawatan =
			biayaPerawatanPohonSakit + potensiBiayaPerawatanPohonKritis;

		const potensiPendapatanDiselamatkan = totalProyeksiKerugianPendapatan;
		const hasilBersihIntervensi = potensiPendapatanDiselamatkan - totalEstimasiBiayaPerawatan;
		const proyeksiROI =
			totalEstimasiBiayaPerawatan > 0
				? (hasilBersihIntervensi / totalEstimasiBiayaPerawatan) * 100
				: 0;

		const yearlyBreakdownKerugian = kerugianBreakdownPerPohon.map(
			(yearlyLoss) =>
				sickTrees.length * yearlyLoss +
				criticalZoneTrees.length * yearlyLoss * financialParams.probabilitasInfeksiKritis
		);

		const financialImpact = {
			totalProyeksiKerugianPendapatan: totalProyeksiKerugianPendapatan,
			totalEstimasiBiayaPerawatan: totalEstimasiBiayaPerawatan,
			potensiPendapatanDiselamatkan: potensiPendapatanDiselamatkan,
			hasilBersihIntervensi: hasilBersihIntervensi,
			proyeksiROI: proyeksiROI,
			kerugianPerPohon: kerugianNpvPerPohon,
			yearlyBreakdown: yearlyBreakdownKerugian,
			parameter: financialParams
		};

		const summaryForAI = {
			jumlahPohonSakit: sickTrees.length,
			jumlahPohonZonaKritis: criticalZoneTrees.length,
			totalPotensiKerugian: Math.round(financialImpact.totalProyeksiKerugianPendapatan),
			totalBiayaInvestasi: Math.round(financialImpact.totalEstimasiBiayaPerawatan),
			proyeksiROI: financialImpact.proyeksiROI.toFixed(1),
			hargaBibit: financialParams.hargaBibit
		};

		return {
			companyName,
			sickTrees,
			criticalZoneTrees,
			warningZoneTrees,
			hotspots,
			stats: {
				criticalCount: criticalZoneTrees.length,
				warningCount: warningZoneTrees.length,
				hotspotCount: hotspots.filter((h) => h.criticalThreatsCount > 0).length
			},
			mapboxAccessToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN,
			financialImpact,
			message: null,
			aiAnalysis: getAiAnalysis(summaryForAI)
		};
	} catch (error: any) {
		console.error(`[SpreadPotential Server Load] Gagal memuat data:`, error);
		throw svelteKitError(500, `Gagal memuat data potensi penyebaran: ${error.message}`);
	}
};

export const actions: Actions = {
	updateSettings: async ({ request, locals }) => {
		const userSession = locals.user as UserSessionData | undefined;
		if (!userSession?.hasGanoAIAccess || !userSession.ganoAICompanyId) {
			return fail(403, { message: 'Akses ditolak.' });
		}
		if (!ganoAIDbAdmin) {
			return fail(503, { message: 'Layanan database tidak tersedia.' });
		}
		const companyId = userSession.ganoAICompanyId;
		const formData = await request.formData();

		try {
			const kurvaString = formData.get('kurvaPenurunanHasil') as string;
			const updatedData: FinancialParameters = {
				hargaTbsPerKg: parseFloat(formData.get('hargaTbsPerKg') as string),
				produksiTbsTahunanPerPohon: parseFloat(
					formData.get('produksiTbsTahunanPerPohon') as string
				),
				tingkatDiskontoTahunan: parseFloat(formData.get('tingkatDiskontoTahunan') as string),
				probabilitasInfeksiKritis: parseFloat(
					formData.get('probabilitasInfeksiKritis') as string
				),
				kurvaPenurunanHasil: kurvaString.split(',').map((s) => parseFloat(s.trim())),
				biayaPerPohon: parseFloat(formData.get('biayaPerPohon') as string),
				hargaBibit: parseFloat(formData.get('hargaBibit') as string)
			};

			if (
				Object.values(updatedData).some((v) => v === null || isNaN(v as number)) ||
				updatedData.kurvaPenurunanHasil.some(isNaN)
			) {
				return fail(400, { message: 'Semua field harus diisi dengan angka yang valid.' });
			}

			const settingsRef = ganoAIDbAdmin.collection('company_settings').doc(companyId);
			await settingsRef.set(updatedData, { merge: true });

			return { success: true, message: 'Parameter berhasil diperbarui.' };
		} catch (error: any) {
			console.error('Error updating settings:', error);
			return fail(500, { message: `Gagal menyimpan: ${error.message}` });
		}
	}
};
// src/routes/apps/kebun-status/+page.server.ts
import { redirect, error as svelteKitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { UserSessionData } from '$lib/types';
import { ganoAIDbAdmin } from '$lib/server/adminGanoAI';


const SAWITAI_API_KEY = 'wnxxXV5GNbiXMRKsaAqDJrmNqTAvLLKHt9m-KNHvRAo';
const SAWITAI_BASE_URL = 'https://sawitapi.tkraf.com';

export interface ComplianceData {
    eudr2020: {
        status: string;
        redFlagPercentage: number;
        dominantCover: string;
        komposisiDetail: Record<string, number>;
    };
    rspo2005: {
        status: string;
        redFlagPercentage: number;
        dominantCover: string;
        komposisiDetail: Record<string, number>;
    };
}

export interface GanodermaData {
    riskLevel: string;
    riskLevelShort: string;
    riskDescription: string;
    sawitDurationYears: number;
    karetDurationYears: number;
    gambutDurationYears: number;
    timeline: Record<string, string>;
}

export interface RiskPolygon {
    riskLevel: string;
    fillColor: string;
    coordinates: number[][];
}

interface KebunStatusPageData {
    companyName: string;
    companyId: string;
    compliance: ComplianceData | null;
    ganoderma: GanodermaData | null;
    riskPolygons: RiskPolygon[];
    landUseHistory: Record<string, string | null>;
    polygon: number[][];
    mapboxAccessToken: string;
    error: string | null;
}

function geoPointToLatLng(geoPoint: any): [number, number] {
    return [geoPoint.longitude, geoPoint.latitude];
}

export const load: PageServerLoad = async ({ locals }) => {
    console.log('[KebunStatus] Load function started');
    const userSession = locals.user as UserSessionData | undefined;
    
    // 1. Verifikasi akses
    if (!userSession?.hasGanoAIAccess) {
        console.log('[KebunStatus] No GanoAI access, redirecting');
        throw redirect(303, '/auth/sign-in');
    }

    const activeCompanyId = userSession.ganoAIActiveCompanyId || userSession.ganoAICompanyId;
    console.log('[KebunStatus] Active company ID:', activeCompanyId);
    
    if (!activeCompanyId || !ganoAIDbAdmin) {
        console.error('[KebunStatus] No active company or DB not initialized');
        throw svelteKitError(503, 'Data kebun tidak tersedia.');
    }

    try {
        // 2. Fetch company data & polygon
        console.log('[KebunStatus] Fetching company data...');
        const companyDoc = await ganoAIDbAdmin.collection('company').doc(activeCompanyId).get();
        
        if (!companyDoc.exists) {
            console.error('[KebunStatus] Company not found:', activeCompanyId);
            throw svelteKitError(404, 'Data kebun tidak ditemukan.');
        }

        const companyData = companyDoc.data();
        const companyName = companyData?.company_name || 'Kebun Tanpa Nama';
        console.log('[KebunStatus] Company found:', companyName);
        
        // Convert polygon GeoPoints to [lat, lng] array
        const polygon: number[][] = [];
        if (companyData?.polygon && Array.isArray(companyData.polygon)) {
            companyData.polygon.forEach((point: any) => {
                if (point.latitude && point.longitude) {
                    polygon.push([point.latitude, point.longitude]);
                }
            });
        }
        console.log('[KebunStatus] Polygon points:', polygon.length);

        // 3. Prepare GeoJSON
        if (polygon.length < 3) {
            console.error('[KebunStatus] Polygon has less than 3 points:', polygon.length);
            return {
                companyName,
                companyId: activeCompanyId,
                compliance: null,
                ganoderma: null,
                riskPolygons: [],
                landUseHistory: {},
                polygon,
                mapboxAccessToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '',
                error: 'Polygon kebun tidak valid (kurang dari 3 titik).',
            } as KebunStatusPageData;
        }
        
        const geojson = {
            type: 'Polygon',
            coordinates: [polygon.map(p => [p[1], p[0]])] // Convert to [lng, lat]
        };
        console.log('[KebunStatus] GeoJSON prepared with', polygon.length, 'points');

        // 4. Call SawitAI APIs
        let compliance: ComplianceData | null = null;
        let ganoderma: GanodermaData | null = null;
        let riskPolygons: RiskPolygon[] = [];
        let landUseHistory: Record<string, string | null> = {};
        let apiError: string | null = null;

        try {
            // Call all 3 APIs in parallel
            console.log('[KebunStatus] Calling SawitAI APIs...');
            const [legalRes, ganoRes, vectorRes] = await Promise.all([
                fetch(`${SAWITAI_BASE_URL}/verify-legal`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': SAWITAI_API_KEY,
                    },
                    body: JSON.stringify({
                        farmer_id: activeCompanyId,
                        geojson,
                    }),
                }),
                fetch(`${SAWITAI_BASE_URL}/analyze-ganoderma`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': SAWITAI_API_KEY,
                    },
                    body: JSON.stringify({
                        farmer_id: activeCompanyId,
                        geojson,
                    }),
                }),
                fetch(`${SAWITAI_BASE_URL}/analyze-ganoderma-vector`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': SAWITAI_API_KEY,
                    },
                    body: JSON.stringify({
                        farmer_id: activeCompanyId,
                        geojson,
                    }),
                }),
            ]);

            // Parse responses
            console.log('[KebunStatus] API Responses - legal:', legalRes.status, 'gano:', ganoRes.status, 'vector:', vectorRes.status);
            
            if (!legalRes.ok) {
                const legalError = await legalRes.text();
                console.error('[KebunStatus] Legal API error:', legalRes.status, legalError.substring(0, 200));
            }
            if (!ganoRes.ok) {
                const ganoError = await ganoRes.text();
                console.error('[KebunStatus] Gano API error:', ganoRes.status, ganoError.substring(0, 200));
            }
            if (!vectorRes.ok) {
                const vectorError = await vectorRes.text();
                console.error('[KebunStatus] Vector API error:', vectorRes.status, vectorError.substring(0, 200));
            }
            
            if (legalRes.ok) {
                const legalData = await legalRes.json();
                console.log('[KebunStatus] Legal data received:', legalData.module);
                compliance = {
                    eudr2020: {
                        status: legalData.eudr_2020?.status || 'UNKNOWN',
                        redFlagPercentage: legalData.eudr_2020?.red_flag_percentage || 0,
                        dominantCover: legalData.eudr_2020?.dominant_cover || '',
                        komposisiDetail: legalData.eudr_2020?.komposisi_detail || {},
                    },
                    rspo2005: {
                        status: legalData.rspo_2005?.status || 'UNKNOWN',
                        redFlagPercentage: legalData.rspo_2005?.red_flag_percentage || 0,
                        dominantCover: legalData.rspo_2005?.dominant_cover || '',
                        komposisiDetail: legalData.rspo_2005?.komposisi_detail || {},
                    },
                };
            }

            if (ganoRes.ok) {
                const ganoData = await ganoRes.json();
                const prediction = ganoData.ganoderma_prediction || {};
                const riskLevel = prediction.risk_level || 'RENDAH (Aman)';
                
                ganoderma = {
                    riskLevel,
                    riskLevelShort: riskLevel.includes('SANGAT TINGGI') ? 'SANGAT TINGGI' :
                                   riskLevel.includes('TINGGI') ? 'TINGGI' :
                                   riskLevel.includes('SEDANG') ? 'SEDANG' : 'RENDAH',
                    riskDescription: riskLevel.includes('SANGAT TINGGI') 
                        ? 'Siklus Replanting / Sawit Generasi 2+' :
                        riskLevel.includes('TINGGI') 
                        ? 'Transisi dari Kebun Karet ke Sawit' :
                        riskLevel.includes('SEDANG') 
                        ? 'Sawit mulai menua, pantau pangkal batang' :
                        'Aman - tidak ada riwayat sawit/karet',
                    sawitDurationYears: prediction.sawit_duration_years || 0,
                    karetDurationYears: prediction.karet_duration_years || 0,
                    gambutDurationYears: prediction.gambut_duration_years || 0,
                    timeline: prediction.timeline || {},
                };
            }

            if (vectorRes.ok) {
                const vectorData = await vectorRes.json();
                
                // Parse risk polygons
                if (vectorData.geojson?.features) {
                    riskPolygons = vectorData.geojson.features.map((f: any) => ({
                        riskLevel: f.properties?.risk_level || 'RENDAH',
                        fillColor: f.properties?.fill_color || '#00CC66',
                        coordinates: f.geometry?.coordinates?.[0] || [],
                    }));
                }

                // Parse land use history
                if (vectorData.land_use_history) {
                    landUseHistory = vectorData.land_use_history;
                }
            }

        } catch (apiErr: any) {
            console.error('[KebunStatus] API Error:', apiErr.message || apiErr);
            apiError = 'Gagal mengambil data analisis dari SawitAI. Silakan coba lagi nanti.';
        }

        console.log('[KebunStatus] Returning data - compliance:', !!compliance, 'ganoderma:', !!ganoderma);

        const mapboxAccessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

        return {
            companyName,
            companyId: activeCompanyId,
            compliance,
            ganoderma,
            riskPolygons,
            landUseHistory,
            polygon,
            mapboxAccessToken,
            error: apiError,
        } as KebunStatusPageData;

    } catch (error: any) {
        console.error('[KebunStatus] Error:', error);
        throw svelteKitError(500, 'Gagal memuat data status kebun.');
    }
};

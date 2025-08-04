# functions/main.py

# --- PINDAHKAN BLOK INISIALISASI KE ATAS ---
import firebase_admin
firebase_admin.initialize_app()
# --- AKHIR BLOK ---

import sys
import os

# Menambahkan direktori 'functions' ke dalam path Python
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Impor library lainnya setelah inisialisasi
from firebase_admin import credentials, firestore, auth as firebase_auth
from firebase_functions import https_fn, options, scheduler_fn
from datetime import datetime, timezone

# Impor modul lokal Anda
from tasks import daily_report


# Atur region setelah inisialisasi
options.set_global_options(region=options.SupportedRegion.ASIA_SOUTHEAST2)

@https_fn.on_call()
def manage_user_access_claims(req: https_fn.CallableRequest) -> https_fn.Response:
    if req.auth is None:
        print("Permintaan tidak terautentikasi.")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Fungsi ini harus dipanggil oleh pengguna yang terautentikasi."
        )

    uid = req.auth.uid
    db = firestore.client()
    print(f"Memproses permintaan custom claims untuk UID: {uid}")

    try:
        company_user_ref = db.collection('companyUser').document(uid)
        company_user_snap = company_user_ref.get()

        if not company_user_snap.exists:
            print(f"Dokumen companyUser untuk UID {uid} tidak ditemukan. Menetapkan claims default.")
            default_claims = {
                'hasGanoAIAccess': False, 'ganoAICompanyId': None,
                'hasRipenessAccess': False, 'ripenessCompanyId': None,
                'role': 'no_company_user'
            }
            firebase_auth.set_custom_user_claims(uid, default_claims)
            return {"status": "success", "message": "Pengguna tidak terdaftar, akses default ditetapkan."}

        user_data = company_user_snap.to_dict()
        if not user_data:
             print(f"Data pengguna kosong untuk UID {uid} meskipun dokumen ada. Menetapkan claims default.")
             default_claims = {
                'hasGanoAIAccess': False, 'ganoAICompanyId': None,
                'hasRipenessAccess': False, 'ripenessCompanyId': None,
                'role': 'empty_user_data'
            }
             firebase_auth.set_custom_user_claims(uid, default_claims)
             return {"status": "success", "message": "Data pengguna kosong, akses default ditetapkan."}

        memberships = user_data.get('membership', [])
        valid_date_timestamp = user_data.get('validDate') # Firestore Timestamp (Python datetime naive UTC)
        
        is_active = True
        if valid_date_timestamp:
            # valid_date_timestamp adalah datetime.datetime dari Firestore
            if isinstance(valid_date_timestamp, datetime):
                # Buat kedua datetime menjadi timezone-aware UTC untuk perbandingan yang aman
                aware_valid_date = valid_date_timestamp.replace(tzinfo=timezone.utc)
                now_aware_utc = datetime.now(timezone.utc)
                
                if aware_valid_date < now_aware_utc: # PERBANDINGAN YANG DIPERBAIKI
                    print(f"Akun pengguna {uid} telah kedaluwarsa pada {valid_date_timestamp} (UTC). Sekarang: {now_aware_utc}")
                    is_active = False
            else:
                print(f"Tipe validDate tidak dikenali (bukan datetime) untuk UID {uid}: {type(valid_date_timestamp)}. Menganggap tidak aktif.")
                is_active = False
        
        gano_ai_company_id = user_data.get('ganoAICompanyId') if isinstance(user_data.get('ganoAICompanyId'), str) else None
        ripeness_company_id = user_data.get('ripenessCompanyId') if isinstance(user_data.get('ripenessCompanyId'), str) else None

        claims = {
            'hasGanoAIAccess': is_active and ('ganoAI' in memberships),
            'ganoAICompanyId': gano_ai_company_id if is_active and ('ganoAI' in memberships) else None,
            'hasRipenessAccess': is_active and ('ripeness' in memberships),
            'ripenessCompanyId': ripeness_company_id if is_active and ('ripeness' in memberships) else None,
            'accountActive': is_active
        }

        import json as py_json # Pindahkan impor ke atas jika sering digunakan
        if len(py_json.dumps(claims)) > 1000:
            print(f"ERROR: Ukuran custom claims melebihi 1000 byte untuk UID {uid}. Claims: {claims}")
            minimal_claims = {
                'hasGanoAIAccess': claims['hasGanoAIAccess'],
                'hasRipenessAccess': claims['hasRipenessAccess'],
                'accountActive': claims['accountActive']
            }
            firebase_auth.set_custom_user_claims(uid, minimal_claims)
            print(f"Menetapkan custom claims minimal karena batasan ukuran untuk UID {uid}: {minimal_claims}")
        else:
            firebase_auth.set_custom_user_claims(uid, claims)
            print(f"Custom claims berhasil ditetapkan untuk UID {uid}: {claims}")
        
        return {"status": "success", "claimsSet": claims}

    except Exception as e:
        print(f"!!! EXCEPTION UMUM: Gagal menetapkan custom claims untuk UID {uid}: {type(e).__name__} - {e}")
        import traceback
        traceback.print_exc()
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Server mengalami kesalahan internal saat memproses permintaan Anda.",
            details=f"Error type: {type(e).__name__}"
        )
    

@scheduler_fn.on_schedule(
    schedule="0 17 * * *", # Jam 5 sore setiap hari
    timezone=scheduler_fn.Timezone("Asia/Jakarta"),
    # MODIFIKASI: Ganti dengan secret Twilio yang baru
    secrets=["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_NUMBER"]
)
def dailyganodermareport(event: scheduler_fn.ScheduledEvent) -> None:
    """
    Menjalankan pengecekan harian untuk lonjakan Ganoderma dan mengirim laporan.
    """
    try:
        daily_report.run_daily_check()
    except Exception as e:
        print(f"!!! CRITICAL ERROR dalam dailyganodermareport: {e}")
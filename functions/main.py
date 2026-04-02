# main.py
import os
import smtplib
import firebase_admin
import json as py_json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from firebase_admin import credentials, firestore, auth as firebase_auth, get_app
from firebase_functions import https_fn, scheduler_fn, options
from datetime import datetime, timezone

# Inisialisasi hanya jika belum ada (Ini untuk database utama / Sawit Pintar)
if not firebase_admin._apps:
    firebase_admin.initialize_app()

# Atur region secara global
options.set_global_options(region=options.SupportedRegion.ASIA_SOUTHEAST2)

# ==========================================
# FUNGSI HELPER & INISIALISASI DATABASE KEDUA
# ==========================================
def get_ganoai_db():
    app_name = 'ganoAIAdmin'
    try:
        gano_app = get_app(app_name)
    except ValueError:
        sa_string = os.environ.get('GANOAI_ADMIN_SDK_JSON')
        if not sa_string:
            print("ERROR: GANOAI_ADMIN_SDK_JSON tidak ditemukan di environment variables.")
            return None
        
        sa_dict = py_json.loads(sa_string)
        if 'private_key' in sa_dict:
            sa_dict['private_key'] = sa_dict['private_key'].replace('\\n', '\n')
            
        cred = credentials.Certificate(sa_dict)
        
        # --- PERBAIKAN DI SINI ---
        # Kita paksa Python untuk menggunakan project_id dari JSON
        # agar tidak nyasar ke database sawitpintar
        project_id = sa_dict.get('project_id')
        
        gano_app = firebase_admin.initialize_app(
            cred, 
            options={'projectId': project_id}, # KUNCI PERBAIKANNYA
            name=app_name
        )
        print(f"[{app_name}] Firebase Admin SDK diinisialisasi untuk project: {project_id}")
        
    return firestore.client(app=gano_app)

def send_alert_email(target_email, company_name, sick_trees_data, summary_data):
    sender_email = os.environ.get('SENDER_EMAIL')
    sender_password = os.environ.get('SENDER_PASSWORD')
    
    if not sender_email or not sender_password:
        print("ERROR: Kredensial email (SENDER_EMAIL / SENDER_PASSWORD) tidak diset di Environment Variables.")
        return

    # Susun isi pesan sesuai format yang diminta
    body = f"Halo Tim {company_name}, sistem GanoAI mendeteksi lonjakan kasus pohon terindikasi Ganoderma.\n\n"
    body += f"Total Pohon Sakit Baru saat Ini: {len(sick_trees_data)}\n\n"
    body += "Berikut daftarnya:\n\n"
    
    for i, tree in enumerate(sick_trees_data):
        body += f"- Pohon {tree.get('name', f'Tidak Bernama ({i+1})')}\n"
        body += f"  Deskripsi: {tree.get('description', 'Tidak ada deskripsi')}\n"
        body += f"  Kawasan: {tree.get('kawasan', 'Tidak ada kawasan')}\n"
        
        img_url = tree.get('img')
        if img_url:
            body += f"  (Lihat Foto: {img_url})\n"
        
        body += "  Mohon segera lakukan verifikasi.\n\n"
        
    body += "---\n"
    body += "Rangkuman Kesehatan Kebun:\n"
    body += f"Total Sakit: {summary_data['sick']} pohon\n"
    body += f"Dalam Perawatan: {summary_data['maintenance']} pohon\n"
    body += f"Sehat/Pulih: {summary_data['recovered']} pohon\n"

    # Setup MIME
    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = target_email
    msg['Subject'] = "PERINGATAN LONJAKAN GANODERMA"
    msg.attach(MIMEText(body, 'plain'))

    # Kirim via SMTP Gmail
    try:
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, target_email, msg.as_string())
        server.quit()
        print(f"Email peringatan berhasil dikirim ke {target_email} ({company_name})")
    except Exception as e:
        print(f"Gagal mengirim email ke {target_email}: {e}")

# ==========================================
# 1. SCHEDULER: DAILY GANODERMA ALERT
# ==========================================
@scheduler_fn.on_schedule(
    schedule="0 17 * * *", 
    timezone=scheduler_fn.Timezone("Asia/Jakarta"),
    timeout_sec=300,
    # TAMBAHKAN BARIS DI BAWAH INI:
    secrets=["GANOAI_ADMIN_SDK_JSON", "SENDER_EMAIL", "SENDER_PASSWORD"] 
)
def daily_ganoderma_alert(event: scheduler_fn.ScheduledEvent) -> None:
    print("Memulai proses pengecekan harian Ganoderma (17:00 WIB)...")
    
    db_main = firestore.client() # Database Sawit Pintar
    db_gano = get_ganoai_db()    # Database Sawit Care
    
    if not db_gano:
        print("Membatalkan eksekusi karena gagal terhubung ke database GanoAI.")
        return

    # Ambil semua dokumen user
    users_ref = db_main.collection('companyUser')
    users_docs = users_ref.stream()

    for user_doc in users_docs:
        user_data = user_doc.to_dict()
        company_name = user_data.get('companyName')
        target_email = user_data.get('email')
        gano_company_id = user_data.get('ganoAICompanyId')

        # Lewati jika data tidak lengkap
        if not company_name or not target_email or not gano_company_id:
            continue
            
        print(f"Mengecek kebun untuk {company_name}...")

        # Ambil data pohon dari database GanoAI
        trees_ref = db_gano.collection(f'company/{gano_company_id}/tree')
        trees_docs = trees_ref.stream()
        
        sick_trees_data = []
        summary_data = {'sick': 0, 'maintenance': 0, 'recovered': 0, 'other': 0}
        
        for tree_doc in trees_docs:
            tree_data = tree_doc.to_dict()
            status = tree_data.get('last_status', 'unknown').lower()
            
            if status == 'sick':
                summary_data['sick'] += 1
                sick_trees_data.append(tree_data)
            elif status == 'maintenance':
                summary_data['maintenance'] += 1
            elif status == 'recovered':
                summary_data['recovered'] += 1
            else:
                summary_data['other'] += 1

        # Kondisi: Kirim email jika pohon sakit lebih dari 5
        if len(sick_trees_data) > 5:
            print(f"Mendeteksi {len(sick_trees_data)} pohon sakit di {company_name}. Mengirim email...")
            send_alert_email(target_email, company_name, sick_trees_data, summary_data)
        else:
            print(f"Aman. Hanya ada {len(sick_trees_data)} pohon sakit di {company_name}.")
            
    print("Proses pengecekan harian selesai.")

# ==========================================
# 2. HTTP CALLABLE: MANAGE USER ACCESS CLAIMS
# ==========================================
@https_fn.on_call(
    cors=options.CorsOptions(
        cors_origins=[
            "http://localhost:5174", 
            "https://sawitpintar.firebaseapp.com",
            "https://web-palmol.vercel.app"
        ],
        cors_methods=["post"],
    )
)
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
        valid_date_timestamp = user_data.get('validDate')
        
        is_active = True
        if valid_date_timestamp:
            if isinstance(valid_date_timestamp, datetime):
                aware_valid_date = valid_date_timestamp.replace(tzinfo=timezone.utc)
                now_aware_utc = datetime.now(timezone.utc)
                
                if aware_valid_date < now_aware_utc:
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
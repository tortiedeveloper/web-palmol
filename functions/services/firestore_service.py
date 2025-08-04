# functions/services/firestore_service.py
from firebase_admin import firestore
from datetime import datetime, timedelta, timezone

# Variabel global untuk menyimpan koneksi, tapi diinisialisasi sebagai None
_db_client = None

def _get_db():
    """
    Fungsi helper untuk menginisialisasi Firestore client hanya sekali.
    Ini memastikan firestore.client() tidak dipanggil saat file diimpor.
    """
    global _db_client
    if _db_client is None:
        print("Inisialisasi koneksi Firestore...")
        _db_client = firestore.client()
    return _db_client

def get_companies_with_bot_config():
    """Mengambil semua perusahaan yang memiliki daftar nomor notifikasi WhatsApp."""
    db = _get_db() # Panggil koneksi di dalam fungsi
    return db.collection("company").where("whatsappNotificationNumbers", "!=", []).stream()

def get_company_settings(company_id: str):
    """Mengambil pengaturan spesifik sebuah perusahaan."""
    db = _get_db() # Panggil koneksi di dalam fungsi
    return db.collection("company_settings").document(company_id).get()

def get_newly_sick_trees(company_id: str):
    """Mendapatkan pohon yang statusnya menjadi 'sick' dalam 24 jam terakhir."""
    db = _get_db() # Panggil koneksi di dalam fungsi
    now = datetime.now(timezone.utc)
    yesterday = now - timedelta(days=1)
    
    trees_ref = db.collection(f"company/{company_id}/tree")
    query = trees_ref.where("last_status", "==", "sick") \
                     .where("date.updatedDate", ">=", yesterday) \
                     .where("date.updatedDate", "<=", now)
    return list(query.stream())

def get_plantation_stats(company_id: str):
    """Menghitung statistik total pohon berdasarkan status."""
    db = _get_db() # Panggil koneksi di dalam fungsi
    trees_ref = db.collection(f"company/{company_id}/tree")
    
    total_sick = trees_ref.where("last_status", "==", "sick").count().get()[0][0].value
    total_maintenance = trees_ref.where("last_status", "==", "maintenance").count().get()[0][0].value
    total_recovered = trees_ref.where("last_status", "==", "recovered").count().get()[0][0].value
    
    return {
        "sick": total_sick,
        "maintenance": total_maintenance,
        "recovered": total_recovered
    }
# functions/services/firestore_service.py
from firebase_admin import firestore
from datetime import datetime, timedelta, timezone

db = firestore.client()

def get_companies_with_bot_config():
    """Mengambil semua perusahaan yang memiliki whatsappGroupId."""
    return db.collection("company").where("whatsappGroupId", "!=", "").stream()

def get_company_settings(company_id: str):
    """Mengambil pengaturan spesifik sebuah perusahaan."""
    return db.collection("company_settings").document(company_id).get()

def get_newly_sick_trees(company_id: str):
    """Mendapatkan pohon yang statusnya menjadi 'sick' dalam 24 jam terakhir."""
    now = datetime.now(timezone.utc)
    yesterday = now - timedelta(days=1)
    
    trees_ref = db.collection(f"company/{company_id}/tree")
    query = trees_ref.where("last_status", "==", "sick") \
                     .where("date.updatedDate", ">=", yesterday) \
                     .where("date.updatedDate", "<=", now)
    return query.stream()

def get_plantation_stats(company_id: str):
    """Menghitung statistik total pohon berdasarkan status."""
    trees_ref = db.collection(f"company/{company_id}/tree")
    
    total_sick = trees_ref.where("last_status", "==", "sick").count().get()[0][0].value
    total_maintenance = trees_ref.where("last_status", "==", "maintenance").count().get()[0][0].value
    total_recovered = trees_ref.where("last_status", "==", "recovered").count().get()[0][0].value
    
    return {
        "sick": total_sick,
        "maintenance": total_maintenance,
        "recovered": total_recovered
    }
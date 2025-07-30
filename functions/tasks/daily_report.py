# functions/tasks/daily_report.py
from ..services import firestore_service, whatsapp_service

def run_daily_check():
    """Fungsi utama yang dijalankan oleh scheduler."""
    print("Memulai pengecekan harian lonjakan Ganoderma...")
    
    companies = firestore_service.get_companies_with_bot_config()

    for company in companies:
        company_id = company.id
        company_data = company.to_dict()
        group_id = company_data.get("whatsappGroupId")

        print(f"Memproses perusahaan: {company_id} ({company_data.get('company_name', 'N/A')})")

        settings_doc = firestore_service.get_company_settings(company_id)
        if not settings_doc.exists:
            print(f"Pengaturan untuk {company_id} tidak ditemukan, dilewati.")
            continue
        
        spike_threshold = settings_doc.to_dict().get("ganodermaSpikeThreshold", 5)
        
        newly_sick_trees = list(firestore_service.get_newly_sick_trees(company_id))
        newly_sick_count = len(newly_sick_trees)

        print(f"  -> Ditemukan {newly_sick_count} pohon sakit baru (Batas: {spike_threshold}).")

        if newly_sick_count > spike_threshold:
            print(f"  -> LONJAKAN TERDETEKSI! Menyiapkan laporan untuk {company_id}.")
            
            # Format daftar pohon
            tree_list_str = ""
            for tree_doc in newly_sick_trees:
                tree_data = tree_doc.to_dict()
                tree_list_str += f"\n- *{tree_data.get('name', f'ID: {tree_doc.id[:6]}...')}*"
                if tree_data.get('img'):
                    tree_list_str += f"\n  (Lihat Foto: {tree_data.get('img')})"
            
            # Ambil statistik
            stats = firestore_service.get_plantation_stats(company_id)
            
            # Buat pesan
            message = f"""🚨 *PERINGATAN LONJAKAN GANODERMA* 🚨

Halo Tim, sistem kami mendeteksi lonjakan kasus pohon terindikasi Ganoderma dalam 24 jam terakhir.

*Total Pohon Sakit Baru Hari Ini: {newly_sick_count}*

Berikut adalah daftar pohon yang dilaporkan sakit:
{tree_list_str}

Mohon untuk segera melakukan verifikasi lapangan dan tindakan mitigasi yang diperlukan.

---
*Rangkuman Status Kebun Saat Ini:*
- 🌳 Total Sakit: *{stats['sick']} pohon*
- 🛠️ Dlm Perawatan: *{stats['maintenance']} pohon*
- ✅ Sehat/Pulih: *{stats['recovered']} pohon*

Terima kasih.
- *Bot Sawit Pintar* -
"""
            # Kirim pesan
            whatsapp_service.send_message(group_id, message)
        else:
            print(f"  -> Tidak ada lonjakan signifikan untuk {company_id}.")
            
    print("Pengecekan harian selesai.")
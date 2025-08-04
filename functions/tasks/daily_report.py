# functions/tasks/daily_report.py
from services import firestore_service, whatsapp_service

def run_daily_check():
    """Fungsi utama yang dijalankan oleh scheduler."""
    print("Memulai pengecekan harian lonjakan Ganoderma...")
    
    companies = firestore_service.get_companies_with_bot_config()

    for company in companies:
        company_id = company.id
        company_data = company.to_dict()
        
        # Menggunakan field yang benar untuk broadcast atau grup
        # Kita asumsikan Anda ingin broadcast ke individu sesuai rekomendasi terakhir
        notification_recipients = company_data.get("whatsappNotificationNumbers")
        company_name = company_data.get("companyName", "Tim Anda")

        if not isinstance(notification_recipients, list) or not notification_recipients:
            print(f"Perusahaan {company_id} tidak memiliki daftar penerima notifikasi, dilewati.")
            continue

        settings_doc = firestore_service.get_company_settings(company_id)
        if not settings_doc.exists:
            print(f"Pengaturan untuk {company_id} tidak ditemukan, dilewati.")
            continue
        
        settings_data = settings_doc.to_dict()
        spike_threshold = settings_data.get("ganodermaSpikeThreshold", 5)
        # Ambil ContentSid dari settings, ini adalah ID template dari Twilio
        template_sid = settings_data.get("ganodermaTemplateSid") 

        if not template_sid:
            print(f"Template SID tidak ditemukan untuk perusahaan {company_id}, dilewati.")
            continue
        
        newly_sick_trees = firestore_service.get_newly_sick_trees(company_id)
        newly_sick_count = len(newly_sick_trees)

        print(f"  -> Ditemukan {newly_sick_count} pohon sakit baru (Batas: {spike_threshold}).")

        if newly_sick_count > spike_threshold:
            print(f"  -> LONJAKAN TERDETEKSI! Menyiapkan laporan untuk {company_id}.")
            
            tree_list_str = ""
            for tree_doc in newly_sick_trees:
                tree_data = tree_doc.to_dict()
                tree_list_str += f"\n- *{tree_data.get('name', f'ID: {tree_doc.id[:6]}...')}*"
                if tree_data.get('img'):
                    tree_list_str += f"\n  (Lihat Foto: {tree_data.get('img')})"
            
            stats = firestore_service.get_plantation_stats(company_id)
            
            # Siapkan variabel sesuai urutan di template
            template_vars = [
                company_name,
                newly_sick_count,
                tree_list_str,
                stats['sick'],
                stats['maintenance'],
                stats['recovered']
            ]

            print(f"  -> Mengirim notifikasi ke {len(notification_recipients)} penerima...")
            for recipient in notification_recipients:
                whatsapp_service.send_template_message(
                    recipient_number=recipient,
                    content_sid=template_sid,
                    template_variables=template_vars
                )
        else:
            print(f"  -> Tidak ada lonjakan signifikan.")
            
    print("Pengecekan harian selesai.")
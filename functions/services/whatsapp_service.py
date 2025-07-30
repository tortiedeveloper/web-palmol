# functions/services/whatsapp_service.py
import requests
from .. import config # Mengimpor dari config.py di root

def send_message(group_id: str, message: str) -> bool:
    """
    Mengirim pesan teks ke grup WhatsApp melalui API provider.
    """
    api_url = config.WHATSAPP_API_URL.value()
    api_token = config.WHATSAPP_API_TOKEN.value()

    if not all([api_url, api_token, group_id]):
        print("ERROR: Konfigurasi WhatsApp API tidak lengkap.")
        return False

    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
    }
    
    # Payload bisa berbeda tergantung provider, ini contoh umum
    payload = {
        "messaging_product": "whatsapp",
        "to": group_id,
        "type": "text",
        "text": {
            "body": message
        }
    }

    try:
        print(f"Mengirim pesan ke grup: {group_id}...")
        response = requests.post(api_url, headers=headers, json=payload, timeout=10)
        response.raise_for_status() # Akan error jika status code 4xx atau 5xx
        print(f"Pesan berhasil dikirim. Status: {response.status_code}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"!!! GAGAL mengirim pesan WhatsApp ke {group_id}: {e}")
        if e.response is not None:
            print(f"Response body: {e.response.text}")
        return False
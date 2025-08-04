# functions/config.py
from firebase_functions import params

# Ganti secret lama dengan yang lebih spesifik untuk Twilio
# Hapus WHATSAPP_API_URL dan WHATSAPP_API_TOKEN jika tidak dipakai lagi
TWILIO_ACCOUNT_SID = params.SecretParam("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = params.SecretParam("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_NUMBER = params.SecretParam("TWILIO_WHATSAPP_NUMBER")
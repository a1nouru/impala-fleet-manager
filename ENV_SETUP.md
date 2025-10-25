# Environment Setup

This document outlines the environment variables required for the Impala Express Fleet Manager application.

## Required Environment Variables

### Database Configuration
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### AI API Configuration
```bash
# Gemini API Configuration (for bank verification)
GEMINI_API_KEY=your_gemini_api_key_here
```

### WhatsApp Notifications Configuration
```bash
# WhatsApp Business API Configuration (for notifications)
WHATSAPP_API_URL=https://graph.facebook.com/v17.0
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# Cron Job Security (optional)
CRON_SECRET_TOKEN=your_secure_random_token
```

### Application Configuration
```bash
# Next.js Configuration
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
```

## Setup Instructions

### 1. Supabase Setup
1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to find your project URL and anon key
3. Go to Settings > API > Service Role to find your service role key

### 2. Gemini API Setup
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Copy the API key and add it to your environment variables

### 3. Environment File Setup
Create a `.env.local` file in your project root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here

# WhatsApp Business API
WHATSAPP_API_URL=https://graph.facebook.com/v17.0
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token
CRON_SECRET_TOKEN=your_secure_random_token

# NextAuth
NEXTAUTH_SECRET=your_random_secret_string
NEXTAUTH_URL=http://localhost:3000
```

## Notes

- Never commit your `.env.local` file to version control
- Make sure your Gemini API key has the necessary permissions for text generation
- The Gemini API will be used for bank statement verification with mathematical functions
- For production deployment, set these environment variables in your hosting platform 
# 🚂 Railway Deployment Guide

## Quick Fix for Current Build Error

Your Railway deployment is failing because environment variables are not configured. Follow these steps:

### Step 1: Access Railway Dashboard

1. Go to [railway.app](https://railway.app)
2. Login to your account
3. Select your `impala-fleet-manager` project
4. Click on the service/deployment

### Step 2: Configure Environment Variables

1. Click on the **"Variables"** tab
2. Click **"+ New Variable"** or **"Raw Editor"** for bulk entry
3. Add the following required variables:

#### **Required Variables (Minimum to Fix Build)**

```bash
# Supabase Configuration (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://hymravaveedguejtazsc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

#### **Recommended Variables (Full Functionality)**

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://hymravaveedguejtazsc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# AI API Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# WhatsApp Business API (if using notifications)
WHATSAPP_API_URL=https://graph.facebook.com/v17.0
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# Security
CRON_SECRET_TOKEN=your_secure_random_token

# NextAuth (if using authentication)
NEXTAUTH_SECRET=your_random_secret_string
NEXTAUTH_URL=https://your-railway-app.railway.app
```

### Step 3: Get Your Supabase Credentials

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project: `hymravaveedguejtazsc`
3. Go to **Settings** → **API**
4. Copy the following:
   - **Project URL** → Use as `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API keys** → **anon** **public** → Use as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Project API keys** → **service_role** → Use as `SUPABASE_SERVICE_ROLE_KEY`

### Step 4: Deploy

After adding the variables:
1. Railway will automatically trigger a new deployment
2. Or click **"Deploy"** to manually trigger
3. Monitor the build logs for success

---

## Railway Environment Variable Setup Methods

### Method 1: Using Raw Editor (Fastest for Multiple Variables)

1. Click **"Variables"** tab
2. Click **"Raw Editor"** button
3. Paste all variables in `KEY=VALUE` format:

```
NEXT_PUBLIC_SUPABASE_URL=https://hymravaveedguejtazsc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here
SUPABASE_SERVICE_ROLE_KEY=your_key_here
GEMINI_API_KEY=your_key_here
```

4. Click **"Update Variables"**

### Method 2: Using Individual Entry

1. Click **"Variables"** tab
2. Click **"+ New Variable"**
3. Enter **Variable Name** and **Value**
4. Repeat for each variable
5. Railway auto-saves each variable

---

## Verification Checklist

After deployment, verify everything is working:

- [ ] ✅ Build completes successfully without environment errors
- [ ] ✅ Application loads at your Railway URL
- [ ] ✅ Supabase connection works (login, data fetching)
- [ ] ✅ No console errors about missing environment variables
- [ ] ✅ Bank verification works (if GEMINI_API_KEY is set)
- [ ] ✅ WhatsApp notifications work (if configured)

---

## Common Issues & Solutions

### Issue 1: Build Still Fails After Adding Variables

**Solution:**
- Make sure you clicked **"Update Variables"** or saved each variable
- Trigger a new deployment manually
- Check for typos in variable names (they are case-sensitive)

### Issue 2: App Builds but Doesn't Work

**Solution:**
- Check browser console for errors
- Verify Supabase credentials are correct
- Make sure `NEXT_PUBLIC_*` variables are set (these are client-side)

### Issue 3: Environment Variables Not Taking Effect

**Solution:**
- Railway injects variables at runtime
- Force a redeploy: Settings → Deploy → Redeploy
- Clear browser cache and hard refresh (Cmd+Shift+R or Ctrl+Shift+R)

### Issue 4: NEXTAUTH_URL Issues

**Solution:**
- Set to your Railway public URL: `https://your-app.railway.app`
- Find your public URL in Railway dashboard under **"Settings"** → **"Networking"**
- Or use Railway's provided domain

---

## Security Best Practices

1. **Never commit `.env` files** to Git
2. **Use Railway's secret variables** for sensitive data
3. **Rotate keys periodically** (especially API keys)
4. **Use different keys for production vs development**
5. **Enable Railway's environment protection** for production

---

## Railway-Specific Tips

### Custom Domain Setup
1. Go to **Settings** → **Networking** → **Public Networking**
2. Click **"+ Custom Domain"**
3. Add your domain and configure DNS

### Monitoring & Logs
1. Click **"Deployments"** tab to view deployment history
2. Click any deployment to view build/runtime logs
3. Use **"Observability"** for metrics and monitoring

### Environment-Specific Variables
Railway supports multiple environments:
- Create separate services for `production` and `staging`
- Each can have different environment variables
- Useful for testing with different Supabase projects

---

## Quick Reference: Where to Get API Keys

| Variable | Where to Get It |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role key |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `WHATSAPP_ACCESS_TOKEN` | [Meta for Developers](https://developers.facebook.com/) |
| `NEXTAUTH_SECRET` | Generate: `openssl rand -base64 32` |

---

## After Successful Deployment

Once deployed successfully:

1. **Test the application** at your Railway URL
2. **Set up custom domain** (optional but recommended)
3. **Configure monitoring** and alerts
4. **Set up automatic deployments** from your Git branch
5. **Create a staging environment** for testing

---

## Need Help?

- **Railway Docs**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway
- **Supabase Docs**: https://supabase.com/docs

---

**Your next steps:**
1. ✅ Add Supabase environment variables to Railway
2. ✅ Commit the updated `next.config.js` (already fixed for Railway)
3. ✅ Wait for automatic redeployment or trigger manually
4. ✅ Test your deployed application


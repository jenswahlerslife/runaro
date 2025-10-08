# 📧 Professional Email Setup Guide for Runaro

## 🎯 Quick Setup Checklist

### 1. Supabase Auth Configuration
Go to **Supabase Dashboard → Authentication → URL Configuration**:

```
Site URL: https://runaro.dk

Authorized Redirect URLs:
- https://runaro.dk
- https://runaro.dk/*
- http://localhost:5173/*
- http://localhost:3000/*
```

### 2. SMTP Email Configuration
Go to **Supabase Dashboard → Authentication → Settings → SMTP Settings**:

```
Sender Name: Runaro
Sender Email: runaro.info@gmail.com
Host: smtp.gmail.com
Port: 587
User: runaro.info@gmail.com
Password: [App Password - see below]
```

### 3. Gmail App Password Setup

Since you're using Gmail (`runaro.info@gmail.com`), you need an App Password:

1. Go to **Google Account Settings** → **Security**
2. Enable **2-Step Verification** (required for App Passwords)
3. Go to **App passwords**
4. Generate password for "Mail" application
5. Use this 16-character password in Supabase SMTP settings

### 4. DNS Configuration (Professional Emails)

For professional emails, add these DNS records to your `runaro.dk` domain:

**SPF Record** (TXT on root domain):
```
v=spf1 include:_spf.google.com ~all
```

**DKIM Record** (requires Gmail/Workspace setup):
- If using Gmail: Set up Gmail DKIM in Google Admin Console
- Alternative: Use a dedicated email service like Postmark or Resend

**DMARC Record** (TXT on `_dmarc.runaro.dk`):
```
v=DMARC1; p=quarantine; rua=mailto:runaro.info@gmail.com; fo=1
```

### 5. Email Templates

In **Supabase → Authentication → Email Templates**:

**Confirm Signup Template:**
```html
<h2>Velkommen til Runaro! 🏃‍♂️</h2>
<p>Klik på linket nedenfor for at aktivere din konto:</p>
<p><a href="{{ .ConfirmationURL }}">Aktiver konto</a></p>
<p>Linket udløber om 24 timer.</p>
<p>Mvh,<br>Runaro Team</p>
```

**Magic Link Template:**
```html
<h2>Log ind på Runaro 🔐</h2>
<p>Klik på linket nedenfor for at logge ind:</p>
<p><a href="{{ .ConfirmationURL }}">Log ind</a></p>
<p>Linket udløber om 1 time.</p>
<p>Mvh,<br>Runaro Team</p>
```

### 6. Environment Variables

Make sure these are set in **Cloudflare Pages → Settings → Environment Variables**:

```
VITE_SITE_URL=https://runaro.dk
VITE_SUPABASE_URL=https://ojjpslrhyutizwpvvngu.supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
```

### 7. Testing the Flow

1. **Sign up with new email** → Should receive confirmation email
2. **Click email link** → Should redirect to `https://runaro.dk/auth/callback`
3. **Callback page** → Should create profile and redirect to leagues
4. **No more 406 errors** → Profile exists automatically

## 🚨 Troubleshooting

### Emails not arriving:
- Check SMTP credentials in Supabase
- Verify Gmail App Password is correct
- Check spam/junk folders
- Test with different email providers

### 406 Profile Errors:
- Already fixed with auto-profile creation
- `AuthCallback.tsx` includes self-healing
- All existing users now have profiles

### Localhost redirects in emails:
- Fixed with `VITE_SITE_URL` environment variable
- All emails now point to `https://runaro.dk`

## 🎉 What's Fixed

✅ Professional email templates in Danish  
✅ Production URLs in all redirects  
✅ Auto-profile creation for all new users  
✅ Self-healing profile system  
✅ Smooth AuthCallback experience  
✅ No more 406 errors  
✅ Magic link support  

Your authentication system is now production-ready! 🚀
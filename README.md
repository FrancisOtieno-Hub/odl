# 📚 ODL Digital Library

A modern, Progressive Web App (PWA) for publishing and monetizing eBooks with monthly subscriptions.

![ODL Digital Library](https://img.shields.io/badge/Version-1.0.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![PWA](https://img.shields.io/badge/PWA-Ready-orange)

## 🌟 Features

- ✅ **Progressive Web App** - Install on any device, works offline
- 💳 **Paystack Integration** - Secure payments in Kenyan Shillings (KES 300/month)
- 🔐 **User Authentication** - Powered by Supabase Auth with password reset
- 📖 **PDF Reader** - Read eBooks directly in the browser via iframe
- 🔍 **Book Search** - Search by title, author, or description in real time
- 🎨 **Modern UI** - Beautiful, responsive design optimized for mobile
- 🔒 **Subscription Control** - Only active subscribers can read books
- 📱 **Mobile Optimized** - Two-column grid on mobile, single column on small screens

## 🚀 Quick Start

### Prerequisites

- GitHub account
- Vercel account (free)
- Supabase account (free)
- Paystack account (KYC verified)
- Google Drive for PDF storage

### 1. Clone or Download

```bash
git clone https://github.com/YOUR_USERNAME/odl-library.git
cd odl-library
```

Or download this repository as ZIP and extract it.

### 2. Setup Supabase

#### Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Choose Singapore region (closest to Kenya)
4. Wait 2-3 minutes for setup

#### Run Database Schema

1. Go to SQL Editor in Supabase Dashboard
2. Copy and paste this SQL schema:

```sql
-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'cancelled')),
  amount DECIMAL(10, 2) NOT NULL DEFAULT 300.00,
  currency TEXT DEFAULT 'KES',
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  paystack_reference TEXT UNIQUE,
  paystack_subscription_code TEXT,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Books table
CREATE TABLE public.books (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  pdf_url TEXT NOT NULL,
  google_drive_id TEXT,
  category TEXT,
  published_date DATE,
  page_count INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reading Progress table (for future use)
CREATE TABLE public.reading_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id UUID REFERENCES public.books(id) ON DELETE CASCADE,
  current_page INTEGER DEFAULT 0,
  total_pages INTEGER,
  progress_percentage DECIMAL(5, 2),
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- Payment History table
CREATE TABLE public.payment_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id),
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'KES',
  status TEXT NOT NULL CHECK (status IN ('pending', 'successful', 'failed')),
  paystack_reference TEXT UNIQUE,
  payment_method TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view active books" ON public.books
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can view own progress" ON public.reading_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress" ON public.reading_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress" ON public.reading_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own payments" ON public.payment_history
  FOR SELECT USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_reading_progress_user_id ON public.reading_progress(user_id);
CREATE INDEX idx_payment_history_user_id ON public.payment_history(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_books_updated_at BEFORE UPDATE ON public.books
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

3. Click **Run** to create all tables

#### Get Supabase Credentials

1. Go to Settings → API
2. Copy your **Project URL**
3. Copy your **anon/public key**

### 3. Setup Paystack

#### Create Paystack Account

1. Go to [paystack.com](https://paystack.com)
2. Sign up and complete KYC verification
3. Switch to Test Mode for development

#### Get API Keys

1. Dashboard → Settings → API Keys & Webhooks
2. Copy your **Public Key** (starts with `pk_test_` for test mode, `pk_live_` for live)
3. Keep your **Secret Key** secure — never put it in frontend code

> ⚠️ **M-Pesa note:** M-Pesa payments via Paystack require separate activation on your Paystack account. Contact Paystack support to enable it before advertising this option to users.

### 4. Configure Your App

Open `index.html` and find the `CONFIG` object near the top of the `<script>` section. Replace the placeholder values:

```javascript
const CONFIG = {
    supabase: {
        url: 'https://your-project.supabase.co',   // ← Your Supabase Project URL
        key: 'your-anon-key-here'                  // ← Your Supabase anon/public key
    },
    paystack: {
        publicKey: 'pk_test_your_public_key',      // ← Your Paystack public key
        amount: 30000,                             // 300 KES in kobo (do not change the math)
        currency: 'KES'
    }
};
```

> 🔐 **Security note:** The Supabase `anon` key and Paystack `publicKey` are safe to include in frontend code — they are designed to be public. Never expose your Supabase **service role key** or Paystack **secret key** in any frontend file.

### 5. Register the Service Worker

Make sure your `index.html` `<head>` contains the manifest link, and add the service worker registration before your closing `</body>` tag if not already present:

```html
<!-- In <head> -->
<link rel="manifest" href="/manifest.json">

<!-- Before </body> -->
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker registered:', reg.scope))
      .catch(err => console.error('Service Worker registration failed:', err));
  }
</script>
```

### 6. Add Your Books

#### Upload PDFs to Google Drive

1. Upload your PDF eBooks to Google Drive
2. Right-click each PDF → Share → "Anyone with the link can view"
3. Copy the sharing link (format: `https://drive.google.com/file/d/FILE_ID/view`)
4. Extract the `FILE_ID` from the URL

#### Add Books to Supabase

In Supabase SQL Editor, run:

```sql
INSERT INTO public.books (title, author, description, cover_url, pdf_url, is_active)
VALUES 
(
  'Your Book Title',
  'Your Name',
  'A captivating story about...',
  'https://link-to-your-cover-image.jpg',
  'https://drive.google.com/file/d/YOUR_FILE_ID/preview',
  true
);
```

Repeat for each book. You can also manage books directly in the Supabase Dashboard under **Table Editor → books**.

### 7. Create App Icons

You need icons in these sizes: 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512

#### Option 1: Use PWA Builder
1. Go to [pwabuilder.com/imageGenerator](https://www.pwabuilder.com/imageGenerator)
2. Upload a 512x512 icon
3. Download all sizes
4. Place in `/icons/` folder

#### Option 2: Use Canva
1. Create a 512x512px design with "📚 ODL" logo
2. Download as PNG
3. Use an image resizer to create all sizes

### 8. Deploy to GitHub

```bash
# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: ODL Digital Library"

# Create GitHub repository at github.com/new
# Then connect and push:
git remote add origin https://github.com/YOUR_USERNAME/odl-library.git
git branch -M main
git push -u origin main
```

### 9. Deploy to Vercel

#### Method 1: Vercel Dashboard (Easiest)

1. Go to [vercel.com](https://vercel.com)
2. Sign up/Login with GitHub
3. Click "New Project"
4. Import your `odl-library` repository
5. Click "Deploy"
6. Done! Your app is live 🎉

#### Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Follow prompts, then:
vercel --prod
```

Your app will be live at: `https://odl-library.vercel.app`

## 📱 Features Guide

### For Readers

1. **Browse Books** - View all available eBooks (covers visible to everyone)
2. **Search** - Find books by title, author, or description
3. **Sign Up** - Create an account with email and password
4. **Subscribe** - Pay KES 300/month via Paystack
5. **Read** - Access all books with unlimited reading
6. **Install** - Add to home screen for a native app experience

### For You (Admin)

1. **Add Books** - Insert via Supabase SQL Editor or directly in the Table Editor
2. **Track Subscribers** - View the `subscriptions` table in Supabase Dashboard
3. **Monitor Payments** - Check the `payment_history` table or Paystack Dashboard
4. **Manage Content** - Toggle `is_active` on any book to show/hide it instantly

## 🛠️ Customization

### Change Subscription Price

In `index.html`, find the `CONFIG` object:
```javascript
paystack: {
    amount: 50000,  // Change to 500 KES (always in kobo: KES × 100)
    currency: 'KES'
}
```

In Supabase SQL Editor:
```sql
ALTER TABLE public.subscriptions 
ALTER COLUMN amount SET DEFAULT 500.00;
```

### Change Colors

In `index.html` CSS, find the `:root` block near the top of the `<style>` section:
```css
:root {
    --primary: #6C63FF;  /* Main purple color */
    --secondary: #FF6B6B;  /* Accent red/pink */
    --dark: #1a1a2e;     /* Page background */
}
```

### Add Book Categories

Add a `category` column filter in the UI and query books by category using:
```sql
SELECT * FROM books WHERE category = 'Fiction' AND is_active = true;
```

## 📊 Database Schema

```
profiles
├── id (UUID) - References auth.users
├── email (TEXT)
├── full_name (TEXT)
└── timestamps

subscriptions
├── id (UUID)
├── user_id (UUID) - References profiles
├── status (TEXT) - active / expired / cancelled
├── amount (DECIMAL) - Default 300.00 KES
├── start_date / end_date (TIMESTAMP)
└── paystack_reference (TEXT)

books
├── id (UUID)
├── title (TEXT)
├── author (TEXT)
├── description (TEXT)
├── cover_url (TEXT) - Book cover image URL
├── pdf_url (TEXT) - Google Drive /preview link
└── is_active (BOOLEAN)

reading_progress ← (schema ready, UI coming in a future update)
├── user_id (UUID)
├── book_id (UUID)
├── current_page (INTEGER)
└── progress_percentage (DECIMAL)

payment_history
├── user_id (UUID)
├── subscription_id (UUID)
├── amount (DECIMAL)
├── status (TEXT) - pending / successful / failed
└── paystack_reference (TEXT)
```

## 🔒 Security

- ✅ Row Level Security (RLS) enabled on all tables
- ✅ User data isolated per user via RLS policies
- ✅ Secure payment processing via Paystack
- ✅ Supabase anon key is safe for frontend use (read-only public access by design)
- ✅ HTTPS enforced by Vercel
- ⚠️ Never expose your Supabase **service role key** or Paystack **secret key** in any frontend file

## 🐛 Troubleshooting

### Books Not Loading
- Open browser DevTools → Console tab and check for errors
- Verify books exist in Supabase: `SELECT * FROM books WHERE is_active = true;`
- Confirm your Supabase URL and anon key are correctly set in the `CONFIG` object
- Check that RLS policies were created successfully

### Payment Not Working
- Confirm the Paystack `publicKey` in `CONFIG` matches your dashboard key
- Test using Paystack Test Mode first before going live
- Check browser console for errors after clicking Subscribe
- Verify the Paystack script loaded: DevTools → Network → filter for `paystack`

### Authentication Issues
- Clear browser cache and cookies and try again
- Check Supabase Auth is enabled: Authentication → Settings
- For testing, disable email confirmation: Authentication → Providers → Email → uncheck "Confirm email"

### Password Reset Not Working
- Ensure your Supabase redirect URL is set: Authentication → URL Configuration → add your Vercel domain
- Check spam folder for the reset email
- The reset link contains a token in the URL hash — it must be opened in the same browser

### PDF Not Displaying
- Ensure the Google Drive link ends in `/preview` not `/view`
- Confirm the file sharing is set to "Anyone with the link can view"
- Some browsers block cross-origin iframes — try Chrome if another browser fails

## 📈 Roadmap

- [ ] Reading progress tracking UI (database schema already in place)
- [ ] Email notifications for subscription renewals and expiry
- [ ] Admin dashboard for managing books without SQL
- [ ] Bookmarks and highlights
- [ ] Book categories and filtering
- [ ] Book recommendations
- [ ] Gift subscriptions
- [ ] Multi-language support

## 🤝 Support

For issues or questions:
- Check the troubleshooting section above
- Review Supabase docs: [supabase.com/docs](https://supabase.com/docs)
- Review Paystack docs: [paystack.com/docs](https://paystack.com/docs)

## 📄 License

MIT License - Feel free to use for your own projects!

## 🙏 Credits

Built with:
- [Supabase](https://supabase.com) - Backend & Auth
- [Paystack](https://paystack.com) - Payments
- [Vercel](https://vercel.com) - Hosting
- Google Drive - PDF Storage

---

**Made with ❤️ for authors and readers**

🚀 **Your ODL Digital Library is ready to launch!**

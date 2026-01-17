# 📚 ODL Digital Library

A modern, Progressive Web App (PWA) for publishing and monetizing literary fiction eBooks with monthly subscriptions.

![ODL Digital Library](https://img.shields.io/badge/Version-1.0.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![PWA](https://img.shields.io/badge/PWA-Ready-orange)

## 🌟 Features

- ✅ **Progressive Web App** - Install on any device, works offline
- 💳 **Paystack Integration** - Secure payments in Kenyan Shillings (KES 300/month)
- 🔐 **User Authentication** - Powered by Supabase Auth
- 📖 **PDF Reader** - Read eBooks directly in the browser
- 📊 **Reading Progress** - Track user reading progress
- 🎨 **Modern UI** - Beautiful, responsive design
- 🔒 **Subscription Control** - Only subscribers can read books
- 📱 **Mobile Optimized** - Perfect for phones and tablets

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

-- Reading Progress table
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
2. Copy your **Public Key** (starts with `pk_test_`)
3. Keep your **Secret Key** secure (for backend only)

#### Create Subscription Plan (Optional)

1. Dashboard → Payments → Plans
2. Create Plan:
   - Name: "ODL Monthly Subscription"
   - Amount: 300 KES
   - Interval: Monthly
3. Copy the **Plan Code**

### 4. Configure Your App

Open `index.html` and replace these values around line 400-415:

```javascript
// Supabase Configuration
const SUPABASE_CONFIG = {
    url: 'https://your-project.supabase.co',  // ← Your Supabase URL
    anonKey: 'your-anon-key-here'  // ← Your Supabase anon key
};

// Paystack Configuration
const PAYSTACK_CONFIG = {
    publicKey: 'pk_test_your_public_key',  // ← Your Paystack public key
    amount: 30000,  // 300 KES in kobo
    currency: 'KES'
};
```

### 5. Add Your Books

#### Upload PDFs to Google Drive

1. Upload your PDF eBooks to Google Drive
2. Right-click each PDF → Share → "Anyone with the link can view"
3. Copy the sharing link (format: `https://drive.google.com/file/d/FILE_ID/view`)
4. Extract the `FILE_ID` from the URL

#### Add Books to Supabase

In Supabase SQL Editor, run:

```sql
INSERT INTO public.books (title, author, description, pdf_url, is_active)
VALUES 
(
  'Your Book Title',
  'Your Name',
  'A captivating story about...',
  'https://drive.google.com/file/d/YOUR_FILE_ID/preview',
  true
);
```

Repeat for each book.

### 6. Create App Icons

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

### 7. Deploy to GitHub

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

### 8. Deploy to Vercel

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
2. **Sign Up** - Create an account with email
3. **Subscribe** - Pay KES 300/month via Paystack (Card or M-Pesa)
4. **Read** - Access all books with unlimited reading
5. **Install** - Add to home screen for offline reading

### For You (Admin)

1. **Add Books** - Insert via Supabase SQL Editor
2. **Track Subscribers** - View in Supabase Dashboard
3. **Monitor Payments** - Check Paystack Dashboard
4. **Update Content** - Manage books in Supabase

## 🛠️ Customization

### Change Subscription Price

In `index.html`:
```javascript
const PAYSTACK_CONFIG = {
    amount: 50000,  // Change to 500 KES (in kobo)
    // ...
};
```

In SQL:
```sql
ALTER TABLE public.subscriptions 
ALTER COLUMN amount SET DEFAULT 500.00;
```

### Change Colors

In `index.html` CSS (around line 30):
```css
:root {
    --primary: #6C63FF;  /* Main color */
    --secondary: #FF6B6B;  /* Accent color */
    --dark: #1a1a2e;  /* Background */
    /* ... */
}
```

### Add Book Categories

Update the books table and add filtering in the UI.

## 📊 Database Schema

```
profiles
├── id (UUID) - User ID
├── email (TEXT) - User email
├── full_name (TEXT) - User name
└── timestamps

subscriptions
├── id (UUID) - Subscription ID
├── user_id (UUID) - References profiles
├── status (TEXT) - active/expired/cancelled
├── amount (DECIMAL) - 300.00 KES
├── start_date / end_date (TIMESTAMP)
└── paystack_reference (TEXT)

books
├── id (UUID) - Book ID
├── title (TEXT)
├── author (TEXT)
├── description (TEXT)
├── pdf_url (TEXT) - Google Drive link
├── cover_url (TEXT) - Book cover image
└── is_active (BOOLEAN)

reading_progress
├── user_id (UUID)
├── book_id (UUID)
├── current_page (INTEGER)
└── progress_percentage (DECIMAL)

payment_history
├── user_id (UUID)
├── subscription_id (UUID)
├── amount (DECIMAL)
├── status (TEXT)
└── paystack_reference (TEXT)
```

## 🔒 Security

- ✅ Row Level Security (RLS) enabled on all tables
- ✅ User data isolated per user
- ✅ Secure payment processing via Paystack
- ✅ Environment variables for sensitive keys
- ✅ HTTPS enforced by Vercel

## 🐛 Troubleshooting

### Books Not Loading
- Check Supabase connection (Console → Network tab)
- Verify books exist: `SELECT * FROM books WHERE is_active = true;`
- Check RLS policies are created

### Payment Not Working
- Verify Paystack public key is correct
- Check browser console for errors
- Ensure Paystack script loaded: Check Network tab for `js.paystack.co`
- Test in Paystack Test Mode first

### Authentication Issues
- Clear browser cache and cookies
- Check Supabase Auth is enabled (Authentication → Settings)
- Verify email confirmation is disabled for testing (Authentication → Providers → Email)

### PDF Not Displaying
- Ensure Google Drive link is in `/preview` format
- Check file is publicly accessible
- Some browsers block iframes - try different browser

## 📈 Roadmap

- [ ] Email notifications for subscription reminders
- [ ] Admin dashboard for managing books
- [ ] Reading statistics and analytics
- [ ] Bookmark and highlights feature
- [ ] Multi-language support
- [ ] Book recommendations
- [ ] Gift subscriptions

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

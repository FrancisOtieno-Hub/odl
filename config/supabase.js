// Supabase Configuration and Integration for ODL Library
// File: config/supabase.js

// =============================================================================
// SUPABASE SETUP INSTRUCTIONS
// =============================================================================
/*
1. Go to https://supabase.com and create a free account
2. Create a new project (choose a region close to Kenya - e.g., Singapore)
3. Wait for project setup (2-3 minutes)
4. Get your credentials from Settings > API:
   - Project URL (SUPABASE_URL)
   - anon/public key (SUPABASE_ANON_KEY)
5. Replace the placeholders below with your actual credentials
*/

// =============================================================================
// CONFIGURATION
// =============================================================================

const SUPABASE_CONFIG = {
  url: 'https://vryzwufhpooxgfholuqk.supabase.co', // Replace with your Supabase project URL
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyeXp3dWZocG9veGdmaG9sdXFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2MzQxMjYsImV4cCI6MjA4NDIxMDEyNn0.QT9ZI-ckTK3oMgzPvJlqFKzZFNFNkvbVbGTncxop__A' // Replace with your anon/public key
};

// Initialize Supabase client
const supabase = window.supabase.createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey
);

// =============================================================================
// DATABASE SCHEMA
// =============================================================================
/*
Run these SQL commands in Supabase SQL Editor to create your tables:

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

-- Profiles: Users can read and update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Subscriptions: Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Books: Everyone can view active books
CREATE POLICY "Anyone can view active books" ON public.books
  FOR SELECT USING (is_active = true);

-- Reading Progress: Users can manage their own progress
CREATE POLICY "Users can view own progress" ON public.reading_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress" ON public.reading_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress" ON public.reading_progress
  FOR UPDATE USING (auth.uid() = user_id);

-- Payment History: Users can view their own payments
CREATE POLICY "Users can view own payments" ON public.payment_history
  FOR SELECT USING (auth.uid() = user_id);

-- Create indexes for better performance
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

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_books_updated_at BEFORE UPDATE ON public.books
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
*/

// =============================================================================
// AUTHENTICATION FUNCTIONS
// =============================================================================

class ODLAuth {
  // Sign up new user
  async signUp(email, password, fullName) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });

      if (error) throw error;

      // Create profile
      if (data.user) {
        await this.createProfile(data.user.id, email, fullName);
      }

      return { success: true, user: data.user };
    } catch (error) {
      console.error('Sign up error:', error);
      return { success: false, error: error.message };
    }
  }

  // Create user profile
  async createProfile(userId, email, fullName) {
    try {
      const { error } = await supabase
        .from('profiles')
        .insert([
          {
            id: userId,
            email: email,
            full_name: fullName
          }
        ]);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Profile creation error:', error);
      return { success: false, error: error.message };
    }
  }

  // Sign in existing user
  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) throw error;

      return { success: true, user: data.user, session: data.session };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: error.message };
    }
  }

  // Sign out
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get current user
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  }

  // Get current session
  async getSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return session;
    } catch (error) {
      console.error('Get session error:', error);
      return null;
    }
  }

  // Reset password
  async resetPassword(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Password reset error:', error);
      return { success: false, error: error.message };
    }
  }

  // Listen to auth state changes
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  }
}

// =============================================================================
// SUBSCRIPTION FUNCTIONS
// =============================================================================

class ODLSubscription {
  // Check if user has active subscription
  async hasActiveSubscription(userId) {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString())
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return { 
        isActive: !!data, 
        subscription: data 
      };
    } catch (error) {
      console.error('Check subscription error:', error);
      return { isActive: false, subscription: null };
    }
  }

  // Create new subscription
  async createSubscription(userId, paystackReference, paystackSubscriptionCode) {
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

      const { data, error } = await supabase
        .from('subscriptions')
        .insert([
          {
            user_id: userId,
            status: 'active',
            amount: 300.00,
            currency: 'KES',
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            paystack_reference: paystackReference,
            paystack_subscription_code: paystackSubscriptionCode
          }
        ])
        .select()
        .single();

      if (error) throw error;

      return { success: true, subscription: data };
    } catch (error) {
      console.error('Create subscription error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get user subscriptions
  async getUserSubscriptions(userId) {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { success: true, subscriptions: data };
    } catch (error) {
      console.error('Get subscriptions error:', error);
      return { success: false, error: error.message };
    }
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId) {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .update({ 
          status: 'cancelled',
          auto_renew: false
        })
        .eq('id', subscriptionId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, subscription: data };
    } catch (error) {
      console.error('Cancel subscription error:', error);
      return { success: false, error: error.message };
    }
  }
}

// =============================================================================
// BOOKS FUNCTIONS
// =============================================================================

class ODLBooks {
  // Get all active books
  async getAllBooks() {
    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { success: true, books: data };
    } catch (error) {
      console.error('Get books error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get single book
  async getBook(bookId) {
    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single();

      if (error) throw error;

      return { success: true, book: data };
    } catch (error) {
      console.error('Get book error:', error);
      return { success: false, error: error.message };
    }
  }

  // Add new book (admin only - you'll add books manually or via admin panel)
  async addBook(bookData) {
    try {
      const { data, error } = await supabase
        .from('books')
        .insert([bookData])
        .select()
        .single();

      if (error) throw error;

      return { success: true, book: data };
    } catch (error) {
      console.error('Add book error:', error);
      return { success: false, error: error.message };
    }
  }
}

// =============================================================================
// READING PROGRESS FUNCTIONS
// =============================================================================

class ODLProgress {
  // Save reading progress
  async saveProgress(userId, bookId, currentPage, totalPages) {
    try {
      const percentage = (currentPage / totalPages) * 100;

      const { data, error } = await supabase
        .from('reading_progress')
        .upsert([
          {
            user_id: userId,
            book_id: bookId,
            current_page: currentPage,
            total_pages: totalPages,
            progress_percentage: percentage.toFixed(2),
            last_read_at: new Date().toISOString()
          }
        ], { onConflict: 'user_id,book_id' })
        .select()
        .single();

      if (error) throw error;

      return { success: true, progress: data };
    } catch (error) {
      console.error('Save progress error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get reading progress for a book
  async getProgress(userId, bookId) {
    try {
      const { data, error } = await supabase
        .from('reading_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('book_id', bookId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return { success: true, progress: data };
    } catch (error) {
      console.error('Get progress error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get all user progress
  async getUserProgress(userId) {
    try {
      const { data, error } = await supabase
        .from('reading_progress')
        .select(`
          *,
          books (
            id,
            title,
            author,
            cover_url
          )
        `)
        .eq('user_id', userId)
        .order('last_read_at', { ascending: false });

      if (error) throw error;

      return { success: true, progress: data };
    } catch (error) {
      console.error('Get user progress error:', error);
      return { success: false, error: error.message };
    }
  }
}

// =============================================================================
// PAYMENT HISTORY FUNCTIONS
// =============================================================================

class ODLPayments {
  // Record payment
  async recordPayment(userId, subscriptionId, amount, paystackReference, status) {
    try {
      const { data, error } = await supabase
        .from('payment_history')
        .insert([
          {
            user_id: userId,
            subscription_id: subscriptionId,
            amount: amount,
            currency: 'KES',
            status: status,
            paystack_reference: paystackReference,
            paid_at: status === 'successful' ? new Date().toISOString() : null
          }
        ])
        .select()
        .single();

      if (error) throw error;

      return { success: true, payment: data };
    } catch (error) {
      console.error('Record payment error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get user payment history
  async getPaymentHistory(userId) {
    try {
      const { data, error } = await supabase
        .from('payment_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { success: true, payments: data };
    } catch (error) {
      console.error('Get payment history error:', error);
      return { success: false, error: error.message };
    }
  }
}

// =============================================================================
// EXPORT INSTANCES
// =============================================================================

const odlAuth = new ODLAuth();
const odlSubscription = new ODLSubscription();
const odlBooks = new ODLBooks();
const odlProgress = new ODLProgress();
const odlPayments = new ODLPayments();

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    supabase,
    odlAuth,
    odlSubscription,
    odlBooks,
    odlProgress,
    odlPayments
  };
}

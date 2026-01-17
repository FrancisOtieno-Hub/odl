        const SUPABASE_CONFIG = {
            url: 'https://vryzwufhpooxgfholuqk.supabase.co',
            anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyeXp3dWZocG9veGdmaG9sdXFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2MzQxMjYsImV4cCI6MjA4NDIxMDEyNn0.QT9ZI-ckTK3oMgzPvJlqFKzZFNFNkvbVbGTncxop__A'
        };

        const supabase = window.supabase.createClient(
            SUPABASE_CONFIG.url,
            SUPABASE_CONFIG.anonKey
        );

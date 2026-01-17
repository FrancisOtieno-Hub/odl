 const PAYSTACK_CONFIG = {
            publicKey: 'pk_test_your_public_key',
            amount: 30000, // 300 KES in kobo
            currency: 'KES'
        };

        // =============================================================================
        // APP STATE
        // =============================================================================
        let currentUser = null;
        let userSubscription = null;
        let books = [];
        let isAuthModeSignup = false;

        // =============================================================================
        // INITIALIZATION
        // =============================================================================
        async function initApp() {
            try {
                await checkUserAuth();
                await loadBooks();
            } catch (error) {
                console.error('Init error:', error);
                showToast('Failed to initialize app', 'error');
            }
        }

        // =============================================================================
        // AUTHENTICATION
        // =============================================================================
        async function checkUserAuth() {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                
                if (session) {
                    currentUser = session.user;
                    await checkSubscriptionStatus();
                    updateUserUI();
                }
            } catch (error) {
                console.error('Auth check error:', error);
            }
        }

        async function checkSubscriptionStatus() {
            if (!currentUser) return;

            try {
                const { data, error } = await supabase
                    .from('subscriptions')
                    .select('*')
                    .eq('user_id', currentUser.id)
                    .eq('status', 'active')
                    .gte('end_date', new Date().toISOString())
                    .single();

                if (data) {
                    userSubscription = data;
                }
            } catch (error) {
                console.error('Subscription check error:', error);
            }
        }

        function updateUserUI() {
            const userActions = document.getElementById('userActions');
            
            if (currentUser) {
                const userName = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
                
                if (userSubscription) {
                    userActions.innerHTML = `
                        <div class="subscription-badge">⭐ Premium Member</div>
                        <button class="btn btn-secondary" onclick="logout()">Logout</button>
                    `;
                } else {
                    userActions.innerHTML = `
                        <span style="margin-right: 1rem;">Hi, ${userName}!</span>
                        <button class="btn btn-primary" onclick="showPaymentModal()">Subscribe</button>
                        <button class="btn btn-secondary" onclick="logout()">Logout</button>
                    `;
                }
            }
        }

        async function handleAuth(event) {
            event.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const fullName = document.getElementById('fullName').value;

            try {
                if (isAuthModeSignup) {
                    const { data, error } = await supabase.auth.signUp({
                        email,
                        password,
                        options: {
                            data: { full_name: fullName }
                        }
                    });

                    if (error) throw error;

                    if (data.user) {
                        await supabase.from('profiles').insert([{
                            id: data.user.id,
                            email: email,
                            full_name: fullName
                        }]);
                    }

                    showToast('Account created! Please check your email to verify.', 'success');
                    closeAuthModal();
                } else {
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email,
                        password
                    });

                    if (error) throw error;

                    currentUser = data.user;
                    await checkSubscriptionStatus();
                    updateUserUI();
                    closeAuthModal();
                    showToast('Welcome back!', 'success');
                }
            } catch (error) {
                console.error('Auth error:', error);
                showToast(error.message, 'error');
            }
        }

        async function logout() {
            try {
                await supabase.auth.signOut();
                currentUser = null;
                userSubscription = null;
                location.reload();
            } catch (error) {
                console.error('Logout error:', error);
                showToast('Logout failed', 'error');
            }
        }

        // =============================================================================
        // BOOKS
        // =============================================================================
        async function loadBooks() {
            try {
                const { data, error } = await supabase
                    .from('books')
                    .select('*')
                    .eq('is_active', true)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                books = data || [];
                renderBooks();
                document.getElementById('loadingState').style.display = 'none';
            } catch (error) {
                console.error('Load books error:', error);
                
                // Fallback to sample books if database is empty
                books = [
                    {
                        id: '1',
                        title: 'The Midnight Chronicles',
                        author: 'Your Name',
                        description: 'A gripping tale of mystery and adventure.',
                        cover_url: '',
                        pdf_url: 'https://drive.google.com/file/d/YOUR_FILE_ID/preview'
                    }
                ];
                renderBooks();
                document.getElementById('loadingState').style.display = 'none';
            }
        }

        function renderBooks() {
            const grid = document.getElementById('booksGrid');
            
            if (books.length === 0) {
                grid.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">No books available yet. Check back soon!</p>';
                return;
            }

            grid.innerHTML = books.map(book => `
                <div class="book-card" onclick='openBook(${JSON.stringify(book).replace(/'/g, "&apos;")})'>
                    <div class="book-cover">
                        ${book.cover_url ? `<img src="${book.cover_url}" alt="${book.title}">` : '📖'}
                    </div>
                    <div class="book-info">
                        <div class="book-title">${book.title}</div>
                        <div class="book-author">by ${book.author}</div>
                        <div class="book-description">${book.description || 'A captivating story awaits...'}</div>
                    </div>
                </div>
            `).join('');
        }

        function openBook(book) {
            if (!currentUser) {
                showToast('Please sign in to read books', 'error');
                showAuthModal('login');
                return;
            }

            if (!userSubscription) {
                showPaymentModal();
                return;
            }

            openPDFReader(book.pdf_url);
        }

        // =============================================================================
        // PAYMENT
        // =============================================================================
        async function processPayment() {
            if (!currentUser) {
                showToast('Please sign in first', 'error');
                showAuthModal('login');
                return;
            }

            try {
                const handler = PaystackPop.setup({
                    key: PAYSTACK_CONFIG.publicKey,
                    email: currentUser.email,
                    amount: PAYSTACK_CONFIG.amount,
                    currency: PAYSTACK_CONFIG.currency,
                    ref: `ODL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    metadata: {
                        custom_fields: [{
                            display_name: "User ID",
                            variable_name: "user_id",
                            value: currentUser.id
                        }]
                    },
                    callback: async (response) => {
                        await handlePaymentSuccess(response);
                    },
                    onClose: () => {
                        console.log('Payment window closed');
                    }
                });

                handler.openIframe();
            } catch (error) {
                console.error('Payment error:', error);
                showToast('Payment failed to initialize', 'error');
            }
        }

        async function handlePaymentSuccess(response) {
            try {
                const startDate = new Date();
                const endDate = new Date();
                endDate.setMonth(endDate.getMonth() + 1);

                const { data, error } = await supabase
                    .from('subscriptions')
                    .insert([{
                        user_id: currentUser.id,
                        status: 'active',
                        amount: 300.00,
                        currency: 'KES',
                        start_date: startDate.toISOString(),
                        end_date: endDate.toISOString(),
                        paystack_reference: response.reference
                    }])
                    .select()
                    .single();

                if (error) throw error;

                await supabase.from('payment_history').insert([{
                    user_id: currentUser.id,
                    subscription_id: data.id,
                    amount: 300.00,
                    currency: 'KES',
                    status: 'successful',
                    paystack_reference: response.reference,
                    paid_at: new Date().toISOString()
                }]);

                userSubscription = data;
                updateUserUI();
                closePaymentModal();
                showToast('🎉 Subscription activated! Enjoy unlimited reading!', 'success');
            } catch (error) {
                console.error('Subscription creation error:', error);
                showToast('Payment successful but subscription activation failed. Please contact support.', 'error');
            }
        }

        // =============================================================================
        // MODAL CONTROLS
        // =============================================================================
        function showPaymentModal() {
            document.getElementById('paymentModal').classList.add('active');
        }

        function closePaymentModal() {
            document.getElementById('paymentModal').classList.remove('active');
        }

        function showAuthModal(mode = 'login') {
            isAuthModeSignup = mode === 'signup';
            
            document.getElementById('authTitle').textContent = isAuthModeSignup ? 'Create Account' : 'Sign In';
            document.getElementById('authSubmitBtn').textContent = isAuthModeSignup ? 'Sign Up' : 'Sign In';
            document.getElementById('nameGroup').style.display = isAuthModeSignup ? 'flex' : 'none';
            document.getElementById('authSwitchText').textContent = isAuthModeSignup ? 'Already have an account? ' : "Don't have an account? ";
            document.getElementById('authSwitchLink').textContent = isAuthModeSignup ? 'Sign In' : 'Sign Up';
            
            document.getElementById('authModal').classList.add('active');
        }

        function closeAuthModal() {
            document.getElementById('authModal').classList.remove('active');
            document.getElementById('authForm').reset();
        }

        function openPDFReader(pdfUrl) {
            document.getElementById('pdfViewer').src = pdfUrl;
            document.getElementById('readerModal').classList.add('active');
        }

        function closePDFReader() {
            document.getElementById('readerModal').classList.remove('active');
            document.getElementById('pdfViewer').src = '';
        }

        // =============================================================================
        // UI HELPERS
        // =============================================================================
        function showToast(message, type = 'success') {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = message;
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.remove();
            }, 3000);
        }

        // =============================================================================
        // EVENT LISTENERS
        // =============================================================================
        document.getElementById('loginBtn').addEventListener('click', () => showAuthModal('login'));
        document.getElementById('signupBtn').addEventListener('click', () => showAuthModal('signup'));
        document.getElementById('subscribeBtn').addEventListener('click', processPayment);
        document.getElementById('authForm').addEventListener('submit', handleAuth);
        
        document.getElementById('authSwitchLink').addEventListener('click', () => {
            isAuthModeSignup = !isAuthModeSignup;
            showAuthModal(isAuthModeSignup ? 'signup' : 'login');
        });

        // Listen for auth state changes
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                currentUser = session.user;
                checkSubscriptionStatus().then(() => updateUserUI());
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                userSubscription = null;
            }
        });

        // =============================================================================
        // SERVICE WORKER
        // =============================================================================
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('Service Worker registered'))
                .catch(err => console.log('Service Worker registration failed'));
        }

        // =============================================================================
        // START APP
        // =============================================================================
        initApp();

const PAYSTACK_CONFIG = {
  publicKey: 'pk_live_cedf130a1a00ac0547eedbbd0d7349e92d15446a', // Replace with your Paystack public key
  subscriptionAmount: 30000, // Amount in kobo (300 KES = 30000 kobo)
  currency: 'KES',
  planCode: 'PLN_ap8knacmb5ywwj2', // Create a plan in Paystack dashboard
  callbackUrl: `${window.location.origin}/payment-callback`,
  channels: ['card', 'mobile_money', 'bank'] // Payment methods
};

// =============================================================================
// PAYSTACK PAYMENT CLASS
// =============================================================================

class PaystackPayment {
  constructor() {
    this.publicKey = PAYSTACK_CONFIG.publicKey;
    this.amount = PAYSTACK_CONFIG.subscriptionAmount;
    this.scriptLoaded = false;
    this.loadPaystackScript();
  }

  // Load Paystack inline script
  loadPaystackScript() {
    if (document.getElementById('paystack-script')) {
      this.scriptLoaded = true;
      return;
    }

    const script = document.createElement('script');
    script.id = 'paystack-script';
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.onload = () => {
      this.scriptLoaded = true;
      console.log('Paystack script loaded successfully');
    };
    script.onerror = () => {
      console.error('Failed to load Paystack script');
    };
    document.head.appendChild(script);
  }

  // Initialize one-time payment
  async initializePayment(userData) {
    if (!this.scriptLoaded) {
      await this.waitForScript();
    }

    return new Promise((resolve, reject) => {
      try {
        const handler = PaystackPop.setup({
          key: this.publicKey,
          email: userData.email,
          amount: this.amount,
          currency: PAYSTACK_CONFIG.currency,
          ref: this.generateReference(),
          metadata: {
            custom_fields: [
              {
                display_name: "User ID",
                variable_name: "user_id",
                value: userData.userId
              },
              {
                display_name: "Full Name",
                variable_name: "full_name",
                value: userData.fullName
              },
              {
                display_name: "Subscription Type",
                variable_name: "subscription_type",
                value: "monthly"
              }
            ]
          },
          channels: PAYSTACK_CONFIG.channels,
          callback: (response) => {
            console.log('Payment successful:', response);
            resolve(response);
          },
          onClose: () => {
            console.log('Payment window closed');
            reject(new Error('Payment window closed by user'));
          }
        });

        handler.openIframe();
      } catch (error) {
        console.error('Payment initialization error:', error);
        reject(error);
      }
    });
  }

  // Initialize subscription payment
  async initializeSubscription(userData) {
    if (!this.scriptLoaded) {
      await this.waitForScript();
    }

    return new Promise((resolve, reject) => {
      try {
        const handler = PaystackPop.setup({
          key: this.publicKey,
          email: userData.email,
          amount: this.amount,
          currency: PAYSTACK_CONFIG.currency,
          ref: this.generateReference(),
          plan: PAYSTACK_CONFIG.planCode, // Subscription plan
          metadata: {
            custom_fields: [
              {
                display_name: "User ID",
                variable_name: "user_id",
                value: userData.userId
              },
              {
                display_name: "Full Name",
                variable_name: "full_name",
                value: userData.fullName
              }
            ]
          },
          channels: PAYSTACK_CONFIG.channels,
          callback: (response) => {
            console.log('Subscription successful:', response);
            resolve(response);
          },
          onClose: () => {
            console.log('Subscription window closed');
            reject(new Error('Subscription window closed by user'));
          }
        });

        handler.openIframe();
      } catch (error) {
        console.error('Subscription initialization error:', error);
        reject(error);
      }
    });
  }

  // Verify payment on backend
  async verifyPayment(reference) {
    try {
      // This should be done on your backend for security
      // For now, we'll use a serverless function or Supabase Edge Function
      const response = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reference })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Payment verification error:', error);
      return { success: false, error: error.message };
    }
  }

  // Generate unique payment reference
  generateReference() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `ODL_${timestamp}_${random}`;
  }

  // Wait for Paystack script to load
  waitForScript() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.scriptLoaded) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  // Check payment status
  async checkPaymentStatus(reference) {
    try {
      const response = await fetch(`/api/check-payment-status/${reference}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Status check error:', error);
      return { success: false, error: error.message };
    }
  }
}

// =============================================================================
// PAYMENT WORKFLOW MANAGER
// =============================================================================

class PaymentWorkflow {
  constructor() {
    this.paystack = new PaystackPayment();
  }

  // Complete payment workflow with Supabase integration
  async processSubscriptionPayment(user) {
    try {
      // Show loading state
      this.showLoadingState('Processing payment...');

      // Initialize Paystack payment
      const paymentResponse = await this.paystack.initializeSubscription({
        email: user.email,
        userId: user.id,
        fullName: user.full_name || user.email
      });

      // Verify payment
      this.showLoadingState('Verifying payment...');
      const verification = await this.verifyPaymentWithBackend(paymentResponse.reference);

      if (!verification.success) {
        throw new Error('Payment verification failed');
      }

      // Create subscription in Supabase
      this.showLoadingState('Activating subscription...');
      const subscription = await odlSubscription.createSubscription(
        user.id,
        paymentResponse.reference,
        verification.subscriptionCode
      );

      if (!subscription.success) {
        throw new Error('Failed to create subscription');
      }

      // Record payment in history
      await odlPayments.recordPayment(
        user.id,
        subscription.subscription.id,
        300.00,
        paymentResponse.reference,
        'successful'
      );

      // Success!
      this.hideLoadingState();
      this.showSuccessMessage('Subscription activated successfully! 🎉');

      return {
        success: true,
        subscription: subscription.subscription,
        reference: paymentResponse.reference
      };

    } catch (error) {
      console.error('Payment workflow error:', error);
      this.hideLoadingState();
      this.showErrorMessage(error.message || 'Payment failed. Please try again.');

      // Record failed payment
      if (user && user.id) {
        await odlPayments.recordPayment(
          user.id,
          null,
          300.00,
          null,
          'failed'
        );
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Verify payment with backend
  async verifyPaymentWithBackend(reference) {
    // This will call your Supabase Edge Function or serverless function
    // For now, we'll simulate it - YOU MUST IMPLEMENT THIS SECURELY
    try {
      const response = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reference })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Verification error:', error);
      return { success: false, error: error.message };
    }
  }

  // UI Helper: Show loading state
  showLoadingState(message) {
    const modal = document.getElementById('paymentModal');
    const content = modal.querySelector('.modal-content');
    
    content.innerHTML = `
      <div style="text-align: center; padding: 3rem;">
        <div class="spinner" style="margin: 0 auto 1rem;"></div>
        <p style="font-size: 1.2rem;">${message}</p>
      </div>
    `;
  }

  // UI Helper: Hide loading state
  hideLoadingState() {
    const modal = document.getElementById('paymentModal');
    modal.classList.remove('active');
  }

  // UI Helper: Show success message
  showSuccessMessage(message) {
    alert(message); // Replace with a nice toast notification
    window.location.reload(); // Reload to update UI
  }

  // UI Helper: Show error message
  showErrorMessage(message) {
    alert(`Error: ${message}`); // Replace with a nice error notification
  }
}

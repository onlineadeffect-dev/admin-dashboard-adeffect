import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const allowedAdminEmail = import.meta.env.VITE_ADMIN_EMAIL;

// Fail gracefully with a console error instead of throwing an unhandled top-level exception
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables! Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in Vercel.");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const loginCard = document.getElementById('login-card');
const dashboardCard = document.getElementById('dashboard-card');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const messageDiv = document.getElementById('message');
const userEmailSpan = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');

// 1. Check current session status on load
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    if (session.user.email.toLowerCase() === allowedAdminEmail.toLowerCase()) {
      showDashboard(session.user.email);
    } else {
      // Sign out unauthorized user session if one exists
      await supabase.auth.signOut();
      showMessage('Unauthorized account.', 'error');
    }
  }
}

// 2. Handle Login Submission
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputEmail = emailInput.value.trim().toLowerCase();
    const passwordInput = document.getElementById('password');
    const inputPassword = passwordInput ? passwordInput.value : '';

    const targetEmail = (allowedAdminEmail || 'onlineadeffect@gmail.com').toLowerCase();

    if (inputEmail !== targetEmail) {
      showMessage('Access denied: You are not authorized to log into this dashboard.', 'error');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: inputEmail,
      password: inputPassword,
    });

    if (error) {
      showMessage(error.message, 'error');
    } else {
      showMessage('Login successful!', 'success');
    }
  });
}

// 3. Handle Logout
logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  loginCard.classList.remove('hidden');
  dashboardCard.classList.add('hidden');
  showMessage('Logged out successfully.', 'success');
});

function showDashboard(email) {
  userEmailSpan.textContent = email;
  loginCard.classList.add('hidden');
  dashboardCard.classList.remove('hidden');
}

function showMessage(msg, type) {
  messageDiv.textContent = msg;
  messageDiv.className = type;
}

// Initialize session check
checkAuth();
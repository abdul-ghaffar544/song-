// Login/register logic
const $ = (sel) => document.querySelector(sel);
const form = $('#login-form');
const email = $('#email');
const password = $('#password');
const msg = $('#msg');
const registerBtn = $('#register');

async function post(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || 'Request failed');
  return json;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = 'Signing in...';
  try {
    await post('/api/auth/login', { email: email.value.trim(), password: password.value });
    msg.textContent = 'Success! Redirecting...';
    setTimeout(() => location.href = '/', 500);
  } catch (err) {
    msg.textContent = err.message;
  }
});

registerBtn.addEventListener('click', async () => {
  msg.textContent = 'Creating account...';
  try {
    await post('/api/auth/register', { email: email.value.trim(), password: password.value });
    msg.textContent = 'Account created. Redirecting...';
    setTimeout(() => location.href = '/', 500);
  } catch (err) {
    msg.textContent = err.message;
  }
});


        document.getElementById('registerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const mobile = document.getElementById('mobile').value;
            const password = document.getElementById('password').value;
            const msgEl = document.getElementById('msg');
            const btn = document.querySelector('button');
            
            btn.textContent = 'Creating account...';
            btn.disabled = true;
            msgEl.className = '';

            try {
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, mobile, password })
                });

                const data = await res.json();
                
                if (res.ok) {
                    msgEl.textContent = 'Registration successful! Redirecting to login...';
                    msgEl.className = 'success';
                    msgEl.style.display = 'block';
                    setTimeout(() => window.location.href = '/login', 2000);
                } else {
                    msgEl.textContent = data.error || 'Registration failed';
                    msgEl.className = 'error';
                    msgEl.style.display = 'block';
                }
            } catch (err) {
                msgEl.textContent = 'Network error. Please try again.';
                msgEl.className = 'error';
                msgEl.style.display = 'block';
            } finally {
                btn.textContent = 'Create Account';
                btn.disabled = false;
            }
        });
    
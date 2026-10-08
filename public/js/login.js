
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorMsg = document.getElementById('error-msg');
            const btn = document.querySelector('button');
            
            btn.textContent = 'Signing in...';
            btn.disabled = true;

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                let data;
                try {
                    data = await res.json();
                } catch (parseErr) {
                    const text = await res.text().catch(() => '');
                    data = { error: `Server error (${res.status}): ${text.substring(0, 80) || res.statusText || 'Unable to parse response'}` };
                }
                
                if (res.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    window.location.href = '/worker';
                } else {
                    errorMsg.textContent = data.error || 'Login failed';
                    errorMsg.style.display = 'block';
                }
            } catch (err) {
                console.error('Login request failed:', err);
                errorMsg.textContent = err.message ? `Connection error: ${err.message}` : 'Network error. Please try again.';
                errorMsg.style.display = 'block';
            } finally {
                btn.textContent = 'Sign In';
                btn.disabled = false;
            }
        });
    
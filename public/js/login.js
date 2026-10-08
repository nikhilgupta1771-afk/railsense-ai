
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

                const data = await res.json();
                
                if (res.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    window.location.href = '/worker';
                } else {
                    errorMsg.textContent = data.error || 'Login failed';
                    errorMsg.style.display = 'block';
                }
            } catch (err) {
                errorMsg.textContent = 'Network error. Please try again.';
                errorMsg.style.display = 'block';
            } finally {
                btn.textContent = 'Sign In';
                btn.disabled = false;
            }
        });
    
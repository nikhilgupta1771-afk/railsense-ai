
    const formEmail = document.getElementById('form-email');
    const formReset = document.getElementById('form-reset');
    const step1 = document.getElementById('step1-email');
    const step2 = document.getElementById('step2-otp');
    const errorMsg = document.getElementById('error-msg');
    const successMsg = document.getElementById('success-msg');
    const emailInput = document.getElementById('email');
    const displayEmail = document.getElementById('display-email');
    
    let savedEmail = '';
    let timerInterval = null;

    function startTimer(durationInSeconds) {
      clearInterval(timerInterval);
      const timerDisplay = document.getElementById('timer-text');
      let timeRemaining = durationInSeconds;
      
      timerInterval = setInterval(() => {
        if (timeRemaining <= 0) {
          clearInterval(timerInterval);
          timerDisplay.textContent = 'OTP has expired. Please request a new one.';
          timerDisplay.style.color = '#ef4444';
          document.getElementById('btn-reset').disabled = true;
          return;
        }
        
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        timerDisplay.textContent = `OTP expires in ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        timerDisplay.style.color = '#f59e0b';
        document.getElementById('btn-reset').disabled = false;
        
        timeRemaining--;
      }, 1000);
    }

    function showError(msg) { errorMsg.textContent = msg; errorMsg.style.display = 'block'; successMsg.style.display = 'none'; }
    function showSuccess(msg) { successMsg.textContent = msg; successMsg.style.display = 'block'; errorMsg.style.display = 'none'; }
    function clearMsgs() { errorMsg.style.display = 'none'; successMsg.style.display = 'none'; }

    // OTP Input Auto-advance Logic
    const otpInputs = document.querySelectorAll('.otp-char');
    otpInputs.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        // Only allow numbers
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
        if (e.target.value && index < otpInputs.length - 1) {
          otpInputs[index + 1].focus();
        }
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
          otpInputs[index - 1].focus();
        }
      });
      // Handle paste
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
        for (let i = 0; i < pastedData.length; i++) {
          if (otpInputs[index + i]) {
            otpInputs[index + i].value = pastedData[i];
            if (index + i < otpInputs.length - 1) {
              otpInputs[index + i + 1].focus();
            }
          }
        }
      });
    });

    formEmail.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMsgs();
      const btn = document.getElementById('btn-send');
      btn.disabled = true; btn.textContent = 'Sending...';
      
      savedEmail = emailInput.value.trim();
      
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: savedEmail })
        });
        const data = await res.json();
        
        if (res.ok) {
          showSuccess(data.message);
          displayEmail.textContent = savedEmail;
          step1.classList.remove('active');
          step2.classList.add('active');
          startTimer(15 * 60); // 15 minutes in seconds
          otpInputs[0].focus();
        } else {
          showError(data.error);
        }
      } catch (err) {
        showError('Network error. Please try again.');
      } finally {
        btn.disabled = false; btn.textContent = 'Send OTP';
      }
    });

    formReset.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMsgs();
      const btn = document.getElementById('btn-reset');
      
      // Get OTP
      let otp = '';
      otpInputs.forEach(input => otp += input.value);
      if (otp.length !== 6) {
        return showError('Please enter the full 6-digit OTP.');
      }
      
      const newPassword = document.getElementById('new-password').value;
      
      btn.disabled = true; btn.textContent = 'Verifying...';
      
      try {
        const res = await fetch('/api/auth/reset-password-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: savedEmail, otp, newPassword })
        });
        const data = await res.json();
        
        if (res.ok) {
          showSuccess('Password reset successfully! Redirecting...');
          setTimeout(() => { window.location.href = '/login'; }, 2000);
        } else {
          showError(data.error);
          btn.disabled = false; btn.textContent = 'Reset Password';
        }
      } catch (err) {
        showError('Network error. Please try again.');
        btn.disabled = false; btn.textContent = 'Reset Password';
      }
    });
  
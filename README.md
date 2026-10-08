# RailSense AI 🚆

A secure, full-stack railway predictive maintenance and real-time sensor monitoring platform.

## 🔧 Tech Stack
- **Frontend:** HTML, CSS, JavaScript, Chart.js, Three.js
- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL
- **Realtime:** Socket.IO
- **Auth:** JWT + bcrypt
- **Email (OTP):** Nodemailer (Gmail SMTP)

## ✨ Features
- 🔐 JWT-based login & registration
- 📧 6-digit OTP password reset (email)
- 📡 Real-time sensor data streaming (Socket.IO)
- 📊 26 live signal charts per device (Chart.js)
- 🏥 Health Monitor — classifies 500+ devices as Good / Poor / Critical (RDSO limits)
- 🚨 Instant safety alerts for maintenance workers

## 🚀 Run Locally

1. Clone the repo:
```bash
git clone https://github.com/nikhilgupta1771-afk/railsense-ai.git
cd railsense-ai
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file (see `.env.example`):
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your_password
PORT=3000
JWT_SECRET=your_secret
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

4. Start the server:
```bash
node server.js
```

5. Open: [http://localhost:3000](http://localhost:3000)

## 🏢 Built During Internship
**Centre for Railway Information Systems (CRIS)**
Signal and Telecommunication Intern | Jun–Aug 2026 | New Delhi, India

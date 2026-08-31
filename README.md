# OPEN IT INSTITUTE - Complete Institute Management System

A modern, professional full-stack Institute Management System built with the MERN stack.

## Tech Stack

### Frontend
- React.js (Vite)
- Tailwind CSS
- React Router DOM
- Axios
- React Icons
- Framer Motion
- React Hook Form
- SweetAlert2

### Backend
- Node.js + Express.js
- MongoDB + Mongoose
- JWT Authentication
- bcrypt
- express-validator
- Helmet, CORS, Rate Limiting

## Project Structure

```
open-it-institute/
├── client/          # React Frontend
├── server/          # Express Backend
├── .env.example
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. **Clone / Navigate to project**
```bash
cd open-it-institute
```

2. **Setup Environment**
```bash
cp .env.example .env
# Edit .env with your values
```

3. **Install Backend Dependencies**
```bash
cd server
npm install
```

4. **Install Frontend Dependencies**
```bash
cd ../client
npm install
```

5. **Start Backend** (from server folder)
```bash
npm run dev
```

6. **Start Frontend** (from client folder)
```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/api/health

## Roles
- **Admin** → Full system access
- **Teacher** → Academic management
- **Student** → Personal academic portal

## Development Phases
This project is built phase-by-phase following the master specification.

Current Status: **Phase 1 - Project Setup** ✅

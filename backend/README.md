# BLE Sense - FastAPI Backend API Server

This directory contains the modernized **BLE Sense Backend API Server**, rewritten in Python using **FastAPI** with **PostgreSQL** as the database. It provides secure JWT-based user authentication, role-based access control (RBAC), automatic email integration via Gmail SMTP, and database migration tracking via **Alembic**.

---

## 🏗️ Architecture & Features

- **High Performance:** Built on top of **FastAPI** (Python 3.10+) and Starlette for asynchronous speed.
- **Relational Storage:** Connected to **PostgreSQL** using the **SQLAlchemy ORM** for query building.
- **Database Migrations:** Programmatic schema evolution with **Alembic**.
- **Secure Authentication:** User verification and login utilizing **JSON Web Tokens (JWT)** and **bcrypt** secure password hashing.
- **Gmail SMTP Integration:** Sends email verifications, password resets, and user invitations via background tasks to avoid blocking web traffic.
- **Role Permissions:** Access control preventing non-admin users from viewing list registry or promoting other users to administrators.
- **Default Admin Account:** Automatically seeds a default administrator on server startup if no admin exists.

---

## 📂 Project Structure

```
backend/
├── app/
│   ├── main.py            # Application entry point, lifespan, & admin seed
│   ├── config.py          # Environment settings loader (Pydantic)
│   ├── database.py        # SQLAlchemy engine and session setup
│   ├── security.py        # Password hashing & JWT generation
│   ├── models/
│   │   └── user.py        # User table schema
│   ├── schemas/
│   │   └── user.py        # Pydantic serialization models
│   ├── routers/
│   │   ├── deps.py        # Route dependency guards (auth check)
│   │   ├── auth.py        # Registration, login, reset, & verify API
│   │   └── users.py       # Password change & admin endpoints
│   └── services/
│       └── email.py       # Gmail SMTP helper & HTML templates
├── alembic/               # Migration scripts environment
├── alembic.ini            # Alembic configuration
├── requirements.txt       # Dependencies manifest
└── .env                   # Configuration file (ignored by git)
```

---

## 🚀 Installation & Setup

### 1. Prerequisites
- **Python 3.10 or newer**
- **PostgreSQL Server** running locally or a connection string to a remote instance.

### 2. Create Virtual Environment
Open a terminal in the `backend/` directory:
```bash
python -m venv venv

# On Windows (cmd):
venv\Scripts\activate
# On Windows (PowerShell):
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment (`.env`)
Create a `.env` file in the `backend/` directory:
```env
PORT=8000
HOST=0.0.0.0

# Database Connection
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/blesense

# Security Keys
SECRET_KEY=your_secure_random_hex_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Gmail SMTP Email Setup
# IMPORTANT: Generate a 16-character App Password on your Google account.
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=BLE Sense Ecosystem

# Seed Administrator Account
DEFAULT_ADMIN_USERNAME=saurabh
DEFAULT_ADMIN_EMAIL=thedev.saurabh@gmail.com
DEFAULT_ADMIN_PASSWORD=AdminChangeMe123!

# Frontend Address (for email verification & reset redirects)
FRONTEND_URL=http://localhost:5173
```

---

## 🗄️ Database Migrations (Alembic)

Once your database is running and configuration is complete in `.env`, run the following commands to create and apply the database tables:

1. **Initialize the migration revision:**
   ```bash
   alembic revision --autogenerate -m "Initial migrations"
   ```
2. **Apply migrations to the database:**
   ```bash
   alembic upgrade head
   ```

---

## 🏃 Running the Application

Start the development server:
```bash
uvicorn app.main:app --reload
```

The application will run by default at `http://localhost:8000`.
- **Swagger Interactive API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Alternative Documentation:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 📡 API Reference Summary

### Authentication Routes (`/api/auth`)
* `POST /api/auth/register` - Registers a new user. Sends verification email.
* `GET /api/auth/verify-email?token=...` - API verify callback. Activates account.
* `POST /api/auth/login` - Authenticates user. Returns JWT Access Token.
* `POST /api/auth/forgot-password` - Generates reset token and sends email link.
* `POST /api/auth/reset-password` - Resets password using the received token.

### User Profile & Management Routes (`/api/users`)
* `POST /api/users/change-password` - Updates the current user's password (requires auth).
* `GET /api/users/` - Lists all registered users (**Admin only**).
* `POST /api/users/{user_id}/promote` - Grants administrator status to a user (**Admin only**).

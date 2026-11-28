import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import SessionLocal
from app.models.user import User
from app.security import get_password_hash
from app.routers import auth, users, packets, datalogger, registry, system
from app.services.queue import packet_worker

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Suppress harmless Windows ProactorEventLoop ConnectionResetError [WinError 10054]
    try:
        loop = asyncio.get_running_loop()
        def handle_exception(loop, context):
            exc = context.get("exception")
            if isinstance(exc, ConnectionResetError) or "[WinError 10054]" in str(context.get("message", "")):
                return
            loop.default_exception_handler(context)
        loop.set_exception_handler(handle_exception)
    except Exception:
        pass

    # Startup actions: Ensure tables exist
    try:
        from app.database import Base, engine
        import app.models
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"⚠️ Table initialization notice: {e}")

    # Safe database deduplication (Option A): Only purge exact retransmissions (identical hex data within 10 minutes)
    # Never deletes next-day packets or packets with different sensor readings, even if packet IDs restart from 1.
    try:
        from sqlalchemy import text
        with SessionLocal() as db_cleanup:
            # 1. Clean duplicate datalogger_headers (identical raw_data within 10 minutes)
            db_cleanup.execute(text("""
                DELETE FROM datalogger_headers
                WHERE id IN (
                    SELECT d2.id
                    FROM datalogger_headers d1
                    JOIN datalogger_headers d2 
                      ON d1.app_id = d2.app_id 
                     AND d1.packet_id_num = d2.packet_id_num 
                     AND d1.raw_data = d2.raw_data
                     AND d1.id < d2.id
                     AND d2.created_at >= d1.created_at
                     AND d2.created_at <= d1.created_at + INTERVAL '10 minutes'
                )
            """))
            # 2. Clean duplicate sensor_packets (identical rawData within 10 minutes)
            db_cleanup.execute(text("""
                DELETE FROM sensor_packets
                WHERE id IN (
                    SELECT s2.id
                    FROM sensor_packets s1
                    JOIN sensor_packets s2
                      ON s1.app_id = s2.app_id
                     AND s1.data->>'packetId' = s2.data->>'packetId'
                     AND s1.data->>'rawData' = s2.data->>'rawData'
                     AND s1.id < s2.id
                     AND s2.timestamp >= s1.timestamp
                     AND s2.timestamp <= s1.timestamp + INTERVAL '10 minutes'
                    WHERE s1.data->>'packetId' IS NOT NULL
                )
            """))
            db_cleanup.commit()
            print("✅ Database tables deduplicated safely (Option A active).")
    except Exception as e:
        print(f"⚠️ Safe deduplication check notice: {e}")

    # Seed default admin user
    db = SessionLocal()
    try:
        admin_username = settings.DEFAULT_ADMIN_USERNAME
        admin_email = settings.DEFAULT_ADMIN_EMAIL
        
        # Check if user with either username or email already exists
        admin = db.query(User).filter(
            (User.username == admin_username) | (User.email == admin_email)
        ).first()
        
        if not admin:
            # Seed default admin user
            admin_pwd_hash = get_password_hash(settings.DEFAULT_ADMIN_PASSWORD)
            default_admin = User(
                username=admin_username,
                email=admin_email,
                hashed_password=admin_pwd_hash,
                is_active=True,
                is_verified=True,
                is_superuser=True
            )
            db.add(default_admin)
            db.commit()
            
            print("\n" + "="*58)
            print(f"👤 DEFAULT ADMINISTRATOR ACCOUNT SEEDED!")
            print(f"   Username: {admin_username}")
            print(f"   Email:    {admin_email}")
            print(f"   Password: {settings.DEFAULT_ADMIN_PASSWORD}")
            print("⚠️  CRITICAL: PLEASE CHANGE THIS PASSWORD UPON FIRST LOGIN!")
            print("="*58 + "\n")
        else:
            print(f"👤 Admin user '{admin.username}' ({admin.email}) already exists in the database.")
    except Exception as e:
        print(f"❌ Failed to seed database: {e}")
    finally:
        db.close()
    
    # Start background worker task
    worker_task = asyncio.create_task(packet_worker())
    
    yield
    
    # Shutdown actions: Cancel background task
    worker_task.cancel()

# Instantiate FastAPI application
app = FastAPI(
    title="BLE Sense Ecosystem API",
    description="FastAPI Backend for User Authentication, Profiles, and System Roles",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware configuration
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
   
    "https://blesense.netlify.app",
     "https://blecom.netlify.app",
]
if settings.FRONTEND_URL:
    allowed_origins.append(settings.FRONTEND_URL)
    stripped_url = settings.FRONTEND_URL.rstrip("/")
    if stripped_url not in allowed_origins:
        allowed_origins.append(stripped_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.netlify\.app|http://localhost:.*|http://127\.0\.0\.1:.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(packets.router, prefix="/api")
app.include_router(datalogger.router, prefix="/api")
app.include_router(registry.router, prefix="/api")
app.include_router(system.router, prefix="/api")

# Simple base check
@app.get("/")
def read_root():
    return {
        "message": "BLE Sense Ecosystem API is running.",
        "docs": "/docs",
        "redoc": "/redoc"
    }

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "BLE Sense API"}

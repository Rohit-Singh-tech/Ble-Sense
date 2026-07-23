import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import SessionLocal
from app.models.user import User
from app.security import get_password_hash
from app.routers import auth, users, packets, datalogger, registry
from app.services.queue import packet_worker

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions: Seed default admin user
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
            
        # Seed default bovine tags in TagRegistry
        from app.models.registry import TagRegistry
        if db.query(TagRegistry).count() == 0:
            default_tags = [
                TagRegistry(
                    device_id="11",
                    name="Bovine #11",
                    breed="Murrah Buffalo",
                    location="Barn Sector A",
                    weight="480 kg",
                    notes="Lactation study subject A"
                ),
                TagRegistry(
                    device_id="42",
                    name="Bovine #42",
                    breed="Holstein Cow",
                    location="Barn Sector B",
                    weight="620 kg",
                    notes="Milk yield telemetry group 1"
                ),
                TagRegistry(
                    device_id="89",
                    name="Bovine #89",
                    breed="Jersey Cow",
                    location="Barn Sector B",
                    weight="510 kg",
                    notes="High fat content test cow"
                ),
                TagRegistry(
                    device_id="93",
                    name="Bovine #93",
                    breed="Sahiwal Cow",
                    location="Barn Sector A",
                    weight="430 kg",
                    notes="Native heat tolerance study"
                ),
                TagRegistry(
                    device_id="248",
                    name="Bovine #248",
                    breed="Nili-Ravi Buffalo",
                    location="Pasture Sector C",
                    weight="550 kg",
                    notes="Grazing behavior tracking collar"
                ),
            ]
            db.add_all(default_tags)
            db.commit()
            print("🐃 Tag Registry Seeded with 5 default entries successfully.")
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

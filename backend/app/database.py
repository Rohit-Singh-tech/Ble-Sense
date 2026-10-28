from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

# Handle cloud providers (e.g., Render, Supabase, Neon) supplying postgres:// instead of postgresql://
database_url = settings.DATABASE_URL
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

# Ensure compatibility between psycopg (v3, default in SQLAlchemy 2.1+) and psycopg2
try:
    import psycopg  # noqa: F401 - psycopg v3
except ImportError:
    try:
        import psycopg2  # noqa: F401
        # Fall back to psycopg2 driver if psycopg (v3) is not installed
        if database_url and database_url.startswith("postgresql://"):
            database_url = database_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    except ImportError:
        pass

# Create database engine with low memory footprint suited for Render free tier (512MB RAM)
# For PostgreSQL we do not need connect_args={"check_same_thread": False}
engine = create_engine(
    database_url,
    pool_size=5,
    max_overflow=5,
    pool_recycle=1800,
    pool_pre_ping=True
)

# Create SessionLocal class for database sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Dependency to get db session in API endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

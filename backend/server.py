from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from datetime import datetime, timezone
import bcrypt

from routers.auth import create_auth_router, get_current_user
from routers.files import create_files_router
from routers.transactions import create_transactions_router
from routers.dashboard import create_dashboard_router
from routers.insights import create_insights_router
from routers.reports import create_reports_router
from routers.settings import create_settings_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create FastAPI app - redirect_slashes=False prevents HTTP redirect issues
app = FastAPI(
    title="LedgerLens API",
    description="AI-powered personal finance tracker",
    version="1.0.0",
    redirect_slashes=False
)

# CORS configuration
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper function to get current user with db
async def get_user_with_db(request: Request):
    return await get_current_user(request, db)

# Include routers
auth_router = create_auth_router(db)
app.include_router(auth_router, prefix="/api")

files_router = create_files_router(db, get_user_with_db)
app.include_router(files_router, prefix="/api")

transactions_router = create_transactions_router(db, get_user_with_db)
app.include_router(transactions_router, prefix="/api")

dashboard_router = create_dashboard_router(db, get_user_with_db)
app.include_router(dashboard_router, prefix="/api")

insights_router = create_insights_router(db, get_user_with_db)
app.include_router(insights_router, prefix="/api")

reports_router = create_reports_router(db, get_user_with_db)
app.include_router(reports_router, prefix="/api")

settings_router = create_settings_router(db, get_user_with_db)
app.include_router(settings_router, prefix="/api")


@app.get("/api/")
async def root():
    return {"message": "LedgerLens API", "version": "1.0.0"}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


async def seed_admin():
    """Seed admin user if not exists."""
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@ledgerlens.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin123!")
    
    existing = await db.users.find_one({"email": admin_email}, {"_id": 0})
    
    if existing is None:
        import uuid
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "user_id": user_id,
            "email": admin_email,
            "name": "Admin",
            "password_hash": hashed,
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
        logger.info(f"Admin password updated: {admin_email}")
    
    # Write test credentials
    os.makedirs("/app/memory", exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(f"""# LedgerLens Test Credentials

## Admin Account
- Email: {admin_email}
- Password: {admin_password}
- Role: admin

## Auth Endpoints
- POST /api/auth/register - Register new user
- POST /api/auth/login - Login with email/password
- POST /api/auth/logout - Logout
- GET /api/auth/me - Get current user
- POST /api/auth/refresh - Refresh access token
- POST /api/auth/forgot-password - Request password reset
- POST /api/auth/reset-password - Reset password with token
- POST /api/auth/google/session - Google OAuth session exchange
""")


async def seed_sample_data():
    """Seed sample transactions for demo purposes."""
    admin = await db.users.find_one({"role": "admin"}, {"_id": 0})
    if not admin:
        return
    
    # Check if sample data already exists
    existing_count = await db.transactions.count_documents({"user_id": admin["user_id"]})
    if existing_count > 0:
        return
    
    import uuid
    import random
    from datetime import timedelta
    
    categories = ["Groceries", "Transport", "Dining", "Shopping", "Entertainment", "Bills", "Health"]
    merchants = {
        "Groceries": ["Tesco Express", "Sainsbury's Local", "Waitrose", "Aldi", "Lidl"],
        "Transport": ["TfL", "Uber", "Bolt", "Shell Petrol"],
        "Dining": ["Costa Coffee", "Pret A Manger", "Nando's", "Wagamama", "Deliveroo"],
        "Shopping": ["Amazon", "ASOS", "John Lewis", "Argos"],
        "Entertainment": ["Netflix", "Spotify", "Cinema City", "Steam"],
        "Bills": ["British Gas", "Thames Water", "EE Mobile", "Sky Broadband"],
        "Health": ["Boots Pharmacy", "Pure Gym", "Holland & Barrett"]
    }
    
    transactions = []
    now = datetime.now(timezone.utc)
    
    # Generate 3 months of sample data
    for days_ago in range(90):
        date = now - timedelta(days=days_ago)
        num_txns = random.randint(1, 5)
        
        for _ in range(num_txns):
            category = random.choice(categories)
            merchant = random.choice(merchants[category])
            
            # Generate realistic amounts
            if category == "Groceries":
                amount = -round(random.uniform(10, 80), 2)
            elif category == "Transport":
                amount = -round(random.uniform(2, 50), 2)
            elif category == "Dining":
                amount = -round(random.uniform(5, 40), 2)
            elif category == "Shopping":
                amount = -round(random.uniform(15, 200), 2)
            elif category == "Entertainment":
                amount = -round(random.uniform(5, 50), 2)
            elif category == "Bills":
                amount = -round(random.uniform(30, 150), 2)
            else:
                amount = -round(random.uniform(5, 100), 2)
            
            txn_id = f"txn_{uuid.uuid4().hex[:12]}"
            transactions.append({
                "transaction_id": txn_id,
                "user_id": admin["user_id"],
                "account_id": None,
                "date": date.isoformat(),
                "merchant_raw": merchant,
                "merchant_clean": merchant,
                "amount": amount,
                "currency": "GBP",
                "category": category,
                "subcategory": None,
                "source_file_id": None,
                "confidence_score": round(random.uniform(0.7, 0.95), 2),
                "notes": None,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    # Add some income
    for month_offset in range(3):
        date = now - timedelta(days=month_offset * 30 + 1)
        txn_id = f"txn_{uuid.uuid4().hex[:12]}"
        transactions.append({
            "transaction_id": txn_id,
            "user_id": admin["user_id"],
            "account_id": None,
            "date": date.isoformat(),
            "merchant_raw": "ACME Corp Salary",
            "merchant_clean": "ACME Corp Salary",
            "amount": 3500.00,
            "currency": "GBP",
            "category": "Income",
            "subcategory": "Salary",
            "source_file_id": None,
            "confidence_score": 0.95,
            "notes": "Monthly salary",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    if transactions:
        await db.transactions.insert_many(transactions)
        logger.info(f"Seeded {len(transactions)} sample transactions")


async def create_indexes():
    """Create database indexes."""
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.transactions.create_index([("user_id", 1), ("date", -1)])
    await db.transactions.create_index("transaction_id", unique=True)
    await db.uploaded_files.create_index([("user_id", 1), ("uploaded_at", -1)])
    await db.uploaded_files.create_index("file_id", unique=True)
    await db.reports.create_index([("user_id", 1), ("generated_at", -1)])
    await db.login_attempts.create_index("identifier")
    await db.password_reset_tokens.create_index("token")
    logger.info("Database indexes created")


@app.on_event("startup")
async def startup_event():
    await create_indexes()
    await seed_admin()
    await seed_sample_data()
    logger.info("LedgerLens API started")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

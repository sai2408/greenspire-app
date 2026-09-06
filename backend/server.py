from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

import jwt
import requests


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
SESSION_SECRET = os.environ['SESSION_SECRET']
SESSION_TTL_DAYS = int(os.environ.get('SESSION_TTL_DAYS', '30'))
ADMIN_EMAILS = {e.strip().lower() for e in os.environ.get('ADMIN_EMAILS', '').split(',') if e.strip()}

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class UserProfile(BaseModel):
    user_id: str
    name: str
    email: str
    picture: Optional[str] = None
    preferences: Dict[str, Any] = Field(default_factory=dict)
    onboarded: bool = False
    is_admin: bool = False
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# No user_id/email/is_admin here — identity comes from the verified session
# token only, and is_admin is never client-settable (see ADMIN_EMAILS below).
class ProfileUpsert(BaseModel):
    name: Optional[str] = None
    picture: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None
    onboarded: Optional[bool] = None


class GoogleSignInRequest(BaseModel):
    access_token: str


class AuthResponse(BaseModel):
    user: UserProfile
    token: str


class PlannerEntry(BaseModel):
    user_id: str
    date: str  # YYYY-MM-DD
    recipe_id: str
    slot: str  # breakfast | lunch | dinner | snack
    servings: float = 1.0


class PlannerUpsert(BaseModel):
    date: str
    recipe_id: str
    slot: str
    servings: float = 1.0


class Ingredient(BaseModel):
    name: str
    qty: float
    unit: str  # 'g' | 'ml' | 'piece'
    category: str  # 'Produce' | 'Proteins' | 'Condiments' | 'Nuts & Seeds'


class Step(BaseModel):
    phase: str  # 'Preparation' | 'Dressing' | 'Tossing'
    text: str


class Macros(BaseModel):
    calories: float
    carbs_g: float
    protein_g: float
    fat_g: float


class Recipe(BaseModel):
    id: str
    name: str
    tagline: str
    cuisine: str
    diet: str  # 'veg' | 'egg' | 'chicken' | 'fish'
    proteins: List[str]
    prep_time_min: float
    spice: str
    calorie_bucket: str
    budget: str
    dressing_style: str
    meal_slot: List[str]
    allergens: List[str]
    image: str
    ingredients: List[Ingredient]
    steps: List[Step]
    macros: Macros


class RecipeUpsert(BaseModel):
    id: Optional[str] = None
    name: str
    tagline: str
    cuisine: str
    diet: str
    proteins: List[str] = Field(default_factory=list)
    prep_time_min: float
    spice: str
    calorie_bucket: str
    budget: str
    dressing_style: str
    meal_slot: List[str] = Field(default_factory=list)
    allergens: List[str] = Field(default_factory=list)
    image: str
    ingredients: List[Ingredient] = Field(default_factory=list)
    steps: List[Step] = Field(default_factory=list)
    macros: Macros


# ---------- Auth ----------
def create_session_token(user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + timedelta(days=SESSION_TTL_DAYS),
    }
    return jwt.encode(payload, SESSION_SECRET, algorithm="HS256")


async def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, SESSION_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session token")
    return payload["sub"]


# Re-reads is_admin from Mongo on every call rather than trusting a JWT claim,
# so editing ADMIN_EMAILS takes effect on next sign-in, not only once a
# previously-issued token happens to expire.
async def require_admin(user_id: str = Depends(get_current_user)) -> str:
    profile = await db.profiles.find_one({"user_id": user_id}, {"_id": 0})
    if not profile or not profile.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user_id


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "GreenSpire API running"}


@api_router.post("/auth/google", response_model=AuthResponse)
async def google_sign_in(payload: GoogleSignInRequest):
    # Verify the token was actually issued for this app before trusting it —
    # a valid access token for some other Google client shouldn't be usable
    # to sign in here.
    try:
        tokeninfo = requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"access_token": payload.access_token},
            timeout=10,
        )
    except requests.RequestException:
        raise HTTPException(status_code=401, detail="Could not verify Google token")
    if tokeninfo.status_code != 200 or tokeninfo.json().get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=401, detail="Invalid Google access token")

    # The (id_token-only) implicit flow doesn't carry profile claims like
    # picture/name — fetching userinfo with the access token instead gets
    # the full profile in one call, using Google's own server as the
    # verification authority instead of local JWT signature verification.
    try:
        userinfo = requests.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {payload.access_token}"},
            timeout=10,
        )
    except requests.RequestException:
        raise HTTPException(status_code=401, detail="Could not fetch Google profile")
    if userinfo.status_code != 200:
        raise HTTPException(status_code=401, detail="Could not fetch Google profile")
    idinfo = userinfo.json()

    if idinfo.get("email_verified") not in (True, "true"):
        raise HTTPException(status_code=401, detail="Google email not verified")

    user_id = idinfo["sub"]
    email = idinfo["email"]
    # Recomputed on every sign-in (not just first-time) so ADMIN_EMAILS
    # changes apply the next time this person logs in.
    is_admin = email.lower() in ADMIN_EMAILS

    existing = await db.profiles.find_one({"user_id": user_id}, {"_id": 0})
    updated = {
        "user_id": user_id,
        "name": idinfo.get("name", email),
        "email": email,
        "picture": idinfo.get("picture") or (existing.get("picture") if existing else None),
        "preferences": existing.get("preferences", {}) if existing else {},
        "onboarded": existing.get("onboarded", False) if existing else False,
        "is_admin": is_admin,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.profiles.update_one({"user_id": user_id}, {"$set": updated}, upsert=True)

    token = create_session_token(user_id, email)
    return AuthResponse(user=UserProfile(**updated), token=token)


@api_router.post("/profile", response_model=UserProfile)
async def upsert_profile(payload: ProfileUpsert, user_id: str = Depends(get_current_user)):
    existing = await db.profiles.find_one({"user_id": user_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Profile not found — sign in first")
    updated = {
        "user_id": user_id,
        "name": payload.name if payload.name is not None else existing.get("name"),
        "email": existing.get("email"),
        "picture": payload.picture if payload.picture is not None else existing.get("picture"),
        "preferences": payload.preferences if payload.preferences is not None else existing.get("preferences", {}),
        "onboarded": payload.onboarded if payload.onboarded is not None else existing.get("onboarded", False),
        "is_admin": existing.get("is_admin", False),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.profiles.update_one({"user_id": user_id}, {"$set": updated}, upsert=True)
    return UserProfile(**updated)


@api_router.get("/profile/me", response_model=Optional[UserProfile])
async def get_my_profile(user_id: str = Depends(get_current_user)):
    doc = await db.profiles.find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Profile not found")
    return UserProfile(**doc)


@api_router.post("/planner", response_model=PlannerEntry)
async def add_planner(payload: PlannerUpsert, user_id: str = Depends(get_current_user)):
    entry = {**payload.dict(), "user_id": user_id}
    await db.planner.update_one(
        {"user_id": user_id, "date": payload.date, "slot": payload.slot},
        {"$set": entry},
        upsert=True,
    )
    return PlannerEntry(**entry)


@api_router.get("/planner", response_model=List[PlannerEntry])
async def get_planner(user_id: str = Depends(get_current_user)):
    docs = await db.planner.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    return [PlannerEntry(**d) for d in docs]


@api_router.delete("/planner/{date}/{slot}")
async def remove_planner(date: str, slot: str, user_id: str = Depends(get_current_user)):
    res = await db.planner.delete_one({"user_id": user_id, "date": date, "slot": slot})
    return {"deleted": res.deleted_count}


@api_router.delete("/planner")
async def clear_planner(user_id: str = Depends(get_current_user)):
    res = await db.planner.delete_many({"user_id": user_id})
    return {"deleted": res.deleted_count}


@api_router.get("/recipes", response_model=List[Recipe])
async def list_recipes():
    docs = await db.recipes.find({}, {"_id": 0}).to_list(1000)
    return [Recipe(**d) for d in docs]


@api_router.get("/recipes/{recipe_id}", response_model=Recipe)
async def get_recipe(recipe_id: str):
    doc = await db.recipes.find_one({"id": recipe_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return Recipe(**doc)


@api_router.post("/recipes", response_model=Recipe)
async def create_recipe(payload: RecipeUpsert, admin_id: str = Depends(require_admin)):
    new_id = payload.id or payload.name.lower().strip().replace(" ", "-")
    if await db.recipes.find_one({"id": new_id}):
        raise HTTPException(status_code=409, detail="Recipe id already exists")
    doc = payload.dict()
    doc["id"] = new_id
    await db.recipes.insert_one(doc)
    doc.pop("_id", None)
    return Recipe(**doc)


@api_router.put("/recipes/{recipe_id}", response_model=Recipe)
async def update_recipe(recipe_id: str, payload: RecipeUpsert, admin_id: str = Depends(require_admin)):
    doc = payload.dict()
    doc["id"] = recipe_id
    result = await db.recipes.update_one({"id": recipe_id}, {"$set": doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return Recipe(**doc)


@api_router.delete("/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str, admin_id: str = Depends(require_admin)):
    res = await db.recipes.delete_one({"id": recipe_id})
    return {"deleted": res.deleted_count}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

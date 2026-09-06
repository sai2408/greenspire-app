"""GreenSpire backend API tests: auth, profile & planner CRUD.

Profiles are now only ever created by POST /api/auth/google (real Google
token verification), which these tests can't exercise directly. Instead,
fixtures seed a profile document straight into Mongo and mint a session JWT
with the same SESSION_SECRET the server uses — functionally equivalent to
what /api/auth/google would have produced, without needing a real Google
token.
"""
import os
import uuid
import pytest
import requests
import jwt as pyjwt
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from pathlib import Path
from pymongo import MongoClient

# Load frontend .env to get public backend URL used by app
load_dotenv(Path(__file__).resolve().parents[2] / 'frontend' / '.env')
# Load backend .env to get the Mongo connection + session signing secret
load_dotenv(Path(__file__).resolve().parents[1] / '.env')

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set"

API = f"{BASE_URL}/api"

SESSION_SECRET = os.environ['SESSION_SECRET']
_mongo = MongoClient(os.environ['MONGO_URL'])
_db = _mongo[os.environ['DB_NAME']]


def _make_token(user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "email": email, "iat": now, "exp": now + timedelta(days=1)}
    return pyjwt.encode(payload, SESSION_SECRET, algorithm="HS256")


def _seed_profile(user_id: str, email: str, is_admin: bool = False):
    _db.profiles.insert_one({
        "user_id": user_id, "name": "TEST User", "email": email, "picture": None,
        "preferences": {}, "onboarded": False, "is_admin": is_admin,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def test_user_id():
    uid = f"TEST_user_{uuid.uuid4().hex[:8]}"
    _seed_profile(uid, f"{uid}@example.com")
    yield uid
    _db.profiles.delete_one({"user_id": uid})
    _db.planner.delete_many({"user_id": uid})


@pytest.fixture(scope="module")
def auth_headers(test_user_id):
    token = _make_token(test_user_id, f"{test_user_id}@example.com")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_user_id():
    uid = f"TEST_admin_{uuid.uuid4().hex[:8]}"
    _seed_profile(uid, f"{uid}@example.com", is_admin=True)
    yield uid
    _db.profiles.delete_one({"user_id": uid})


@pytest.fixture(scope="module")
def admin_headers(admin_user_id):
    token = _make_token(admin_user_id, f"{admin_user_id}@example.com")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def non_admin_user_id():
    uid = f"TEST_nonadmin_{uuid.uuid4().hex[:8]}"
    _seed_profile(uid, f"{uid}@example.com", is_admin=False)
    yield uid
    _db.profiles.delete_one({"user_id": uid})


@pytest.fixture(scope="module")
def non_admin_headers(non_admin_user_id):
    token = _make_token(non_admin_user_id, f"{non_admin_user_id}@example.com")
    return {"Authorization": f"Bearer {token}"}


def _sample_recipe_payload(name):
    return {
        "name": name,
        "tagline": "A test recipe",
        "cuisine": "Tandoori",
        "diet": "veg",
        "proteins": ["paneer"],
        "prep_time_min": 15,
        "spice": "mild",
        "calorie_bucket": "low",
        "budget": "budget",
        "dressing_style": "light",
        "meal_slot": ["lunch"],
        "allergens": [],
        "image": "https://example.com/test.jpg",
        "ingredients": [{"name": "Paneer", "qty": 100, "unit": "g", "category": "Proteins"}],
        "steps": [
            {"phase": "Preparation", "text": "prep"},
            {"phase": "Dressing", "text": "dress"},
            {"phase": "Tossing", "text": "toss"},
        ],
        "macros": {"calories": 200, "carbs_g": 10, "protein_g": 15, "fat_g": 8},
    }


# ---------- Health ----------
class TestHealth:
    def test_root(self, api):
        r = api.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        assert "message" in data
        assert "GreenSpire" in data["message"]


# ---------- Auth ----------
class TestAuth:
    def test_profile_me_without_token_returns_401(self, api):
        r = api.get(f"{API}/profile/me")
        assert r.status_code == 401

    def test_profile_me_with_garbage_token_returns_401(self, api):
        r = api.get(f"{API}/profile/me", headers={"Authorization": "Bearer not-a-real-token"})
        assert r.status_code == 401

    def test_profile_me_for_unseeded_user_returns_404(self, api):
        # A structurally valid token for a user_id with no Mongo profile —
        # this is the "signed a token but never actually signed in" case,
        # which can't happen via real /api/auth/google but proves the route
        # itself 404s correctly rather than fabricating a profile.
        token = _make_token(f"TEST_ghost_{uuid.uuid4().hex[:8]}", "ghost@example.com")
        r = api.get(f"{API}/profile/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 404


# ---------- Profile ----------
class TestProfile:
    def test_get_me_returns_seeded_profile(self, api, test_user_id, auth_headers):
        r = api.get(f"{API}/profile/me", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["user_id"] == test_user_id

    def test_upsert_without_token_returns_401(self, api):
        r = api.post(f"{API}/profile", json={"name": "No Auth"})
        assert r.status_code == 401

    def test_upsert_updates_preferences(self, api, auth_headers):
        prefs = {"dietType": "veg", "fitnessGoal": "weight_loss", "spice": "medium"}
        payload = {"name": "TEST Aarav", "preferences": prefs, "onboarded": True}
        r = api.post(f"{API}/profile", json=payload, headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["preferences"] == prefs
        assert data["onboarded"] is True
        assert data["name"] == "TEST Aarav"

    def test_get_reflects_updated_prefs(self, api, auth_headers):
        r = api.get(f"{API}/profile/me", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["preferences"]["dietType"] == "veg"
        assert data["onboarded"] is True

    def test_partial_upsert_preserves_prefs(self, api, auth_headers):
        # Send upsert without preferences → should preserve existing
        r = api.post(f"{API}/profile", json={"name": "TEST Aarav Updated"}, headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "TEST Aarav Updated"
        assert data["preferences"]["dietType"] == "veg"
        assert data["onboarded"] is True

    def test_upsert_cannot_set_is_admin(self, api, auth_headers):
        # is_admin isn't even a field on the request model anymore, but
        # confirm sending it is silently ignored rather than accepted.
        r = api.post(f"{API}/profile", json={"name": "TEST Aarav", "is_admin": True}, headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["is_admin"] is False

    def test_profile_is_scoped_to_caller(self, api, auth_headers, non_admin_headers, non_admin_user_id):
        # Two different callers' /profile/me must never return the other's data.
        r = api.get(f"{API}/profile/me", headers=non_admin_headers)
        assert r.status_code == 200
        assert r.json()["user_id"] == non_admin_user_id
        r2 = api.get(f"{API}/profile/me", headers=auth_headers)
        assert r2.json()["user_id"] != non_admin_user_id


# ---------- Planner ----------
class TestPlanner:
    def test_planner_without_token_returns_401(self, api):
        r = api.get(f"{API}/planner")
        assert r.status_code == 401

    def test_add_planner_entry(self, api, auth_headers):
        payload = {"date": "2026-01-15", "recipe_id": "kachumber-quinoa", "slot": "lunch", "servings": 1.5}
        r = api.post(f"{API}/planner", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["recipe_id"] == "kachumber-quinoa"
        assert data["servings"] == 1.5

    def test_get_planner_returns_entry(self, api, auth_headers):
        r = api.get(f"{API}/planner", headers=auth_headers)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        assert any(e["date"] == "2026-01-15" and e["slot"] == "lunch" for e in arr)

    def test_upsert_planner_same_slot(self, api, auth_headers):
        # Same user/date/slot should update, not duplicate
        payload = {"date": "2026-01-15", "recipe_id": "sprouts-chaat", "slot": "lunch", "servings": 2.0}
        r = api.post(f"{API}/planner", json=payload, headers=auth_headers)
        assert r.status_code == 200
        r2 = api.get(f"{API}/planner", headers=auth_headers)
        entries = [e for e in r2.json() if e["date"] == "2026-01-15" and e["slot"] == "lunch"]
        assert len(entries) == 1
        assert entries[0]["recipe_id"] == "sprouts-chaat"

    def test_multiple_slots_same_day(self, api, auth_headers):
        for slot, rid in [("dinner", "tandoori-paneer"), ("snack", "moong-salad")]:
            r = api.post(f"{API}/planner", json={
                "date": "2026-01-15", "recipe_id": rid, "slot": slot, "servings": 1.0,
            }, headers=auth_headers)
            assert r.status_code == 200
        r = api.get(f"{API}/planner", headers=auth_headers)
        slots = {e["slot"] for e in r.json() if e["date"] == "2026-01-15"}
        assert {"lunch", "dinner", "snack"}.issubset(slots)

    def test_planner_is_scoped_to_caller(self, api, auth_headers, non_admin_headers):
        # A different caller must not see test_user_id's planner entries.
        r = api.get(f"{API}/planner", headers=non_admin_headers)
        assert r.status_code == 200
        assert not any(e["date"] == "2026-01-15" for e in r.json())

    def test_delete_planner_slot(self, api, auth_headers):
        r = api.delete(f"{API}/planner/2026-01-15/snack", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["deleted"] == 1
        r2 = api.get(f"{API}/planner", headers=auth_headers)
        assert not any(e["date"] == "2026-01-15" and e["slot"] == "snack" for e in r2.json())

    def test_delete_nonexistent_returns_zero(self, api, auth_headers):
        r = api.delete(f"{API}/planner/2099-12-31/lunch", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["deleted"] == 0


# ---------- Recipes ----------
class TestRecipes:
    def test_list_recipes(self, api):
        r = api.get(f"{API}/recipes")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_missing_recipe_returns_404(self, api):
        r = api.get(f"{API}/recipes/nonexistent-{uuid.uuid4().hex[:6]}")
        assert r.status_code == 404

    def test_create_without_token_returns_401(self, api):
        r = api.post(f"{API}/recipes", json=_sample_recipe_payload("TEST No Auth"))
        assert r.status_code == 401

    def test_create_as_non_admin_returns_403(self, api, non_admin_headers):
        r = api.post(f"{API}/recipes", json=_sample_recipe_payload("TEST Non Admin"), headers=non_admin_headers)
        assert r.status_code == 403

    def test_admin_create_update_delete_round_trip(self, api, admin_headers):
        name = f"TEST Recipe {uuid.uuid4().hex[:8]}"
        r = api.post(f"{API}/recipes", json=_sample_recipe_payload(name), headers=admin_headers)
        assert r.status_code == 200, r.text
        created = r.json()
        recipe_id = created["id"]
        assert created["name"] == name

        r_get = api.get(f"{API}/recipes/{recipe_id}")
        assert r_get.status_code == 200
        assert r_get.json()["name"] == name

        updated_payload = _sample_recipe_payload(name)
        updated_payload["spice"] = "high"
        r_put = api.put(f"{API}/recipes/{recipe_id}", json=updated_payload, headers=admin_headers)
        assert r_put.status_code == 200
        assert r_put.json()["spice"] == "high"

        r_del_no_auth = api.delete(f"{API}/recipes/{recipe_id}")
        assert r_del_no_auth.status_code == 401

        r_del = api.delete(f"{API}/recipes/{recipe_id}", headers=admin_headers)
        assert r_del.status_code == 200
        assert r_del.json()["deleted"] == 1

        r_get_after = api.get(f"{API}/recipes/{recipe_id}")
        assert r_get_after.status_code == 404

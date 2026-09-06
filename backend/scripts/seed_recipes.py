import json
import os
from pathlib import Path

from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / '.env')
client = MongoClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

with open(Path(__file__).parent / 'recipes_seed.json') as f:
    recipes = json.load(f)

for r in recipes:
    db.recipes.update_one({"id": r["id"]}, {"$set": r}, upsert=True)

print(f"Seeded {len(recipes)} recipes")

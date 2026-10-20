from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings
from backend.database.session import init_db
from backend.api.router import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    init_db()
    yield

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="LazyDesk AI: Local-first AI-powered file organizer for Hacktoberfest Open-Source AI Challenge",
    lifespan=lifespan
)

# CORS configuration restricted to frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.get("/")
def root():
    return {
        "message": "LazyDesk AI Backend API is running.",
        "docs_url": "/docs",
        "health_url": "/api/health",
        "ai_status_url": "/api/ai/status"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)

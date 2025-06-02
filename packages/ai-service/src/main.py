from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
from datetime import datetime
import time

# Create FastAPI app
app = FastAPI(
    title="E-Learning AI Service",
    description="AI services for English learning application",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:19006"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models
class TextAnalysisRequest(BaseModel):
    text: str
    language: str = "en"

class TranslationRequest(BaseModel):
    text: str
    source_lang: str = "vi"
    target_lang: str = "en"

class GrammarCheckRequest(BaseModel):
    text: str

class ContentGenerationRequest(BaseModel):
    topic: str
    level: str = "beginner"
    content_type: str = "lesson"

class TTSRequest(BaseModel):
    text: str
    language: str = "en"
    voice: str = "default"

# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "OK",
        "service": "AI Service",
        "timestamp": datetime.now().isoformat(),
        "uptime": time.time(),
        "version": "1.0.0"
    }

# Text analysis endpoints
@app.post("/analyze/text")
async def analyze_text(request: TextAnalysisRequest):
    return {
        "message": "Text analysis endpoint",
        "text": request.text,
        "language": request.language,
        "status": "Not implemented yet",
        "service": "AI Service"
    }

@app.post("/analyze/difficulty")
async def analyze_difficulty(request: TextAnalysisRequest):
    return {
        "message": "Text difficulty analysis endpoint",
        "text": request.text,
        "status": "Not implemented yet",
        "service": "AI Service"
    }

# Translation endpoints
@app.post("/translate")
async def translate_text(request: TranslationRequest):
    return {
        "message": "Translation endpoint",
        "source_text": request.text,
        "source_lang": request.source_lang,
        "target_lang": request.target_lang,
        "status": "Not implemented yet",
        "service": "AI Service"
    }

# Grammar checking endpoints
@app.post("/grammar/check")
async def check_grammar(request: GrammarCheckRequest):
    return {
        "message": "Grammar check endpoint",
        "text": request.text,
        "status": "Not implemented yet",
        "service": "AI Service"
    }

@app.post("/grammar/correct")
async def correct_grammar(request: GrammarCheckRequest):
    return {
        "message": "Grammar correction endpoint",
        "text": request.text,
        "status": "Not implemented yet",
        "service": "AI Service"
    }

# Content generation endpoints
@app.post("/generate/content")
async def generate_content(request: ContentGenerationRequest):
    return {
        "message": "Content generation endpoint",
        "topic": request.topic,
        "level": request.level,
        "content_type": request.content_type,
        "status": "Not implemented yet",
        "service": "AI Service"
    }

@app.post("/generate/exercises")
async def generate_exercises(request: ContentGenerationRequest):
    return {
        "message": "Exercise generation endpoint",
        "topic": request.topic,
        "level": request.level,
        "status": "Not implemented yet",
        "service": "AI Service"
    }

@app.post("/generate/questions")
async def generate_questions(request: ContentGenerationRequest):
    return {
        "message": "Question generation endpoint",
        "topic": request.topic,
        "level": request.level,
        "status": "Not implemented yet",
        "service": "AI Service"
    }

# Text-to-Speech endpoints
@app.post("/tts/generate")
async def generate_speech(request: TTSRequest):
    return {
        "message": "Text-to-Speech generation endpoint",
        "text": request.text,
        "language": request.language,
        "voice": request.voice,
        "status": "Not implemented yet",
        "service": "AI Service"
    }

# Conversational AI endpoints
@app.post("/chat/conversation")
async def chat_conversation():
    return {
        "message": "Conversational AI endpoint",
        "status": "Not implemented yet",
        "service": "AI Service"
    }

@app.post("/chat/speaking-practice")
async def speaking_practice():
    return {
        "message": "Speaking practice AI endpoint",
        "status": "Not implemented yet",
        "service": "AI Service"
    }

# API documentation
@app.get("/docs-info")
async def get_docs_info():
    return {
        "name": "E-Learning AI Service",
        "version": "1.0.0",
        "description": "AI services for English learning application",
        "features": [
            "Text analysis and difficulty assessment",
            "Translation services",
            "Grammar checking and correction",
            "Content generation (lessons, exercises, questions)",
            "Text-to-Speech synthesis",
            "Conversational AI for practice"
        ],
        "endpoints": {
            "/health": "Health check",
            "/analyze/*": "Text analysis services",
            "/translate": "Translation services",
            "/grammar/*": "Grammar checking services",
            "/generate/*": "Content generation services",
            "/tts/*": "Text-to-Speech services",
            "/chat/*": "Conversational AI services"
        }
    }

# Default route
@app.get("/")
async def root():
    return {
        "message": "E-Learning AI Service",
        "version": "1.0.0",
        "status": "Running",
        "docs": "/docs",
        "health": "/health"
    }

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    ) 
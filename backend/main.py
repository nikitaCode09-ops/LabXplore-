import sqlite3
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import google.generativeai as genai
import shutil
from typing import List
from dotenv import load_dotenv
import bcrypt
import json

load_dotenv()

# ==========================================
# 1. API KEY SETUP & GEMINI INIT
# ==========================================
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise RuntimeError("🚨 SECURITY ERROR: GEMINI_API_KEY is not set in the environment variables!")

# Standard Gemini API configuration
genai.configure(api_key=api_key)
gemini_model = genai.GenerativeModel('gemini-1.5-flash-latest')
# ==========================================
# 2. DATABASE INITIALIZATION FUNCTION
# ==========================================
def init_db():
    conn = sqlite3.connect("labxplore.db")
    cursor = conn.cursor()
    
    # Users Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'patient',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Chat Sessions Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id TEXT PRIMARY KEY,
            user_id INTEGER,
            title TEXT DEFAULT 'New Analysis',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    
    # Messages Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            sender TEXT NOT NULL,
            text TEXT NOT NULL,
            is_file BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
        )
    ''')
    
    conn.commit()
    conn.close()

# ==========================================
# 3. FASTAPI LIFESPAN & APP INIT
# ==========================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()  # Server on hote hi database banega/load hoga
    yield

# App initialization
app = FastAPI(lifespan=lifespan)

# CORS Middleware setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🌟 Structured Response Models
class HighlightItem(BaseModel):
    type: str  # 'critical', 'warning', 'normal', 'info'
    title: str
    description: str

class StructuredReportResponse(BaseModel):
    highlights: List[HighlightItem]
    full_analysis: str

class ChatRequest(BaseModel):
    session_id: str = "default_session"
    history: list
    message: str
    language: str = "English"

class UserRegisterRequest(BaseModel):
    username: str
    password: str
    role: str = "patient"

class UserLoginRequest(BaseModel):
    username: str
    password: str

# ==========================================
# 4. API ROUTES & LOGIC
# ==========================================

@app.post("/register")
async def register_user(data: UserRegisterRequest):
    try:
        conn = sqlite3.connect("labxplore.db")
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM users WHERE username = ?", (data.username,))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail="Username already exists!")

        password_bytes = data.password.encode('utf-8')
        hashed_pwd = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')

        cursor.execute(
            "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
            (data.username, hashed_pwd, data.role)
        )
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"User {data.username} securely registered as {data.role}!"}
    except Exception as e:
        return {"error": str(e)}

@app.post("/login")
async def login_user(data: UserLoginRequest):
    try:
        conn = sqlite3.connect("labxplore.db")
        cursor = conn.cursor()

        cursor.execute("SELECT password, role FROM users WHERE username = ?", (data.username,))
        user_record = cursor.fetchone()
        conn.close()

        if not user_record:
            raise HTTPException(status_code=400, detail="Invalid username or password!")

        db_hashed_password, db_role = user_record

        user_pwd_bytes = data.password.encode('utf-8')
        db_pwd_bytes = db_hashed_password.encode('utf-8')

        if not bcrypt.checkpw(user_pwd_bytes, db_pwd_bytes):
            raise HTTPException(status_code=400, detail="Invalid username or password!")

        return {
            "status": "success",
            "username": data.username,
            "role": db_role
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/chat")
async def chat(data: ChatRequest):
    try:
        conn = sqlite3.connect("labxplore.db")
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM chat_sessions WHERE id = ?", (data.session_id,))
        if not cursor.fetchone():
            cursor.execute("INSERT INTO chat_sessions (id, title) VALUES (?, ?)", (data.session_id, "LabXplore Analysis"))

        cursor.execute("INSERT INTO messages (session_id, sender, text) VALUES (?, ?, ?)",
                       (data.session_id, "user", data.message))
        conn.commit()

        # Medical System Instruction Prompt
        system_instruction = """
        You are LabXplore Neural AI, a strict medical and pathology laboratory assistant.
        CRITICAL GUARDRAIL RULES:
        1. You are ONLY allowed to answer questions related to medicine, human health, healthcare, biological biomarkers, biology, symptoms, and medical laboratory reports.
        2. If the user asks about ANY non-medical topic, you must strictly and politely refuse.
        3. Your refusal response MUST be exactly: "🚨 **Scope Restriction:** I am engineered exclusively for clinical pathology and medical data analysis. I cannot assist with non-medical inquiries."
        """

        language_instruction = f"\n\nCRITICAL: Respond strictly in {data.language} language. If Hinglish, use Latin script but speak in Hindi style. TREND TRACKING: If the user mentions health metrics/biomarkers that were mentioned earlier in chat history, include a small '📈 Trend Update' bullet point comparing the old value with the new value."

        prompt_with_context = f"{system_instruction}\n\nUser Question: {data.message}{language_instruction}"

        # Safe Async Gemini Call
        response = gemini_model.generate_content(prompt_with_context)
        ai_text = response.text

        cursor.execute("INSERT INTO messages (session_id, sender, text) VALUES (?, ?, ?)",
                       (data.session_id, "model", ai_text))
        conn.commit()
        conn.close()

        return {"response": ai_text}
    except Exception as e:
        return {"error": str(e)}

@app.get("/history/{session_id}")
async def get_history(session_id: str):
    try:
        conn = sqlite3.connect("labxplore.db")
        cursor = conn.cursor()
        
        cursor.execute("SELECT sender, text FROM messages WHERE session_id = ? ORDER BY created_at ASC", (session_id,))
        messages = cursor.fetchall()
        conn.close()

        history = [{"sender": msg[0], "text": msg[1]} for msg in messages]
        return {"history": history}
    except Exception as e:
        return {"error": str(e)}
        
@app.post("/upload")
async def upload_report(session_id: str, language: str = "English", file: UploadFile = File(...)):
    try:
        MAX_FILE_SIZE = 10 * 1024 * 1024  
        file_bytes = await file.read()

        if len(file_bytes) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="🚨 Security Alert: File size exceeds the 10MB limit.")

        os.makedirs("temp_uploads", exist_ok=True)
        file_location = f"temp_uploads/{file.filename}"
        
        with open(file_location, "wb") as buffer:
            buffer.write(file_bytes)
            
        conn = sqlite3.connect("labxplore.db")
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM chat_sessions WHERE id = ?", (session_id,))
        if not cursor.fetchone():
            file_title = f"Doc: {file.filename[:20]}"
            cursor.execute("INSERT INTO chat_sessions (id, title) VALUES (?, ?)", (session_id, file_title))
            
        cursor.execute("INSERT INTO messages (session_id, sender, text, is_file) VALUES (?, ?, ?, ?)",
                       (session_id, "user", f"Uploaded Document: {file.filename}", True))
        conn.commit()

        cursor.execute("SELECT text FROM messages WHERE session_id = ? AND sender = 'user'", (session_id,))
        past_user_texts = [row[0] for row in cursor.fetchall()]
        past_context_string = " | ".join(past_user_texts)

        prompt = f"""
        You are LabXplore AI, an expert medical report analyzer and Trend Tracker. 
        Analyze this uploaded laboratory report carefully. 
        Extract key biomarkers, values, reference ranges, and explain what they mean.
        
        📈 BIOMARKER TREND TRACKER RULE:
        Past context: '{past_context_string}'.
        Compare new values with past values. Add a section named "📈 BIOMARKER TREND TRACKER".
        State if biomarkers are going UP, DOWN, or STABLE.
        If no past data, write: "Trend tracking will activate on your next report upload!"
        
        Provide analysis in {language} language. Keep it friendly and comforting.
        """

        # Gemini Image / File Processing Call
        image_part = {"mime_type": file.content_type, "data": file_bytes}
        response = gemini_model.generate_content([prompt, image_part])
        ai_text = response.text

        cursor.execute("INSERT INTO messages (session_id, sender, text) VALUES (?, ?, ?)",
                       (session_id, "model", ai_text))
        conn.commit()
        conn.close()

        if os.path.exists(file_location):
            os.remove(file_location)

        file_title = f"Doc: {file.filename[:20]}"
        return {
            "response": ai_text, 
            "filename": file.filename, 
            "title": file_title
        }

    except Exception as e:
        return {"error": str(e)}

@app.get("/sessions")
async def get_all_sessions():
    try:
        conn = sqlite3.connect("labxplore.db")
        cursor = conn.cursor()
        cursor.execute("SELECT id, title FROM chat_sessions ORDER BY created_at DESC")
        sessions = cursor.fetchall()
        
        sessions_list = []
        for s in sessions:
            cursor.execute("SELECT sender, text FROM messages WHERE session_id = ? ORDER BY created_at ASC", (s[0],))
            messages = [{"sender": msg[0], "text": msg[1]} for msg in cursor.fetchall()]
            sessions_list.append({"id": s[0], "title": s[1], "messages": messages})
            
        conn.close()
        return {"sessions": sessions_list}
    except Exception as e:
        return {"error": str(e)}
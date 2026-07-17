import sqlite3
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from google import genai
from fastapi import File, UploadFile
import shutil
from typing import List
from dotenv import load_dotenv
import bcrypt

load_dotenv()
# ==========================================
# 1. API KEY SETUP
# ==========================================
# Yahan apni actual API key string (quotes ke andar) daaliye
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise RuntimeError("🚨 SECURITY ERROR: GEMINI_API_KEY is not set in the environment variables!")
client = genai.Client(api_key=api_key)

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

# 🌟 NAYA FEATURE: Structured Response ke liye Pydantic Models
class HighlightItem(BaseModel):
    type: str  # 'critical', 'warning', 'normal', 'info'
    title: str
    description: str

class StructuredReportResponse(BaseModel):
    highlights: List[HighlightItem]
    full_analysis: str
# ==========================================
# 4. API ROUTES & LOGIC
# ==========================================
class ChatRequest(BaseModel):
    session_id: str = "default_session"
    history: list
    message: str
    language: str = "English"

# User Registration schema structure
class UserRegisterRequest(BaseModel):
    username: str
    password: str
    role: str = "patient" # default role patient rahega

@app.post("/register")
async def register_user(data: UserRegisterRequest):
    try:
        conn = sqlite3.connect("labxplore.db")
        cursor = conn.cursor()

        # 🔒 CHECK 1: Username duplicate toh nahi hai?
        cursor.execute("SELECT id FROM users WHERE username = ?", (data.username,))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail="Username already exists!")

        # 🔒 SECURITY: Plaintext password ko hash (encrypt) karna compulsory hai
        password_bytes = data.password.encode('utf-8')
        hashed_pwd = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')

        # Encrypted password ko DB mein insert karenge
        cursor.execute(
            "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
            (data.username, hashed_pwd, data.role)
        )
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"User {data.username} securely registered as {data.role}!"}
    except Exception as e:
        return {"error": str(e)}

class UserLoginRequest(BaseModel):
    username: str
    password: str

@app.post("/login")
async def login_user(data: UserLoginRequest):
    try:
        conn = sqlite3.connect("labxplore.db")
        cursor = conn.cursor()

        # Database se user fetch karna password matching ke liye
        cursor.execute("SELECT password, role FROM users WHERE username = ?", (data.username,))
        user_record = cursor.fetchone()
        conn.close()

        if not user_record:
            raise HTTPException(status_code=400, detail="Invalid username or password!")

        db_hashed_password, db_role = user_record

        # 🔒 SECURITY CHECK: Hashed context password verifying
        user_pwd_bytes = data.password.encode('utf-8')
        db_pwd_bytes = db_hashed_password.encode('utf-8')

        if not bcrypt.checkpw(user_pwd_bytes, db_pwd_bytes):
            raise HTTPException(status_code=400, detail="Invalid username or password!")

        # Successfully verifed hone par temporary user identity data return karenge
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
        # 1. Database se connect
        conn = sqlite3.connect("labxplore.db")
        cursor = conn.cursor()

        # 2. Check session
        cursor.execute("SELECT id FROM chat_sessions WHERE id = ?", (data.session_id,))
        if not cursor.fetchone():
            cursor.execute("INSERT INTO chat_sessions (id, title) VALUES (?, ?)", (data.session_id, "LabXplore Analysis"))

        # 3. User message save
        cursor.execute("INSERT INTO messages (session_id, sender, text) VALUES (?, ?, ?)",
                       (data.session_id, "user", data.message))
        conn.commit()

        # 4. Gemini AI Context History Setup
        chat_context = []
        for msg in data.history:
            role = "user" if msg["sender"] == "user" else "model"
            if not chat_context and role == "model":
                continue 
            chat_context.append({"role": role, "parts": [{"text": msg["text"]}]})

        # ✅ FIX: Ekdum clean trend tracker instructions bina kisi variable mismatch ke
        language_instruction = f"\n\nCRITICAL: Respond strictly in {data.language} language. If Hinglish, use Latin script (English letters) but speak in Hindi style. TREND TRACKING: Scan the chat history array provided. If the user mentions any health metrics/biomarkers now that were mentioned earlier, include a small '📈 Trend Update' bullet point comparing the old value with the new value."
        chat_context.append({"role": "user", "parts": [{"text": data.message + language_instruction}]})

        # Gemini AI Call
        response = await client.aio.models.generate_content(
            model='gemini-2.5-flash',
            contents=chat_context,
            config={
                "system_instruction": """
                You are LabXplore Neural AI, a strict medical and pathology laboratory assistant.

                CRITICAL GUARDRAIL RULES:
                1. You are ONLY allowed to answer questions related to medicine, human health, healthcare, biological biomarkers, biology, symptoms, and medical laboratory reports.
                2. If the user asks about ANY non-medical topic (for example: coding, food recipes, history, general knowledge, movies, sports, or general talk), you must strictly and politely refuse.
                3. Your refusal response MUST be exactly: "🚨 **Scope Restriction:** I am engineered exclusively for clinical pathology and medical data analysis. I cannot assist with non-medical inquiries."
                4. Do not break character or violate these guardrails under any circumstances.
                """
            }
        )
        ai_text = response.text

        # 5. AI Reply save
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
        
        # Database se history messages fetch karna
        cursor.execute("SELECT sender, text FROM messages WHERE session_id = ? ORDER BY created_at ASC", (session_id,))
        messages = cursor.fetchall()
        conn.close()

        # React formatting format
        history = [{"sender": msg[0], "text": msg[1]} for msg in messages]
        return {"history": history}
    except Exception as e:
        return {"error": str(e)}
        
@app.post("/upload")
async def upload_report(session_id: str, language: str = "English", file: UploadFile = File(...)):
    try:
        # 🔒 SECURITY: Restrict file size to 10MB max (10 * 1024 * 1024 bytes)
        MAX_FILE_SIZE = 10 * 1024 * 1024  
        file_size = len(await file.read())
        await file.seek(0)  # Reset file pointer read karne ke baad

        if file_size > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="🚨 Security Alert: File size exceeds the 10MB limit.")
        # 1. Ek temporary folder banayein agar nahi hai toh
        os.makedirs("temp_uploads", exist_ok=True)
        file_location = f"temp_uploads/{file.filename}"
        
        # 2. File ko locally save karein
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 3. Database mein entry save karein ki file upload hui hai
        conn = sqlite3.connect("labxplore.db")
        cursor = conn.cursor()
        
        # Check session
        cursor.execute("SELECT id FROM chat_sessions WHERE id = ?", (session_id,))
        if not cursor.fetchone():
            # Agar user pehle file bhejta hai, toh pdf/image ke naam ko hi chat ka title bana do!
            file_title = f"Doc: {file.filename[:20]}"
            cursor.execute("INSERT INTO chat_sessions (id, title) VALUES (?, ?)", (session_id, file_title))
            
        # Message table mein save karein
        cursor.execute("INSERT INTO messages (session_id, sender, text, is_file) VALUES (?, ?, ?, ?)",
                       (session_id, "user", f"Uploaded Document: {file.filename}", True))
        conn.commit()

        # 4. Gemini AI ko file bhejein analysis ke liye
        # File ko bytes mein read karna padta hai Gemini client ke liye
        with open(file_location, "rb") as f:
            file_bytes = f.read()

        # 🌟 NAYA: Pehle database se purane saare medical messages uthayein taaki AI trend track kar sake
        cursor.execute("SELECT text FROM messages WHERE session_id = ? AND sender = 'user'", (session_id,))
        past_user_texts = [row[0] for row in cursor.fetchall()]
        past_context_string = " | ".join(past_user_texts)

        prompt = f"""
        You are LabXplore AI, an expert medical report analyzer and Trend Tracker. 
        Analyze this uploaded laboratory report image/document carefully. 
        Extract the key biomarkers, their values, reference ranges, and explain what they mean.
        
        📈 BIOMARKER TREND TRACKER RULE:
        Here is the user's past chat/report context: '{past_context_string}'.
        Compare the new values with any past values mentioned in the context. 
        Add a dedicated section named "📈 BIOMARKER TREND TRACKER" in your response. 
        In this section, clearly state if a biomarker (like Hemoglobin, Sugar, Creatinine) is going UP, DOWN, or STABLE compared to before (e.g., "Aapka Hemoglobin pehle 10.5 tha, ab 11.2 ho gaya hai - Yeh ek accha improvement hai!").
        If there is no past data available for comparison, simply write: "Trend tracking will activate on your next report upload!"
        
        CRITICAL: Provide the entire analysis, headings, and details strictly in {language} language. 
        If language is Hinglish, use English text letters but talk in conversational Hindi style.
        Highlight if anything is high, low, or abnormal. Keep it very friendly and comforting.
        """

        # 🌟 1. Gemini AI call with JSON Structured Output
        response = await client.aio.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                {"inline_data": {"mime_type": file.content_type, "data": file_bytes}},
                prompt + "\n\nIMPORTANT: Extract 3 to 4 key interactive highlights from this report according to the JSON schema provided."
            ],
            config={
                "response_mime_type": "application/json", 
                "response_schema": StructuredReportResponse,
                "system_instruction": """
                You are LabXplore Neural AI, a strict medical report data analyzer.
                1. Analyze ONLY the medical records, lab biomarkers, and clinical metrics inside the uploaded file.
                2. If the file is not a medical report or if the user asks any off-topic question about the file, you must strictly return the full_analysis string as: "🚨 **Scope Restriction:** I am engineered exclusively for clinical pathology and medical data analysis."
                """
            }
        )
        
        # 🌟 2. Output ko string se JSON object mein parse karna
        import json
        json_data = json.loads(response.text)
        ai_text = json_data.get("full_analysis", "")

        # 🌟 3. Database mein Raw JSON text save kar rahe hain taaki Frontend cards bana sake
        cursor.execute("INSERT INTO messages (session_id, sender, text) VALUES (?, ?, ?)",
                       (session_id, "model", response.text))
        conn.commit()
        conn.close()

        # 🌟 4. Temporary file ko delete kar dein safety ke liye
        if os.path.exists(file_location):
            os.remove(file_location)

        # 🌟 5. Saari detailed cheezein frontend ko return karna
        file_title = f"Doc: {file.filename[:20]}"
        return {
            "response": ai_text, 
            "highlights": json_data.get("highlights", []),
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
        # Saari chat sessions ko unke banne ke time ke hisab se order mein nikalna
        cursor.execute("SELECT id, title FROM chat_sessions ORDER BY created_at DESC")
        sessions = cursor.fetchall()
        
        # Har session ke andar ke messages bhi load karna taaki frontend par length zero na ho
        sessions_list = []
        for s in sessions:
            cursor.execute("SELECT sender, text FROM messages WHERE session_id = ? ORDER BY created_at ASC", (s[0],))
            messages = [{"sender": msg[0], "text": msg[1]} for msg in cursor.fetchall()]
            sessions_list.append({"id": s[0], "title": s[1], "messages": messages})
            
        conn.close()
        return {"sessions": sessions_list}
    except Exception as e:
        return {"error": str(e)}
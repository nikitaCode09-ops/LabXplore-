import sqlite3
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from google import genai
from typing import List
from dotenv import load_dotenv
import bcrypt

load_dotenv()

# ==========================================
# 1. API KEY SETUP & GEMINI INIT
# ==========================================

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise RuntimeError(
        "SECURITY ERROR: GEMINI_API_KEY is not set in the environment variables!"
    )

# New Gemini SDK
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
    init_db()
    yield


app = FastAPI(lifespan=lifespan)


# ==========================================
# CORS Middleware
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ==========================================
# 4. REQUEST / RESPONSE MODELS
# ==========================================

class HighlightItem(BaseModel):
    type: str
    title: str
    description: str


class StructuredReportResponse(BaseModel):
    highlights: List[HighlightItem]
    full_analysis: str


class ChatRequest(BaseModel):
    session_id: str = "default_session"
    history: list = []
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
# 5. ROOT API
# ==========================================

@app.get("/")
async def root():
    return {
        "message": "LabXplore API is active and running!"
    }


# ==========================================
# 6. REGISTER
# ==========================================

@app.post("/register")
async def register_user(data: UserRegisterRequest):
    try:
        conn = sqlite3.connect("labxplore.db")
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM users WHERE username = ?",
            (data.username,)
        )

        if cursor.fetchone():
            conn.close()
            raise HTTPException(
                status_code=400,
                detail="Username already exists!"
            )

        password_bytes = data.password.encode("utf-8")

        hashed_pwd = bcrypt.hashpw(
            password_bytes,
            bcrypt.gensalt()
        ).decode("utf-8")

        cursor.execute(
            "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
            (
                data.username,
                hashed_pwd,
                data.role
            )
        )

        conn.commit()
        conn.close()

        return {
            "status": "success",
            "message": f"User {data.username} securely registered as {data.role}!"
        }

    except HTTPException as http_ex:
        raise http_ex

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ==========================================
# 7. LOGIN
# ==========================================

@app.post("/login")
async def login_user(data: UserLoginRequest):
    try:
        conn = sqlite3.connect("labxplore.db")
        cursor = conn.cursor()

        cursor.execute(
            "SELECT password, role FROM users WHERE username = ?",
            (data.username,)
        )

        user_record = cursor.fetchone()
        conn.close()

        if not user_record:
            raise HTTPException(
                status_code=400,
                detail="Invalid username or password!"
            )

        db_hashed_password, db_role = user_record

        user_pwd_bytes = data.password.encode("utf-8")
        db_pwd_bytes = db_hashed_password.encode("utf-8")

        if not bcrypt.checkpw(
            user_pwd_bytes,
            db_pwd_bytes
        ):
            raise HTTPException(
                status_code=400,
                detail="Invalid username or password!"
            )

        return {
            "status": "success",
            "username": data.username,
            "role": db_role
        }

    except HTTPException as http_ex:
        raise http_ex

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ==========================================
# 8. CHAT WITH GEMINI 2.5 PRO
# ==========================================

@app.post("/chat")
async def chat(data: ChatRequest):
    try:

        # --------------------------------------
        # Database connection
        # --------------------------------------

        conn = sqlite3.connect("labxplore.db")
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM chat_sessions WHERE id = ?",
            (data.session_id,)
        )

        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO chat_sessions (id, title) VALUES (?, ?)",
                (
                    data.session_id,
                    "LabXplore Analysis"
                )
            )

        # Save user message
        cursor.execute(
            """
            INSERT INTO messages
            (session_id, sender, text)
            VALUES (?, ?, ?)
            """,
            (
                data.session_id,
                "user",
                data.message
            )
        )

        conn.commit()

        # --------------------------------------
        # Medical System Guardrail Prompt
        # --------------------------------------

        system_instruction = """
You are LabXplore Neural AI, a strict medical and pathology laboratory assistant.

CRITICAL GUARDRAIL RULES:

1. You are ONLY allowed to answer questions related to:
   - medicine
   - human health
   - healthcare
   - biological biomarkers
   - biology
   - symptoms
   - medical laboratory reports
   - pathology
   - diagnostic laboratory data

2. If the user asks about ANY non-medical topic,
   you must strictly and politely refuse.

3. Your refusal response MUST be exactly:

"Scope Restriction: I am engineered exclusively for clinical pathology and medical data analysis. I cannot assist with non-medical inquiries."

4. Never invent laboratory values or medical facts.

5. Explain laboratory results clearly and carefully.

6. Do not claim to replace a qualified doctor.

7. If a result appears abnormal, explain that it may require professional medical evaluation.
"""

        # --------------------------------------
        # Language instruction
        # --------------------------------------

        language_instruction = f"""

CRITICAL:
Respond strictly in {data.language} language.

If Hinglish is selected:
Use Latin script but speak in natural Hindi style.

TREND TRACKING:
If the user mentions health metrics or biomarkers
that were mentioned earlier in the chat history,
include a small "Trend Update" bullet point comparing
the old value with the new value.
"""

        # --------------------------------------
        # Build conversation history
        # --------------------------------------

        history_text = ""

        if data.history:

            for item in data.history:

                sender = item.get("sender", "")
                text = item.get("text", "")

                if not text:
                    continue

                if sender == "model" or sender == "ai":
                    history_text += f"\nAI: {text}\n"

                else:
                    history_text += f"\nUser: {text}\n"

        # --------------------------------------
        # Final prompt
        # --------------------------------------

        prompt_with_context = f"""
{system_instruction}

CONVERSATION HISTORY:
{history_text}

CURRENT USER QUESTION:
{data.message}

{language_instruction}

Provide a helpful medical/pathology response.
"""

        # --------------------------------------
        # Gemini 2.5 Pro API call
        # --------------------------------------

        response = client.models.generate_content(
            model="gemini-2.5-pro",
            contents=prompt_with_context
        )

        # --------------------------------------
        # Get Gemini response
        # --------------------------------------

        ai_text = response.text

        if not ai_text:
            raise Exception(
                "Gemini returned an empty response."
            )

        # --------------------------------------
        # Save AI response
        # --------------------------------------

        cursor.execute(
            """
            INSERT INTO messages
            (session_id, sender, text)
            VALUES (?, ?, ?)
            """,
            (
                data.session_id,
                "model",
                ai_text
            )
        )

        conn.commit()
        conn.close()

        return {
            "response": ai_text
        }

    except HTTPException as http_ex:
        raise http_ex

    except Exception as e:

        print("GEMINI CHAT ERROR:", str(e))

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ==========================================
# 9. CHAT HISTORY
# ==========================================

@app.get("/history/{session_id}")
async def get_history(session_id: str):

    try:

        conn = sqlite3.connect("labxplore.db")
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT sender, text
            FROM messages
            WHERE session_id = ?
            ORDER BY created_at ASC
            """,
            (session_id,)
        )

        messages = cursor.fetchall()

        conn.close()

        history = [
            {
                "sender": msg[0],
                "text": msg[1]
            }
            for msg in messages
        ]

        return {
            "history": history
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ==========================================
# 10. UPLOAD MEDICAL REPORT
# ==========================================

@app.post("/upload")
async def upload_report(
    session_id: str,
    language: str = "English",
    file: UploadFile = File(...)
):

    file_location = None

    try:

        # --------------------------------------
        # File size limit
        # --------------------------------------

        MAX_FILE_SIZE = 10 * 1024 * 1024

        file_bytes = await file.read()

        if len(file_bytes) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail="Security Alert: File size exceeds the 10MB limit."
            )

        # --------------------------------------
        # Temporary upload folder
        # --------------------------------------

        os.makedirs(
            "temp_uploads",
            exist_ok=True
        )

        file_location = (
            f"temp_uploads/{file.filename}"
        )

        with open(
            file_location,
            "wb"
        ) as buffer:

            buffer.write(file_bytes)

        # --------------------------------------
        # Database
        # --------------------------------------

        conn = sqlite3.connect("labxplore.db")
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM chat_sessions WHERE id = ?",
            (session_id,)
        )

        if not cursor.fetchone():

            file_title = (
                f"Doc: {file.filename[:20]}"
            )

            cursor.execute(
                """
                INSERT INTO chat_sessions
                (id, title)
                VALUES (?, ?)
                """,
                (
                    session_id,
                    file_title
                )
            )

        # Save uploaded document message
        cursor.execute(
            """
            INSERT INTO messages
            (session_id, sender, text, is_file)
            VALUES (?, ?, ?, ?)
            """,
            (
                session_id,
                "user",
                f"Uploaded Document: {file.filename}",
                True
            )
        )

        conn.commit()

        # --------------------------------------
        # Previous user context
        # --------------------------------------

        cursor.execute(
            """
            SELECT text
            FROM messages
            WHERE session_id = ?
            AND sender = 'user'
            """,
            (session_id,)
        )

        past_user_texts = [
            row[0]
            for row in cursor.fetchall()
        ]

        past_context_string = " | ".join(
            past_user_texts
        )

        # --------------------------------------
        # Medical report prompt
        # --------------------------------------

        prompt = f"""
You are LabXplore AI,
an expert medical report analyzer and Trend Tracker.

Analyze this uploaded laboratory report carefully.

Extract:

- Patient information if available
- Test names
- Biomarkers
- Values
- Reference ranges
- Units
- Abnormal results
- Possible medical significance

Explain what the laboratory values mean
in simple and understandable language.

BIOMARKER TREND TRACKER RULE:

Past context:
'{past_context_string}'

Compare new values with previous values
when previous values are available.

Add a section named:

BIOMARKER TREND TRACKER

State whether biomarkers are:

UP
DOWN
STABLE

If there is no previous data, write:

"Trend tracking will activate on your next report upload!"

IMPORTANT:

Do not invent values.

If a value or reference range cannot be read,
clearly say that it could not be determined.

Provide analysis in {language} language.

Keep the explanation friendly,
clear and comforting.

This is an AI-assisted interpretation
and should not replace professional medical advice.
"""

        # --------------------------------------
        # Gemini inline file data
        # --------------------------------------

        image_part = {
            "inline_data": {
                "mime_type": file.content_type,
                "data": file_bytes
            }
        }

        # --------------------------------------
        # Gemini 2.5 Pro Vision/File Analysis
        # --------------------------------------

        response = client.models.generate_content(
            model="gemini-2.5-pro",
            contents=[
                prompt,
                image_part
            ]
        )

        ai_text = response.text

        if not ai_text:
            raise Exception(
                "Gemini returned an empty report analysis."
            )

        # --------------------------------------
        # Save AI analysis
        # --------------------------------------

        cursor.execute(
            """
            INSERT INTO messages
            (session_id, sender, text)
            VALUES (?, ?, ?)
            """,
            (
                session_id,
                "model",
                ai_text
            )
        )

        conn.commit()
        conn.close()

        # --------------------------------------
        # Delete temporary file
        # --------------------------------------

        if file_location and os.path.exists(
            file_location
        ):
            os.remove(file_location)

        file_title = (
            f"Doc: {file.filename[:20]}"
        )

        return {
            "response": ai_text,
            "filename": file.filename,
            "title": file_title
        }

    except HTTPException as http_ex:
        raise http_ex

    except Exception as e:

        print("GEMINI UPLOAD ERROR:", str(e))

        if file_location and os.path.exists(
            file_location
        ):
            os.remove(file_location)

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ==========================================
# 11. ALL CHAT SESSIONS
# ==========================================

@app.get("/sessions")
async def get_all_sessions():

    try:

        conn = sqlite3.connect("labxplore.db")
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT id, title
            FROM chat_sessions
            ORDER BY created_at DESC
            """
        )

        sessions = cursor.fetchall()

        sessions_list = []

        for s in sessions:

            cursor.execute(
                """
                SELECT sender, text
                FROM messages
                WHERE session_id = ?
                ORDER BY created_at ASC
                """,
                (s[0],)
            )

            messages = [
                {
                    "sender": msg[0],
                    "text": msg[1]
                }
                for msg in cursor.fetchall()
            ]

            sessions_list.append(
                {
                    "id": s[0],
                    "title": s[1],
                    "messages": messages
                }
            )

        conn.close()

        return {
            "sessions": sessions_list
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

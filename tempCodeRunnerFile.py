# App.py — File-backed user storage version
# Based on original app (sqlite) uploaded by user. See original for reference. :contentReference[oaicite:1]{index=1}

from flask import Flask, request, jsonify
from flask_cors import CORS
from urllib.parse import urlparse
import re
import os
import json
import hashlib
from pathlib import Path
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
from collections import defaultdict
import threading
import time

# ---------- Config ----------
API_HOST = "127.0.0.1"
API_PORT = 5000
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "devtoken")  # set this in env for safety

# Storage mode: file-only for this version
STORAGE_MODE = "file"
USER_FILES_DIR = Path(os.environ.get("USER_FILES_DIR", "./user_files"))

# Ensure user files dir exists
USER_FILES_DIR.mkdir(parents=True, exist_ok=True)
try:
    # Prefer restrictive permissions for folder (owner only)
    USER_FILES_DIR.chmod(0o700)
except Exception:
    # may fail on Windows or restricted containers; it's fine
    pass

app = Flask(__name__)
CORS(app)

# ---------- Rate limit & lockout config ----------
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
MAX_REQUESTS_PER_MINUTE = 30
RATE_LIMIT_WINDOW = 60  # seconds

# In-memory rate limiter store
_rate_limit_store = defaultdict(list)
_rate_limit_lock = threading.Lock()

def is_rate_limited(ip):
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW
    with _rate_limit_lock:
        times = _rate_limit_store[ip]
        # remove timestamps older than window_start
        while times and times[0] < window_start:
            times.pop(0)
        if len(times) >= MAX_REQUESTS_PER_MINUTE:
            retry_after = int(RATE_LIMIT_WINDOW - (now - times[0])) + 1
            return True, retry_after
        times.append(now)
        return False, 0

def _cleanup_rate_limit_store():
    while True:
        with _rate_limit_lock:
            now = time.time()
            cutoff = now - (RATE_LIMIT_WINDOW * 2)
            keys_to_delete = []
            for ip, times in list(_rate_limit_store.items()):
                _rate_limit_store[ip] = [t for t in times if t >= cutoff]
                if not _rate_limit_store[ip]:
                    keys_to_delete.append(ip)
            for ip in keys_to_delete:
                del _rate_limit_store[ip]
        time.sleep(RATE_LIMIT_WINDOW)

cleanup_thread = threading.Thread(target=_cleanup_rate_limit_store, daemon=True)
cleanup_thread.start()

# ---------- Phishing analyzer (unchanged logic) ----------
PHISHING_KEYWORDS = [
    "urgent","immediately","important","alert","deadline",
    "suspended","terminated","locked","warning",
    "verify","verify now","update","update now",
    "confirm","confirm now","authenticate","reset",
    "login","password","account","security",
    "access","unauthorized","identity",
    "bank","payment","transaction","invoice","refund","billing",
    "winner","gift","free","reward","cashback","prize",
    "package","shipment","otp","tracking","delivery hold",
    "click here","click the link","verify your account",
    "security update","your account has been suspended",
]

@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        data = request.json or {}
        email = data.get("email", "")
        url = data.get("url", "")

        findings = []
        score = 0

        if url:
            findings_url, score_url = analyze_url(url)
            findings.extend(findings_url)
            score += score_url

        if email:
            findings_email, score_email = analyze_email(email)
            findings.extend(findings_email)
            score += score_email

        final_risk = calculate_risk(score)

        return jsonify({
            "score": score,
            "risk": final_risk,
            "findings": findings
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

def analyze_url(url):
    findings = []
    score = 0
    try:
        parsed = urlparse(url)
    except:
        findings.append("Invalid URL format.")
        return findings, 20

    if parsed.scheme == "http":
        findings.append("URL uses insecure HTTP.")
        score += 20

    if re.match(r"^\d+\.\d+\.\d+\.\d+$", parsed.hostname or ""):
        findings.append("URL uses an IP address instead of domain.")
        score += 25

    if len(url) > 120:
        findings.append("URL is unusually long.")
        score += 10

    if not findings:
        findings.append("URL appears safe.")

    return findings, score

def analyze_email(email):
    findings = []
    score = 0
    email_lower = email.lower()

    for keyword in PHISHING_KEYWORDS:
        if keyword in email_lower:
            findings.append(f"Phishing keyword detected: '{keyword}'")
            score += 5

    sensitive = ["password", "bank", "credit card", "otp", "verify"]
    if any(s in email_lower for s in sensitive):
        findings.append("Email requests sensitive information.")
        score += 30

    if not findings:
        findings.append("Email content appears normal.")

    return findings, score

def calculate_risk(score):
    if score <= 20:
        return "LOW"
    elif score <= 50:
        return "MEDIUM"
    else:
        return "HIGH"

# ---------- Helpers for lock parsing ----------
def parse_locked_until(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except Exception:
        return None

# ---------- File-backed storage helpers ----------
def _user_filename_for_email(email: str) -> Path:
    """Map email to a safe filename using SHA256(email)."""
    h = hashlib.sha256(email.encode("utf-8")).hexdigest()
    return USER_FILES_DIR / f"{h}.json"

def _read_user_file(path: Path):
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except Exception:
        return None

def _atomic_write_json(path: Path, data: dict):
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tmp.replace(path)
    try:
        path.chmod(0o600)
    except Exception:
        pass

def _get_all_user_files():
    return list(USER_FILES_DIR.glob("*.json"))

def _get_next_user_id():
    max_id = 0
    for p in _get_all_user_files():
        u = _read_user_file(p)
        if u and "id" in u:
            try:
                max_id = max(max_id, int(u["id"]))
            except Exception:
                pass
    return max_id + 1

def file_get_user_by_email(email: str):
    path = _user_filename_for_email(email)
    return _read_user_file(path)

def file_create_user(email: str, password_hash: str):
    path = _user_filename_for_email(email)
    if path.exists():
        raise FileExistsError("Email already registered")
    uid = _get_next_user_id()
    now = datetime.utcnow().isoformat()
    user = {
        "id": uid,
        "email": email,
        "password_hash": password_hash,
        "failed_attempts": 0,
        "locked_until": None,
        "created_at": now
    }
    _atomic_write_json(path, user)
    return user

def file_update_user(email: str, update_dict: dict):
    path = _user_filename_for_email(email)
    user = _read_user_file(path)
    if not user:
        return None
    user.update(update_dict)
    _atomic_write_json(path, user)
    return user

def file_list_users():
    users = []
    for p in sorted(_get_all_user_files(), key=lambda x: x.name):
        u = _read_user_file(p)
        if u:
            users.append(u)
    return users

# ---------- Auth routes (register/login) using file storage ----------
@app.route("/register", methods=["POST"])
def register():
    ip = request.remote_addr or "unknown"
    limited, retry_after = is_rate_limited(ip)
    if limited:
        return jsonify({"success": False, "message": f"Too many requests. Try again in {retry_after} seconds."}), 429

    try:
        data = request.json or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        if not email or not password:
            return jsonify({"success": False, "message": "Email and password are required."}), 400

        if "@" not in email or "." not in email:
            return jsonify({"success": False, "message": "Invalid email format."}), 400

        password_hash = generate_password_hash(password)

        # file-based storage
        if file_get_user_by_email(email):
            return jsonify({"success": False, "message": "Email already registered."}), 409
        try:
            file_create_user(email, password_hash)
        except FileExistsError:
            return jsonify({"success": False, "message": "Email already registered."}), 409

        return jsonify({"success": True, "message": "Registration successful."})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/login", methods=["POST"])
def login():
    ip = request.remote_addr or "unknown"
    limited, retry_after = is_rate_limited(ip)
    if limited:
        return jsonify({"success": False, "message": f"Too many requests. Try again in {retry_after} seconds."}), 429

    try:
        data = request.json or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        if not email or not password:
            return jsonify({"success": False, "message": "Email and password are required."}), 400

        user = file_get_user_by_email(email)
        if not user:
            return jsonify({"success": False, "message": "Invalid credentials."}), 401

        locked_until_val = user.get("locked_until")
        locked_until = parse_locked_until(locked_until_val)
        now = datetime.utcnow()

        if locked_until and locked_until > now:
            delta = locked_until - now
            minutes_left = int(delta.total_seconds() // 60) + 1
            return jsonify({
                "success": False,
                "message": f"Account locked due to multiple failed attempts. Try again in {minutes_left} minute(s).",
                "locked": True,
                "locked_until": locked_until.isoformat()
            }), 403

        stored_hash = user.get("password_hash")
        if not check_password_hash(stored_hash, password):
            failed = (user.get("failed_attempts") or 0) + 1
            update_vals = {"failed_attempts": failed, "locked_until": None}

            if failed >= MAX_FAILED_ATTEMPTS:
                lock_until_dt = now + timedelta(minutes=LOCKOUT_MINUTES)
                update_vals["locked_until"] = lock_until_dt.isoformat()

            file_update_user(email, update_vals)

            if update_vals.get("locked_until"):
                return jsonify({
                    "success": False,
                    "message": f"Account locked due to {failed} failed attempts. Try again after {LOCKOUT_MINUTES} minute(s).",
                    "locked": True,
                    "locked_until": update_vals["locked_until"]
                }), 403

            return jsonify({"success": False, "message": "Invalid credentials."}), 401

        # success: reset failed attempts
        file_update_user(email, {"failed_attempts": 0, "locked_until": None})
        return jsonify({"success": True, "message": "Login successful.", "user": {"id": user["id"], "email": user["email"]}})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# ---------- Admin route to list users (protected by ADMIN_TOKEN) ----------
@app.route("/users", methods=["GET"])
def get_users():
    token = request.headers.get("X-Admin-Token", "")
    if token != ADMIN_TOKEN:
        return jsonify({"error": "Forbidden"}), 403

    try:
        users_list = file_list_users()
        sanitized = []
        for u in users_list:
            sanitized.append({
                "id": u.get("id"),
                "email": u.get("email"),
                "created_at": u.get("created_at"),
                "failed_attempts": u.get("failed_attempts"),
                "locked_until": u.get("locked_until")
            })
        return jsonify({"users": sanitized})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------- Run ----------
if __name__ == "__main__":
    print(f"Admin token (server-side) = {ADMIN_TOKEN} (set ADMIN_TOKEN env var to override)")
    print(f"User files directory = {USER_FILES_DIR.resolve()}")
    app.run(host=API_HOST, port=API_PORT, debug=True)

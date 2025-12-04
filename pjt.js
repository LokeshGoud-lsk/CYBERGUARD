// pjt.js - single input box (inputBox) for both email text & URL
// Keep pjt.html and pjt.css unchanged. Backend still expects { email, url } on /analyze
const API_BASE = "http://127.0.0.1:5000";

/* ---------- Small helper ---------- */
function showMsg(el, msg, success = false) {
  if (!el) return;
  el.style.color = success ? "#80ff80" : "#ff8080";
  el.innerText = msg;
}

/* ---------- AUTH / NAV (kept behavior from your original) ---------- */
const landing = document.getElementById("landing");
const appContent = document.getElementById("appContent");

const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const landingLoginForm = document.getElementById("landingLoginForm");
const landingRegisterForm = document.getElementById("landingRegisterForm");
const landingLoginMsg = document.getElementById("landingLoginMsg");
const landingRegisterMsg = document.getElementById("landingRegisterMsg");

tabLogin && tabLogin.addEventListener("click", () => {
  tabLogin.classList.add("active");
  tabRegister.classList.remove("active");
  landingLoginForm.classList.remove("hidden");
  landingRegisterForm.classList.add("hidden");
  landingLoginMsg.innerText = "";
  landingRegisterMsg.innerText = "";
});

tabRegister && tabRegister.addEventListener("click", () => {
  tabRegister.classList.add("active");
  tabLogin.classList.remove("active");
  landingRegisterForm.classList.remove("hidden");
  landingLoginForm.classList.add("hidden");
  landingLoginMsg.innerText = "";
  landingRegisterMsg.innerText = "";
});

/* Login */
landingLoginForm && landingLoginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("landingLoginEmail").value.trim();
  const password = document.getElementById("landingLoginPassword").value.trim();
  showMsg(landingLoginMsg, "Logging in...");

  if (!email || !password) { showMsg(landingLoginMsg, "Email and password required."); return; }
  try {
    const res = await fetch(API_BASE + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (res.status === 429) { showMsg(landingLoginMsg, data.message || "Too many requests."); return; }
    if (res.status === 403 && data.locked) { showMsg(landingLoginMsg, data.message || "Account locked."); return; }

    if (data.success) {
      showMsg(landingLoginMsg, "Login successful!", true);
      localStorage.setItem("user", JSON.stringify(data.user));
      openAppAfterAuth();
    } else {
      showMsg(landingLoginMsg, data.message || "Invalid credentials.");
    }
  } catch (err) {
    console.error("Login fetch error:", err);
    showMsg(landingLoginMsg, "Server error during login.");
  }
});

/* Register */
landingRegisterForm && landingRegisterForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("landingRegisterEmail").value.trim();
  const password = document.getElementById("landingRegisterPassword").value.trim();
  const password2 = document.getElementById("landingRegisterPassword2").value.trim();
  showMsg(landingRegisterMsg, "Registering...");

  if (!email || !password || !password2) { showMsg(landingRegisterMsg, "All fields are required."); return; }
  if (password !== password2) { showMsg(landingRegisterMsg, "Passwords do not match."); return; }
  if (password.length < 6) { showMsg(landingRegisterMsg, "Password too short (min 6)."); return; }

  try {
    const res = await fetch(API_BASE + "/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (res.status === 429) { showMsg(landingRegisterMsg, data.message || "Too many requests."); return; }

    if (data.success) {
      showMsg(landingRegisterMsg, "Registered successfully! Logging in...", true);
      // auto-login after registration
      setTimeout(async () => {
        try {
          const loginRes = await fetch(API_BASE + "/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
          });
          const loginData = await loginRes.json();
          if (loginData.success) {
            localStorage.setItem("user", JSON.stringify(loginData.user));
            openAppAfterAuth();
          } else {
            showMsg(landingRegisterMsg, "Registered but auto-login failed: " + (loginData.message || ""));
          }
        } catch (err) {
          console.error("Auto-login error:", err);
          showMsg(landingRegisterMsg, "Auto-login failed (server error).");
        }
      }, 700);
    } else {
      showMsg(landingRegisterMsg, data.message || "Registration failed.");
    }
  } catch (err) {
    console.error("Register fetch error:", err);
    showMsg(landingRegisterMsg, "Server error during registration.");
  }
});

/* Nav & logout */
function updateNavForAuth() {
  const navUserArea = document.getElementById("navUserArea");
  const userEmailSpan = document.getElementById("userEmail");
  const loginNavLink = document.getElementById("loginBtnNav");
  const registerNavLink = document.getElementById("RegisterBtnNav");
  const userStr = localStorage.getItem("user");
  if (userStr) {
    const user = JSON.parse(userStr);
    if (userEmailSpan) userEmailSpan.innerText = user.email || "User";
    if (navUserArea) navUserArea.style.display = "flex";
    if (loginNavLink) loginNavLink.style.display = "none";
    if (registerNavLink) registerNavLink.style.display = "none";
  } else {
    if (navUserArea) navUserArea.style.display = "none";
    if (loginNavLink) loginNavLink.style.display = "inline-block";
    if (registerNavLink) registerNavLink.style.display = "inline-block";
  }
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("user");
    if (landing) landing.style.display = "flex";
    if (appContent) appContent.style.visibility = "hidden";
    updateNavForAuth();
    const l1 = document.getElementById("landingLoginMsg"), l2 = document.getElementById("landingRegisterMsg");
    if (l1) l1.innerText = ""; if (l2) l2.innerText = "";
    window.scrollTo(0,0);
  });
}

/* Open app / check login */
function openAppAfterAuth() {
  if (landing) landing.style.display = "none";
  if (appContent) appContent.style.visibility = "visible";
  updateNavForAuth();
}
function checkExistingLogin() {
  const user = localStorage.getItem("user");
  if (user) openAppAfterAuth();
  else { if (landing) landing.style.display = "flex"; if (appContent) appContent.style.visibility = "hidden"; }
}

/* Hamburger & fade-in */
const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("navLinks");
if (hamburger && navLinks) hamburger.addEventListener("click", () => navLinks.classList.toggle("active"));

const faders = document.querySelectorAll(".fade-in");
const appearOptions = { threshold: 0.2, rootMargin: "0px 0px -50px 0px" };
const appearOnScroll = new IntersectionObserver((entries) => {
  entries.forEach(entry => { if (!entry.isIntersecting) return; entry.target.classList.add("show"); appearOnScroll.unobserve(entry.target); });
}, appearOptions);
faders.forEach(f => appearOnScroll.observe(f));

/* ---------- SCAN: single box behavior ---------- */
const modal = document.getElementById("modal");
const scanBtn = document.getElementById("scanBtn");
const closeBtn = document.querySelector(".closeBtn");
const resultText = document.getElementById("resultText");

const inputBox = document.getElementById("inputBox");   // NEW single box
const detectedUrlDiv = document.getElementById("detectedUrl");
const detectedUrlListDiv = document.getElementById("detectedUrlList");
const clearBtn = document.getElementById("clearBtn");

// Regex (global) to find URLs: http(s)://..., www..., bare domains like example.com/path
const urlRegexGlobal = /(?:(https?:\/\/|www\.)[^\s'"<>]+)|(?<!@)\b([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z]{2,24}(?:\/[^\s'"<>]*)?)/ig;

function normalizeUrlCandidate(raw) {
  if (!raw) return raw;
  if (/^www\./i.test(raw)) return "http://" + raw;
  if (!/^https?:\/\//i.test(raw) && /^[a-z0-9\-]+\.[a-z]{2,}/i.test(raw)) return "http://" + raw;
  return raw;
}

function findAllUrls(text) {
  if (!text) return [];
  const matches = [];
  urlRegexGlobal.lastIndex = 0;
  let m;
  while ((m = urlRegexGlobal.exec(text)) !== null) {
    if (!m[0]) break;
    matches.push(m[0]);
  }
  return matches;
}

function removeFirstOccurrence(text, substring) {
  if (!substring) return text;
  const esc = substring.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(esc, "i");
  return text.replace(re, "").trim();
}

function updateDetectedUI(urls) {
  if (!detectedUrlDiv) return;
  if (!urls || urls.length === 0) {
    detectedUrlDiv.innerText = "(none detected)";
    if (detectedUrlListDiv) detectedUrlListDiv.innerHTML = "";
    return;
  }
  detectedUrlDiv.innerText = normalizeUrlCandidate(urls[0]);
  if (detectedUrlListDiv) {
    detectedUrlListDiv.innerHTML = urls.map((u, i) => `<div style="margin-top:6px;"><strong>#${i+1}:</strong> ${normalizeUrlCandidate(u)}</div>`).join("");
  }
}

// live detection
if (inputBox) {
  inputBox.addEventListener("input", () => {
    try {
      const urls = findAllUrls(inputBox.value || "");
      updateDetectedUI(urls);
    } catch (e) {
      console.error("Live detect error:", e);
    }
  });
}

// clear button
if (clearBtn) clearBtn.addEventListener("click", () => {
  if (inputBox) inputBox.value = "";
  updateDetectedUI([]);
  if (resultText) resultText.innerText = "";
  if (modal) modal.style.display = "none";
});

// analyze click
if (scanBtn) {
  scanBtn.addEventListener("click", async () => {
    try {
      const raw = (inputBox && inputBox.value) ? inputBox.value.trim() : "";
      if (!raw) { alert("Please paste email content or a suspicious URL first!"); return; }

      const urls = findAllUrls(raw); // array
      const firstUrl = urls.length ? normalizeUrlCandidate(urls[0]) : "";

      // prepare email body without chosen URL
      let emailBody = raw;
      if (firstUrl) {
        emailBody = removeFirstOccurrence(emailBody, urls[0]);           // remove matched snippet
        emailBody = removeFirstOccurrence(emailBody, firstUrl);         // remove normalized variant
        const noProto = firstUrl.replace(/^https?:\/\//i, "");
        emailBody = removeFirstOccurrence(emailBody, noProto);
      }

      if (resultText) resultText.innerText = "Scanning... 🔍";
      if (modal) modal.style.display = "block";

      const res = await fetch(API_BASE + "/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailBody, url: firstUrl })
      });
      const data = await res.json();
      if (data.error) {
        if (resultText) resultText.innerText = "Server error: " + data.error;
        return;
      }

      const findings = Array.isArray(data.findings) ? data.findings : [];
      const findingsHTML = findings.length ? `<ul>${findings.map(f => `<li>${f}</li>`).join("")}</ul>` : "(no findings)";
      const allUrlsHTML = urls.length ? `<div style="margin-bottom:10px;"><strong>All detected URLs:</strong><br>${urls.map(u => normalizeUrlCandidate(u)).join("<br>")}</div>` : "";

      if (resultText) resultText.innerHTML = `
        ${allUrlsHTML}
        <strong>URL sent to server:</strong> ${firstUrl || "(none)"} <br><br>
        <strong>Risk Level:</strong> ${data.risk} <br><br>
        <strong>Threat Score:</strong> ${data.score} / 100<br><br>
        <strong>Findings:</strong><br>
        ${findingsHTML}
      `;
    } catch (e) {
      console.error("Analyze error:", e);
      if (resultText) resultText.innerText = "Server error during analysis.";
    }
  });
}

if (closeBtn) closeBtn.addEventListener("click", () => modal && (modal.style.display = "none"));

/* ON LOAD */
document.addEventListener("DOMContentLoaded", () => {
  checkExistingLogin();
  updateNavForAuth();
});
/* ---------- LetterGlitch (drop-in, vanilla JS) ----------
   Append this block to the end of pjt.js
------------------------------------------------------------------------- */
(function () {
  function initLetterGlitch(opts = {}) {
    const defaults = {
      selector: '.landing-overlay',
      glitchColors: ['#2b4539', '#61dca3', '#61b3dc'],
      glitchSpeed: 60,
      centerVignette: false,
      outerVignette: true,
      smooth: true,
      characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789',
      fontSize: 16,
      charWidth: 10,
      charHeight: 20
    };
    const cfg = Object.assign({}, defaults, opts);
    const container = document.querySelector(cfg.selector);
    if (!container) {
      console.warn('LetterGlitch: container not found for selector', cfg.selector);
      return null;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'letterglitch-wrapper';
    wrapper.style.position = 'absolute';
    wrapper.style.inset = '0';
    wrapper.style.pointerEvents = 'none';
    wrapper.style.overflow = 'hidden';
    wrapper.style.zIndex = 10000;

    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    wrapper.appendChild(canvas);

    let outerVignetteDiv = null;
    let centerVignetteDiv = null;
    if (cfg.outerVignette) {
      outerVignetteDiv = document.createElement('div');
      outerVignetteDiv.className = 'letterglitch-outer-vignette';
      outerVignetteDiv.style.position = 'absolute';
      outerVignetteDiv.style.inset = '0';
      outerVignetteDiv.style.pointerEvents = 'none';
      outerVignetteDiv.style.background = 'radial-gradient(circle, rgba(0,0,0,0) 60%, rgba(0,0,0,1) 100%)';
      wrapper.appendChild(outerVignetteDiv);
    }
    if (cfg.centerVignette) {
      centerVignetteDiv = document.createElement('div');
      centerVignetteDiv.className = 'letterglitch-center-vignette';
      centerVignetteDiv.style.position = 'absolute';
      centerVignetteDiv.style.inset = '0';
      centerVignetteDiv.style.pointerEvents = 'none';
      centerVignetteDiv.style.background = 'radial-gradient(circle, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 60%)';
      wrapper.appendChild(centerVignetteDiv);
    }

    const prevPosition = window.getComputedStyle(container).position;
    if (prevPosition === 'static') container.style.position = 'relative';
    container.appendChild(wrapper);

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const letters = [];
    const grid = { columns: 0, rows: 0 };
    const lettersAndSymbols = Array.from(cfg.characters);
    let lastGlitchTime = Date.now();
    let animationFrame = null;

    function getRandomChar() {
      return lettersAndSymbols[Math.floor(Math.random() * lettersAndSymbols.length)];
    }
    function getRandomColor() {
      return cfg.glitchColors[Math.floor(Math.random() * cfg.glitchColors.length)];
    }
    function hexToRgb(hex) {
      const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
      hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
    }
    function interpolateColor(start, end, factor) {
      const result = { r: Math.round(start.r + (end.r - start.r) * factor), g: Math.round(start.g + (end.g - start.g) * factor), b: Math.round(start.b + (end.b - start.b) * factor) };
      return `rgb(${result.r}, ${result.g}, ${result.b})`;
    }

    function calculateGrid(width, height) {
      const columns = Math.ceil(width / cfg.charWidth);
      const rows = Math.ceil(height / cfg.charHeight);
      return { columns, rows };
    }
    function initializeLetters(columns, rows) {
      grid.columns = columns;
      grid.rows = rows;
      letters.length = 0;
      const total = columns * rows;
      for (let i = 0; i < total; i++) {
        letters.push({ char: getRandomChar(), color: getRandomColor(), targetColor: getRandomColor(), colorProgress: 1 });
      }
    }

    function resizeCanvasNow() {
      const rect = wrapper.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { columns, rows } = calculateGrid(width, height);
      initializeLetters(columns, rows);
      drawLetters();
    }

    function drawLetters() {
      const rect = wrapper.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      ctx.clearRect(0, 0, width, height);
      ctx.font = `${cfg.fontSize}px monospace`;
      ctx.textBaseline = 'top';
      for (let i = 0; i < letters.length; i++) {
        const letter = letters[i];
        const x = (i % grid.columns) * cfg.charWidth;
        const y = Math.floor(i / grid.columns) * cfg.charHeight;
        ctx.fillStyle = letter.color;
        ctx.fillText(letter.char, x, y);
      }
    }

    function updateLetters() {
      if (!letters.length) return;
      const updateCount = Math.max(1, Math.floor(letters.length * 0.05));
      for (let i = 0; i < updateCount; i++) {
        const idx = Math.floor(Math.random() * letters.length);
        if (!letters[idx]) continue;
        letters[idx].char = getRandomChar();
        letters[idx].targetColor = getRandomColor();
        if (!cfg.smooth) { letters[idx].color = letters[idx].targetColor; letters[idx].colorProgress = 1; } else { letters[idx].colorProgress = 0; }
      }
    }

    function handleSmoothTransitions() {
      let needsRedraw = false;
      for (let li = 0; li < letters.length; li++) {
        const letter = letters[li];
        if (letter.colorProgress < 1) {
          letter.colorProgress += 0.05;
          if (letter.colorProgress > 1) letter.colorProgress = 1;
          const startRgb = hexToRgb(letter.color);
          const endRgb = hexToRgb(letter.targetColor);
          if (startRgb && endRgb) { letter.color = interpolateColor(startRgb, endRgb, letter.colorProgress); needsRedraw = true; }
        }
      }
      if (needsRedraw) drawLetters();
    }

    function animate() {
      const now = Date.now();
      if (now - lastGlitchTime >= cfg.glitchSpeed) { updateLetters(); drawLetters(); lastGlitchTime = now; }
      if (cfg.smooth) handleSmoothTransitions();
      animationFrame = requestAnimationFrame(animate);
    }

    resizeCanvasNow();
    animate();

    let resizeTimeout = null;
    function onResize() {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        cancelAnimationFrame(animationFrame);
        resizeCanvasNow();
        animate();
      }, 100);
    }
    window.addEventListener('resize', onResize);

    function destroy() {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', onResize);
      if (wrapper && wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      try { if (prevPosition === 'static') container.style.position = prevPosition; } catch (e) {}
    }

    return { destroy };
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const instance = initLetterGlitch({
        selector: '.landing-overlay',
        glitchColors: ['#2b4539', '#61dca3', '#61b3dc'],
        glitchSpeed: 60,
        centerVignette: false,
        outerVignette: true,
        smooth: true
      });
      window.__LetterGlitchInstance = instance;
    }, 150);
  });

  window.initLetterGlitch = initLetterGlitch;
})();


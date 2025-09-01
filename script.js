// script.js (no build tools required) - save as module
// This is client-only: login (any id), per-user localStorage timetable, add/delete, notifications 10 minutes before.
// Optional: FCM placeholders provided if you later want push when browser closed (see comments).

// -------------------- Helper / Constants --------------------
const DEFAULT_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const LS_PREFIX = "ttnotifier_user_"; // localStorage key prefix

// -------------------- DOM --------------------
const loginScreen = document.getElementById("loginScreen");
const mainApp = document.getElementById("mainApp");
const userIdInput = document.getElementById("userIdInput");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userLabel = document.getElementById("userLabel");

const dayInput = document.getElementById("dayInput");
const timeInput = document.getElementById("timeInput");
const subjectInput = document.getElementById("subjectInput");
const classForm = document.getElementById("classForm");
const tbody = document.querySelector("#timetableTable tbody");

const todayLabel = document.getElementById("todayLabel");
const todayList = document.getElementById("todayList");

// -------------------- State --------------------
let currentUserId = null;
let timetable = {}; // per-user timetable obj
let notifiedSet = new Set(); // avoids duplicate reminder same session

// -------------------- Login / Storage --------------------
function saveToLocal() {
  if (!currentUserId) return;
  localStorage.setItem(LS_PREFIX + currentUserId, JSON.stringify(timetable));
}

function loadFromLocal(userId) {
  const raw = localStorage.getItem(LS_PREFIX + userId);
  if (raw) {
    try { return JSON.parse(raw); } catch(e){/*ignore*/ }
  }
  // default empty timetable
  const t = {};
  DEFAULT_DAYS.forEach(d => t[d] = []);
  return t;
}

function showLogin(show=true) {
  loginScreen.style.display = show ? "block" : "none";
  mainApp.style.display = show ? "none" : "block";
}

// -------------------- UI Render --------------------
function renderTable() {
  tbody.innerHTML = "";
  for (const day of DEFAULT_DAYS) {
    (timetable[day] || []).sort((a,b) => a.time.localeCompare(b.time)).forEach((cls, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${day}</td>
        <td>${cls.time}</td>
        <td>${cls.subject}</td>
        <td><button class="action-btn del">Delete</button></td>
      `;
      const delBtn = tr.querySelector(".del");
      delBtn.addEventListener("click", () => {
        if (!confirm(`Delete ${cls.subject} on ${day} at ${cls.time}?`)) return;
        timetable[day].splice(idx,1);
        saveToLocal();
        renderTable();
        renderToday();
      });
      tbody.appendChild(tr);
    });
  }
}

function renderToday() {
  const now = new Date();
  const today = now.toLocaleString("en-US", { weekday: "long" });
  todayLabel.textContent = `(${today})`;
  todayList.innerHTML = "";
  const arr = (timetable[today] || []).slice().sort((a,b)=>a.time.localeCompare(b.time));
  const currentMinutes = now.getHours()*60 + now.getMinutes();

  arr.forEach((cls) => {
    const li = document.createElement("li");
    const [h,m] = cls.time.split(":").map(Number);
    const classMinutes = h*60 + m;
    li.textContent = `${cls.time} — ${cls.subject}`;
    if (classMinutes >= currentMinutes) {
      li.classList.add("highlight");
    }
    todayList.appendChild(li);
  });
}

// -------------------- Notifications --------------------
async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  try {
    const perm = await Notification.requestPermission();
    return perm === "granted";
  } catch(e) { return false; }
}

function tryNotify(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

// runs while page open; checks every 30s
function startReminderChecker() {
  checkReminders();
  setInterval(checkReminders, 30000);
}

function checkReminders() {
  const now = new Date();
  const today = now.toLocaleString("en-US", { weekday: "long" });
  const currentMinutes = now.getHours()*60 + now.getMinutes();
  (timetable[today] || []).forEach(cls => {
    const [h,m] = cls.time.split(":").map(Number);
    const classMinutes = h*60 + m;
    const key = `${today}:${cls.time}:${cls.subject}`;
    if (classMinutes - currentMinutes === 10 && !notifiedSet.has(key)) {
      tryNotify("⏰ Class Reminder", `${cls.subject} starts in 10 minutes!`);
      notifiedSet.add(key);
    }
  });
}

// -------------------- Form handling --------------------
classForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const day = dayInput.value;
  const time = timeInput.value;
  const subject = subjectInput.value.trim();
  if (!time || !subject) return alert("Enter both time and subject.");
  timetable[day].push({ time, subject });
  saveToLocal();
  renderTable();
  renderToday();
  classForm.reset();
});

// -------------------- Login actions --------------------
loginBtn.addEventListener("click", () => {
  const id = (userIdInput.value || "").trim();
  if (!id) return alert("Enter an id or email to continue.");
  currentUserId = id;
  userLabel.textContent = id;
  timetable = loadFromLocal(id);
  showLogin(false);
  renderTable();
  renderToday();
  requestNotificationPermission();
  startReminderChecker();
  // OPTIONAL: register service worker & try to get push token for FCM if you later add Firebase config
  // registerServiceWorkerForFCM(); // uncomment if you add FCM and service worker
});

logoutBtn.addEventListener("click", () => {
  if (!confirm("Logout?")) return;
  // clear state
  currentUserId = null;
  timetable = {};
  userIdInput.value = "";
  showLogin(true);
});

// -------------------- On load --------------------
(function init() {
  // if user had a lastId saved, auto-fill (not auto-login)
  const last = localStorage.getItem("ttnotifier_lastid");
  if (last) userIdInput.value = last;
  showLogin(true);
})();

// when user logs in, store last id for convenience
document.addEventListener("visibilitychange", () => {
  if (currentUserId) localStorage.setItem("ttnotifier_lastid", currentUserId);
});

// refresh today's highlight every minute
setInterval(renderToday, 60000);

/* ================== OPTIONAL: Firebase FCM Hooks (for background push) ==================
If you want notifications that arrive when the browser is closed, you need to:
  1) Create a Firebase project and enable Cloud Messaging.
  2) Add firebase-messaging-sw.js (service worker) at the site root.
  3) Add Firebase client code to obtain the FCM token and store it somewhere (server or Firestore).
  4) Run a server/cloud function to send push messages 10 minutes before classes using FCM.

Below is a minimal stub you can fill later. DO NOT call this function until you add Firebase and the service worker.

async function registerServiceWorkerForFCM() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('SW registered:', reg);

    // Example: initialize Firebase app in client, call getToken() and send token to your server/database.
    // See Firebase docs for VAPID key and getToken usage.
  } catch(e) {
    console.error('SW register failed', e);
  }
}
====================================================================================== */

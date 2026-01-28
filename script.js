import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, update, get, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyAessffdBaG653iPfoCJYEG4_-h7fx8Wx4",
    authDomain: "ojt-attendance-system-1d346.firebaseapp.com",
    databaseURL: "https://ojt-attendance-system-1d346-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ojt-attendance-system-1d346",
    storageBucket: "ojt-attendance-system-1d346.firebasestorage.app",
    messagingSenderId: "599115495303",
    appId: "1:599115495303:web:3ffa6874c95545616a8522"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const ADMIN_EMAIL = "admin@test.com";
const authCont = document.getElementById('auth-container');
const appCont = document.getElementById('app-content');
const studentSec = document.getElementById('student-section');
const adminSec = document.getElementById('admin-section');

// --- AUTH UI LOGIC ---
let isLoginMode = true;
document.getElementById('btn-toggle-auth').onclick = (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? "Welcome Back" : "Join OJT Tracker";
    document.getElementById('login-fields').classList.toggle('hidden');
    document.getElementById('signup-fields').classList.toggle('hidden');
    document.getElementById('btn-toggle-auth').innerText = isLoginMode ? "Sign Up" : "Sign In";
};

document.getElementById('btn-forgot-password').onclick = (e) => {
    e.preventDefault();
    document.getElementById('login-signup-view').classList.add('hidden');
    document.getElementById('reset-fields').classList.remove('hidden');
};

document.getElementById('btn-back-to-login').onclick = (e) => {
    e.preventDefault();
    document.getElementById('reset-fields').classList.add('hidden');
    document.getElementById('login-signup-view').classList.remove('hidden');
};

document.getElementById('btn-login').onclick = async () => {
    const e = document.getElementById('login-email').value;
    const p = document.getElementById('login-password').value;
    try { await signInWithEmailAndPassword(auth, e, p); } catch (err) { alert(err.message); }
};

document.getElementById('btn-signup').onclick = async () => {
    const n = document.getElementById('signup-name').value;
    const e = document.getElementById('signup-email').value;
    const p = document.getElementById('signup-password').value;
    try {
        const res = await createUserWithEmailAndPassword(auth, e, p);
        await set(ref(db, `users/${res.user.uid}/profile`), { name: n, email: e, status: 'active' });
    } catch (err) { alert(err.message); }
};

document.getElementById('btn-send-reset').onclick = async () => {
    const e = document.getElementById('reset-email').value;
    try { await sendPasswordResetEmail(auth, e); alert("Reset link sent!"); } catch (err) { alert(err.message); }
};

// --- LOGOUT Logic (Fixed) ---
document.getElementById('btn-logout').onclick = () => signOut(auth);

// --- STATE MANAGEMENT ---
onAuthStateChanged(auth, async (user) => {
    authCont.classList.add('hidden'); 
    appCont.classList.add('hidden');
    studentSec.classList.add('hidden'); 
    adminSec.classList.add('hidden');

    if (user) {
        appCont.classList.remove('hidden');
        if (user.email === ADMIN_EMAIL) {
            adminSec.classList.remove('hidden');
            document.getElementById('display-user-name').innerText = "Admin";
            loadAdminData();
        } else {
            studentSec.classList.remove('hidden');
            const snap = await get(ref(db, `users/${user.uid}/profile`));
            const profile = snap.val();
            document.getElementById('display-user-name').innerText = profile?.name || "Student";
            
            if(profile?.status === 'inactive') {
                document.getElementById('btn-time-in').disabled = true;
                document.getElementById('student-welcome-msg').innerText = "ACCOUNT INACTIVE";
                document.getElementById('student-welcome-msg').style.color = "red";
            } else {
                document.getElementById('student-welcome-msg').innerText = "Attendance";
                document.getElementById('student-welcome-msg').style.color = "inherit";
                loadStudentData(user.uid);
            }
        }
    } else { 
        authCont.classList.remove('hidden'); 
        document.getElementById('login-email').value = "";
        document.getElementById('login-password').value = "";
    }
});

// --- STUDENT LOGIC ---
document.getElementById('btn-time-in').onclick = async () => {
    const u = auth.currentUser;
    const d = new Date().toISOString().split('T')[0];
    await set(ref(db, `users/${u.uid}/attendance/${d}`), {
        date: d, timeIn: new Date().toLocaleTimeString(), timestampIn: Date.now(), timeOut: null, hours: 0
    });
    loadStudentData(u.uid);
};

document.getElementById('btn-time-out').onclick = async () => {
    const u = auth.currentUser;
    const d = new Date().toISOString().split('T')[0];
    const snap = await get(ref(db, `users/${u.uid}/attendance/${d}`));
    const r = snap.val();
    const tOut = new Date().toLocaleTimeString();
    const h = (Date.now() - r.timestampIn) / (3600000);
    await update(ref(db, `users/${u.uid}/attendance/${d}`), { timeOut: tOut, hours: parseFloat(h.toFixed(2)) });
    loadStudentData(u.uid);
};

async function loadStudentData(uid) {
    const snap = await get(ref(db, `users/${uid}/attendance`));
    const list = document.getElementById('attendance-list');
    list.innerHTML = ""; let th = 0, td = 0; const today = new Date().toISOString().split('T')[0];
    
    document.getElementById('btn-time-in').disabled = false;
    document.getElementById('btn-time-out').disabled = true;

    if (snap.exists()) {
        const recs = snap.val();
        Object.keys(recs).reverse().forEach(k => {
            const r = recs[k]; th += r.hours; td++;
            if (r.date === today) {
                document.getElementById('btn-time-in').disabled = true;
                document.getElementById('btn-time-out').disabled = !!r.timeOut;
                document.getElementById('today-status').innerText = r.timeOut ? "Finished" : "Active";
            }
            list.innerHTML += `<tr><td>${r.date}</td><td>${r.timeIn}</td><td>${r.timeOut || '--'}</td><td>${r.hours}h</td></tr>`;
        });
    }
    document.getElementById('total-hours').innerText = th.toFixed(2);
    document.getElementById('total-days').innerText = td;
}

// --- ADMIN FEATURES (Search, Toggle, Delete, Targeted Export) ---
async function loadAdminData(searchQuery = "") {
    const snap = await get(ref(db, `users`));
    const list = document.getElementById('admin-list'); 
    list.innerHTML = "";
    
    if (snap.exists()) {
        const users = snap.val();
        for (let uid in users) {
            const profile = users[uid].profile || {};
            const att = users[uid].attendance;
            const name = profile.name || "Unknown";
            const email = profile.email || "";
            const status = profile.status || 'active';

            if (searchQuery && !name.toLowerCase().includes(searchQuery.toLowerCase()) && !email.toLowerCase().includes(searchQuery.toLowerCase())) continue;

            if (att) {
                for (let date in att) {
                    const r = att[date];
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td><div style="font-weight:800">${name}</div><div style="font-size:0.7rem; color:gray">${email}</div></td>
                        <td>
                            <label class="switch">
                                <input type="checkbox" class="status-tog" data-uid="${uid}" ${status === 'active' ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                            <span class="status-label ${status === 'active' ? 'active-txt' : 'inactive-txt'}">${status.toUpperCase()}</span>
                        </td>
                        <td>${r.date}</td><td>${r.timeIn}</td><td>${r.timeOut || '--'}</td><td>${r.hours}</td>
                        <td><button class="btn-delete" data-uid="${uid}" data-date="${date}">DEL</button></td>
                    `;
                    list.appendChild(row);
                }
            }
        }
    }
    attachAdminEvents();
}

function attachAdminEvents() {
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.onclick = async (e) => {
            if(confirm("Delete record?")) {
                await remove(ref(db, `users/${e.target.dataset.uid}/attendance/${e.target.dataset.date}`));
                loadAdminData(document.getElementById('admin-search').value);
            }
        };
    });

    document.querySelectorAll('.status-tog').forEach(tog => {
        tog.onchange = async (e) => {
            const newStatus = e.target.checked ? 'active' : 'inactive';
            await update(ref(db, `users/${e.target.dataset.uid}/profile`), { status: newStatus });
            loadAdminData(document.getElementById('admin-search').value);
        };
    });
}

document.getElementById('admin-search').addEventListener('input', (e) => loadAdminData(e.target.value));

document.getElementById('btn-export-excel').onclick = () => {
    let csv = "Student,Email,Status,Date,In,Out,Hrs\n";
    document.querySelectorAll("#admin-list tr").forEach(row => {
        const cells = row.querySelectorAll("td");
        csv += `"${cells[0].querySelector("div").innerText}","${cells[0].querySelectorAll("div")[1].innerText}","${cells[1].innerText.trim()}","${cells[2].innerText}","${cells[3].innerText}","${cells[4].innerText}","${cells[5].innerText}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
};

document.getElementById('btn-manual-save').onclick = async () => {
    const email = document.getElementById('manual-email').value;
    const date = document.getElementById('manual-date').value;
    const tIn = document.getElementById('manual-time-in').value;
    const tOut = document.getElementById('manual-time-out').value;
    const snap = await get(ref(db, `users`)); 
    let target = null;
    for (let u in snap.val()) if (snap.val()[u].profile?.email === email) target = u;
    if (target) {
        await set(ref(db, `users/${target}/attendance/${date}`), { date, timeIn: tIn, timeOut: tOut, hours: 8 });
        alert("Done!"); loadAdminData();
    } else { alert("Not found"); }
};

// --- CLOCK ---
function startClock() {
    setInterval(() => {
        const now = new Date();
        document.getElementById('live-time').innerText = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        document.getElementById('live-day').innerText = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][now.getDay()];
        document.getElementById('live-date').innerText = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }, 1000);
}
startClock();
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, update, get, remove, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyAessffdBaG653iPfoCJYEG4_-h7fx8Wx4",
    authDomain: "ojt-attendance-system-1d346.firebaseapp.com",
    databaseURL: "https://ojt-attendance-system-1d346-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ojt-attendance-system-1d346",
    storageBucket: "ojt-attendance-system-1d346.appspot.com",
    messagingSenderId: "599115495303",
    appId: "1:599115495303:web:3ffa6874c95545616a8522"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

const ADMIN_EMAIL = "admin@test.com";

// Global variables for modal management
let currentEditingUserId = null;
let currentEditingDate = null;
let isEditMode = false;

// --- UTILS ---
const showLoader = (show) => document.getElementById('loader-overlay').classList.toggle('hidden', !show);
const formatError = (code) => {
    switch(code) {
        case 'auth/user-not-found': return "Email not found. Please check spelling.";
        case 'auth/wrong-password': return "Incorrect password provided.";
        case 'auth/email-already-in-use': return "Email already registered.";
        case 'auth/weak-password': return "Password must be at least 6 characters.";
        case 'auth/invalid-email': return "Invalid email format.";
        default: return "An error occurred. Please try again.";
    }
};

// --- SIDEBAR TOGGLE FUNCTIONALITY ---
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarToggleIcon = sidebarToggle.querySelector('i');
const mainContent = document.getElementById('main-content');
const resizeHandle = document.getElementById('sidebar-resize-handle');

// Load sidebar state from localStorage
const savedSidebarState = localStorage.getItem('sidebarCollapsed');
const savedSidebarWidth = localStorage.getItem('sidebarWidth');

if (savedSidebarWidth) {
    sidebar.style.width = savedSidebarWidth + 'px';
    mainContent.style.marginLeft = savedSidebarWidth + 'px';
}

if (savedSidebarState === 'true') {
    sidebar.classList.add('collapsed');
    sidebarToggleIcon.className = 'fas fa-angles-right';
}

sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    const isCollapsed = sidebar.classList.contains('collapsed');
    
    // Update icon based on state
    if (isCollapsed) {
        sidebarToggleIcon.className = 'fas fa-angles-right';
    } else {
        sidebarToggleIcon.className = 'fas fa-angles-left';
    }
    
    localStorage.setItem('sidebarCollapsed', isCollapsed);
});

// --- SIDEBAR DRAG RESIZE FUNCTIONALITY ---
let isResizing = false;
let startX = 0;
let startWidth = 0;

resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;
    
    resizeHandle.classList.add('dragging');
    sidebar.classList.add('resizing');
    mainContent.classList.add('resizing');
    
    // Prevent text selection while dragging
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const deltaX = e.clientX - startX;
    let newWidth = startWidth + deltaX;
    
    // Enforce min/max constraints
    newWidth = Math.max(70, Math.min(400, newWidth));
    
    sidebar.style.width = newWidth + 'px';
    mainContent.style.marginLeft = newWidth + 'px';
});

document.addEventListener('mouseup', () => {
    if (isResizing) {
        isResizing = false;
        resizeHandle.classList.remove('dragging');
        sidebar.classList.remove('resizing');
        mainContent.classList.remove('resizing');
        
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        
        // Save the new width
        localStorage.setItem('sidebarWidth', sidebar.offsetWidth);
        
        // Auto-collapse if dragged too small
        if (sidebar.offsetWidth < 120) {
            sidebar.classList.add('collapsed');
            sidebarToggleIcon.className = 'fas fa-angles-right';
            localStorage.setItem('sidebarCollapsed', 'true');
        } else {
            sidebar.classList.remove('collapsed');
            sidebarToggleIcon.className = 'fas fa-angles-left';
            localStorage.setItem('sidebarCollapsed', 'false');
        }
    }
});

// --- MOBILE SIDEBAR TOGGLE ---
const mobileBackdrop = document.getElementById('mobile-backdrop');

document.getElementById('mobile-menu-toggle').onclick = () => {
    sidebar.classList.add('open');
    if (window.innerWidth <= 768) {
        mobileBackdrop.classList.add('active');
    }
};

document.getElementById('mobile-close').onclick = () => {
    sidebar.classList.remove('open');
    mobileBackdrop.classList.remove('active');
};

mobileBackdrop.onclick = () => {
    sidebar.classList.remove('open');
    mobileBackdrop.classList.remove('active');
};

// --- AUTH UI LOGIC ---
document.getElementById('btn-toggle-auth').onclick = (e) => {
    e.preventDefault();
    const isLogin = document.getElementById('signup-fields').classList.contains('hidden');
    document.getElementById('auth-title').innerText = isLogin ? "Create Account" : "Welcome Back";
    document.getElementById('login-fields').classList.toggle('hidden');
    document.getElementById('signup-fields').classList.toggle('hidden');
    document.getElementById('btn-toggle-auth').innerText = isLogin ? "Sign In" : "Sign Up";
};

document.getElementById('btn-show-forgot').onclick = (e) => {
    e.preventDefault();
    document.getElementById('auth-main-view').classList.add('hidden');
    document.getElementById('forgot-password-view').classList.remove('hidden');
};

document.getElementById('btn-back-to-login').onclick = (e) => {
    e.preventDefault();
    document.getElementById('forgot-password-view').classList.add('hidden');
    document.getElementById('auth-main-view').classList.remove('hidden');
};

// --- AUTH FUNCTIONS ---
document.getElementById('btn-login').onclick = async () => {
    const e = document.getElementById('login-email').value.trim();
    const p = document.getElementById('login-password').value;
    
    if (!e || !p) {
        alert("Please fill in all fields.");
        return;
    }
    
    showLoader(true);
    try { 
        await signInWithEmailAndPassword(auth, e, p); 
    } catch (err) { 
        alert(formatError(err.code)); 
    } finally { 
        showLoader(false); 
    }
};

document.getElementById('btn-signup').onclick = async () => {
    const n = document.getElementById('signup-name').value.trim();
    const e = document.getElementById('signup-email').value.trim();
    const p = document.getElementById('signup-password').value;
    
    if (!n || !e || !p) {
        alert("Please fill in all fields.");
        return;
    }
    
    showLoader(true);
    try {
        const res = await createUserWithEmailAndPassword(auth, e, p);
        await set(ref(db, `users/${res.user.uid}/profile`), { 
            name: n, 
            email: e, 
            status: 'active', 
            photo: "" 
        });
    } catch (err) { 
        alert(formatError(err.code)); 
    } finally { 
        showLoader(false); 
    }
};

document.getElementById('btn-send-reset').onclick = async () => {
    const e = document.getElementById('forgot-email').value.trim();
    
    if (!e) {
        alert("Please enter your email address.");
        return;
    }
    
    try { 
        await sendPasswordResetEmail(auth, e); 
        alert("Reset link sent to your email!"); 
        document.getElementById('forgot-password-view').classList.add('hidden');
        document.getElementById('auth-main-view').classList.remove('hidden');
    } catch (err) { 
        alert(formatError(err.code)); 
    }
};

document.getElementById('btn-logout').onclick = () => {
    if (confirm("Are you sure you want to logout?")) {
        signOut(auth);
    }
};

// --- APP STATE ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-content').classList.remove('hidden');
        
        const snap = await get(ref(db, `users/${user.uid}/profile`));
        const profile = snap.val() || {};
        
        document.getElementById('display-user-name').innerText = profile.name || "User";
        document.getElementById('nav-avatar').src = profile.photo || "https://via.placeholder.com/40";
        
        if (user.email === ADMIN_EMAIL) {
            // Admin mode
            document.getElementById('admin-nav').classList.remove('hidden');
            document.getElementById('student-nav').classList.add('hidden');
            
            // Set admin profile data
            document.getElementById('admin-profile-img').src = profile.photo || "https://via.placeholder.com/150";
            document.getElementById('admin-prof-name').innerText = profile.name || "Administrator";
            document.getElementById('admin-prof-email').innerText = profile.email;
            document.getElementById('admin-name-input').value = profile.name || "";
            
            loadAdminMaster();
        } else {
            // Student mode
            document.getElementById('admin-nav').classList.add('hidden');
            document.getElementById('student-nav').classList.remove('hidden');
            
            document.getElementById('profile-img').src = profile.photo || "https://via.placeholder.com/150";
            document.getElementById('prof-name').innerText = profile.name;
            document.getElementById('prof-email').innerText = profile.email;
            
            initStudentDashboard(user.uid, profile);
        }
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-content').classList.add('hidden');
    }
});

// --- STUDENT CORE ---
function initStudentDashboard(uid, profile) {
    if(profile.status === 'inactive') {
        document.getElementById('btn-time-in').disabled = true;
        document.getElementById('today-status').innerText = "INACTIVE";
        document.getElementById('today-status').style.color = "red";
    } else {
        onValue(ref(db, `users/${uid}/attendance`), (snap) => {
            const list = document.getElementById('attendance-list');
            list.innerHTML = "";
            let tHrs = 0, tDays = 0;
            const today = new Date().toISOString().split('T')[0];
            let hasTodayEntry = false;
            
            if (snap.exists()) {
                const data = snap.val();
                Object.keys(data).sort().reverse().forEach(date => {
                    const r = data[date];
                    tHrs += (r.hours || 0); 
                    tDays++;
                    
                    if (date === today) {
                        hasTodayEntry = true;
                        document.getElementById('btn-time-in').disabled = true;
                        document.getElementById('btn-time-out').disabled = !!r.timeOut;
                        document.getElementById('today-status').innerText = r.timeOut ? "Finished" : "Active";
                    }
                    
                    list.innerHTML += `
                        <tr>
                            <td>${r.date}</td>
                            <td>${r.timeIn}</td>
                            <td>${r.timeOut || '--'}</td>
                            <td>${(r.hours || 0).toFixed(2)}h</td>
                        </tr>
                    `;
                });
            }
            
            if (!hasTodayEntry) {
                document.getElementById('btn-time-in').disabled = false;
                document.getElementById('btn-time-out').disabled = true;
                document.getElementById('today-status').innerText = "Ready";
            }
            
            document.getElementById('total-hours').innerText = tHrs.toFixed(2);
            document.getElementById('total-days').innerText = tDays;
        });
    }
}

document.getElementById('btn-time-in').onclick = async () => {
    const d = new Date().toISOString().split('T')[0];
    const now = new Date();
    
    await set(ref(db, `users/${auth.currentUser.uid}/attendance/${d}`), {
        date: d, 
        timeIn: now.toLocaleTimeString('en-US', { hour12: false }), 
        timestampIn: Date.now(), 
        hours: 0
    });
};

document.getElementById('btn-time-out').onclick = async () => {
    const d = new Date().toISOString().split('T')[0];
    const snap = await get(ref(db, `users/${auth.currentUser.uid}/attendance/${d}`));
    const r = snap.val();
    const h = (Date.now() - r.timestampIn) / 3600000;
    const now = new Date();
    
    await update(ref(db, `users/${auth.currentUser.uid}/attendance/${d}`), { 
        timeOut: now.toLocaleTimeString('en-US', { hour12: false }), 
        hours: parseFloat(h.toFixed(2)) 
    });
};

// --- PROFILE IMG UPLOAD (STUDENT) ---
document.getElementById('img-upload').onchange = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    
    showLoader(true);
    try {
        const imageRef = sRef(storage, `profiles/${auth.currentUser.uid}`);
        await uploadBytes(imageRef, file);
        const url = await getDownloadURL(imageRef);
        await update(ref(db, `users/${auth.currentUser.uid}/profile`), { photo: url });
        document.getElementById('profile-img').src = url;
        document.getElementById('nav-avatar').src = url;
    } catch (err) { 
        alert("Upload failed. Ensure Firebase Storage is enabled."); 
    } finally { 
        showLoader(false); 
    }
};

// --- ADMIN PROFILE IMG UPLOAD ---
document.getElementById('admin-img-upload').onchange = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    
    showLoader(true);
    try {
        const imageRef = sRef(storage, `profiles/${auth.currentUser.uid}`);
        await uploadBytes(imageRef, file);
        const url = await getDownloadURL(imageRef);
        await update(ref(db, `users/${auth.currentUser.uid}/profile`), { photo: url });
        document.getElementById('admin-profile-img').src = url;
        document.getElementById('nav-avatar').src = url;
    } catch (err) { 
        alert("Upload failed. Ensure Firebase Storage is enabled."); 
    } finally { 
        showLoader(false); 
    }
};

// --- ADMIN UPDATE NAME ---
document.getElementById('btn-update-admin-name').onclick = async () => {
    const newName = document.getElementById('admin-name-input').value.trim();
    
    if (!newName) {
        alert("Please enter a name.");
        return;
    }
    
    showLoader(true);
    try {
        await update(ref(db, `users/${auth.currentUser.uid}/profile`), { name: newName });
        document.getElementById('admin-prof-name').innerText = newName;
        document.getElementById('display-user-name').innerText = newName;
        alert("Name updated successfully!");
    } catch (err) {
        alert("Failed to update name.");
    } finally {
        showLoader(false);
    }
};

// --- ADMIN CORE ---
function loadAdminMaster() {
    onValue(ref(db, `users`), (snap) => {
        const masterList = document.getElementById('admin-master-list');
        const mgmtList = document.getElementById('mgmt-table-body');
        masterList.innerHTML = ""; 
        mgmtList.innerHTML = "";
        
        const users = snap.val();
        if (!users) return;
        
        for (let uid in users) {
            const p = users[uid].profile;
            if (!p || p.email === ADMIN_EMAIL) continue;

            const att = users[uid].attendance || {};
            const tDays = Object.keys(att).length;
            const tHrs = Object.values(att).reduce((s, r) => s + (r.hours || 0), 0);

            // Masters list
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="clickable-name" onclick="openDetail('${uid}')">
                    <strong>${p.name}</strong><br>
                    <small>${p.email}</small>
                </td>
                <td>${tDays}</td>
                <td>${tHrs.toFixed(2)}h</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="openDetail('${uid}')">
                        <i class="fas fa-eye"></i> View Logs
                    </button>
                </td>
            `;
            masterList.appendChild(row);

            // Mgmt List
            mgmtList.innerHTML += `
                <tr>
                    <td>${p.name}</td>
                    <td>${p.email}</td>
                    <td>
                        <label class="switch">
                            <input type="checkbox" onchange="updateUserStatus('${uid}', this.checked)" ${p.status === 'active' ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="deleteUser('${uid}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        }
    });
}

window.openDetail = async (uid) => {
    currentEditingUserId = uid;
    
    const snap = await get(ref(db, `users/${uid}`));
    const user = snap.val();
    
    document.getElementById('admin-dashboard').classList.add('hidden');
    document.getElementById('admin-detail-view').classList.remove('hidden');
    
    document.getElementById('det-name').innerText = user.profile.name;
    document.getElementById('det-email').innerText = user.profile.email;
    
    const body = document.getElementById('det-table-body');
    body.innerHTML = "";
    let totalAccumulated = 0;
    const att = user.attendance || {};

    Object.keys(att).sort().reverse().forEach(date => {
        const r = att[date];
        totalAccumulated += (r.hours || 0);
        
        body.innerHTML += `
            <tr>
                <td>${r.date}</td>
                <td>${r.timeIn}</td>
                <td>${r.timeOut || 'Active'}</td>
                <td>${(r.hours || 0).toFixed(2)}h</td>
                <td class="table-actions">
                    <button class="icon-btn edit" onclick="editLog('${uid}', '${date}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="icon-btn delete" onclick="deleteLog('${uid}', '${date}')" title="Delete">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    document.getElementById('det-total-hrs').innerText = totalAccumulated.toFixed(2);

    // CSV EXPORT
    document.getElementById('btn-export-csv').onclick = () => {
        let csvContent = "data:text/csv;charset=utf-8,Date,Time In,Time Out,Hours\n";
        Object.values(att).forEach(r => {
            csvContent += `${r.date},${r.timeIn},${r.timeOut || 'Active'},${r.hours}\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${user.profile.name}_Report.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };
};

window.updateUserStatus = async (uid, active) => {
    await update(ref(db, `users/${uid}/profile`), { status: active ? 'active' : 'inactive' });
};

window.deleteUser = async (uid) => {
    if(confirm("Confirm deletion of student and all logs?")) {
        await remove(ref(db, `users/${uid}`));
    }
};

document.getElementById('btn-close-detail').onclick = () => {
    currentEditingUserId = null;
    document.getElementById('admin-detail-view').classList.add('hidden');
    document.getElementById('admin-dashboard').classList.remove('hidden');
};

// --- MODAL MANAGEMENT ---
const modal = document.getElementById('log-modal');
const modalTitle = document.getElementById('modal-title');
const logDateInput = document.getElementById('log-date');
const logTimeInInput = document.getElementById('log-time-in');
const logTimeOutInput = document.getElementById('log-time-out');
const logHoursInput = document.getElementById('log-hours');

// Auto-calculate hours when time changes
const calculateHours = () => {
    const timeIn = logTimeInInput.value;
    const timeOut = logTimeOutInput.value;
    
    if (timeIn && timeOut) {
        const [inHour, inMin] = timeIn.split(':').map(Number);
        const [outHour, outMin] = timeOut.split(':').map(Number);
        
        const inMinutes = inHour * 60 + inMin;
        const outMinutes = outHour * 60 + outMin;
        
        let diffMinutes = outMinutes - inMinutes;
        if (diffMinutes < 0) diffMinutes += 24 * 60; // Handle overnight
        
        const hours = (diffMinutes / 60).toFixed(2);
        logHoursInput.value = hours;
    } else {
        logHoursInput.value = '';
    }
};

logTimeInInput.addEventListener('change', calculateHours);
logTimeOutInput.addEventListener('change', calculateHours);

// Add manual log
document.getElementById('btn-add-manual-log').onclick = () => {
    if (!currentEditingUserId) return;
    
    isEditMode = false;
    currentEditingDate = null;
    
    modalTitle.innerText = "Add Attendance Log";
    logDateInput.value = '';
    logTimeInInput.value = '';
    logTimeOutInput.value = '';
    logHoursInput.value = '';
    
    modal.classList.remove('hidden');
};

// Edit log
window.editLog = async (uid, date) => {
    isEditMode = true;
    currentEditingDate = date;
    
    const snap = await get(ref(db, `users/${uid}/attendance/${date}`));
    const record = snap.val();
    
    if (!record) return;
    
    modalTitle.innerText = "Edit Attendance Log";
    logDateInput.value = date;
    logTimeInInput.value = record.timeIn;
    logTimeOutInput.value = record.timeOut || '';
    logHoursInput.value = record.hours || '';
    
    modal.classList.remove('hidden');
};

// Delete log
window.deleteLog = async (uid, date) => {
    if (!confirm(`Delete attendance record for ${date}?`)) return;
    
    showLoader(true);
    try {
        await remove(ref(db, `users/${uid}/attendance/${date}`));
        openDetail(uid); // Refresh the detail view
    } catch (err) {
        alert("Failed to delete log.");
    } finally {
        showLoader(false);
    }
};

// Save log (add or edit)
document.getElementById('btn-save-log').onclick = async () => {
    if (!currentEditingUserId) return;
    
    const date = logDateInput.value;
    const timeIn = logTimeInInput.value;
    const timeOut = logTimeOutInput.value;
    const hours = parseFloat(logHoursInput.value) || 0;
    
    if (!date || !timeIn) {
        alert("Please fill in at least Date and Time In.");
        return;
    }
    
    showLoader(true);
    try {
        const logData = {
            date: date,
            timeIn: timeIn,
            timeOut: timeOut || null,
            hours: hours
        };
        
        // Add timestamp for time-in tracking if not editing
        if (!isEditMode) {
            const [hour, min] = timeIn.split(':').map(Number);
            const dateObj = new Date(date);
            dateObj.setHours(hour, min, 0, 0);
            logData.timestampIn = dateObj.getTime();
        }
        
        await set(ref(db, `users/${currentEditingUserId}/attendance/${date}`), logData);
        
        modal.classList.add('hidden');
        openDetail(currentEditingUserId); // Refresh the detail view
    } catch (err) {
        alert("Failed to save log.");
    } finally {
        showLoader(false);
    }
};

// Cancel modal
document.getElementById('btn-cancel-log').onclick = () => {
    modal.classList.add('hidden');
};

document.getElementById('modal-close').onclick = () => {
    modal.classList.add('hidden');
};

// Close modal on outside click
modal.onclick = (e) => {
    if (e.target === modal) {
        modal.classList.add('hidden');
    }
};

// --- NAVIGATION SWITCHER ---
document.querySelectorAll('.nav-link[data-view]').forEach(link => {
    link.onclick = (e) => {
        const viewId = link.getAttribute('data-view');
        document.querySelectorAll('.view-container').forEach(v => v.classList.add('hidden'));
        document.getElementById(viewId).classList.remove('hidden');
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        document.getElementById('view-title').innerText = link.querySelector('.nav-text').innerText;
        sidebar.classList.remove('open');
        mobileBackdrop.classList.remove('active');
    };
});

// --- CLOCK ENGINE ---
setInterval(() => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: true 
    });
    const dateStr = now.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
    });
    
    document.querySelectorAll('.live-time').forEach(el => el.innerText = timeStr);
    document.querySelectorAll('.live-date').forEach(el => el.innerText = dateStr);
}, 1000);
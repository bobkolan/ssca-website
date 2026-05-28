// ==========================================
// CONFIGURATIE: VUL HIER JOUW JSONBIN GEGEVENS IN
// ==========================================
const BIN_ID = "6a1848aeddf5aa59f7700f5c";       // Vervang door je echte Bin ID
const MASTER_KEY = "$2a$10$H4KCi9v/wRbgMaa7ZRtm4ewHBEnnvc/C4774w/I0HJK.A5YYTXFWG"; // Vervang door je echte X-Master-Key

const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

// Globale applicatie status (inclusief auth vanuit de cloud)
let state = {
    auth: {}, 
    texts: {},
    events: [],
    players: [],
    isLoggedIn: false,
    isEditMode: false
};

// SHA-256 Hashing helperfunctie voor veilig inloggen
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);                    
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ==========================================
// DATA SYNCHRONISATIE (JSONBIN.IO API)
// ==========================================

// Data ophalen uit de cloud bij het laden van de pagina
async function loadDataFromCloud() {
    updateSyncStatus("Bezig met ophalen van live data...");
    try {
        const response = await fetch(`${API_URL}/latest`, {
            method: "GET",
            headers: {
                "X-Master-Key": MASTER_KEY
            }
        });
        
        if (!response.ok) throw new Error("Fout bij ophalen van cloud-data.");
        
        const resData = await response.json();
        
        // Vul de status met de database data
        state.auth = resData.record.auth || { username: "admin", passHash: "" };
        state.texts = resData.record.texts || {};
        state.events = resData.record.events || [];
        state.players = resData.record.players || [];
        
        // Bouw de pagina visueel op
        loadTextBlocks();
        renderCalendar();
        renderScores();
        updateSyncStatus("✓ Live cloud-data geladen");
    } catch (error) {
        console.error(error);
        updateSyncStatus("❌ Laden mislukt. Controleer je API keys.");
        alert("Kon de live gegevens niet ophalen uit de cloud. Controleer of je de juiste Bin ID en Master Key hebt ingevuld.");
    }
}

// Data opslaan en synchroniseren naar de cloud
async function saveDataToCloud() {
    updateSyncStatus("🔄 Wijzigingen synchroniseren naar de cloud...");
    try {
        const response = await fetch(API_URL, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "X-Master-Key": MASTER_KEY
            },
            body: JSON.stringify({
                auth: state.auth, // Zorgt dat de inloggegevens in de cloud bewaard blijven
                texts: state.texts,
                events: state.events,
                players: state.players
            })
        });

        if (!response.ok) throw new Error("Fout tijdens het uploaden.");
        updateSyncStatus("✓ Cloud succesvol bijgewerkt!");
    } catch (error) {
        console.error(error);
        updateSyncStatus("❌ Synchronisatie mislukt!");
        alert("Fout bij het opslaan naar de cloud. Probeer het opnieuw.");
    }
}

function updateSyncStatus(msg) {
    const indicator = document.getElementById("syncStatus");
    if (indicator) indicator.innerText = msg;
}

// ==========================================
// INTERNE PAGINA LOGICA
// ==========================================

function loadTextBlocks() {
    Object.keys(state.texts).forEach(key => {
        const element = document.getElementById(`editable_${key}`);
        if (element) {
            element.innerHTML = state.texts[key];
            element.setAttribute('placeholder', 'Typ hier je tekst...');
        }
    });
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const target = document.getElementById(pageId);
    if(target) target.classList.add('active');
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('border-[#0c261a]');
        btn.classList.add('border-transparent');
    });
    
    document.getElementById('mobileMenu').classList.add('hidden');
    window.scrollTo({top: 0, behavior: 'smooth'});
}

function toggleMobileMenu() {
    document.getElementById('mobileMenu').classList.toggle('hidden');
}

// ==========================================
// CMS BEHEERDERSMODUS LOGICA
// ==========================================

function toggleGlobalEditMode() {
    state.isEditMode = !state.isEditMode;
    const body = document.body;
    const btn = document.getElementById('editModeToggleBtn');

    if (state.isEditMode) {
        body.classList.add('admin-editing');
        btn.innerHTML = `<i class="fa-solid fa-floppy-disk mr-1"></i> <strong>Wijzigingen Opslaan!</strong>`;
        btn.classList.replace('bg-amber-500', 'bg-red-500');
        btn.classList.replace('text-stone-900', 'text-white');
        
        Object.keys(state.texts).forEach(key => {
            const el = document.getElementById(`editable_${key}`);
            if(el) el.contentEditable = "true";
        });
    } else {
        body.classList.remove('admin-editing');
        btn.innerHTML = `<i class="fa-solid fa-pen-to-square mr-1"></i> Bewerk Paginateksten (Word Editor)`;
        btn.classList.replace('bg-red-500', 'bg-amber-500');
        btn.classList.replace('text-white', 'text-stone-900');
        
        Object.keys(state.texts).forEach(key => {
            const el = document.getElementById(`editable_${key}`);
            if(el) {
                el.contentEditable = "false";
                state.texts[key] = el.innerHTML;
            }
        });
        
        saveDataToCloud();
        alert('Alle paginateksten zijn succesvol opgeslagen in de cloud!');
    }
}

function renderCalendar() {
    const container = document.getElementById('calendarList');
    if (!container) return;
    container.innerHTML = '';
    
    state.events.sort((a,b) => new Date(a.date) - new Date(b.date));

    state.events.forEach((ev, idx) => {
        const dateStr = new Date(ev.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
        container.innerHTML += `
            <div class="bg-stone-900 text-white p-4 rounded-xl border border-[#b89753] flex justify-between items-center shadow-lg">
                <div>
                    <span class="text-[10px] font-bold text-[#ecd292] uppercase tracking-widest">${dateStr}</span>
                    <h4 class="text-base font-black mt-0.5">${ev.title}</h4>
                    <p class="text-xs text-stone-400">${ev.status}</p>
                </div>
                ${state.isLoggedIn ? `<button onclick="deleteEvent(${idx})" class="text-red-400 hover:text-red-600 text-xs font-bold cursor-pointer"><i class="fa-solid fa-trash-can"></i> Wis</button>` : ''}
            </div>
        `;
    });
}

function renderScores() {
    const tbody = document.getElementById('scoresTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    state.players.sort((a,b) => b.wins - a.wins);

    state.players.forEach((player, idx) => {
        tbody.innerHTML += `
            <tr class="hover:bg-stone-800/40 transition">
                <td class="p-4 text-center font-bold text-[#ecd292]">${idx + 1}</td>
                <td class="p-4 font-bold text-white">${player.name}</td>
                <td class="p-4 text-center text-emerald-400 font-black">${player.wins}</td>
                <td class="p-4 text-center text-amber-400 font-mono font-bold">${player.break}</td>
                ${state.isLoggedIn ? `
                    <td class="p-4 text-center">
                        <button onclick="deletePlayer(${idx})" class="text-red-400 hover:text-red-500 text-sm cursor-pointer"><i class="fa-solid fa-user-minus"></i></button>
                    </td>
                ` : ''}
            </tr>
        `;
    });
}

// Cloud-gestuurde inlogfunctie
async function handleLogin() {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value;
    const err = document.getElementById('loginError');

    const inputHash = await sha256(pass);

    // Controleer met de gegevens die we live uit de JSONBin cloud hebben getrokken
    if (user === state.auth.username && inputHash === state.auth.passHash) {
        state.isLoggedIn = true;
        if(err) err.classList.add('hidden');
        
        document.getElementById('adminNavBtn').innerHTML = `<i class="fa-solid fa-screwdriver-wrench text-emerald-800"></i> BEHEER`;
        document.getElementById('adminEditorBar').classList.remove('hidden');
        
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        
        showPage('home');
        renderCalendar();
        renderScores();
    } else {
        if(err) {
            err.innerText = "Combinatie onjuist. Let op speciale tekens.";
            err.classList.remove('hidden');
        }
    }
}

function handleLogout() {
    if(state.isEditMode) toggleGlobalEditMode();
    state.isLoggedIn = false;
    document.getElementById('adminNavBtn').innerHTML = `<i class="fa-solid fa-lock"></i> BEHEER`;
    document.getElementById('adminEditorBar').classList.add('hidden');
    showPage('home');
    renderCalendar();
    renderScores();
}

function addCalendarEvent() {
    const title = document.getElementById('eventTitle').value.trim();
    const date = document.getElementById('eventDate').value;
    const status = document.getElementById('eventStatus').value.trim();

    if(!title || !date || !status) return alert('Vul alle velden in.');
    
    state.events.push({ title, date, status });
    renderCalendar();
    saveDataToCloud();
    
    document.getElementById('eventTitle').value = '';
    document.getElementById('eventDate').value = '';
    document.getElementById('eventStatus').value = '';
    alert('Toernooi toegevoegd en live gezet!');
}

function deleteEvent(idx) {
    if(confirm("Weet je zeker dat je dit toernooi wilt verwijderen uit de cloud?")) {
        state.events.splice(idx, 1);
        renderCalendar();
        saveDataToCloud();
    }
}

function addOrUpdatePlayer() {
    const name = document.getElementById('playerName').value.trim();
    const wins = parseInt(document.getElementById('playerWins').value);
    const breakScore = parseInt(document.getElementById('playerBreak').value);

    if(!name || isNaN(wins) || isNaN(breakScore)) return alert('Vul geldige waarden in.');
    
    const existIdx = state.players.findIndex(p => p.name.toLowerCase() === name.toLowerCase());

    if(existIdx > -1) {
        state.players[existIdx].wins = wins;
        state.players[existIdx].break = breakScore;
    } else {
        state.players.push({ name, wins, break: breakScore });
    }
    
    renderScores();
    saveDataToCloud();
    
    document.getElementById('playerName').value = '';
    document.getElementById('playerWins').value = '';
    document.getElementById('playerBreak').value = '';
    alert('Scoreboard live bijgewerkt!');
}

function deletePlayer(idx) {
    if(confirm("Speler permanent uit het leaderboard verwijderen?")) {
        state.players.splice(idx, 1);
        renderScores();
        saveData
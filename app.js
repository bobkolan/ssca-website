// ==========================================
// CONFIGURATIE: VUL HIER JOUW JSONBIN GEGEVENS IN
// ==========================================
const BIN_ID = "6a1848aeddf5aa59f7700f5c";       // Vervang door je echte Bin ID
const MASTER_KEY = "$2a$10$H4KCi9v/wRbgMaa7ZRtm4ewHBEnnvc/C4774w/I0HJK.A5YYTXFWG"; // Vervang door je echte X-Master-Key

const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;


// Globale applicatie status
let state = {
    auth: { username: "admin", passHash: "" }, 
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
    
    if (BIN_ID.includes("JOUW_JSONBIN") || MASTER_KEY.includes("JOUW_JSONBIN")) {
        console.error("Fout: De JSONBin sleutels zijn nog niet ingevuld!");
        updateSyncStatus("❌ Configuratiefout in app.js");
        return;
    }

    try {
        const response = await fetch(API_URL + "/latest", {
            method: "GET",
            headers: {
                "X-Master-Key": MASTER_KEY,
                "X-Bin-Meta": "false"
            }
        });
        
        if (!response.ok) throw new Error("Server reageerde met status: " + response.status);
        
        const resData = await response.json();
        
        state.auth = resData.auth || { username: "admin", passHash: "7cfae4f71120023ee0998ccb5d92fe7b949219ea2b52479e0a811c75949d6c81" };
        state.texts = resData.texts || {};
        state.events = resData.events || [];
        state.members = resData.players || [];
        
        loadTextBlocks();
        renderCalendar();
        renderScores();
        updateSyncStatus("✓ Live cloud-data geladen");
    } catch (error) {
        console.error("Fout bij laden:", error);
        updateSyncStatus("❌ Laden mislukt.");
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
                auth: state.auth,
                texts: state.texts,
                events: state.events,
                players: state.members
            })
        });

        if (!response.ok) throw new Error("Fout tijdens het uploaden.");
        updateSyncStatus("✓ Cloud succesvol bijgewerkt!");
    } catch (error) {
        console.error("Fout bij opslaan:", error);
        updateSyncStatus("❌ Synchronisatie mislukt!");
        alert("Fout bij het opslaan naar de cloud.");
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
        const element = document.getElementById("editable_" + key);
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
            const el = document.getElementById("editable_" + key);
            if(el) el.contentEditable = "true";
        });
    } else {
        body.classList.remove('admin-editing');
        btn.innerHTML = `<i class="fa-solid fa-pen-to-square mr-1"></i> Bewerk Paginateksten (Word Editor)`;
        btn.classList.replace('bg-red-500', 'bg-amber-500');
        btn.classList.replace('text-white', 'text-stone-900');
        
        Object.keys(state.texts).forEach(key => {
            const el = document.getElementById("editable_" + key);
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



async function handleLogin() {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value;
    const err = document.getElementById('loginError');

    // Genereer de hash van wat jij zojuist hebt ingetypt
    const inputHash = await sha256(pass);

    // DIT ZIJN DE DIAGNOSE REGELS (Alleen zichtbaar in jouw F12 console)
    console.log("--- INLOG DIAGNOSE ---");
    console.log("Ingevoerde gebruikersnaam:", user);
    console.log("Verwachte gebruikersnaam uit cloud:", state.auth.username);
    console.log("Berekende hash van invoer:", inputHash);
    console.log("Verwachte hash uit cloud:    ", state.auth.passHash);
    console.log("Match gebruikersnaam?:", user === state.auth.username);
    console.log("Match wachtwoord-hash?:", inputHash === state.auth.passHash);
    console.log("----------------------");

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
            err.innerText = "Combinatie onjuist. Open F12 Console voor details.";
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

function renderCalendar() {
    const publicContainer = document.getElementById('calendarList');
    const adminContainer = document.getElementById('adminCalendarManagerList');
    
    if (!publicContainer) return;
    
    // Leegmaken voor schone her-render
    publicContainer.innerHTML = '';
    if (adminContainer) adminContainer.innerHTML = '';
    
    // Sorteer data chronologisch (dichtstbijzijnde datum eerst)
    state.events.sort((a,b) => new Date(a.date) - new Date(b.date));

    if (state.events.length === 0) {
        const emptyMsg = `<p class="text-stone-500 text-xs italic p-2">Er staan momenteel geen evenementen op de planning.</p>`;
        publicContainer.innerHTML = emptyMsg;
        if (adminContainer) adminContainer.innerHTML = emptyMsg;
        return;
    }

    state.events.forEach((ev, idx) => {
        // Formateer datum naar nette Nederlandse tekst (bijv. 12 juni 2026)
        const dateStr = new Date(ev.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
        
        // 1. Bouw de OPENBARE agenda kaart op
        publicContainer.innerHTML += `
            <div class="bg-stone-900 text-white p-4 rounded-xl border border-[#b89753] flex justify-between items-center shadow-lg">
                <div>
                    <span class="text-[10px] font-bold text-[#ecd292] uppercase tracking-widest">${dateStr}</span>
                    <h4 class="text-base font-black mt-0.5">${ev.title}</h4>
                    <p class="text-xs text-stone-400">${ev.status}</p>
                </div>
            </div>
        `;

        // 2. Bouw de ADMIN agenda manager regel op (alleen als de admin is ingelogd)
        if (state.isLoggedIn && adminContainer) {
            adminContainer.innerHTML += `
                <div class="bg-stone-900 border border-stone-800 p-3 rounded-lg flex justify-between items-center text-xs text-white">
                    <div class="flex-1 min-w-0 pr-4">
                        <span class="text-[#ecd292] font-mono font-bold block">${ev.date}</span>
                        <strong class="truncate block text-sm">${ev.title}</strong>
                        <span class="text-stone-400 truncate block">${ev.status}</span>
                    </div>
                    <button onclick="deleteEvent(${idx})" class="bg-red-950/40 hover:bg-red-900 text-red-400 hover:text-white border border-red-900/50 px-3 py-1.5 rounded-md font-bold transition cursor-pointer flex items-center space-x-1 whitespace-nowrap">
                        <i class="fa-solid fa-trash-can text-[11px]"></i> <span>Wis</span>
                    </button>
                </div>
            `;
        }
    });
}

function deleteEvent(idx) {
    if(confirm("Weet je zeker dat je dit toernooi wilt verwijderen uit de cloud?")) {
        state.events.splice(idx, 1);
        renderCalendar();
        saveDataToCloud();
    }
}

// Vernieuwde score-renderer (vult zowel de openbare ranglijst als het beheerpaneel)
function renderScores() {
    const publicTbody = document.getElementById('scoresTableBody');
    const adminContainer = document.getElementById('adminMembersManagerList');
    
    // Zorg voor achterwaartse compatibiliteit als de database nog 'players' heet
    if (!state.members && state.players) {
        state.members = state.players.map(p => ({
            name: p.name,
            isActive: true,
            tournamentWins: p.wins || 0,
            highestBreak: p.break || 0
        }));
    }
    if (!state.members) state.members = [];

    // 1. Update de OPENBARE ranglijst (alleen actieve leden, gesorteerd op Toernooi Wins)
    if (publicTbody) {
        publicTbody.innerHTML = '';
        const activeMembers = state.members.filter(m => m.isActive !== false);
        activeMembers.sort((a, b) => b.tournamentWins - a.tournamentWins);

        if (activeMembers.length === 0) {
            publicTbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-stone-500 italic text-sm">Geen actieve leden gevonden.</td></tr>`;
        } else {
            activeMembers.forEach((member, idx) => {
                publicTbody.innerHTML += `
                    <tr class="hover:bg-stone-800/40 transition border-b border-stone-800/30">
                        <td class="p-4 text-center font-bold text-[#ecd292]">${idx + 1}</td>
                        <td class="p-4 font-bold text-white">${member.name}</td>
                        <td class="p-4 text-center text-emerald-400 font-black">${member.tournamentWins}</td>
                        <td class="p-4 text-center text-amber-400 font-mono font-bold">${member.highestBreak || 0}</td>
                    </tr>
                `;
            });
        }
    }

    // 2. Update het ADMIN Ledenbeheer dashboard
    if (adminContainer && state.isLoggedIn) {
        adminContainer.innerHTML = '';
        
        // Sorteer alfabetisch op naam voor het beheerpaneel
        const sortedMembers = [...state.members].sort((a,b) => a.name.localeCompare(b.name));

        if (sortedMembers.length === 0) {
            adminContainer.innerHTML = `<p class="text-stone-500 text-xs italic p-2">Er zijn nog geen leden ingeschreven.</p>`;
            return;
        }

        sortedMembers.forEach((member) => {
            // Zoek de echte index in de originele array voor bewerkingen
            const origIdx = state.members.findIndex(m => m.name === member.name);

            adminContainer.innerHTML += `
                <div class="bg-stone-900 border ${member.isActive ? 'border-stone-800' : 'border-red-900/30 opacity-60'} p-3 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs text-white gap-3 mb-2">
                    <div class="min-w-0">
                        <strong class="text-sm text-white block">${member.name}</strong>
                        <button onclick="toggleMemberStatus(${origIdx})" class="mt-1 text-[10px] font-bold px-2 py-0.5 rounded ${member.isActive ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-900'} cursor-pointer">
                            ${member.isActive ? '✓ Actief Lid' : '⏰ Inactief / Gestopt'}
                        </button>
                    </div>
                    
                    <div class="flex items-center space-x-4 bg-stone-950 p-2 rounded-lg border border-stone-800 w-full sm:w-auto justify-between sm:justify-start">
                        <div class="flex items-center space-x-2">
                            <span class="text-stone-400 font-semibold text-[11px]">Toernooi Wins:</span>
                            <button onclick="adjustScore(${origIdx}, 'tournamentWins', -1)" class="w-6 h-6 bg-stone-800 hover:bg-stone-700 rounded text-center font-bold text-white cursor-pointer">-</button>
                            <span class="font-bold text-emerald-400 text-sm min-w-[16px] text-center">${member.tournamentWins}</span>
                            <button onclick="adjustScore(${origIdx}, 'tournamentWins', 1)" class="w-6 h-6 bg-stone-800 hover:bg-stone-700 rounded text-center font-bold text-white cursor-pointer">+</button>
                        </div>
                        
                        <div class="flex items-center space-x-1">
                            <span class="text-stone-400 font-semibold text-[11px]">H. Break:</span>
                            <input type="number" value="${member.highestBreak || 0}" onchange="updateHighestBreak(${origIdx}, this.value)" class="w-14 bg-stone-900 border border-stone-700 rounded px-1 py-0.5 text-center text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500">
                        </div>
                    </div>

                    <button onclick="deleteMember(${origIdx})" class="text-stone-500 hover:text-red-400 p-1 transition cursor-pointer self-end sm:self-center">
                        <i class="fa-solid fa-trash-can text-sm"></i>
                    </button>
                </div>
            `;
        });
    }
}

// Nieuw lid toevoegen
function addNewMember() {
    const nameInput = document.getElementById('newMemberName');
    const activeInput = document.getElementById('newMemberActive');
    if (!nameInput) return;

    const name = nameInput.value.trim();
    if (!name) return alert('Vul aub een naam in.');

    // Check of lid al bestaat
    const exists = state.members.some(m => m.name.toLowerCase() === name.toLowerCase());
    if (exists) return alert('Dit lid bestaat al!');

    state.members.push({
        name: name,
        isActive: activeInput.checked,
        tournamentWins: 0,
        highestBreak: 0
    });

    nameInput.value = '';
    renderScores();
    saveDataToCloud();
    alert(`${name} is succesvol toegevoegd aan de ledenlijst!`);
}

// Plus en Min knoppen logica
function adjustScore(idx, field, amount) {
    if (state.members[idx]) {
        state.members[idx][field] = Math.max(0, (state.members[idx][field] || 0) + amount);
        renderScores();
        saveDataToCloud();
    }
}

// Hoogste break direct typen
function updateHighestBreak(idx, val) {
    const intVal = parseInt(val);
    if (state.members[idx] && !isNaN(intVal)) {
        state.members[idx].highestBreak = Math.max(0, intVal);
        renderScores();
        saveDataToCloud();
    }
}

// Schakelen tussen Actief / Inactief
function toggleMemberStatus(idx) {
    if (state.members[idx]) {
        state.members[idx].isActive = !state.members[idx].isActive;
        renderScores();
        saveDataToCloud();
    }
}

// Lid permanent verwijderen
function deleteMember(idx) {
    if (state.members[idx] && confirm(`Weet je zeker dat je ${state.members[idx].name} permanent wilt verwijderen?`)) {
        state.members.splice(idx, 1);
        renderScores();
        saveDataToCloud();
    }
}

document.addEventListener('click', function(e) {
    if(e.target && e.target.tagName === 'A' && e.target.getAttribute('href') === '#') {
        e.preventDefault();
    }
});

window.onload = loadDataFromCloud;

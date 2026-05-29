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
    members: [],
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

// Data inladen vanuit de cloud
async function loadDataFromCloud() {
    updateSyncStatus("🔄 Live cloud-data laden...");
    try {
        const response = await fetch(API_URL, {
            method: "GET",
            headers: {
                "X-Master-Key": MASTER_KEY
            }
        });

        if (!response.ok) throw new Error("Ophalen uit cloud mislukt.");
        
        const data = await response.json();
        
        // VEILIGHEID: Controleer of data en data.record wel echt bestaan
        if (!data || !data.record) {
            console.error("JSONBin response structuur is onbekend:", data);
            state.members = [];
            state.events = [];
            state.texts = {};
        } else {
            // Als het record bestaat, pakken we de data eruit
            const record = data.record;
            
            // Controleer of er members zijn, zo niet check oude spelers, anders leeg
            if (record.members) {
                state.members = record.members;
            } else if (record.players) {
                // Automatische omzetting van oude spelerslijst naar nieuwe structuur
                state.members = record.players.map(p => ({
                    name: p.name,
                    isActive: true,
                    tournamentScores: p.wins ? [p.wins] : [],
                    highestBreak: p.break || 0
                }));
            } else {
                state.members = [];
            }

            state.events = record.events || [];
            state.texts = record.texts || {};
            if (record.auth) state.auth = record.auth;
        }

        updateSyncStatus("✅ Live cloud-data geladen");
        renderScores();
        if (typeof renderCalendar === "function") renderCalendar();
        
    } catch (error) {
        console.error("Fout bij laden:", error);
        updateSyncStatus("❌ Fout bij laden cloud-data");
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
                members: state.members || []
            })
        });

        if (!response.ok) throw new Error("Cloud synchronisatie mislukt.");
        updateSyncStatus("✅ Live cloud-data geladen");
    } catch (error) {
        console.error(error);
        updateSyncStatus("❌ Synchronisatiefout!");
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

// ==========================================
// TOERNOOISCORES & LEDENBEHEER LOGICA
// ==========================================

// Bereken de som van de beste 3 toernooien
function calculateBestThreeTotal(scoresArray) {
    if (!scoresArray || !Array.isArray(scoresArray)) return 0;
    const sortedScores = [...scoresArray].map(Number).filter(n => !isNaN(n)).sort((a, b) => b - a);
    const bestThree = sortedScores.slice(0, 3);
    return bestThree.reduce((sum, score) => sum + score, 0);
}

// Ranglijst Renderen (Openbaar & Admin)
function renderScores() {
    const publicTbody = document.getElementById('scoresTableBody');
    const adminContainer = document.getElementById('adminMembersManagerList');
    
    // Altijd zorgen dat state.members een geldige array is
    if (!state.members || !Array.isArray(state.members)) {
        state.members = [];
    }

    // 1. OPENBARE RANGLIJST
    if (publicTbody) {
        publicTbody.innerHTML = '';
        const activeMembers = state.members.filter(m => m.isActive !== false);
        
        activeMembers.sort((a, b) => {
            return calculateBestThreeTotal(b.tournamentScores) - calculateBestThreeTotal(a.tournamentScores);
        });

        if (activeMembers.length === 0) {
            publicTbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-stone-500 italic text-sm">Geen actieve leden gevonden.</td></tr>`;
        } else {
            activeMembers.forEach((member, idx) => {
                const totaalBesteDrie = calculateBestThreeTotal(member.tournamentScores);
                const tScores = member.tournamentScores || [];
                const alleScoresStr = tScores.length > 0 
                    ? `(${[...tScores].reverse().join(', ')})` 
                    : '(Nog geen deelnames)';

                publicTbody.innerHTML += `
                    <tr class="hover:bg-stone-800/40 transition border-b border-stone-800/30">
                        <td class="p-4 text-center font-bold text-[#ecd292]">${idx + 1}</td>
                        <td class="p-4 font-bold text-white">
                            ${member.name} 
                            <span class="text-[10px] text-stone-500 font-normal block md:inline md:ml-2">${alleScoresStr}</span>
                        </td>
                        <td class="p-4 text-center text-emerald-400 font-black text-base">${totaalBesteDrie}</td>
                        <td class="p-4 text-center text-amber-400 font-mono font-bold">${member.highestBreak || 0}</td>
                    </tr>
                `;
            });
        }
    }

    // VEILIGHEID: Als we niet ingelogd zijn of de container is er niet, stop hier.
    if (!adminContainer || !state.isLoggedIn) return;

    adminContainer.innerHTML = '';
    const sortedMembers = [...state.members].sort((a,b) => a.name.localeCompare(b.name));

    if (sortedMembers.length === 0) {
        adminContainer.innerHTML = `<p class="text-stone-500 text-xs italic p-2">Er zijn nog geen leden. Voeg hier links een lid toe!</p>`;
        return;
    }

    sortedMembers.forEach((member) => {
        const origIdx = state.members.findIndex(m => m.name === member.name);
        const tScores = member.tournamentScores || [];
        const totaalBesteDrie = calculateBestThreeTotal(tScores);
        const geschiedenisTekst = tScores.length > 0 ? tScores.join(', ') : 'Geen';

        adminContainer.innerHTML += `
            <div class="bg-stone-900 border ${member.isActive !== false ? 'border-stone-800' : 'border-red-900/30 opacity-60'} p-3 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center text-xs text-white gap-3 mb-2">
                <div class="min-w-[120px] text-left">
                    <strong class="text-sm text-white block">${member.name}</strong>
                    <span class="text-[10px] text-stone-400 block mt-0.5">Historie: [${geschiedenisTekst}]</span>
                    <span class="text-[11px] text-[#ecd292] font-bold block mt-1">Totaal (Beste 3): ${totaalBesteDrie} pnt</span>
                </div>
                
                <div class="flex flex-wrap items-center gap-3 bg-stone-950 p-2 rounded-lg border border-stone-800 w-full md:w-auto">
                    <div class="flex items-center space-x-1">
                        <span class="text-stone-400 text-[10px]">Nieuwe Score:</span>
                        <input type="number" id="newScoreFor_${origIdx}" placeholder="Frames" class="w-14 bg-stone-900 border border-stone-700 rounded px-2 py-1 text-center text-emerald-400 font-bold focus:outline-none text-xs">
                        <button onclick="pushNewTournamentScore(${origIdx})" class="bg-emerald-700 hover:bg-emerald-600 px-2 py-1 rounded font-bold text-white cursor-pointer text-[11px]">Voeg toe</button>
                    </div>
                    
                    <div class="flex items-center space-x-1 border-l border-stone-800 pl-3">
                        <span class="text-stone-400 text-[10px]">H. Break:</span>
                        <input type="number" value="${member.highestBreak || 0}" onchange="updateHighestBreak(${origIdx}, this.value)" class="w-14 bg-stone-900 border border-stone-700 rounded px-1 py-0.5 text-center text-amber-400 font-mono font-bold focus:outline-none text-xs">
                    </div>
                    
                    <button onclick="clearLastScore(${origIdx})" class="text-red-400 hover:text-red-300 font-semibold text-[10px] border border-red-900/50 px-1.5 py-0.5 rounded bg-red-950/20 cursor-pointer ml-auto">
                        Reset Last
                    </button>
                </div>

                <div class="flex items-center space-x-2 ml-auto md:ml-0">
                    <button onclick="toggleMemberStatus(${origIdx})" class="text-[10px] font-bold px-2 py-1 rounded ${member.isActive !== false ? 'bg-stone-800 text-stone-300' : 'bg-red-950 text-red-400'} cursor-pointer">
                        ${member.isActive !== false ? 'Actief' : 'Inactief'}
                    </button>
                    <button onclick="deleteMember(${origIdx})" class="text-stone-500 hover:text-red-400 p-1 cursor-pointer">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
    });
}

// Nieuw lid registreren
function addNewMember() {
    const nameInput = document.getElementById('newMemberName');
    const activeInput = document.getElementById('newMemberActive');
    
    // Als het HTML-veld écht niet bestaat, geeft de browser nu deze duidelijke foutmelding:
    if (!nameInput) {
        return alert('Fout: Het invoerveld met id="newMemberName" ontbreekt in de HTML code!');
    }

    const name = nameInput.value.trim();
    if (!name) {
        return alert('Vul een naam in.');
    }

    if (!state.members || !Array.isArray(state.members)) {
        state.members = [];
    }
    
    const exists = state.members.some(m => m.name && m.name.toLowerCase() === name.toLowerCase());
    if (exists) return alert('Dit lid bestaat al!');

    state.members.push({
        name: name,
        isActive: activeInput ? activeInput.checked : true,
        tournamentScores: [],
        highestBreak: 0
    });

    nameInput.value = '';
    renderScores();
    saveDataToCloud();
    alert('Lid succesvol toegevoegd!');
}

// Voeg nieuwe score toe
function pushNewTournamentScore(idx) {
    if (!state.members[idx]) return;
    const input = document.getElementById(`newScoreFor_${idx}`);
    if (!input) return;

    const scoreValue = parseInt(input.value);
    if (isNaN(scoreValue) || scoreValue < 0) return alert('Vul een geldige score in.');

    if (!state.members[idx].tournamentScores) state.members[idx].tournamentScores = [];
    state.members[idx].tournamentScores.push(scoreValue);
    
    input.value = '';
    renderScores();
    saveDataToCloud();
}

// Laatste score herstellen
function clearLastScore(idx) {
    if (state.members[idx] && state.members[idx].tournamentScores && state.members[idx].tournamentScores.length > 0) {
        if(confirm(`Laatste score van ${state.members[idx].name} wissen?`)) {
            state.members[idx].tournamentScores.pop();
            renderScores();
            saveDataToCloud();
        }
    }
}

// Hoogste break aanpassen
function updateHighestBreak(idx, val) {
    const intVal = parseInt(val);
    if (state.members[idx] && !isNaN(intVal)) {
        state.members[idx].highestBreak = Math.max(0, intVal);
        renderScores();
        saveDataToCloud();
    }
}

// Status omdraaien
function toggleMemberStatus(idx) {
    if (state.members[idx]) {
        state.members[idx].isActive = (state.members[idx].isActive === false) ? true : false;
        renderScores();
        saveDataToCloud();
    }
}

// Lid deleten
function deleteMember(idx) {
    if (state.members[idx] && confirm(`Weet je zeker dat je ${state.members[idx].name} wilt verwijderen?`)) {
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

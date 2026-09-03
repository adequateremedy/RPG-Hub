/* js/hub.js */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { 
    getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence 
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, collection, query, orderBy, limit, getDocs, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAeyOzh9YHaQDMSvn-8-ZyVqXkwY_diL5Y",
    authDomain: "solus-dynasty-rpg.firebaseapp.com",
    projectId: "solus-dynasty-rpg",
    messagingSenderId: "136636530132",
    appId: "1:136636530132:web:6c77757f59f365be0c6a41",
    measurementId: "G-S6PXC09F52"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// Force localStorage instead of IndexedDB to prevent the Android "closing/hidden" crash
setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("Persistence error:", error);
});

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.appdata');
// provider.setCustomParameters({ prompt: 'consent' });

const DEFAULT_PORTRAIT = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='170' height='170' viewBox='0 0 170 170'%3E%3Crect width='170' height='170' fill='%231a1a1a'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23e3d2b9' font-family='sans-serif' font-size='14'%3ENo Image%3C/text%3E%3C/svg%3E";

// Global state
let CURRENT_HUB_VERSION = "1.0.0";
let SYSTEM_UPDATES = [];
let gDriveToken = localStorage.getItem("gDriveToken") || null;
let dataFileId = null;
let playerJsonData = {};

// Dynamic Routing Pointers
let activeStar = "1";
let activeGen = "1";

// --- GLOBAL BRIDGE API FOR MODULES ---
window.HubAPI = {
    getPlayerData: () => playerJsonData,
    getActiveStar: () => activeStar,
    getActiveGen: () => activeGen,
    showLoading,
    hideLoading,
    uploadImageToDrive,
    saveDriveAppData,
    triggerHubBuild: async (user) => await buildHubUI(user),
    getAuth: () => auth
};

// DOM Elements (Global / Tier 1 & 2 / Modals)
const loginScreen = document.getElementById("loginScreen");
const loadingScreen = document.getElementById("loadingScreen");
const loadingStatusText = document.getElementById("loadingStatusText");
const playerScreen = document.getElementById("playerScreen");
const errorMsg = document.getElementById("errorMessage");

const starNameDisplay = document.getElementById("star-name-display");
const editStarBtn = document.getElementById("edit-star-name-btn");
const editStarContainer = document.getElementById("edit-star-container");
const editStarInput = document.getElementById("edit-star-input");
const saveStarBtn = document.getElementById("save-star-btn");

const schoolModal = document.getElementById("schoolModal");
const closeSchoolBtn = document.getElementById("closeSchoolBtn");

const itemModal = document.getElementById("itemModal");
const closeItemModalBtn = document.getElementById("closeItemModalBtn");
const itemModalImg = document.getElementById("itemModalImg");

const lightboxModal = document.getElementById("lightboxModal");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxCloseBtn = document.getElementById("lightboxCloseBtn");

const memberCardModal = document.getElementById("memberCardModal");
const closeMemberCardBtn = document.getElementById("closeMemberCardBtn");

const elementsToUpdate = {
    "ui-lvl": "level",
    "ui-exp": "exp",
    "ui-bloodline": "bloodlineCourt",
    "ui-birthcourt": "birthCourt",
    "ui-essence": "essenceType",
    "ui-trigger": "trigger",
    "ui-off-name": "offensiveMagicName",
    "ui-off-dmg": "offensiveMagicDmg",
    "ui-def-name": "defensiveMagicName",
    "ui-def-hp": "defensiveMagicHp"
};

// --- DYNAMIC TEMPLATE LOADER ---
async function loadEraTemplate(eraId) {
    const container = document.getElementById('era-content-container');
    
    if (container.dataset.activeEra === eraId) return;

    showLoading(`Loading ${eraId} interface...`);
    
    try {
        const response = await fetch(`templates/${eraId}.html`);
        if (!response.ok) throw new Error(`Failed to load ${eraId} template.`);
        
        const html = await response.text();
        container.innerHTML = html;
        container.dataset.activeEra = eraId;
        
        bindEraEvents();
        
    } catch (error) {
        console.error(error);
        container.innerHTML = `<p style="text-align:center; color:#ffb0b0; margin-top: 40px;">Error loading interface.</p>`;
    }
    
    hideLoading();
}

function bindEraEvents() {
    // Normal Tab Navigation (ignoring the Character Card trigger)
    document.querySelectorAll('.tier-3 .tab-btn[data-target]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tier-3 .tab-btn[data-target]').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.hub-section').forEach(s => s.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');

            if (btn.dataset.target === "tab-members") {
                loadMembersLeaderboard();
            }
        });
    });

    // Character Card Modal Logic
    const openCharBtn = document.getElementById("open-character-modal-btn");
    const myCharModal = document.getElementById("myCharacterModal");
    const closeCharBtn = document.getElementById("closeMyCharacterBtn");

    if (openCharBtn) {
        openCharBtn.addEventListener("click", () => {
            if (myCharModal) myCharModal.classList.remove("hidden");
        });
    }
    
    if (closeCharBtn) {
        closeCharBtn.addEventListener("click", () => {
            if (myCharModal) myCharModal.classList.add("hidden");
        });
    }
    
    if (myCharModal) {
        myCharModal.addEventListener("click", (e) => {
            if (e.target === myCharModal) {
                myCharModal.classList.add("hidden");
            }
        });
    }

    const saveNameBtn = document.getElementById("save-name-btn");
    const editNameInput = document.getElementById("edit-name-input");
    const uiName = document.getElementById("ui-name");
    const editNameContainer = document.getElementById("edit-name-container");
    const gen1NameDisplay = document.getElementById("gen-1-name");

    if (saveNameBtn && editNameInput) {
        saveNameBtn.addEventListener("click", async () => {
            const val = editNameInput.value.trim();
            if (val) {
                showLoading("Saving...");
                playerJsonData.stars[activeStar].gens[activeGen].characterName = val;
                if (uiName) {
                    uiName.textContent = val;
                    uiName.classList.remove("hidden");
                }
                if (editNameContainer) editNameContainer.classList.add("hidden");
                if (gen1NameDisplay) gen1NameDisplay.textContent = `${val} - Steampunk`; 
                
                await saveDriveAppData();
                await buildHubUI(auth.currentUser);
                hideLoading();
            }
        });
    }

    const uploadBtn = document.getElementById("ui-portrait-upload-btn");
    const fileInput = document.getElementById("portrait-file-input");

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener("click", () => fileInput.click());

        fileInput.addEventListener("change", async (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                
                if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif') || (file.type && !file.type.startsWith('image/'))) {
                    alert("HEIC or unsupported format detected. Please select a standard JPG, PNG, or WebP image.");
                    fileInput.value = "";
                    return;
                }

                uploadBtn.textContent = "Processing...";
                uploadBtn.disabled = true;
                try {
                    const reader = new FileReader();

                    reader.onload = function(event) {
                        const img = new Image();
                        img.onload = async function() {
                            const canvas = document.createElement("canvas");
                            const ctx = canvas.getContext("2d");

                            const MAX_SIZE = 200;
                            let width = img.width;
                            let height = img.height;

                            if (width > height) {
                                if (width > MAX_SIZE) {
                                    height *= MAX_SIZE / width;
                                    width = MAX_SIZE;
                                }
                            } else {
                                if (height > MAX_SIZE) {
                                    width *= MAX_SIZE / height;
                                    height = MAX_SIZE;
                                }
                            }

                            canvas.width = width;
                            canvas.height = height;

                            ctx.drawImage(img, 0, 0, width, height);

                            const base64String = canvas.toDataURL("image/jpeg", 0.7);

                            playerJsonData.stars[activeStar].gens[activeGen].portraitUrl = base64String;
                            await saveDriveAppData(); 
                            
                            const portraitImg = document.getElementById("ui-portrait-img");
                            if (portraitImg) portraitImg.src = base64String;
                            
                            await buildHubUI(auth.currentUser);

                            uploadBtn.textContent = "Upload Image";
                            uploadBtn.disabled = false;
                        };
                        img.onerror = function() {
                            alert("Could not process this image format. Please convert to JPG or PNG.");
                            uploadBtn.textContent = "Upload Image";
                            uploadBtn.disabled = false;
                        };
                        img.src = event.target.result;
                    };
                    reader.onerror = function() {
                        alert("Failed to read file.");
                        uploadBtn.textContent = "Upload Image";
                        uploadBtn.disabled = false;
                    };
                    reader.readAsDataURL(file);
                } catch (err) {
                    console.error("Image processing failed", err);
                    alert("Failed to process and save image.");
                    uploadBtn.textContent = "Upload Image";
                    uploadBtn.disabled = false;
                }
            }
        });
    }
}

async function loadSystemUpdates() {
    try {
        const res = await fetch('https://api.github.com/repos/adequateremedy/RPG-Hub/contents/assets/images/updates');
        if (!res.ok) return;
        const files = await res.json();
        
        const validUpdates = [];
        const now = new Date();

        files.forEach(file => {
            const match = file.name.match(/^(\d{4}-\d{2}-\d{2})_(v[\d\.]+)\.(png|jpg|jpeg|gif)$/i);
            if (match) {
                const uDate = new Date(match[1] + 'T00:00:00');
                const diffDays = (now - uDate) / (1000 * 60 * 60 * 24);
                
                if (diffDays <= 14) {
                    validUpdates.push({
                        id: file.name, 
                        date: match[1],
                        version: match[2],
                        imageUrl: `assets/images/updates/${file.name}` 
                    });
                }
            }
        });

        validUpdates.sort((a, b) => {
            const dateDiff = new Date(b.date) - new Date(a.date);
            if (dateDiff !== 0) return dateDiff;
            return b.version.localeCompare(a.version, undefined, { numeric: true });
        });
        
        SYSTEM_UPDATES = validUpdates;
        
        if (SYSTEM_UPDATES.length > 0) {
            CURRENT_HUB_VERSION = SYSTEM_UPDATES[0].version;
        }
    } catch (err) {
        console.error("Failed to load updates from GitHub:", err);
    }
}

function getActiveUpdates() {
    return SYSTEM_UPDATES.filter(u => {
        if (playerJsonData.account && playerJsonData.account.dismissedUpdates && playerJsonData.account.dismissedUpdates.includes(u.id)) return false;
        return true;
    });
}

document.querySelectorAll('.tier-2 .tab-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', async () => {
        document.querySelectorAll('.tier-2 .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (btn.dataset.target === "gen-updates") {
            document.getElementById("gen-updates-content").classList.remove("hidden");
            document.getElementById("era-content-container").classList.add("hidden");
            
            let changed = false;
            if (!playerJsonData.account.seenUpdates) playerJsonData.account.seenUpdates = [];
            getActiveUpdates().forEach(u => {
                if (!playerJsonData.account.seenUpdates.includes(u.id)) {
                    playerJsonData.account.seenUpdates.push(u.id);
                    changed = true;
                }
            });
            
            if (changed) {
                updateBadge();
                saveDriveAppData(); 
            }
            
            renderUpdates();
        } else if (btn.dataset.target === "gen-1") {
            activeGen = "1";
            document.getElementById("gen-updates-content").classList.add("hidden");
            document.getElementById("era-content-container").classList.remove("hidden");
            
            await loadEraTemplate('steampunk');
            buildHubUI(auth.currentUser);
        }
    });
});

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove("hidden");
    loadingScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");
}

function showLoading(msg) {
    loadingScreen.classList.remove("hidden");
    loginScreen.classList.add("hidden");
    playerScreen.classList.add("hidden");
    loadingStatusText.textContent = msg || "Loading...";
}

function hideLoading() {
    loadingScreen.classList.add("hidden");
    playerScreen.classList.remove("hidden");
    loadingStatusText.textContent = "";
}

function updateBadge() {
    if (!playerJsonData.account || !playerJsonData.account.seenUpdates) return;
    const active = getActiveUpdates();
    const unseen = active.filter(u => !playerJsonData.account.seenUpdates.includes(u.id));
    const badge = document.getElementById("updates-badge");
    if (unseen.length > 0) {
        badge.textContent = unseen.length;
        badge.classList.remove("hidden");
    } else {
        badge.classList.add("hidden");
    }
}

function renderUpdates() {
    const container = document.getElementById("updatesContainer");
    const deleteBtn = document.getElementById("delete-updates-btn");
    const versionDisplay = document.getElementById("hub-version-display");
    container.innerHTML = "";
    versionDisplay.textContent = `Current Hub Version: ${CURRENT_HUB_VERSION}`;

    const activeUpdates = getActiveUpdates();

    if (activeUpdates.length === 0) {
        deleteBtn.style.display = "none";
        container.innerHTML = `<p style="text-align:center; opacity:0.7; margin-top:40px;">You are all caught up! There are no new updates.</p>`;
        return;
    }

    deleteBtn.style.display = "inline-block";

    activeUpdates.forEach(update => {
        const div = document.createElement("div");
        div.className = "update-card";
        div.style.padding = "15px";
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <label style="display:flex; align-items:center; gap: 10px; cursor:pointer; color:#e3d2b9; font-weight:bold;">
                    <input type="checkbox" class="update-checkbox" value="${update.id}">
                    Select to Delete
                </label>
                <div class="update-date" style="position:static;">${update.date}</div>
            </div>
            <img src="${update.imageUrl}" alt="System Update" style="width:100%; border-radius:6px; border: 1px solid #333; display:block;">
        `;
        container.appendChild(div);
    });
}

const deleteUpdatesBtn = document.getElementById("delete-updates-btn");
if (deleteUpdatesBtn) {
    deleteUpdatesBtn.addEventListener("click", async () => {
        const checkboxes = document.querySelectorAll('.update-checkbox:checked');
        if (checkboxes.length === 0) {
            alert("Please select at least one update to delete.");
            return;
        }
        
        const confirmDelete = confirm("Are you sure you want to delete the selected updates? This cannot be undone.");
        if (confirmDelete) {
            showLoading("Deleting updates...");
            if (!playerJsonData.account.dismissedUpdates) playerJsonData.account.dismissedUpdates = [];
            checkboxes.forEach(cb => {
                playerJsonData.account.dismissedUpdates.push(cb.value);
            });
            await saveDriveAppData();
            renderUpdates();
            updateBadge();
            hideLoading();
        }
    });
}

async function syncProfileToFirestore(user) {
    if (!user || !playerJsonData.stars || !playerJsonData.stars[activeStar] || !playerJsonData.stars[activeStar].gens[activeGen]) return;
    
    const activeChar = playerJsonData.stars[activeStar].gens[activeGen];
    const starName = playerJsonData.stars[activeStar].starName || "";
    const charName = activeChar.characterName || "Unborn";
    const fullName = starName ? `${charName} ${starName}` : charName;
    
    const memberData = {
        googleUid: user.uid,
        email: user.email,
        displayName: user.displayName || "",
        characterName: charName,
        starName: starName,
        fullName: fullName,
        level: activeChar.level || 1,
        exp: activeChar.exp || 0,
        era: activeChar.era || "Steampunk",
        portraitUrl: activeChar.portraitUrl || "", 
        bloodlineCourt: activeChar.bloodlineCourt || "---",
        birthCourt: activeChar.birthCourt || "---",
        essenceType: activeChar.essenceType || "---",
        trigger: activeChar.trigger || "---",
        offensiveMagicName: activeChar.offensiveMagicName || "---",
        offensiveMagicDmg: activeChar.offensiveMagicDmg || "---",
        defensiveMagicName: activeChar.defensiveMagicName || "---",
        defensiveMagicHp: activeChar.defensiveMagicHp || "---",
        updatedAt: serverTimestamp()
    };
    
    try {
        await setDoc(doc(db, "players", user.uid), memberData, { merge: true });
    } catch (err) {
        console.error("Firestore sync error:", err);
    }
}

async function loadMembersLeaderboard() {
    const membersTableBody = document.getElementById("membersTableBody");
    if (!membersTableBody) return;
    
    membersTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; opacity:0.6;">Loading members...</td></tr>`;
    try {
        const q = query(collection(db, "players"), orderBy("exp", "desc"), limit(50));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            membersTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; opacity:0.6;">No members found.</td></tr>`;
            return;
        }
        
        membersTableBody.innerHTML = "";
        let rank = 1;
        
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const name = data.fullName || (data.characterName ? `${data.characterName} ${data.starName || ''}`.trim() : "Unborn");
            const lvl = data.level !== undefined ? data.level : 1;
            const exp = data.exp !== undefined ? data.exp : 0;
            const era = data.era || "Steampunk";
            
            const tr = document.createElement("tr");
            tr.className = "clickable-member-row";
            tr.innerHTML = `
                <td style="text-align: center;">${rank++}</td>
                <td><a href="#" class="member-name-link">${name}</a></td>
                <td style="text-align: center;">${lvl}</td>
                <td style="text-align: center;">${exp}</td>
                <td style="text-align: center;">${era}</td>
            `;
            
            tr.querySelector('.member-name-link').addEventListener("click", (e) => {
                e.preventDefault();
                showMemberCard(data, name);
            });
            
            membersTableBody.appendChild(tr);
        });
    } catch (err) {
        console.error("Failed to load members:", err);
        membersTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ffb0b0; padding:20px;">Failed to load leaderboard.</td></tr>`;
    }
}

function showMemberCard(data, displayName) {
    document.getElementById("member-name").textContent = displayName;
    document.getElementById("member-lvl").textContent = data.level || 1;
    document.getElementById("member-exp").textContent = data.exp || 0;
    
    document.getElementById("member-bloodline").textContent = data.bloodlineCourt || "---";
    document.getElementById("member-birthcourt").textContent = data.birthCourt || "---";
    document.getElementById("member-essence").textContent = data.essenceType || "---";
    document.getElementById("member-trigger").textContent = data.trigger || "---";
    document.getElementById("member-off-name").textContent = data.offensiveMagicName || "---";
    document.getElementById("member-off-dmg").textContent = data.offensiveMagicDmg || "---";
    document.getElementById("member-def-name").textContent = data.defensiveMagicName || "---";
    document.getElementById("member-def-hp").textContent = data.defensiveMagicHp || "---";

    const portraitImg = document.getElementById("member-portrait-img");
    if (data.portraitUrl) {
        portraitImg.src = data.portraitUrl;
    } else {
        portraitImg.src = DEFAULT_PORTRAIT;
    }

    memberCardModal.classList.remove("hidden");
}

async function getDriveAppData() {
    const res = await fetch("https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='character_data.json'", {
        headers: { 'Authorization': `Bearer ${gDriveToken}` }
    });
    const data = await res.json();
    
    if (data.error) {
        console.error("Drive API Error:", data.error);
        throw new Error(data.error.message); 
    }
    
    if (data.files && data.files.length > 0) {
        dataFileId = data.files[0].id;
        const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${dataFileId}?alt=media`, {
            headers: { 'Authorization': `Bearer ${gDriveToken}` }
        });
        let rawData = await fileRes.json();

        if (!rawData.stars) {
            console.log("Old data format detected. Migrating to Generational System...");
            
            playerJsonData = {
                account: {
                    unlockedStars: 1,
                    dismissedUpdates: rawData.dismissedUpdates || [],
                    seenUpdates: rawData.seenUpdates || []
                },
                stars: {
                    "1": {
                        starName: rawData.starName || "",
                        isComplete: false,
                        gens: {
                            "1": {
                                era: "Steampunk",
                                realm: "Midgard",
                                characterName: rawData.characterName || "",
                                portraitUrl: rawData.portraitUrl || "",
                                portraitId: rawData.portraitId || "",
                                level: rawData.level || 1,
                                exp: rawData.exp || 0,
                                bloodlineCourt: rawData.bloodlineCourt || "",
                                birthCourt: rawData.birthCourt || "",
                                essenceType: rawData.essenceType || "",
                                trigger: rawData.trigger || "",
                                offensiveMagicName: rawData.offensiveMagicName || "",
                                offensiveMagicDmg: rawData.offensiveMagicDmg || "",
                                defensiveMagicName: rawData.defensiveMagicName || "",
                                defensiveMagicHp: rawData.defensiveMagicHp || "",
                                birthBookCompleted: rawData.birthBookCompleted || false,
                                birthBookExpAwarded: rawData.birthBookExpAwarded || false,
                                schoolProgress: rawData.schoolProgress || { class1: false, class2: false, class3: false, class4: false, class5: false },
                                journalEntries: rawData.journalEntries || [],
                                rpSessions: rawData.rpSessions || [],
                                inventory: rawData.inventory || [],
                                class1Points: rawData.class1Points || 0,
                                class1Round: rawData.class1Round || 1,
                                class1Exp: rawData.class1Exp || 0,
                                class1RegularStars: rawData.class1RegularStars || 0,
                                class1BigStars: rawData.class1BigStars || 0,
                                class1GiantStars: rawData.class1GiantStars || 0,
                                class1TotalRunes: rawData.class1TotalRunes || {},
                                versions: rawData.versions || { runicFally: 2 }
                            },
                            "2": { unlocked: false },
                            "3": { unlocked: false },
                            "4": { unlocked: false },
                            "5": { unlocked: false },
                            "zenith": { unlocked: false }
                        }
                    },
                    "2": { unlocked: false },
                    "3": { unlocked: false },
                    "4": { unlocked: false },
                    "5": { unlocked: false }
                }
            };
            
            await saveDriveAppData();
            console.log("Migration complete and saved to Google Drive.");
        } else {
            playerJsonData = rawData;
        }

    } else {
        playerJsonData = {
            account: { unlockedStars: 1, dismissedUpdates: [], seenUpdates: [] },
            stars: {
                "1": {
                    starName: "",
                    isComplete: false,
                    gens: {
                        "1": {
                            era: "Steampunk", realm: "Midgard", characterName: "", portraitUrl: "", portraitId: "",
                            level: 1, exp: 0, birthBookCompleted: false, birthBookExpAwarded: false,
                            schoolProgress: { class1: false, class2: false, class3: false, class4: false, class5: false },
                            journalEntries: [], rpSessions: [], inventory: [], versions: { runicFally: 2 }
                        },
                        "2": { unlocked: false }, "3": { unlocked: false }, "4": { unlocked: false }, "5": { unlocked: false }, "zenith": { unlocked: false }
                    }
                },
                "2": { unlocked: false }, "3": { unlocked: false }, "4": { unlocked: false }, "5": { unlocked: false }
            }
        };
        await saveDriveAppData();
    }
}

async function saveDriveAppData() {
    if (dataFileId) {
        const url = `https://www.googleapis.com/upload/drive/v3/files/${dataFileId}?uploadType=media`;
        const res = await fetch(url, {
            method: 'PATCH',
            headers: { 
                'Authorization': `Bearer ${gDriveToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(playerJsonData)
        });
        if (!res.ok) {
            console.error("Failed to update save file on Google Drive.");
        }
    } else {
        const metadata = {
            name: 'character_data.json',
            parents: ['appDataFolder'],
            mimeType: 'application/json'
        };
        const fileContent = JSON.stringify(playerJsonData);
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([fileContent], { type: 'application/json' }));

        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${gDriveToken}` },
            body: form
        });
        const result = await res.json();
        if (result.id) {
            dataFileId = result.id;
        }
    }

    if (auth.currentUser) {
        await syncProfileToFirestore(auth.currentUser);
    }
}

async function uploadImageToDrive(file) {
    const metadata = {
        name: file.name,
        parents: ['appDataFolder']
    };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${gDriveToken}` },
        body: form
    });
    const result = await res.json();
    return result.id;
}

async function getImageUrl(fileId) {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { 'Authorization': `Bearer ${gDriveToken}` }
    });
    const blob = await res.blob();
    return URL.createObjectURL(blob);
}

function calculateLevel() {
    const activeChar = playerJsonData.stars[activeStar].gens[activeGen];
    let lvl = 1; 
    if (activeChar.comingOfAgeCompleted) lvl = 2;
    if (activeChar.traumaCompleted) lvl = 3;
    if (activeChar.escapeCompleted) lvl = 4;
    activeChar.level = lvl;
}

async function renderInventory() {
    const activeChar = playerJsonData.stars[activeStar].gens[activeGen];
    const inventoryGrid = document.getElementById("inventoryGrid");
    if (!inventoryGrid) return;
    
    const items = activeChar.inventory || [];
    
    if (items.length === 0) {
        inventoryGrid.innerHTML = `<p style="text-align:center; opacity:0.7; grid-column: 1 / -1;">Your inventory is empty.</p>`;
        return;
    }

    inventoryGrid.innerHTML = "";
    
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const div = document.createElement("div");
        div.className = "inventory-item";
        
        let imgUrl = "";
        let glowImgUrl = "";
        
        try {
            if (item.imageId) {
                imgUrl = await getImageUrl(item.imageId);
            } else if (item.image) {
                imgUrl = item.image;
            }
            
            if (item.glowImageId) {
                glowImgUrl = await getImageUrl(item.glowImageId);
            }
        } catch(e) {
            console.error("Failed to load inventory image", e);
        }

        div.innerHTML = `
            <img src="${imgUrl}" alt="${item.name}">
            <span>${item.name}</span>
        `;
        
        div.addEventListener("click", () => {
            document.getElementById("itemModalName").textContent = item.name;
            document.getElementById("itemModalCategory").textContent = item.category || "Item";
            
            itemModalImg.src = imgUrl;
            itemModalImg.dataset.normalSrc = imgUrl;
            itemModalImg.dataset.glowSrc = glowImgUrl; 
            
            document.getElementById("itemModalDesc").textContent = item.desc || "Item description goes here.";
            document.getElementById("itemModal").classList.remove("hidden");
        });
        
        inventoryGrid.appendChild(div);
    }
}

async function renderJournalAndGallery() {
    const activeChar = playerJsonData.stars[activeStar].gens[activeGen];
    const journalContainer = document.getElementById("journalEntriesContainer");
    const galleryListContainer = document.getElementById("galleryListContainer");
    
    if (!journalContainer || !galleryListContainer) return;
    
    const jEntries = activeChar.journalEntries || [];
    const rpEntries = activeChar.rpSessions || [];
    galleryListContainer.innerHTML = "";

    if (activeChar.birthCourt) {
        const bbImageUrl = `https://adequateremedy.github.io/BirthBook/assets/${activeChar.birthCourt}-Result.png`;
        const li = document.createElement("li");
        li.className = "gallery-item";
        li.textContent = `Birth Book - ${activeChar.birthCourt} Court`;
        li.addEventListener("click", () => {
            lightboxImg.src = bbImageUrl;
            lightboxModal.classList.remove("hidden");
        });
        galleryListContainer.appendChild(li);
    }

    let hasImages = !!activeChar.birthCourt;
    
    for (let i = 0; i < jEntries.length; i++) {
        const entry = jEntries[i];
        if (entry.images && entry.images.length > 0) {
            hasImages = true;
            entry.images.forEach(async (fileId, imgIndex) => {
                const labelName = `Solo Journal (${entry.date}) — Image ${imgIndex + 1}`;
                const li = document.createElement("li");
                li.className = "gallery-item";
                li.textContent = labelName;
                try {
                    const url = await getImageUrl(fileId);
                    li.addEventListener("click", () => {
                        lightboxImg.src = url;
                        lightboxModal.classList.remove("hidden");
                    });
                } catch (e) { console.error(e); }
                galleryListContainer.appendChild(li);
            });
        }
    }

    for (let i = 0; i < rpEntries.length; i++) {
        const entry = rpEntries[i];
        if (entry.images && entry.images.length > 0) {
            hasImages = true;
            entry.images.forEach(async (fileId, imgIndex) => {
                const labelName = `Live RP Session (${entry.date}) — Image ${imgIndex + 1}`;
                const li = document.createElement("li");
                li.className = "gallery-item";
                li.textContent = labelName;
                try {
                    const url = await getImageUrl(fileId);
                    li.addEventListener("click", () => {
                        lightboxImg.src = url;
                        lightboxModal.classList.remove("hidden");
                    });
                } catch (e) { console.error(e); }
                galleryListContainer.appendChild(li);
            });
        }
    }

    if (!hasImages) {
        galleryListContainer.innerHTML = `<p style="text-align:center; opacity:0.7;">No gallery images found.</p>`;
    }

    if (jEntries.length === 0) {
        journalContainer.innerHTML = `<p style="text-align:center; opacity:0.7;">No journal entries yet.</p>`;
        return;
    }

    journalContainer.innerHTML = "";
    for (let i = jEntries.length - 1; i >= 0; i--) {
        const entry = jEntries[i];
        const div = document.createElement("div");
        div.className = "journal-entry";
        div.innerHTML = `
            <div class="journal-entry-header">
                <span>Solo Journal (Age ${entry.ageGroup || "2-3"})</span>
                <span>${entry.date}</span>
            </div>
            <div class="journal-entry-text">${entry.text}</div>
        `;
        journalContainer.appendChild(div);
    }
}

async function buildHubUI(user) {
    document.getElementById("headerPlayerEmail").textContent = user.email;

    calculateLevel();
    updateBadge(); 

    const activeChar = playerJsonData.stars[activeStar].gens[activeGen];
    const starName = playerJsonData.stars[activeStar].starName;

    if (starName) {
        starNameDisplay.textContent = starName;
        editStarBtn.classList.add("hidden");
        editStarContainer.classList.add("hidden");
    } else {
        starNameDisplay.textContent = "Star 1";
        editStarBtn.classList.remove("hidden");
    }

    const gen1NameDisplay = document.getElementById("gen-1-name");
    if (gen1NameDisplay) {
        gen1NameDisplay.textContent = activeChar.characterName ? `${activeChar.characterName} - Steampunk` : "Gen 1 - Steampunk";
    }

    for (const [elementId, dataKey] of Object.entries(elementsToUpdate)) {
        const el = document.getElementById(elementId);
        if (!el) continue; 
        const val = activeChar[dataKey];
        if (val !== undefined && val !== "" && val !== null) {
            el.textContent = val;
            el.classList.remove("not-configured");
        } else {
            if (elementId === "ui-exp") {
                el.textContent = "0";
            } else if (elementId === "ui-lvl") {
                el.textContent = "1";
            } else {
                el.textContent = "---";
                el.classList.add("not-configured");
            }
        }
    }

    const portraitImg = document.getElementById("ui-portrait-img");
    if (portraitImg) {
        if (activeChar.portraitUrl) {
            portraitImg.src = activeChar.portraitUrl;
        } else if (activeChar.portraitId) {
            try {
                const imgUrl = await getImageUrl(activeChar.portraitId);
                portraitImg.src = imgUrl;
            } catch (err) {
                console.warn("Failed to load portrait image.", err);
                portraitImg.src = DEFAULT_PORTRAIT;
            }
        } else {
            portraitImg.src = DEFAULT_PORTRAIT;
        }
    }

    const uploadBtn = document.getElementById("ui-portrait-upload-btn");
    const uiName = document.getElementById("ui-name");
    const editNameContainer = document.getElementById("edit-name-container");

    if (activeChar.birthBookCompleted) {
        if (uploadBtn) uploadBtn.classList.remove("hidden"); 

        if (!activeChar.characterName) {
            if (uiName) { uiName.textContent = "Unborn"; uiName.classList.add("hidden"); }
            if (editNameContainer) editNameContainer.classList.remove("hidden");
        } else {
            if (uiName) { uiName.textContent = activeChar.characterName; uiName.classList.remove("hidden"); }
            if (editNameContainer) editNameContainer.classList.add("hidden");
        }
    } else {
        if (uploadBtn) uploadBtn.classList.add("hidden"); 
        if (uiName) { uiName.textContent = "Unborn"; uiName.classList.remove("hidden"); }
        if (editNameContainer) editNameContainer.classList.add("hidden");
    }
    
    renderInventory();
    renderJournalAndGallery();

    const actionsContainer = document.getElementById("actionsContainer");
    if (actionsContainer) {
        actionsContainer.innerHTML = "";
        
        const isBirthBookComplete = activeChar.birthBookCompleted;
        const hasCharacterName = !!activeChar.characterName;
        const hasStarName = !!starName;
        const hasPortrait = !!activeChar.portraitUrl || !!activeChar.portraitId;
        const isFullySetup = isBirthBookComplete && hasCharacterName && hasStarName && hasPortrait;
        
        if (!isBirthBookComplete) {
            let instructions = `
                <div style="text-align: center; max-width: 600px; margin: 10px auto;">
                    <p style="opacity:0.9; margin-bottom: 25px; line-height: 1.6;">
                        Welcome to the Solus Dynasty Universe. 
                        <br><br>
                        <strong>1. Name your Star:</strong> Use the pencil icon next to "Star 1" above. The name of your Star serves as the permanent last name for all 5 characters in this lineage and cannot be changed once set.
                        <br><br>
                        <strong>2. Complete the Birth Book:</strong> Begin the pre-birth sensory choice system to establish your character's baseline stats.
                    </p>
                    <button onclick="window.location.href='https://adequateremedy.github.io/BirthBook/'" style="border-color: #7F522B; color: #e3d2b9; padding: 12px 25px; font-weight: bold; font-size: 1.1rem;">Begin Birth Book</button>
                </div>
            `;
            actionsContainer.innerHTML = instructions;
        } else if (!isFullySetup) {
            let charCheck = hasCharacterName ? "✅" : "❌";
            let starCheck = hasStarName ? "✅" : "❌";
            let portCheck = hasPortrait ? "✅" : "❌";

            actionsContainer.innerHTML = `
                <div style="text-align: center; max-width: 500px; margin: 20px auto;">
                    <p style="opacity:0.9; line-height: 1.6; color: #e3d2b9;">
                        Your baseline stats have been established, but you are not yet fully Born into the world.<br><br>
                        To unlock School and Journal experiences, please ensure you have completed the following:
                    </p>
                    <ul style="list-style: none; padding: 0; text-align: left; max-width: 350px; margin: 20px auto; line-height: 2; opacity:0.9;">
                        <li>${starCheck} Name your Star (Top bar)</li>
                        <li>${charCheck} Name your Character (Character Card tab)</li>
                        <li>${portCheck} Upload a Character Portrait (Character Card tab)</li>
                    </ul>
                </div>
            `;
        } else {
            if (activeChar.era === "Steampunk") {
                const steampunk = await import('./steampunk.js');
                steampunk.renderAvailableActions(actionsContainer, activeChar);
            }
        }
    }
}

async function handleUserReady(user) {
    showLoading("Syncing profile data...");
    await loadSystemUpdates(); 
    await getDriveAppData();
    
    await loadEraTemplate('steampunk');

    const activeChar = playerJsonData.stars[activeStar].gens[activeGen];
    const urlParams = new URLSearchParams(window.location.search);
    const urlBirthCourt = urlParams.get('birthCourt');
    const urlBloodlineCourt = urlParams.get('bloodlineCourt');
    const class1Complete = urlParams.get('class1Complete');
    const class2Complete = urlParams.get('class2Complete');
    let dataChanged = false;

    if (urlBirthCourt && urlBloodlineCourt && !activeChar.birthCourt) {
        activeChar.birthCourt = urlBirthCourt;
        activeChar.bloodlineCourt = urlBloodlineCourt;
        activeChar.birthBookCompleted = true;
        dataChanged = true;
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (class1Complete === "true" && activeChar.schoolProgress && !activeChar.schoolProgress.class1) {
        activeChar.schoolProgress.class1 = true;
        activeChar.exp = (activeChar.exp || 0) + 100;
        dataChanged = true;
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (class2Complete === "true" && activeChar.schoolProgress && !activeChar.schoolProgress.class2) {
        activeChar.schoolProgress.class2 = true;
        activeChar.exp = (activeChar.exp || 0) + 100;
        dataChanged = true;
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (activeChar.birthBookCompleted && (activeChar.exp || 0) < 50) {
        activeChar.exp = 50;
        activeChar.birthBookExpAwarded = true; 
        dataChanged = true;
    }

    if (dataChanged) {
        await saveDriveAppData();
    } else {
        await syncProfileToFirestore(user);
    }

    await buildHubUI(user);
    hideLoading();
}

// --- EVENT LISTENERS ---

onAuthStateChanged(auth, async (user) => {
    if (user && gDriveToken) {
        loginScreen.classList.add("hidden");
        try {
            await handleUserReady(user);
        } catch (error) {
            console.error("Auto-login failed:", error);
            localStorage.removeItem("gDriveToken");
            gDriveToken = null;
            showError("Session expired or Drive connection failed. Please sign in again.");
        }
    }
});

const googleSignInButton = document.getElementById("googleSignInButton");
if (googleSignInButton) {
    googleSignInButton.addEventListener("click", async () => {
        loginScreen.classList.add("hidden");
        showLoading("Signing in...");

        try {
            await setPersistence(auth, browserLocalPersistence);
            const result = await signInWithPopup(auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (credential && credential.accessToken) {
                gDriveToken = credential.accessToken;
                localStorage.setItem("gDriveToken", gDriveToken);
            }
            await handleUserReady(result.user);
        } catch (error) {
            console.error(error);
            showError("Sign-in or Drive connection failed.\n" + error.message);
        }
    });
}

const signOutButton = document.getElementById("signOutButton");
if (signOutButton) {
    signOutButton.addEventListener("click", async () => {
        await signOut(auth);
        localStorage.removeItem("gDriveToken");
        gDriveToken = null;
        playerScreen.classList.add("hidden");
        loginScreen.classList.remove("hidden");
    });
}

if (editStarBtn) {
    editStarBtn.addEventListener("click", () => {
        if (editStarContainer) editStarContainer.classList.toggle("hidden");
        if (editStarInput) editStarInput.value = playerJsonData.stars[activeStar].starName || "";
    });
}

if (saveStarBtn) {
    saveStarBtn.addEventListener("click", async () => {
        if (!editStarInput) return;
        const val = editStarInput.value.trim();
        if (val) {
            showLoading("Saving...");
            playerJsonData.stars[activeStar].starName = val;
            if (starNameDisplay) starNameDisplay.textContent = val;
            if (editStarContainer) editStarContainer.classList.add("hidden");
            if (editStarBtn) editStarBtn.classList.add("hidden");
            await saveDriveAppData();
            await buildHubUI(auth.currentUser);
            hideLoading();
        }
    });
}

if (closeSchoolBtn) {
    closeSchoolBtn.addEventListener("click", () => {
        if (schoolModal) schoolModal.classList.add("hidden");
    });
}

const closeJournalBtn = document.getElementById("closeJournalBtn");
if (closeJournalBtn) {
    closeJournalBtn.addEventListener("click", () => {
        const journalModal = document.getElementById("journalModal");
        if (journalModal) journalModal.classList.add("hidden");
    });
}

const closeRpBtn = document.getElementById("closeRpBtn");
if (closeRpBtn) {
    closeRpBtn.addEventListener("click", () => {
        const rpModal = document.getElementById("rpModal");
        if (rpModal) rpModal.classList.add("hidden");
    });
}

if (closeItemModalBtn) {
    closeItemModalBtn.addEventListener("click", () => {
        if (itemModal) itemModal.classList.add("hidden");
    });
}

if (closeMemberCardBtn) {
    closeMemberCardBtn.addEventListener("click", () => {
        if (memberCardModal) memberCardModal.classList.add("hidden");
    });
}

if (lightboxCloseBtn) {
    lightboxCloseBtn.addEventListener("click", () => {
        if (lightboxModal) lightboxModal.classList.add("hidden");
    });
}

if (lightboxModal) {
    lightboxModal.addEventListener("click", (e) => {
        if (e.target === lightboxModal) {
            lightboxModal.classList.add("hidden");
        }
    });
}

if (itemModal) {
    itemModal.addEventListener("click", (e) => {
        if (e.target === itemModal) {
            itemModal.classList.add("hidden");
        }
    });
}

if (memberCardModal) {
    memberCardModal.addEventListener("click", (e) => {
        if (e.target === memberCardModal) {
            memberCardModal.classList.add("hidden");
        }
    });
}

const journalModal = document.getElementById("journalModal");
if (journalModal) {
    journalModal.addEventListener("click", (e) => {
        if (e.target === journalModal) {
            journalModal.classList.add("hidden");
        }
    });
}

const rpModal = document.getElementById("rpModal");
if (rpModal) {
    rpModal.addEventListener("click", (e) => {
        if (e.target === rpModal) {
            rpModal.classList.add("hidden");
        }
    });
}

if (itemModalImg) {
    itemModalImg.addEventListener("mouseenter", () => {
        if (itemModalImg.dataset.glowSrc) {
            itemModalImg.src = itemModalImg.dataset.glowSrc;
            itemModalImg.style.cursor = "pointer";
        }
    });

    itemModalImg.addEventListener("mouseleave", () => {
        if (itemModalImg.dataset.normalSrc) {
            itemModalImg.src = itemModalImg.dataset.normalSrc;
            itemModalImg.style.cursor = "default";
        }
    });
}

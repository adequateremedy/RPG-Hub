import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { 
    getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged 
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.appdata');
provider.setCustomParameters({ prompt: 'consent' });

// Global state
let CURRENT_HUB_VERSION = "1.0.0";
let SYSTEM_UPDATES = [];
let gDriveToken = localStorage.getItem("gDriveToken") || null;
let dataFileId = null;
let playerJsonData = {};
let queuedJournalImages = [];
let queuedRpImages = [];

// DOM Elements
const loginScreen = document.getElementById("loginScreen");
const loadingScreen = document.getElementById("loadingScreen");
const loadingStatusText = document.getElementById("loadingStatusText");
const playerScreen = document.getElementById("playerScreen");
const errorMsg = document.getElementById("errorMessage");

const uiName = document.getElementById("ui-name");
const editNameContainer = document.getElementById("edit-name-container");
const editNameInput = document.getElementById("edit-name-input");
const saveNameBtn = document.getElementById("save-name-btn");

const starNameDisplay = document.getElementById("star-name-display");
const gen1NameDisplay = document.getElementById("gen-1-name");
const editStarBtn = document.getElementById("edit-star-name-btn");
const editStarContainer = document.getElementById("edit-star-container");
const editStarInput = document.getElementById("edit-star-input");
const saveStarBtn = document.getElementById("save-star-btn");
const uploadBtn = document.getElementById("ui-portrait-upload-btn");

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

// --- GITHUB API FOLDER SCANNER ---
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

        // Sort by Date Descending, then Version Descending
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

// --- UPDATES AUTO-EXPIRE FILTER ---
function getActiveUpdates() {
    return SYSTEM_UPDATES.filter(u => {
        if (playerJsonData.dismissedUpdates && playerJsonData.dismissedUpdates.includes(u.id)) return false;
        return true;
    });
}

// Tier 2 Tabs logic 
document.querySelectorAll('.tier-2 .tab-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tier-2 .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (btn.dataset.target === "gen-updates") {
            document.getElementById("gen-updates-content").classList.remove("hidden");
            document.getElementById("gen-1-content").classList.add("hidden");
            
            let changed = false;
            getActiveUpdates().forEach(u => {
                if (!playerJsonData.seenUpdates.includes(u.id)) {
                    playerJsonData.seenUpdates.push(u.id);
                    changed = true;
                }
            });
            
            if (changed) {
                updateBadge();
                saveDriveAppData(); 
            }
            
            renderUpdates();
        } else if (btn.dataset.target === "gen-1") {
            document.getElementById("gen-updates-content").classList.add("hidden");
            document.getElementById("gen-1-content").classList.remove("hidden");
        }
    });
});

// Tier 3 Tabs logic 
document.querySelectorAll('.tier-3 .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tier-3 .tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.hub-section').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');

        if (btn.dataset.target === "tab-members") {
            loadMembersLeaderboard();
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
    const active = getActiveUpdates();
    const unseen = active.filter(u => !playerJsonData.seenUpdates.includes(u.id));
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

document.getElementById("delete-updates-btn").addEventListener("click", async () => {
    const checkboxes = document.querySelectorAll('.update-checkbox:checked');
    if (checkboxes.length === 0) {
        alert("Please select at least one update to delete.");
        return;
    }
    
    const confirmDelete = confirm("Are you sure you want to delete the selected updates? This cannot be undone.");
    if (confirmDelete) {
        showLoading("Deleting updates...");
        checkboxes.forEach(cb => {
            playerJsonData.dismissedUpdates.push(cb.value);
        });
        await saveDriveAppData();
        renderUpdates();
        updateBadge();
        hideLoading();
    }
});

async function syncProfileToFirestore(user) {
    if (!user) return;
    const charName = playerJsonData.characterName || "Unborn";
    const sName = playerJsonData.starName || "";
    const fullName = sName ? `${charName} ${sName}` : charName;
    
    const memberData = {
        googleUid: user.uid,
        email: user.email,
        displayName: user.displayName || "",
        characterName: charName,
        starName: sName,
        fullName: fullName,
        level: playerJsonData.level || 1,
        exp: playerJsonData.exp || 0,
        era: "Gen 1 - Steampunk",
        portraitUrl: playerJsonData.portraitUrl || "", 
        bloodlineCourt: playerJsonData.bloodlineCourt || "---",
        birthCourt: playerJsonData.birthCourt || "---",
        essenceType: playerJsonData.essenceType || "---",
        trigger: playerJsonData.trigger || "---",
        offensiveMagicName: playerJsonData.offensiveMagicName || "---",
        offensiveMagicDmg: playerJsonData.offensiveMagicDmg || "---",
        defensiveMagicName: playerJsonData.defensiveMagicName || "---",
        defensiveMagicHp: playerJsonData.defensiveMagicHp || "---",
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
            const era = data.era || "Gen 1 - Steampunk";
            
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
        portraitImg.src = "https://via.placeholder.com/170x170/1a1a1a/e3d2b9?text=No+Image";
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
        playerJsonData = await fileRes.json();
        
        if (playerJsonData.birthBookExpAwarded === undefined) {
            playerJsonData.birthBookExpAwarded = playerJsonData.birthBookCompleted;
        }
        if (playerJsonData.schoolProgress === undefined) {
            playerJsonData.schoolProgress = { class1: false, class2: false, class3: false, class4: false, class5: false };
        }
        if (playerJsonData.journalEntries === undefined) {
            playerJsonData.journalEntries = [];
        }
        if (playerJsonData.rpSessions === undefined) {
            playerJsonData.rpSessions = [];
        }
        if (playerJsonData.inventory === undefined) {
            playerJsonData.inventory = [];
        }
        if (playerJsonData.dismissedUpdates === undefined) {
            playerJsonData.dismissedUpdates = [];
        }
        if (playerJsonData.seenUpdates === undefined) {
            playerJsonData.seenUpdates = [];
        }

        if (!playerJsonData.versions) playerJsonData.versions = {};
        const CURRENT_RUNIC_VERSION = 2;

        if (playerJsonData.versions.runicFally !== CURRENT_RUNIC_VERSION) {
            if (playerJsonData.schoolProgress && playerJsonData.schoolProgress.class1) {
                playerJsonData.schoolProgress.class1 = false;
                if (playerJsonData.class1ExpAwarded) {
                    playerJsonData.exp = Math.max(0, (playerJsonData.exp || 0) - 100);
                    playerJsonData.class1ExpAwarded = false;
                }
            }
            
            if (playerJsonData.inventory) {
                playerJsonData.inventory = playerJsonData.inventory.filter(item => item.category !== "Runic Stone");
            }
            
            playerJsonData.class1Points = 0;
            playerJsonData.class1Round = 1;
            playerJsonData.class1Exp = 0;
            playerJsonData.class1RegularStars = 0;
            playerJsonData.class1BigStars = 0;
            playerJsonData.class1GiantStars = 0;
            if (playerJsonData.class1TotalRunes) {
                Object.keys(playerJsonData.class1TotalRunes).forEach(k => playerJsonData.class1TotalRunes[k] = 0);
            }
            
            playerJsonData.versions.runicFally = CURRENT_RUNIC_VERSION;
            await saveDriveAppData();
        }

    } else {
        playerJsonData = {
            starName: "",
            birthBookCompleted: false,
            birthBookExpAwarded: false, 
            schoolProgress: { class1: false, class2: false, class3: false, class4: false, class5: false },
            journalEntries: [],
            rpSessions: [],
            inventory: [],
            dismissedUpdates: [],
            seenUpdates: [],
            versions: { runicFally: 2 },
            comingOfAgeUnlocked: false,
            comingOfAgeCompleted: false,
            traumaUnlocked: false,
            traumaCompleted: false,
            escapeUnlocked: false,
            escapeCompleted: false,
            exp: 0,
            level: 1,
            portraitId: "",
            portraitUrl: ""
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

// --- UI LOGIC ---

function calculateLevel() {
    let lvl = 1; 
    if (playerJsonData.comingOfAgeCompleted) lvl = 2;
    if (playerJsonData.traumaCompleted) lvl = 3;
    if (playerJsonData.escapeCompleted) lvl = 4;
    playerJsonData.level = lvl;
}

function getCurrentAgeGroup() {
    if (!playerJsonData.schoolProgress.class1) return "2-3";
    if (!playerJsonData.schoolProgress.class2) return "4-5";
    if (!playerJsonData.schoolProgress.class3) return "6-7";
    if (!playerJsonData.schoolProgress.class4) return "8-9";
    return "10-11";
}

const journalPromptsByAge = {
    "2-3": {
        "1": "The Brass Market - in Crudsder, Eidolon (Ireland): Ignored by humans brushing past (actual RP Room available).",
        "2": "Any (Cogsbin, SteelMills, or Crudsder - Eidolon (Ireland)) Steam-Train Platform: Human parents pulling their children away from you. The Brushed Herbs Bakery - in Crudsder, Eidolon (Ireland): Baker refuses to acknowledge you, or your caretaker/parent(s).",
        "3": "The Clockwork Toy Shop - in Cogsbin, Eidolon (Ireland): Fascinated by toys, but shooed out by the owner. They don't serve Fae-kind."
    },
    "4-5": {
        "1": "Needlepoint Apothecary, in SteelMills, Eidolon (Ireland): Watching potions bubble and feeling their Energy.",
        "2": "The Backhand Tailor Shop - in Crudsder, Eidolon (Ireland): Being measured for restrictive hat/cap meant to hide your pointed, fae ears.",
        "3": "The Airship Docks of SteelMills - in SteelMills, Eidolon (Ireland): Watching the heavy smog and a feeling of being distant from the humans, as you are segregated onboard."
    },
    "6-7": {
        "1": "A random spice merchant's stall - Eidolon (Ireland): Recognizing ingredients strictly through your sense of smell. Merchant is a Fae woman and is very nice to you.",
        "2": "Home Kitchen: Your parent/guardian helps you make a meal for everyone in your home.",
        "3": "The Brass Market - in Crudsder, Eidolon (Ireland): You tag along with your parent(s)/guardian, looking for some meat at the Butcher's Shop (actual RP Room available)."
    },
    "8-9": {
        "1": "Fyxd Botany - in Cogsbin, Eidolon (Ireland): You are with your parent/guardian and notice that certain plants react subtly to your Energy. Owner is an old Seelie Fae man who never smiles, but is friendly.",
        "2": "Tinker's Shop - in SteelMills, Eidolon (Ireland): Observing timepieces (with parent/guardian) that feel fundamentally 'wrong' to your Energy.",
        "3": "The Brass Market - in Crudsder, Eidolon (Ireland): You are left to wander around the area, by yourself - as long as you promise to stay in The Brass Market (actual RP Room available)."
    },
    "10-11": {
        "1": "The Airship Docks of SteelMills - in SteelMills, Eidolon (Ireland): Watching the heavy smog and a feeling of being distant from the humans, as you & your parent(s)/guardian(s) are segregated onboard.",
        "2": "At Home - Overhear guardian(s)/parent(s) talking to another Fae adult about Humans putting Fae in Cages. They cannot see you, and you know if they do, they will stop talking about it.",
        "3": "The Brass Market - in Crudsder, Eidolon (Ireland): Parent(s)/Guardian(s) send you to buy some food for the Home (actual RP Room available)."
    }
};

function attachJournalModalListeners() {
    const currentAgeGroup = getCurrentAgeGroup();
    const journalSceneSelect = document.getElementById("journalSceneSelect");
    if (!journalSceneSelect) return;

    const promptContainer = document.getElementById("journalPromptContainer");
    const actionContainer = document.getElementById("journalActionContainer");
    const imagesInput = document.getElementById("journalImagesInput");
    const imageCount = document.getElementById("journalImageCount");
    const clearBtn = document.getElementById("clearJournalImagesBtn");
    const saveBtn = document.getElementById("saveJournalBtn");
    const textarea = document.getElementById("journalTextarea");

    journalSceneSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val && journalPromptsByAge[currentAgeGroup][val]) {
            promptContainer.innerHTML = `<strong>Scene Prompt:</strong><br>${journalPromptsByAge[currentAgeGroup][val]}`;
            promptContainer.classList.remove("hidden");
            actionContainer.classList.remove("hidden");
        } else {
            promptContainer.classList.add("hidden");
            actionContainer.classList.add("hidden");
        }
    });

    queuedJournalImages = []; 
    
    imagesInput.addEventListener("change", (e) => {
        if (e.target.files) {
            for (let i = 0; i < e.target.files.length; i++) {
                queuedJournalImages.push(e.target.files[i]);
            }
            imageCount.textContent = `${queuedJournalImages.length} images attached`;
            if (queuedJournalImages.length > 0) clearBtn.classList.remove("hidden");
            imagesInput.value = "";
        }
    });

    clearBtn.addEventListener("click", () => {
        queuedJournalImages = [];
        imageCount.textContent = "0 images attached";
        clearBtn.classList.add("hidden");
    });

    saveBtn.addEventListener("click", async () => {
        const text = textarea.value.trim();
        const words = text.split(/\s+/).filter(w => w.length > 0).length;
        const files = queuedJournalImages;

        if (words < 500) return alert(`Your entry is ${words} words. A minimum of 500 words is required for Solo Writing.`);
        if (files.length < 3 || files.length > 10) return alert(`You selected ${files.length} images. You must upload between 3 and 10 images for Journals.`);

        showLoading("Saving journal entry and uploading images. Please wait...");
        
        try {
            const imageFileIds = [];
            for (let i = 0; i < files.length; i++) {
                imageFileIds.push(await uploadImageToDrive(files[i]));
            }

            const newEntry = {
                date: new Date().toLocaleString(),
                ageGroup: currentAgeGroup,
                text: text,
                images: imageFileIds
            };

            playerJsonData.journalEntries.push(newEntry);
            playerJsonData.exp = (playerJsonData.exp || 0) + 10;
            queuedJournalImages = []; 
            
            await saveDriveAppData();
            hideLoading();
            
            document.getElementById("journalModal").classList.add("hidden");
            await buildHubUI(auth.currentUser);
            alert("Journal entry saved! +10 EXP awarded.");
        } catch (err) {
            console.error(err);
            hideLoading();
            alert("Failed to save journal entry. Check console for details.");
        }
    });
}

function attachRpModalListeners() {
    const currentAgeGroup = getCurrentAgeGroup();
    const rpLocSelect = document.getElementById("rpLocationSelect");
    if (!rpLocSelect) return;

    const imvuContainer = document.getElementById("rpImvuLinkContainer");
    const customLocContainer = document.getElementById("rpCustomLocationContainer");
    const customLocInput = document.getElementById("rpCustomLocationInput");
    const actionContainer = document.getElementById("rpActionContainer");
    const imagesInput = document.getElementById("rpImagesInput");
    const imageCount = document.getElementById("rpImageCount");
    const clearBtn = document.getElementById("clearRpImagesBtn");
    const saveBtn = document.getElementById("saveRpBtn");
    const textarea = document.getElementById("rpTextarea");

    rpLocSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        imvuContainer.classList.add("hidden");
        customLocContainer.classList.add("hidden");
        actionContainer.classList.add("hidden");

        if (val === "market") {
            imvuContainer.classList.remove("hidden");
            actionContainer.classList.remove("hidden");
        } else if (val === "other") {
            customLocContainer.classList.remove("hidden");
            actionContainer.classList.remove("hidden");
        }
    });

    queuedRpImages = []; 

    imagesInput.addEventListener("change", (e) => {
        if (e.target.files) {
            for (let i = 0; i < e.target.files.length; i++) {
                queuedRpImages.push(e.target.files[i]);
            }
            imageCount.textContent = `${queuedRpImages.length} images attached`;
            if (queuedRpImages.length > 0) clearBtn.classList.remove("hidden");
            imagesInput.value = "";
        }
    });

    clearBtn.addEventListener("click", () => {
        queuedRpImages = [];
        imageCount.textContent = "0 images attached";
        clearBtn.classList.add("hidden");
    });

    saveBtn.addEventListener("click", async () => {
        const text = textarea.value.trim();
        const words = text.split(/\s+/).filter(w => w.length > 0).length;
        const files = queuedRpImages;
        const locType = rpLocSelect.value;
        const customLoc = customLocInput.value.trim();

        if (locType === "other" && !customLoc) return alert("Please enter your custom RP location.");
        if (words < 500) return alert(`Your story is ${words} words. A minimum of 500 words is required for RP Sessions.`);
        if (files.length < 5 || files.length > 10) return alert(`You selected ${files.length} images. You must upload between 5 and 10 images for RP Sessions.`);

        showLoading("Saving RP session and uploading images. Please wait...");
        
        try {
            const imageFileIds = [];
            for (let i = 0; i < files.length; i++) {
                imageFileIds.push(await uploadImageToDrive(files[i]));
            }

            const newEntry = {
                date: new Date().toLocaleString(),
                ageGroup: currentAgeGroup,
                location: locType === "market" ? "The Brass Market (IMVU)" : customLoc,
                text: text,
                images: imageFileIds
            };

            playerJsonData.rpSessions.push(newEntry);
            playerJsonData.exp = (playerJsonData.exp || 0) + 10;
            queuedRpImages = []; 
            
            await saveDriveAppData();
            hideLoading();

            document.getElementById("rpModal").classList.add("hidden");
            await buildHubUI(auth.currentUser);
            alert("RP Session submitted! +10 EXP awarded. (Saved to Star Tome data).");
        } catch (err) {
            console.error(err);
            hideLoading();
            alert("Failed to submit RP session. Check console for details.");
        }
    });
}

function renderJournalModalContent() {
    const currentAgeGroup = getCurrentAgeGroup();
    const ageJournalsCount = playerJsonData.journalEntries.filter(e => (e.ageGroup || "2-3") === currentAgeGroup).length;
    const container = document.getElementById("journalModalContent");

    if (ageJournalsCount >= 5) {
        container.innerHTML = `
            <h2 style="margin-top:0; color:#e3d2b9; border-bottom:1px solid #444; padding-bottom:10px; text-align:center;">Solo Journal</h2>
            <p style="text-align:center; color:#7F522B; font-weight:bold;">Max Journal Entries Completed (5/5) for Age ${currentAgeGroup}</p>
            <p style="text-align:center; opacity:0.8; font-size:0.9rem;">You have earned the maximum EXP available from solo journaling for your current age group.</p>
            <button id="closeJournalBottomBtn" style="width:100%; margin-top:20px;">Close</button>
        `;
        document.getElementById("closeJournalBottomBtn").addEventListener("click", () => document.getElementById("journalModal").classList.add("hidden"));
        return;
    }

    container.innerHTML = `
        <h2 style="margin-top:0; color:#e3d2b9; border-bottom:1px solid #444; padding-bottom:10px; text-align:center;">Solo Journal</h2>
        <p style="text-align:center; font-weight:bold; color:#7F522B; margin-top:0;">Age ${currentAgeGroup} Journals Completed: ${ageJournalsCount} / 5</p>
        <p style="text-align:center; font-size: 0.9rem; opacity: 0.9; margin-bottom: 20px;">
            Journals are <strong>1st-person</strong> solo writing entries describing your personal experience based on your current age bracket.
        </p>

        <div id="soloWritingOptions">
            <label style="font-weight:bold; color:#7F522B;">Choose a Lore Scene:</label>
            <select id="journalSceneSelect" style="width:100%; padding:10px; margin-top:8px; background:#222; color:#fff; border:1px solid #444; font-family:inherit; border-radius:4px;">
                <option value="">-- Select Scene --</option>
                <option value="1">Scene Option 1</option>
                <option value="2">Scene Option 2</option>
                <option value="3">Scene Option 3</option>
            </select>
        </div>

        <div id="journalPromptContainer" class="hidden" style="margin-top:15px; padding:15px; background:rgba(255,255,255,0.05); border-left:4px solid #7F522B; font-style:italic;"></div>

        <div id="journalActionContainer" class="hidden" style="margin-top:20px;">
            <div style="font-size:0.9rem; opacity:0.9; margin-bottom:15px;">
                <strong>Requirements:</strong><br>
                • 1st-person journal entry (Min 500 words).<br>
                • Attach 3 to 10 images from your device.
            </div>
            
            <textarea id="journalTextarea" rows="8" style="width:100%; padding:10px; background:#1a1a1a; color:#eee; border:1px solid #444; font-family:inherit; border-radius:4px;" placeholder="Write your first-person journal entry here..."></textarea>
            
            <div style="margin-top:15px;">
                <label style="font-weight:bold; font-size:0.9rem; color:#7F522B;">Attach Images:</label>
                <input type="file" id="journalImagesInput" accept="image/*" multiple style="width:100%; margin-top:5px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                    <span id="journalImageCount" style="font-size:0.85rem; color:#aaa;">0 images attached</span>
                    <button id="clearJournalImagesBtn" type="button" class="hidden" style="padding:4px 8px; font-size:0.8rem;">Clear Selected</button>
                </div>
            </div>

            <button id="saveJournalBtn" style="margin-top:20px; width:100%; border-color:#7F522B; font-weight:bold;">Save Journal Entry (+10 EXP)</button>
        </div>
    `;

    attachJournalModalListeners();
}

function renderRpModalContent() {
    const currentAgeGroup = getCurrentAgeGroup();
    const ageRpCount = playerJsonData.rpSessions.filter(e => (e.ageGroup || "2-3") === currentAgeGroup).length;
    const container = document.getElementById("rpModalContent");

    if (ageRpCount >= 5) {
        container.innerHTML = `
            <h2 style="margin-top:0; color:#e3d2b9; border-bottom:1px solid #444; padding-bottom:10px; text-align:center;">RP Session</h2>
            <p style="text-align:center; color:#7F522B; font-weight:bold;">Max RP Sessions Completed (5/5) for Age ${currentAgeGroup}</p>
            <p style="text-align:center; opacity:0.8; font-size:0.9rem;">You have earned the maximum EXP available from RP sessions for your current age group.</p>
            <button id="closeRpBottomBtn" style="width:100%; margin-top:20px;">Close</button>
        `;
        document.getElementById("closeRpBottomBtn").addEventListener("click", () => document.getElementById("rpModal").classList.add("hidden"));
        return;
    }

    container.innerHTML = `
        <h2 style="margin-top:0; color:#e3d2b9; border-bottom:1px solid #444; padding-bottom:10px; text-align:center;">RP Session</h2>
        <p style="text-align:center; font-weight:bold; color:#7F522B; margin-top:0;">Age ${currentAgeGroup} RP Sessions Completed: ${ageRpCount} / 5</p>
        <p style="text-align:center; font-size: 0.9rem; opacity: 0.9; margin-bottom: 20px;">
            RP Sessions are <strong>3rd-person</strong> stories documenting your live roleplay interactions with other characters.
        </p>

        <div>
            <label style="font-weight:bold; color:#7F522B;">Select RP Location:</label>
            <select id="rpLocationSelect" style="width:100%; padding:10px; margin-top:8px; background:#222; color:#fff; border:1px solid #444; font-family:inherit; border-radius:4px;">
                <option value="">-- Select Location --</option>
                <option value="market">The Brass Market (IMVU)</option>
                <option value="other">Other / Custom Location</option>
            </select>
        </div>

        <div id="rpImvuLinkContainer" class="hidden" style="margin-top:15px; text-align:center;">
            <p style="font-size: 0.9rem; opacity: 0.8; margin-bottom: 10px;">Click below to open IMVU and enter the public RP room.</p>
            <a href="https://go.imvu.com/chat/room-184439344-7012" target="_blank" style="display:inline-block; border: 1px solid #7F522B; background:#222; color:#e3d2b9; padding:10px 20px; font-weight:bold; border-radius:6px; text-decoration:none;">Launch The Brass Market Room</a>
        </div>

        <div id="rpCustomLocationContainer" class="hidden" style="margin-top:15px;">
            <input type="text" id="rpCustomLocationInput" placeholder="Enter your RP Location..." style="width:100%; padding:10px; background:#1a1a1a; color:#eee; border:1px solid #444; font-family:inherit; border-radius:4px;">
        </div>

        <div id="rpActionContainer" class="hidden" style="margin-top:20px;">
            <div style="font-size:0.9rem; opacity:0.9; margin-bottom:15px;">
                <strong>Requirements:</strong><br>
                • 3rd-person story / post (Min 500 words).<br>
                • Attach 5 to 10 session images.<br>
                • Images MUST show: (A) Your character's name in a sentence, (B) Your RP partner's name in a sentence, and (C) The word "Stars" in generalized conversation.
            </div>
            
            <textarea id="rpTextarea" rows="8" style="width:100%; padding:10px; background:#1a1a1a; color:#eee; border:1px solid #444; font-family:inherit; border-radius:4px;" placeholder="Write your 3rd-person RP session story here..."></textarea>
            
            <div style="margin-top:15px;">
                <label style="font-weight:bold; font-size:0.9rem; color:#7F522B;">Attach Images:</label>
                <input type="file" id="rpImagesInput" accept="image/*" multiple style="width:100%; margin-top:5px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                    <span id="rpImageCount" style="font-size:0.85rem; color:#aaa;">0 images attached</span>
                    <button id="clearRpImagesBtn" type="button" class="hidden" style="padding:4px 8px; font-size:0.8rem;">Clear Selected</button>
                </div>
            </div>

            <button id="saveRpBtn" style="margin-top:20px; width:100%; border-color:#7F522B; font-weight:bold;">Submit RP Session (+10 EXP)</button>
        </div>
    `;

    attachRpModalListeners();
}

async function renderInventory() {
    const inventoryGrid = document.getElementById("inventoryGrid");
    const items = playerJsonData.inventory || [];
    
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
    const journalContainer = document.getElementById("journalEntriesContainer");
    const galleryListContainer = document.getElementById("galleryListContainer");
    
    const jEntries = playerJsonData.journalEntries || [];
    const rpEntries = playerJsonData.rpSessions || [];
    galleryListContainer.innerHTML = "";

    if (playerJsonData.birthCourt) {
        const bbImageUrl = `https://adequateremedy.github.io/BirthBook/assets/${playerJsonData.birthCourt}-Result.png`;
        const li = document.createElement("li");
        li.className = "gallery-item";
        li.textContent = `Birth Book - ${playerJsonData.birthCourt} Court`;
        li.addEventListener("click", () => {
            lightboxImg.src = bbImageUrl;
            lightboxModal.classList.remove("hidden");
        });
        galleryListContainer.appendChild(li);
    }

    let hasImages = !!playerJsonData.birthCourt;
    
    // Journal Images
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

    // RP Session Images
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

    if (playerJsonData.starName) {
        starNameDisplay.textContent = playerJsonData.starName;
        editStarBtn.classList.add("hidden");
        editStarContainer.classList.add("hidden");
    } else {
        starNameDisplay.textContent = "Star 1";
        editStarBtn.classList.remove("hidden");
    }

    gen1NameDisplay.textContent = playerJsonData.characterName ? `${playerJsonData.characterName} - Steampunk` : "Gen 1 - Steampunk";

    for (const [elementId, dataKey] of Object.entries(elementsToUpdate)) {
        const el = document.getElementById(elementId);
        if (!el) continue; 
        const val = playerJsonData[dataKey];
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

    if (playerJsonData.portraitUrl) {
        document.getElementById("ui-portrait-img").src = playerJsonData.portraitUrl;
    } else if (playerJsonData.portraitId) {
        try {
            const imgUrl = await getImageUrl(playerJsonData.portraitId);
            document.getElementById("ui-portrait-img").src = imgUrl;
        } catch (err) {
            console.warn("Failed to load portrait image.", err);
        }
    }

    if (playerJsonData.birthBookCompleted) {
        uploadBtn.classList.remove("hidden"); 

        if (!playerJsonData.characterName) {
            uiName.textContent = "Unborn";
            uiName.classList.add("hidden");
            editNameContainer.classList.remove("hidden");
        } else {
            uiName.textContent = playerJsonData.characterName;
            uiName.classList.remove("hidden");
            editNameContainer.classList.add("hidden");
        }
    } else {
        uploadBtn.classList.add("hidden"); 
        uiName.textContent = "Unborn";
        uiName.classList.remove("hidden");
        editNameContainer.classList.add("hidden");
    }
    
    renderInventory();
    renderJournalAndGallery();

    const actionsContainer = document.getElementById("actionsContainer");
    actionsContainer.innerHTML = "";
    
    const isBirthBookComplete = playerJsonData.birthBookCompleted;
    const hasCharacterName = !!playerJsonData.characterName;
    const hasStarName = !!playerJsonData.starName;
    const hasPortrait = !!playerJsonData.portraitUrl || !!playerJsonData.portraitId;
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
        let availableActionsHTML = "";

        if (playerJsonData.exp >= 500) {
            availableActionsHTML += `
                <details class="hub-dropdown">
                    <summary>Trial Books</summary>
                    <div class="dropdown-content">
                        <button onclick="window.location.href='https://adequateremedy.github.io/Awakening_Essence/'" style="border-color: #7F522B; color: #e3d2b9; padding: 12px 20px; font-weight: bold; width: 100%; max-width: 400px; display: block; margin: 0 auto;">Play Awakening Essence</button>
                    </div>
                </details>
            `;
        }

        availableActionsHTML += `
            <details class="hub-dropdown">
                <summary>Echoes</summary>
                <div class="dropdown-content" style="text-align:center;">
                    <button id="openSchoolBtn" style="border-color: #7F522B; color: #e3d2b9; padding: 12px 20px; font-weight: bold; width: 100%; max-width: 400px;">School</button>
                </div>
            </details>
            
            <details class="hub-dropdown">
                <summary>Experiences</summary>
                <div class="dropdown-content" style="text-align:center; display: flex; flex-direction: column; gap: 15px; align-items: center;">
                    <button id="openJournalBtn" style="border-color: #7F522B; color: #e3d2b9; padding: 12px 20px; font-weight: bold; width: 100%; max-width: 400px;">Journal</button>
                    <button id="openRpBtn" style="border-color: #7F522B; color: #e3d2b9; padding: 12px 20px; font-weight: bold; width: 100%; max-width: 400px;">RP Session</button>
                </div>
            </details>
        `;

        actionsContainer.innerHTML = availableActionsHTML;
        
        const openSchoolBtn = document.getElementById("openSchoolBtn");
        if(openSchoolBtn) {
            openSchoolBtn.addEventListener("click", () => {
                const c1 = playerJsonData.schoolProgress.class1;
                document.getElementById("chk-class1").textContent = c1 ? "[X]" : "[ ]";
                document.getElementById("name-class1").innerHTML = `<a href="https://adequateremedy.github.io/Runic-Fally/" style="color: #e3d2b9; text-decoration: underline;">Runic-Fally</a>`;
                document.getElementById("chk-class2").textContent = playerJsonData.schoolProgress.class2 ? "[X]" : "[ ]";
                document.getElementById("chk-class3").textContent = playerJsonData.schoolProgress.class3 ? "[X]" : "[ ]";
                document.getElementById("chk-class4").textContent = playerJsonData.schoolProgress.class4 ? "[X]" : "[ ]";
                document.getElementById("chk-class5").textContent = playerJsonData.schoolProgress.class5 ? "[X]" : "[ ]";
                schoolModal.classList.remove("hidden");
            });
        }

        const openJournalBtn = document.getElementById("openJournalBtn");
        if (openJournalBtn) {
            openJournalBtn.addEventListener("click", () => {
                renderJournalModalContent();
                document.getElementById("journalModal").classList.remove("hidden");
            });
        }

        const openRpBtn = document.getElementById("openRpBtn");
        if (openRpBtn) {
            openRpBtn.addEventListener("click", () => {
                renderRpModalContent();
                document.getElementById("rpModal").classList.remove("hidden");
            });
        }
    }
}

async function handleUserReady(user) {
    showLoading("Syncing profile data...");
    await loadSystemUpdates(); 
    await getDriveAppData();

    const urlParams = new URLSearchParams(window.location.search);
    const urlBirthCourt = urlParams.get('birthCourt');
    const urlBloodlineCourt = urlParams.get('bloodlineCourt');
    let dataChanged = false;

    if (urlBirthCourt && urlBloodlineCourt) {
        playerJsonData.birthCourt = urlBirthCourt;
        playerJsonData.bloodlineCourt = urlBloodlineCourt;
        playerJsonData.birthBookCompleted = true;
        dataChanged = true;
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (playerJsonData.birthBookCompleted && (playerJsonData.exp || 0) < 50) {
        playerJsonData.exp = 50;
        playerJsonData.birthBookExpAwarded = true; 
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

getRedirectResult(auth).then((result) => {
    if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential && credential.accessToken) {
            gDriveToken = credential.accessToken;
            localStorage.setItem("gDriveToken", gDriveToken);
            if (result.user && loginScreen.classList.contains("hidden") === false) {
                 loginScreen.classList.add("hidden");
                 handleUserReady(result.user).catch(error => {
                     console.error("Auto-login failed:", error);
                     localStorage.removeItem("gDriveToken");
                     gDriveToken = null;
                     showError("Session expired or Drive connection failed. Please sign in again.");
                 });
            }
        }
    }
}).catch((error) => {
    console.error(error);
    showError("Sign-in or Drive connection failed.\n" + error.message);
});

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

document.getElementById("googleSignInButton").addEventListener("click", () => {
    loginScreen.classList.add("hidden");
    showLoading("Redirecting to Google...");
    signInWithRedirect(auth, provider);
});

document.getElementById("signOutButton").addEventListener("click", async () => {
    await signOut(auth);
    localStorage.removeItem("gDriveToken");
    gDriveToken = null;
    playerScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");
});

editStarBtn.addEventListener("click", () => {
    editStarContainer.classList.toggle("hidden");
    editStarInput.value = playerJsonData.starName || "";
});

saveStarBtn.addEventListener("click", async () => {
    const val = editStarInput.value.trim();
    if (val) {
        showLoading("Saving...");
        playerJsonData.starName = val;
        starNameDisplay.textContent = val;
        editStarContainer.classList.add("hidden");
        editStarBtn.classList.add("hidden");
        await saveDriveAppData();
        await buildHubUI(auth.currentUser);
        hideLoading();
    }
});

saveNameBtn.addEventListener("click", async () => {
    const val = editNameInput.value.trim();
    if (val) {
        showLoading("Saving...");
        playerJsonData.characterName = val;
        uiName.textContent = val;
        uiName.classList.remove("hidden");
        editNameContainer.classList.add("hidden");
        gen1NameDisplay.textContent = `${val} - Steampunk`;
        await saveDriveAppData();
        await buildHubUI(auth.currentUser);
        hideLoading();
    }
});

const fileInput = document.getElementById("portrait-file-input");

uploadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async (e) => {
    if (e.target.files && e.target.files[0]) {
        uploadBtn.textContent = "Processing...";
        uploadBtn.disabled = true;
        try {
            const file = e.target.files[0];
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

                    playerJsonData.portraitUrl = base64String;
                    await saveDriveAppData(); 
                    
                    document.getElementById("ui-portrait-img").src = base64String;
                    await buildHubUI(auth.currentUser);

                    uploadBtn.textContent = "Upload Image";
                    uploadBtn.disabled = false;
                };
                img.src = event.target.result;
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

closeSchoolBtn.addEventListener("click", () => {
    schoolModal.classList.add("hidden");
});

document.getElementById("closeJournalBtn").addEventListener("click", () => {
    document.getElementById("journalModal").classList.add("hidden");
});

document.getElementById("closeRpBtn").addEventListener("click", () => {
    document.getElementById("rpModal").classList.add("hidden");
});

closeItemModalBtn.addEventListener("click", () => {
    itemModal.classList.add("hidden");
});

closeMemberCardBtn.addEventListener("click", () => {
    memberCardModal.classList.add("hidden");
});

lightboxCloseBtn.addEventListener("click", () => {
    lightboxModal.classList.add("hidden");
});

lightboxModal.addEventListener("click", (e) => {
    if (e.target === lightboxModal) {
        lightboxModal.classList.add("hidden");
    }
});

itemModal.addEventListener("click", (e) => {
    if (e.target === itemModal) {
        itemModal.classList.add("hidden");
    }
});

memberCardModal.addEventListener("click", (e) => {
    if (e.target === memberCardModal) {
        memberCardModal.classList.add("hidden");
    }
});

document.getElementById("journalModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("journalModal")) {
        document.getElementById("journalModal").classList.add("hidden");
    }
});

document.getElementById("rpModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("rpModal")) {
        document.getElementById("rpModal").classList.add("hidden");
    }
});

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

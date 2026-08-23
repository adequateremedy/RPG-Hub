import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { 
    getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged 
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
let gDriveToken = sessionStorage.getItem("gDriveToken") || null;
let dataFileId = null;
let playerJsonData = {};
let queuedJournalImages = [];
const maxJournalEntries = 5;

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

// --- SYSTEM UPDATES CONTENT ---
const SYSTEM_UPDATES = [
    {
        id: "update_003_updates_tab",
        title: "New Updates Folder",
        date: "August 2026",
        content: "We have introduced this new Updates folder attached directly to your Star! As the Solus Dynasty Universe continues to grow, this space will serve as your central notification hub for all patch notes, mechanic changes, and system resets across all Eras and Generations. You can safely leave messages here for reference, or check the box and delete them to keep your feed clean."
    },
    {
        id: "update_002_members",
        title: "Public Member Cards & Portraits",
        date: "August 2026",
        content: "Our team agreed that it is much more beneficial and engaging for everyone to be able to see each other's characters! You can now click on any player's name in the Members tab to view a public version of their full Character Card, including their magical stats and portrait.\n\n**Action Required:** Because your original image is securely locked inside your private Google Drive, you will need to re-upload it. Please go to your Character Card and click 'Upload Image' again to compress and sync your portrait to our public server."
    },
    {
        id: "update_001_runic",
        title: "Runic Fally System Upgrade",
        date: "August 2026",
        content: "We have completely overhauled the Runic Fally class mechanics and asset management! The Runic Stones now feature a stunning, interactive white glow that responds to your unique energy when touched. To ensure everyone receives this new interactive asset and benefits from the corrected EXP scaling, all previous Class 1 records have been reset.\n\n**Action Required:** Simply replay the Runic Fally class located in your Available tab, lock in your grade, and claim your upgraded Runic Stone."
    }
];

// Tier 2 Tabs logic (Star Level vs Era Level)
document.querySelectorAll('.tier-2 .tab-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tier-2 .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (btn.dataset.target === "gen-updates") {
            document.getElementById("gen-updates-content").classList.remove("hidden");
            document.getElementById("gen-1-content").classList.add("hidden");
            
            // Mark unseen updates as seen
            let changed = false;
            SYSTEM_UPDATES.forEach(u => {
                if (!playerJsonData.dismissedUpdates.includes(u.id) && !playerJsonData.seenUpdates.includes(u.id)) {
                    playerJsonData.seenUpdates.push(u.id);
                    changed = true;
                }
            });
            
            if (changed) {
                updateBadge();
                saveDriveAppData(); // Fire and forget save
            }
            
            renderUpdates();
        } else if (btn.dataset.target === "gen-1") {
            document.getElementById("gen-updates-content").classList.add("hidden");
            document.getElementById("gen-1-content").classList.remove("hidden");
        }
    });
});

// Tier 3 Tabs logic (Era Specific)
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

// --- UPDATES & BADGE LOGIC ---
function updateBadge() {
    const unseen = SYSTEM_UPDATES.filter(u => 
        !playerJsonData.dismissedUpdates.includes(u.id) && 
        !playerJsonData.seenUpdates.includes(u.id)
    );
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
    container.innerHTML = "";

    const activeUpdates = SYSTEM_UPDATES.filter(u => !playerJsonData.dismissedUpdates.includes(u.id));

    if (activeUpdates.length === 0) {
        deleteBtn.style.display = "none";
        container.innerHTML = `<p style="text-align:center; opacity:0.7; margin-top:40px;">You are all caught up! There are no new updates.</p>`;
        return;
    }

    deleteBtn.style.display = "inline-block";

    activeUpdates.forEach(update => {
        const div = document.createElement("div");
        div.className = "update-card";
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 10px;">
                <div style="display:flex; align-items:center; gap: 10px;">
                    <input type="checkbox" class="update-checkbox" value="${update.id}">
                    <h3 class="update-title" style="margin:0; border:none; padding:0;">${update.title}</h3>
                </div>
                <div class="update-date" style="position:static;">${update.date}</div>
            </div>
            <div class="update-text">${update.content}</div>
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

// --- FIRESTORE PUBLIC PROFILE SYNC ---

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
        portraitUrl: playerJsonData.portraitUrl || "", // This is now a Base64 string
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

// --- GOOGLE DRIVE API FUNCTIONS ---

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
        if (playerJsonData.inventory === undefined) {
            playerJsonData.inventory = [];
        }
        if (playerJsonData.dismissedUpdates === undefined) {
            playerJsonData.dismissedUpdates = [];
        }
        if (playerJsonData.seenUpdates === undefined) {
            playerJsonData.seenUpdates = [];
        }

        // --- VERSION CONTROL & FORCED WIPE ---
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

        if (playerJsonData.exp > 200) {
            let correctExp = 0;
            if (playerJsonData.birthBookCompleted) correctExp += 50;
            if (playerJsonData.schoolProgress && playerJsonData.schoolProgress.class1) {
                correctExp += 100;
                playerJsonData.class1ExpAwarded = true;
            }
            if (playerJsonData.journalEntries) correctExp += (playerJsonData.journalEntries.length * 10);
            
            playerJsonData.exp = correctExp;
            
            const runicStones = playerJsonData.inventory.filter(i => i.category === "Runic Stone");
            if (runicStones.length > 1) {
                const lastStone = runicStones[runicStones.length - 1];
                playerJsonData.inventory = playerJsonData.inventory.filter(i => i.category !== "Runic Stone");
                if (lastStone) playerJsonData.inventory.push(lastStone);
            }
            await saveDriveAppData();
        }

    } else {
        playerJsonData = {
            starName: "",
            birthBookCompleted: false,
            birthBookExpAwarded: false, 
            schoolProgress: { class1: false, class2: false, class3: false, class4: false, class5: false },
            journalEntries: [],
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
    
    const entries = playerJsonData.journalEntries || [];
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
    if (entries.length > 0) {
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (entry.images && entry.images.length > 0) {
                hasImages = true;
                entry.images.forEach(async (fileId, imgIndex) => {
                    const labelName = `${entry.type === 'RP' ? 'Live RP Session' : 'Solo Journal'} (${entry.date}) — Image ${imgIndex + 1}`;
                    const li = document.createElement("li");
                    li.className = "gallery-item";
                    li.textContent = labelName;
                    
                    try {
                        const url = await getImageUrl(fileId);
                        li.addEventListener("click", () => {
                            lightboxImg.src = url;
                            lightboxModal.classList.remove("hidden");
                        });
                    } catch (e) {
                        console.error("Failed to load image URL for gallery", e);
                    }
                    galleryListContainer.appendChild(li);
                });
            }
        }
    }

    if (!hasImages) {
        galleryListContainer.innerHTML = `<p style="text-align:center; opacity:0.7;">No gallery images found.</p>`;
    }

    if (entries.length === 0) {
        journalContainer.innerHTML = `<p style="text-align:center; opacity:0.7;">No journal entries yet.</p>`;
        return;
    }

    journalContainer.innerHTML = "";
    for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        const div = document.createElement("div");
        div.className = "journal-entry";
        div.innerHTML = `
            <div class="journal-entry-header">
                <span>${entry.type === 'RP' ? 'Live RP Session' : 'Solo Journal'}</span>
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
    updateBadge(); // Trigger badge logic on load

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
        `;

        const entriesCount = (playerJsonData.journalEntries || []).length;
        
        if (entriesCount >= maxJournalEntries) {
            availableActionsHTML += `
                <details class="hub-dropdown">
                    <summary>Journal (Experiences)</summary>
                    <div class="dropdown-content" style="text-align:center;">
                        <p style="color:#7F522B; font-weight:bold;">Max Journal Entries Completed (5/5)</p>
                        <p style="opacity:0.8; font-size:0.9rem;">You have earned the maximum EXP available from journaling at this stage.</p>
                    </div>
                </details>
            `;
        } else {
            availableActionsHTML += `
                <details class="hub-dropdown">
                    <summary>Journal (Experiences)</summary>
                    <div class="dropdown-content">
                        <p style="text-align:center; font-weight:bold; color:#7F522B; margin-top:0;">Completed: ${entriesCount} / 5</p>
                        
                        <div style="display:flex; justify-content:center; gap:20px; margin-bottom:15px; border-bottom:1px solid #333; padding-bottom:15px;">
                            <label><input type="radio" name="journalType" value="RP"> Live RP</label>
                            <label><input type="radio" name="journalType" value="Solo"> Solo Writing</label>
                        </div>

                        <div id="soloWritingOptions" class="hidden">
                            <label style="font-weight:bold; color:#7F522B;">Choose a Lore Scene:</label>
                            <select id="sceneSelect" style="width:100%; padding:10px; margin-top:8px; background:#222; color:#fff; border:1px solid #444; font-family:inherit; border-radius:4px;">
                                <option value="">-- Select Scene --</option>
                                <option value="market">1. The Brass Market</option>
                                <option value="library">2. The Steampunk Library</option>
                                <option value="train">3. The Steam-Train Platform</option>
                                <option value="bakery">4. The Coal-Oven Bakery</option>
                                <option value="courtyard">5. The Walled Courtyard</option>
                            </select>
                        </div>

                        <div id="journalPrompt" class="hidden" style="margin-top:15px; padding:15px; background:rgba(255,255,255,0.05); border-left:4px solid #7F522B; font-style:italic;"></div>

                        <div id="journalAction" class="hidden" style="margin-top:20px;">
                            <div id="journalInstructions" style="font-size:0.9rem; opacity:0.9; margin-bottom:15px;"></div>
                            
                            <textarea id="journalTextarea" rows="8" style="width:100%; padding:10px; background:#1a1a1a; color:#eee; border:1px solid #444; font-family:inherit; border-radius:4px;" placeholder="Write your first-person journal entry here..."></textarea>
                            
                            <div style="margin-top:15px;">
                                <label style="font-weight:bold; font-size:0.9rem; color:#7F522B;">Attach Images (Select one by one or multiple at once):</label>
                                <input type="file" id="journalImagesInput" accept="image/*" multiple style="width:100%; margin-top:5px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                                    <span id="journalImageCount" style="font-size:0.85rem; color:#aaa;">0 images attached</span>
                                    <button id="clearImagesBtn" type="button" class="hidden" style="padding:4px 8px; font-size:0.8rem;">Clear Selected</button>
                                </div>
                            </div>

                            <button id="saveJournalBtn" style="margin-top:20px; width:100%; border-color:#7F522B; font-weight:bold;">Save Journal Entry (+10 EXP)</button>
                        </div>
                    </div>
                </details>
            `;
        }

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

        if (entriesCount < maxJournalEntries) {
            const journalRadios = document.querySelectorAll('input[name="journalType"]');
            const soloWritingOptions = document.getElementById("soloWritingOptions");
            const sceneSelect = document.getElementById("sceneSelect");
            const journalPrompt = document.getElementById("journalPrompt");
            const journalAction = document.getElementById("journalAction");
            const journalInstructions = document.getElementById("journalInstructions");
            const saveJournalBtn = document.getElementById("saveJournalBtn");
            const journalTextarea = document.getElementById("journalTextarea");
            const journalImagesInput = document.getElementById("journalImagesInput");
            const journalImageCount = document.getElementById("journalImageCount");
            const clearImagesBtn = document.getElementById("clearImagesBtn");

            const soloPrompts = {
                "market": "Walking closely with your guardian, humans brush past without looking down, their eyes sliding off you like water. You feel a warm hum of your unique energy, but why do they pretend you aren't there?",
                "library": "Sitting in the grand reading room while your guardian watches over you. A human clerk walks by, totally ignoring your polite greeting. Your inner energy flickers in response to the cold shoulder.",
                "train": "Waiting on the platform, holding your guardian's hand tightly. Human children play nearby, but you notice their parents quickly and quietly pull them away from you.",
                "bakery": "The baker hands your guardian the pastries, refusing to acknowledge your existence or look at your face, leaving you to wonder what makes your energy so different.",
                "courtyard": "Confined to the safety of your home's courtyard. You can hear the human world outside the iron gates—a world you aren't allowed to enter alone because of the strict new laws."
            };

            let currentMode = "";

            journalRadios.forEach(radio => {
                radio.addEventListener("change", (e) => {
                    currentMode = e.target.value;
                    queuedJournalImages = [];
                    if(journalImageCount) journalImageCount.textContent = "0 images attached";
                    if(clearImagesBtn) clearImagesBtn.classList.add("hidden");
                    if(journalImagesInput) journalImagesInput.value = "";

                    if (currentMode === "RP") {
                        soloWritingOptions.classList.add("hidden");
                        journalPrompt.classList.remove("hidden");
                        journalPrompt.innerHTML = `<strong>Live RP Session</strong><br>Document your social RP in the Steampunk Era of the Midgard Realm. Remember, you are a Fae child, and notice that you and other Fae are often ignored by humans and hidden from the world's horrors by your caretaker(s) and/or parents.`;
                        
                        journalInstructions.innerHTML = `
                            <strong>Requirements:</strong><br>
                            • First-person journal entry (Min 300 words).<br>
                            • Attach 5 to 10 session images.<br>
                            • Images MUST show: (A) Your character's name in a sentence, (B) Your RP partner's name in a sentence, and (C) The word "Stars" in generalized conversation.
                        `;
                        journalAction.classList.remove("hidden");
                    } else if (currentMode === "Solo") {
                        soloWritingOptions.classList.remove("hidden");
                        journalPrompt.classList.add("hidden");
                        journalAction.classList.add("hidden");
                        sceneSelect.value = "";
                    }
                });
            });

            sceneSelect.addEventListener("change", (e) => {
                const val = e.target.value;
                if(val && soloPrompts[val]) {
                    journalPrompt.innerHTML = soloPrompts[val];
                    journalPrompt.classList.remove("hidden");
                    
                    journalInstructions.innerHTML = `
                        <strong>Requirements:</strong><br>
                        • First-person journal entry (Min 500 words).<br>
                        • Attach 1 to 3 images from your device.
                    `;
                    journalAction.classList.remove("hidden");
                } else {
                    journalPrompt.classList.add("hidden");
                    journalAction.classList.add("hidden");
                }
            });

            journalImagesInput.addEventListener("change", (e) => {
                if (e.target.files) {
                    for (let i = 0; i < e.target.files.length; i++) {
                        queuedJournalImages.push(e.target.files[i]);
                    }
                    journalImageCount.textContent = `${queuedJournalImages.length} images attached`;
                    if (queuedJournalImages.length > 0) {
                        clearImagesBtn.classList.remove("hidden");
                    }
                    journalImagesInput.value = "";
                }
            });

            clearImagesBtn.addEventListener("click", () => {
                queuedJournalImages = [];
                journalImageCount.textContent = "0 images attached";
                clearImagesBtn.classList.add("hidden");
            });

            saveJournalBtn.addEventListener("click", async () => {
                const text = journalTextarea.value.trim();
                const words = text.split(/\s+/).filter(w => w.length > 0).length;
                const files = queuedJournalImages;
                
                if (currentMode === "RP") {
                    if (words < 300) return alert(`Your entry is ${words} words. A minimum of 300 words is required for Live RP.`);
                    if (files.length < 5 || files.length > 10) return alert(`You selected ${files.length} images. You must upload between 5 and 10 images for Live RP.`);
                } else if (currentMode === "Solo") {
                    if (words < 500) return alert(`Your entry is ${words} words. A minimum of 500 words is required for Solo Writing.`);
                    if (files.length < 1 || files.length > 3) return alert(`You selected ${files.length} images. You must upload between 1 and 3 images for Solo Writing.`);
                } else {
                    return;
                }

                showLoading("Saving journal entry and uploading images. Please wait...");
                
                try {
                    const imageFileIds = [];
                    for (let i = 0; i < files.length; i++) {
                        const fId = await uploadImageToDrive(files[i]);
                        imageFileIds.push(fId);
                    }

                    const newEntry = {
                        date: new Date().toLocaleString(),
                        type: currentMode,
                        text: text,
                        images: imageFileIds
                    };

                    playerJsonData.journalEntries.push(newEntry);
                    playerJsonData.exp = (playerJsonData.exp || 0) + 10;
                    queuedJournalImages = []; 
                    
                    await saveDriveAppData();
                    
                    hideLoading();
                    await buildHubUI(auth.currentUser);
                    alert("Journal entry saved! +10 EXP awarded.");
                    
                } catch (err) {
                    console.error(err);
                    hideLoading();
                    alert("Failed to save journal entry. Check console for details.");
                }
            });
        }
    }
}

async function handleUserReady(user) {
    showLoading("Syncing profile data...");
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

onAuthStateChanged(auth, async (user) => {
    if (user && gDriveToken) {
        loginScreen.classList.add("hidden");
        try {
            await handleUserReady(user);
        } catch (error) {
            console.error("Auto-login failed:", error);
            sessionStorage.removeItem("gDriveToken");
            gDriveToken = null;
            showError("Session expired or Drive connection failed. Please sign in again.");
        }
    }
});

document.getElementById("googleSignInButton").addEventListener("click", async () => {
    loginScreen.classList.add("hidden");
    showLoading("Signing in...");

    try {
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        gDriveToken = credential.accessToken;
        sessionStorage.setItem("gDriveToken", gDriveToken);
        
        await handleUserReady(result.user);
    } catch (error) {
        console.error(error);
        showError("Sign-in or Drive connection failed.\n" + error.message);
    }
});

document.getElementById("signOutButton").addEventListener("click", async () => {
    await signOut(auth);
    sessionStorage.removeItem("gDriveToken");
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

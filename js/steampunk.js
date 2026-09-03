export function getCurrentAgeGroup() {
    const data = window.HubAPI.getPlayerData();
    const activeChar = data.stars[window.HubAPI.getActiveStar()].gens[window.HubAPI.getActiveGen()];
    if (!activeChar.schoolProgress || !activeChar.schoolProgress.class1) return "2-3";
    if (!activeChar.schoolProgress.class2) return "4-5";
    if (!activeChar.schoolProgress.class3) return "6-7";
    if (!activeChar.schoolProgress.class4) return "8-9";
    return "10-11";
}

const journalPromptsByAge = {
    "2-3": {
        "1": { title: "The Brass Market", location: "Crudsder, Eidolon (Ireland) (IMVU Prebuild Room available)", text: "You are walking through the market with your parent(s)/guardian(s). Towering humans constantly brush past, completely ignoring your existence. Describe the chaotic sights and sounds from your perspective." },
        "2": { title: "Steam-Train Platform", location: "Eidolon, Ireland", text: "The baker actively refuses to acknowledge you and/or your parent(s)/guardian(s). Describe how this cold treatment and unspoken rejection feels." },
        "3": { title: "The Clockwork Toy Shop", location: "Cogsbin, Eidolon (Ireland)", text: "You are with your parent(s)/guardian(s) and become utterly fascinated by the mechanical toys. However, the owner quickly shoos all of you out, stating they don't serve Fae-kind. Describe the allure of the toys and the sudden sting of being cast out." }
    },
    "4-5": {
        "1": { title: "Needlepoint Apothecary", location: "SteelMills, Eidolon (Ireland)", text: "Standing beside your parent(s)/guardian(s), you watch the strange potions bubble in their glass vats. Describe the strange, vibrating sensation you feel as your own innate Energy hums in response to certain liquids, even though you don't understand why." },
        "2": { title: "The Backhand Tailor Shop", location: "Crudsder, Eidolon (Ireland)", text: "You are being measured for a thick, restrictive cap designed specifically to hide your pointed, fae ears. Describe the physical discomfort of the hat and what your parent(s)/guardian(s) tell you about why you must wear it to hide." },
        "3": { title: "The Airship Docks of SteelMills", location: "SteelMills, Eidolon (Ireland)", text: "Standing with your parent(s)/guardian(s) in the heavy, choking smog, you wait to board. You are all guided to a segregated section, kept distant from the human passengers. Describe the grimy environment and the feeling of being kept apart." }
    },
    "6-7": {
        "1": { title: "A random spice merchant's stall", location: "Eidolon (Ireland)", text: "While out with your parent(s)/guardian(s), you realize you can identify the different ingredients strictly through your sense of smell. The merchant, a Fae woman, notices and is very kind to you. Describe this sensory." },
        "2": { title: "Home Kitchen", location: "Home", text: "Safe inside, your parent(s)/guardian(s) help you prepare a meal for everyone in your home. Describe the warmth of the hearth, the smells of the food, and the comforting feeling of safety away from humans." },
        "3": { title: "The Brass Market", location: "Crudsder, Eidolon (Ireland) (IMVU Prebuilt Room available)", text: "You tag along close to your parent(s)/guardian(s) as they look for some meat at the Butcher's Shop. Describe the heavy smells, the bustling humans and fae, and what it's like navigating The Brass Market." }
    },
    "8-9": {
        "1": { title: "Fyxd Botany", location: "Cogsbin, Eidolon (Ireland)", text: "You are with your parent(s)/guardian(s) and notice that certain plants react subtly to the hum of your Energy as you pass. The owner, an old Seelie Fae man who never smiles, treats you all with quiet friendliness. Describe the plants' reactions and the shop's atmosphere." },
        "2": { title: "Tinker's Shop", location: "SteelMills, Eidolon (Ireland)", text: "Accompanied by your parent(s)/guardian(s), you observe the intricate, ticking timepieces. Instead of fascination, the mechanical gears feel fundamentally 'wrong' and abrasive to you. Describe this jarring, uncomfortable feeling." },
        "3": { title: "The Brass Market", location: "Crudsder, Eidolon (Ireland) (IMVU Prebuild Room available)", text: "For the very first time, your parent(s)/guardian(s) allow you to wander around the area by yourself—as long as you promise to stay in The Brass Market. Describe the rush of this new independence and the sights you take in while walking alone." }
    },
    "10-11": {
        "1": { title: "The Airship Docks of SteelMills", location: "SteelMills, Eidolon (Ireland)", text: "Traveling with your parent(s)/guardian(s) through the heavy smog, you are once again segregated onboard, away from the human passengers. Now that you are older, describe how your perspective on this forced separation has changed (if it has)." },
        "2": { title: "At Home", location: "Home", text: "You are out of sight when you overhear your parent(s)/guardian(s) talking to another Fae adult about Humans putting your kind in Cages. You know if they see you, they will immediately stop talking. Describe the fear of overhearing this dark reality and how you react." },
        "3": { title: "The Brass Market", location: "Crudsder, Eidolon (Ireland) (IMVU Prebuild Room available)", text: "You are old enough now that your parent(s)/guardian(s) have sent you to the market alone with coin to buy food for the Home. Describe the responsibility of this task and how you navigate the crowded, human-dominated market by yourself." }
    }
};

let queuedJournalImages = [];
let queuedRpImages = [];

function attachJournalModalListeners() {
    const currentAgeGroup = getCurrentAgeGroup();
    const data = window.HubAPI.getPlayerData();
    const activeChar = data.stars[window.HubAPI.getActiveStar()].gens[window.HubAPI.getActiveGen()];
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
            const scene = journalPromptsByAge[currentAgeGroup][val];
            promptContainer.innerHTML = `<strong>Location:</strong> ${scene.location}<br><br><strong>Scene Prompt:</strong><br>${scene.text}`;
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

        window.HubAPI.showLoading("Saving journal entry and uploading images. Please wait...");
        
        try {
            const imageFileIds = [];
            for (let i = 0; i < files.length; i++) {
                imageFileIds.push(await window.HubAPI.uploadImageToDrive(files[i]));
            }

            const newEntry = {
                date: new Date().toLocaleString(),
                ageGroup: currentAgeGroup,
                text: text,
                images: imageFileIds
            };

            if(!activeChar.journalEntries) activeChar.journalEntries = [];
            activeChar.journalEntries.push(newEntry);
            activeChar.exp = (activeChar.exp || 0) + 10;
            queuedJournalImages = []; 
            
            await window.HubAPI.saveDriveAppData();
            window.HubAPI.hideLoading();
            
            document.getElementById("journalModal").classList.add("hidden");
            await window.HubAPI.triggerHubBuild(window.HubAPI.getAuth().currentUser);
            alert("Journal entry saved! +10 EXP awarded.");
        } catch (err) {
            console.error(err);
            window.HubAPI.hideLoading();
            alert("Failed to save journal entry. Check console for details.");
        }
    });
}

function attachRpModalListeners() {
    const currentAgeGroup = getCurrentAgeGroup();
    const data = window.HubAPI.getPlayerData();
    const activeChar = data.stars[window.HubAPI.getActiveStar()].gens[window.HubAPI.getActiveGen()];
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

        window.HubAPI.showLoading("Saving RP session and uploading images. Please wait...");
        
        try {
            const imageFileIds = [];
            for (let i = 0; i < files.length; i++) {
                imageFileIds.push(await window.HubAPI.uploadImageToDrive(files[i]));
            }

            const newEntry = {
                date: new Date().toLocaleString(),
                ageGroup: currentAgeGroup,
                location: locType === "market" ? "The Brass Market (IMVU)" : customLoc,
                text: text,
                images: imageFileIds
            };

            if(!activeChar.rpSessions) activeChar.rpSessions = [];
            activeChar.rpSessions.push(newEntry);
            activeChar.exp = (activeChar.exp || 0) + 10;
            queuedRpImages = []; 
            
            await window.HubAPI.saveDriveAppData();
            window.HubAPI.hideLoading();

            document.getElementById("rpModal").classList.add("hidden");
            await window.HubAPI.triggerHubBuild(window.HubAPI.getAuth().currentUser);
            alert("RP Session submitted! +10 EXP awarded. (Saved to Star Tome data).");
        } catch (err) {
            console.error(err);
            window.HubAPI.hideLoading();
            alert("Failed to submit RP session. Check console for details.");
        }
    });
}

export function renderJournalModalContent() {
    const currentAgeGroup = getCurrentAgeGroup();
    const data = window.HubAPI.getPlayerData();
    const activeChar = data.stars[window.HubAPI.getActiveStar()].gens[window.HubAPI.getActiveGen()];
    const ageJournalsCount = (activeChar.journalEntries || []).filter(e => (e.ageGroup || "2-3") === currentAgeGroup).length;
    const container = document.getElementById("journalModalContent");

    if (ageJournalsCount >= 3) {
        container.innerHTML = `
            <h2 style="margin-top:0; color:#e3d2b9; border-bottom:1px solid #444; padding-bottom:10px; text-align:center;">Solo Journal</h2>
            <p style="text-align:center; color:#7F522B; font-weight:bold;">Max Journal Entries Completed (3/3) for Age ${currentAgeGroup}</p>
            <p style="text-align:center; opacity:0.8; font-size:0.9rem;">You have earned the maximum EXP available from solo journaling for your current age group.</p>
            <button id="closeJournalBottomBtn" style="width:100%; margin-top:20px;">Close</button>
        `;
        document.getElementById("closeJournalBottomBtn").addEventListener("click", () => document.getElementById("journalModal").classList.add("hidden"));
        return;
    }

    container.innerHTML = `
        <h2 style="margin-top:0; color:#e3d2b9; border-bottom:1px solid #444; padding-bottom:10px; text-align:center;">Solo Journal</h2>
        <p style="text-align:center; font-weight:bold; color:#7F522B; margin-top:0;">Age ${currentAgeGroup} Journals Completed: ${ageJournalsCount} / 3</p>
        <p style="text-align:center; font-size: 0.9rem; opacity: 0.9; margin-bottom: 20px;">
            Journals are <strong>1st-person</strong> solo writing entries describing your personal experience based on your current age bracket.
        </p>

        <div id="soloWritingOptions">
            <label style="font-weight:bold; color:#7F522B;">Choose a Lore Scene:</label>
            <select id="journalSceneSelect" style="width:100%; padding:10px; margin-top:8px; background:#222; color:#fff; border:1px solid #444; font-family:inherit; border-radius:4px;">
                <option value="">-- Select Scene --</option>
                <option value="1">${journalPromptsByAge[currentAgeGroup]["1"].title}</option>
                <option value="2">${journalPromptsByAge[currentAgeGroup]["2"].title}</option>
                <option value="3">${journalPromptsByAge[currentAgeGroup]["3"].title}</option>
            </select>
        </div>

        <div id="journalPromptContainer" class="hidden" style="margin-top:15px; padding:15px; background:rgba(255,255,255,0.05); border-left:4px solid #7F522B; font-style:italic;"></div>

        <div id="journalActionContainer" class="hidden" style="margin-top:20px;">
            <div style="font-size:0.9rem; opacity:0.9; margin-bottom:15px;">
                <strong>Requirements:</strong><br>
                • 1st-person journal entry (Min 500 words).<br>
                • Attach 3 to 10 images from your device.
            </div>
            
            <textarea id="journalTextarea" rows="5" style="width:100%; padding:10px; background:#1a1a1a; color:#eee; border:1px solid #444; font-family:inherit; border-radius:4px;" placeholder="Write your first-person journal entry here..."></textarea>
            
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

export function renderRpModalContent() {
    const currentAgeGroup = getCurrentAgeGroup();
    const data = window.HubAPI.getPlayerData();
    const activeChar = data.stars[window.HubAPI.getActiveStar()].gens[window.HubAPI.getActiveGen()];
    const ageRpCount = (activeChar.rpSessions || []).filter(e => (e.ageGroup || "2-3") === currentAgeGroup).length;
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
            
            <textarea id="rpTextarea" rows="5" style="width:100%; padding:10px; background:#1a1a1a; color:#eee; border:1px solid #444; font-family:inherit; border-radius:4px;" placeholder="Write your 3rd-person RP session story here..."></textarea>
            
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

export function renderAvailableActions(actionsContainer, activeChar) {
    let availableActionsHTML = "";

    // HIDDEN ENTIRELY UNTIL 450 EXP
    if (activeChar.exp >= 450) {
        availableActionsHTML += `
            <details class="hub-dropdown">
                <summary>Trial Books</summary>
                <div class="dropdown-content" style="text-align:center;">
                    <button id="openAwakeningBtn" style="border-color: #7F522B; color: #e3d2b9; padding: 12px 20px; font-weight: bold; width: 100%; max-width: 400px;">Awakening Essence</button>
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
    
    // Trial Books: Awakening Essence Modal Logic
    const openAwakeningBtn = document.getElementById("openAwakeningBtn");
    if (openAwakeningBtn) {
        openAwakeningBtn.addEventListener("click", () => {
            const coa = activeChar.comingOfAgeCompleted;
            document.getElementById("chk-comingOfAge").textContent = coa ? "[X]" : "[ ]";
            document.getElementById("awakeningModal").classList.remove("hidden");
        });
    }

    // Close button logic for Awakening Modal
    const closeAwakeningBtn = document.getElementById("closeAwakeningBtn");
    if (closeAwakeningBtn) {
        closeAwakeningBtn.addEventListener("click", () => {
            document.getElementById("awakeningModal").classList.add("hidden");
        });
    }
    
    // Echoes: School Modal Logic
    const openSchoolBtn = document.getElementById("openSchoolBtn");
    if(openSchoolBtn) {
        openSchoolBtn.addEventListener("click", () => {
            const sp = activeChar.schoolProgress || {};
            const c1 = sp.class1;
            const c2 = sp.class2;
            
            // Class 1 Logic
            document.getElementById("chk-class1").textContent = c1 ? "[X]" : "[ ]";
            if (c1) {
                document.getElementById("name-class1").innerHTML = `<span style="color: #666; text-decoration: line-through;">Runic-Fally</span>`;
            } else {
                document.getElementById("name-class1").innerHTML = `<a href="https://adequateremedy.github.io/Runic-Fally/" style="color: #e3d2b9; text-decoration: underline;">Runic-Fally</a>`;
            }
            
            // Class 2 Logic (Requires Class 1)
            document.getElementById("chk-class2").textContent = c2 ? "[X]" : "[ ]";
            if (c2) {
                // Completed Class 2
                document.getElementById("name-class2").innerHTML = `<span style="color: #666; text-decoration: line-through;">Trade & Tally</span>`;
            } else if (c1) {
                // Class 1 is done, Class 2 is unlocked and ready to play
                document.getElementById("name-class2").innerHTML = `<a href="https://adequateremedy.github.io/Trade-and-Tally/" style="color: #e3d2b9; text-decoration: underline;">Trade & Tally</a>`;
            } else {
                // Class 1 is NOT done, so Class 2 remains locked
                document.getElementById("name-class2").innerHTML = `<span style="color: #888;">Trade & Tally (Locked)</span>`;
            }

            document.getElementById("chk-class3").textContent = sp.class3 ? "[X]" : "[ ]";
            document.getElementById("chk-class4").textContent = sp.class4 ? "[X]" : "[ ]";
            document.getElementById("chk-class5").textContent = sp.class5 ? "[X]" : "[ ]";
            document.getElementById("schoolModal").classList.remove("hidden");
        });
    }

    // Experiences: Journal Logic
    const openJournalBtn = document.getElementById("openJournalBtn");
    if (openJournalBtn) {
        openJournalBtn.addEventListener("click", () => {
            renderJournalModalContent();
            document.getElementById("journalModal").classList.remove("hidden");
        });
    }

    // Experiences: RP Session Logic
    const openRpBtn = document.getElementById("openRpBtn");
    if (openRpBtn) {
        openRpBtn.addEventListener("click", () => {
            renderRpModalContent();
            document.getElementById("rpModal").classList.remove("hidden");
        });
    }
}

const { chromium } = require('playwright');
const fs = require('fs');

async function fetchCitiesFromStart() {
    console.log("🚀 מתחיל איסוף ערים מ-אא (עם ניקוי שדה אגרסיבי)...");
    const browser = await chromium.launch({ headless: false }); 
    const page = await browser.newPage();
    const citiesMap = new Map();
    const outputPath = "C:\\REACT\\appointments-hunter\\src\\scrapers\\health\\constants\\cities.js";

    const saveToDisk = () => {
        const citiesList = Array.from(citiesMap.values()).sort((a, b) => a.label.localeCompare(b.label));
        const fileContent = `export const AVAILABLE_CITIES = ${JSON.stringify(citiesList, null, 4)};\n`;
        fs.writeFileSync(outputPath, fileContent);
    };

    try {
        await page.goto('https://e-services.clalit.co.il/OnlineWeb/Services/Appointments/AppointmentsLogon.aspx');
        console.log("👋 בצע לוגין ונווט לשדה היישוב.");

        const getField = async () => {
            for (const frame of page.frames()) {
                if (frame.isDetached()) continue;
                try {
                    const el = await frame.$('#SelectedCityName, .ui-autocomplete-input');
                    if (el && await el.isVisible()) return { frame, el };
                } catch (e) { continue; }
            }
            return null;
        };

        const alphabet = "אבגדהוזחטיכלמנסעפצקרשת".split("");

        for (const c1 of alphabet) {
            for (const c2 of alphabet) {
                const query = c1 + c2;
                let success = false;
                
                while (!success) {
                    try {
                        const target = await getField();
                        if (!target) { await page.waitForTimeout(2000); continue; }

                        const { frame, el } = target;
                        
                        // ניקוי יסודי של השדה לפני כל שאילתה חדשה
                        await el.click({ clickCount: 3 }); 
                        await page.keyboard.press('Backspace');
                        
                        // הזרקת הצירוף החדש
                        await el.fill(query, { force: true });
                        await page.waitForTimeout(1800);

                        const found = await frame.evaluate(() => {
                            const anchors = Array.from(document.querySelectorAll('.ui-menu-item a'));
                            return anchors.map(a => ({ id: a.innerText.trim(), label: a.innerText.trim() }));
                        });

                        found.forEach(c => {
                            if (!citiesMap.has(c.id)) {
                                citiesMap.set(c.id, c);
                                saveToDisk();
                            }
                        });
                        
                        process.stdout.write(`✨ צירוף: ${query} | סה"כ: ${citiesMap.size}\r`);
                        success = true;
                    } catch (err) {
                        await page.waitForTimeout(2000);
                    }
                }
            }
        }
    } catch (error) {
        console.error("\n❌ שגיאה:", error.message);
    } finally {
        await browser.close();
    }
}

fetchCitiesFromStart();
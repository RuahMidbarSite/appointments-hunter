const { chromium } = require('playwright');
const fs = require('fs');

async function fetchDoctorsFinal() {
    console.log("🚀 מתחיל איסוף רופאים במבנה {id: name, label: name}...");
    const browser = await chromium.launch({ headless: false }); 
    const page = await browser.newPage();
    const doctorsMap = new Map(); 
    const outputPath = "C:\\REACT\\appointments-hunter\\src\\scrapers\\health\\constants\\doctors_display.js";

    const saveToDisk = () => {
        const doctorsList = Array.from(doctorsMap.values()).sort((a, b) => a.label.localeCompare(b.label));
        const fileContent = `export const AVAILABLE_DOCTORS = ${JSON.stringify(doctorsList, null, 4)};\n`;
        fs.writeFileSync(outputPath, fileContent);
    };

    try {
        await page.goto('https://e-services.clalit.co.il/OnlineWeb/Services/Appointments/AppointmentsLogon.aspx');
        console.log("👋 בצע לוגין ונווט לשדה 'שם רופא'.");

        const getField = async () => {
            for (const frame of page.frames()) {
                if (frame.isDetached()) continue;
                try {
                    // חיפוש השדה לפי ID חלקי או קלאס האוטוקומפליט
                    const el = await frame.$('input[id*="txtProviderName"], .ui-autocomplete-input');
                    if (el && await el.isVisible()) return { frame, el };
                } catch (e) { continue; }
            }
            return null;
        };

        let target = null;
        while (!target) {
            target = await getField();
            if (!target) await page.waitForTimeout(2000);
        }

        console.log("\n🎯 שדה רופא אותר! מתחיל סריקה א'-ת'...");
        const { frame, el: input } = target;
        const alphabet = "אבגדהוזחטיכלמנסעפצקרשת".split("");

        for (const c1 of alphabet) {
            for (const c2 of alphabet) {
                const query = c1 + c2;
                let success = false;

                while (!success) {
                    try {
                        const currentTarget = await getField();
                        if (!currentTarget) { await page.waitForTimeout(2000); continue; }
                        
                        const { frame: activeFrame, el: activeInput } = currentTarget;

                        // ניקוי שדה לפני כל חיפוש חדש
                        await activeInput.click({ clickCount: 3 });
                        await page.keyboard.press('Backspace');
                        
                        await activeInput.fill(query, { force: true });
                        await page.waitForTimeout(1800); 

                        const found = await activeFrame.evaluate(() => {
                            const anchors = Array.from(document.querySelectorAll('.ui-menu-item a'));
                            return anchors.map(a => {
                                const name = a.innerText.trim();
                                return { id: name, label: name }; 
                            }).filter(d => d.label.length > 1);
                        });

                        let added = 0;
                        found.forEach(doc => {
                            if (!doctorsMap.has(doc.id)) {
                                doctorsMap.set(doc.id, doc);
                                added++;
                            }
                        });

                        if (added > 0) {
                            saveToDisk();
                            process.stdout.write(`✨ צירוף: ${query} | נוספו: ${added} | סה"כ: ${doctorsMap.size}\r`);
                        }
                        success = true;
                    } catch (e) {
                        await page.waitForTimeout(2000);
                    }
                }
            }
        }
        console.log(`\n✅ הסתיים! ${doctorsMap.size} רופאים נשמרו.`);
    } catch (error) {
        console.error("\n❌ שגיאה:", error.message);
    } finally {
        await browser.close();
    }
}

fetchDoctorsFinal();
const { chromium } = require('playwright');
const fs = require('fs');

async function interactiveFetch() {
    const outputPath = "C:\\REACT\\appointments-hunter\\src\\scrapers\\health\\constants\\doctors_display.js";
    console.log("🚀 השותף השקט פועל! גרסה הכוללת שדה serviceType לסינון בדשבורד.");
    console.log("------------------------------------------------------------------");

    const browser = await chromium.launch({ 
        headless: false, 
        args: ['--start-maximized'] 
    });
    
    const context = await browser.newContext({ 
        viewport: { width: 1920, height: 1080 } 
    });

    const page = await context.newPage();
    let doctorsMap = new Map();

    // טעינת המאגר הקיים כדי לעדכן חורים במידע
    if (fs.existsSync(outputPath)) {
        try {
            const content = fs.readFileSync(outputPath, 'utf8');
            const match = content.match(/\[.*\]/s);
            if (match) {
                JSON.parse(match[0]).forEach(d => { if (d.key) doctorsMap.set(d.key, d); });
                console.log(`📦 נטענו ${doctorsMap.size} רופאים מהדיסק. הבוט ינסה להשלים מידע חסר.`);
            }
        } catch (e) {
            console.log("⚠️ לא ניתן היה לקרוא את הקובץ הקיים, מתחיל מאגר חדש.");
        }
    }

    const scrapeCurrentView = async () => {
        try {
            const results = await page.evaluate(() => {
                
                // פונקציית פילטר אגרסיבית: מעיפה כל "ריבוע" או תו נסתר ומשאירה רק תווים חוקיים
                const cleanText = (str) => {
                    if (!str) return '';
                    return str.replace(/[^\u0590-\u05FFa-zA-Z0-9 \-.,|()'"*]/g, '').replace(/\s+/g, ' ').trim();
                };

                const items = Array.from(document.querySelectorAll('.doctor-card, .service-provider-card, .search-result-item, li.row, .result-item'));
                if (items.length === 0) return [];

                // זיהוי לשונית משופר - בודק גם את ה-DOM וגם את כתובת ה-URL
                let tabName = "כללית";
                const isMushlamInUrl = window.location.href.includes('mushlam');
                const activeTabEl = document.querySelector('.nav-tabs li.active a, .selected-tab, .active-filter, [aria-selected="true"]');
                
                if (isMushlamInUrl || (activeTabEl && activeTabEl.textContent.includes('מושלם'))) {
                    tabName = "מושלם";
                }

                return items.map(card => {
                    // 1. חילוץ שם ו-ID (employeeid)
                    const mainLink = card.querySelector('.search-result-item-Link, h2 a, .provider-name a');
                    let rawName = mainLink ? mainLink.textContent : card.textContent.split('\n')[0];
                    let name = cleanText(rawName.split('-')[0]);

                    let doctorId = '';
                    if (mainLink && mainLink.href) {
                        const idMatch = mainLink.href.match(/employeeid=([^&]+)/i) || mainLink.href.match(/id=([^&]+)/i);
                        doctorId = idMatch ? idMatch[1] : '';
                    }

                    // 2. חילוץ מרפאה, כתובת וטלפון לפי סמיכות אלמנטים (Next Sibling)
                    let clinic = '';
                    let address = '';
                    let phone = 'אין טלפון';

                    const labels = Array.from(card.querySelectorAll('.result-list-item-label, span, strong'));
                    
                    labels.forEach(label => {
                        const labelText = cleanText(label.textContent);
                        const valueEl = label.nextElementSibling;
                        const valueText = valueEl ? cleanText(valueEl.textContent) : '';

                        if (labelText.includes('מרפאה')) clinic = valueText;
                        if (labelText.includes('כתובת')) address = valueText;
                        if (labelText.includes('זימון תור')) phone = valueText;
                    });

                    const telLink = card.querySelector('.hyper-link-2700, a[href^="tel:"]');
                    if (telLink && (phone === 'אין טלפון' || phone === '')) {
                        phone = cleanText(telLink.textContent);
                    }

                    // מפתח נקי מריבועים וללא קווים תחתונים (תקין ל-React)
                    const cleanKey = doctorId ? cleanText(`${doctorId} - ${clinic}`) : cleanText(`${name} - ${clinic}`);

                    // המבנה החדש שכולל את serviceType
                    return { 
                        id: name,
                        serviceType: tabName,
                        doctorId: doctorId,
                        label: `${name} | ${tabName} | ${clinic} | ${address} | טל: ${phone} | ID: ${doctorId}`, 
                        key: cleanKey
                    };
                });
            });

            let updatedOrAdded = 0;
            results.forEach(doc => {
                const isDoctor = doc.id.includes('ד"ר') || doc.id.includes('פרופ') || doc.doctorId;
                if (isDoctor) {
                    const existing = doctorsMap.get(doc.key);
                    
                    // תנאי העדכון: אם הרופא לא קיים, או אם הקיים מכיל מידע חסר (| |) והחדש מלא
                    const existingIsMissingInfo = existing && existing.label.includes('|  |');
                    const newHasInfo = !doc.label.includes('|  |');

                    // גם מעדכן אם סוג השירות השתנה מכללית למושלם
                    const isNewServiceType = existing && existing.serviceType !== doc.serviceType;

                    if (!existing || (existingIsMissingInfo && newHasInfo) || isNewServiceType) {
                        doctorsMap.set(doc.key, doc);
                        updatedOrAdded++;
                    }
                }
            });

            if (updatedOrAdded > 0) {
                const doctorsList = Array.from(doctorsMap.values()).sort((a, b) => a.label.localeCompare(b.label));
                fs.writeFileSync(outputPath, `export const AVAILABLE_DOCTORS = ${JSON.stringify(doctorsList, null, 4)};\n`, 'utf8');
                
                process.stdout.write('\x07'); // צליל ביפ
                console.log(`✅ עודכנו/נוספו ${updatedOrAdded} רופאים עם נתונים נקיים. (סה"כ: ${doctorsMap.size})`);
            }
        } catch (e) {
            // שגיאה שקטה בזמן טעינת עמודים
        }
    };

    await page.goto('https://www.clalit.co.il/he/Pages/searchresult.aspx?cat=2', { waitUntil: 'domcontentloaded' });

    setInterval(async () => {
        if (!page.isClosed()) {
            await scrapeCurrentView();
        }
    }, 2500);

    page.on('close', () => {
        console.log(`🏁 הסריקה הסתיימה. הנתונים נשמרו ב-${outputPath}`);
        process.exit();
    });
}

interactiveFetch();
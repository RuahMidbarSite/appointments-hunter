import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    const reportPath = path.join(process.cwd(), 'reports_history.log');
    
    if (!fs.existsSync(reportPath)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send('<h2 style="text-align:center; font-family:sans-serif; margin-top:50px;">טרם נמצאו נתונים בלוג</h2>');
    }

    try {
        const fileContent = fs.readFileSync(reportPath, 'utf8');
        const lines = fileContent.trim().split('\n').reverse();
        
        let appointmentsFound = 0;
        const citiesCount = {};
        const groupCount = {}; 
        const hoursCount = {};

    const colorPalette = {
            'אורתופדיה': '#312e81', // כחול נייבי כהה מאוד
            'אורולוגיה': '#f59e0b', // כתום ענבר
            'ניירולוגיה': '#d946ef', // פוקסיה חזק
            'אף אוזן גרון': '#6366f1', // אינדיגו
            'אונקולוגיה': '#ef4444', // אדום חי
            'אלרגיה': '#fb7185', // ורוד אפרסק
            'אנדוקרינולוגיה': '#8b5cf6', // סגול לילך
            'גסטרואנטרולוגיה': '#991b1b', // בורדו יין
            'גריאטריה': '#78350f', // חום אדמה
            'המטולוגיה': '#ec4899', // ורוד מג'נטה
            'EMG': '#475569', // אפור פלדה
            'כירורגיה': '#ca8a04', // חרדל כהה
            'נפרולוגיה': '#2563eb', // כחול רויאל
            'עור': '#fb923c', // כתום בהיר
            'עיניים': '#581c87', // סגול חציל עמוק
            'ראומטולוגיה': '#4ade80', // ירוק ליים (רחוק מהטורקיז)
            'כללי/אחר': '#64748b'    
        };

        const logEntriesHtml = lines.map(line => {
            if (line.includes('נמצא תור:')) {
                appointmentsFound++;
                
                const extract = (key) => {
                    const regex = new RegExp(`${key}:\\s*([^|\\n]+)`);
                    const match = line.match(regex);
                    return match ? match[1].trim() : null;
                };

                const city = extract('עיר') || 'לא ידוע';
                let group = extract('תחום');

                if (!group) {
                    const docName = extract('רופא');
                    if (docName) {
                        if (docName.includes('דאבוש') || docName.includes('פינחסוב')) group = 'אורתופדיה';
                        else if (docName.includes('שיף')) group = 'אורולוגיה';
                        else if (docName.includes('אבו עצב')) group = 'ניירולוגיה';
                    }
                }
                
                if (city !== 'לא ידוע') citiesCount[city] = (citiesCount[city] || 0) + 1;

                const safeGroup = group || 'כללי/אחר';
                groupCount[safeGroup] = (groupCount[safeGroup] || 0) + 1;

                const hourMatch = line.match(/\[\d{1,2}[./]\d{1,2}[./]\d{4},\s*(\d{1,2}):\d{2}:\d{2}/);
                if (hourMatch) {
                    const hour = hourMatch[1].padStart(2, '0');
                    if (!hoursCount[hour]) hoursCount[hour] = { total: 0, groups: {}, cities: {} };
                    hoursCount[hour].total++;
                    hoursCount[hour].groups[safeGroup] = (hoursCount[hour].groups[safeGroup] || 0) + 1;
                    hoursCount[hour].cities[city] = (hoursCount[hour].cities[city] || 0) + 1;
                }

                const content = line.includes(']') ? line.split(']')[1].trim() : line;
                return `<div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:8px; border-radius:10px; margin-bottom:6px; font-family:sans-serif; font-size:13px; color:#14532d;">
                            <b>🎯</b> ${content}
                        </div>`;
            }
            return '';
        }).join('');

        const maxAppointmentsInHour = Math.max(...Object.values(hoursCount).map(h => h.total), 1);

        const heatMapHtml = Object.entries(hoursCount).sort().map(([h, data]) => {
            const segments = Object.entries(data.groups).map(([groupName, count]) => {
                const width = (count / data.total) * 100;
                const color = colorPalette[groupName] || '#0d9488';
                return `<div style="width:${width}%; background:${color}; height:100%;"></div>`;
            }).join('');

            const topCities = Object.entries(data.cities)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, count]) => `${name} (${count})`)
                .join(', ');

            // הגבלת רוחב העמודה ל-50% מהשטח הזמין כדי להשאיר מקום לטקסט
            const totalWidth = (data.total / maxAppointmentsInHour) * 50;

            return `
            <div style="margin-bottom:10px; font-family:sans-serif; display:flex; align-items:flex-start; gap:12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
                <span style="width:50px; font-weight:bold; color:#1e293b; font-size:14px; padding-top:2px;">${h}:00</span>
                <div style="flex:1; display:flex; align-items:center; gap:10px; flex-wrap: wrap;">
                    <div style="flex-shrink:0; width:${totalWidth}%; background:#f1f5f9; height:18px; border-radius:4px; overflow:hidden; display:flex; border:1px solid #e2e8f0;">
                        ${segments}
                    </div>
                    <span style="font-weight:900; color:#1e293b; font-size:14px; min-width:30px;">${data.total}</span>
                    <span style="font-size:12px; color:#64748b; line-height:1.4; max-width: 400px;">${topCities}</span>
                </div>
            </div>`;
        }).join('');

 const legendHtml = Object.entries(colorPalette).map(([name, color]) => `
            <div style="display:flex; align-items:center; gap:10px; font-size:17px; font-weight:900; color:#0f172a; width: 19%; margin-bottom: 12px;">
                <div style="width:20px; height:20px; background:${color}; border-radius:5px; flex-shrink:0; border: 1px solid rgba(0,0,0,0.2);"></div>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</span>
            </div>
        `).join('');

        const htmlContent = `
            <html dir="rtl" lang="he">
            <head><meta charset="UTF-8"><title>דוח פעילות</title></head>
            <body style="background:#f8fafc; padding:20px; font-family:sans-serif; text-align:right; color:#1e293b;">
                <div style="max-width:1000px; margin:0 auto; background:white; padding:30px; border-radius:30px; border:1px solid #e2e8f0;">
                    
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                        <h1 style="font-size:26px; margin:0; font-weight:900; color:#0f172a;">📋 סיכום פעילות</h1>
                        <button onclick="window.print()" style="background:#0f172a; color:white; border:none; padding:10px 20px; border-radius:10px; font-weight:bold; cursor:pointer; transition: opacity 0.2s;" class="no-print" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">🖨️ PDF</button>
                    </div>

                  <div style="display:flex; flex-flow: column wrap; height: 160px; width: 100%; align-content: flex-start; gap: 0 20px; margin-bottom: 35px; background: #f8fafc; padding: 25px; border-radius: 25px; border: 1px solid #e2e8f0; box-shadow: inset 0 2px 6px rgba(0,0,0,0.03);">
                        ${legendHtml}
                    </div>

                    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:20px; margin-bottom:30px;">
                        <div style="background:#f0fdfa; border: 3px solid #00a6a0; padding:20px; border-radius:24px; color:#007a75; text-align:center; box-shadow: 0 4px 12px rgba(0, 166, 160, 0.1);">
                            <div style="font-size:16px; font-weight:bold; color:#00a6a0; margin-bottom:5px;">תורים</div>
                            <div style="font-size:42px; font-weight:900;">${appointmentsFound}</div>
                        </div>
                        <div style="background:#f0fdfa; border: 3px solid #00a6a0; padding:20px; border-radius:24px; color:#007a75; text-align:center; box-shadow: 0 4px 12px rgba(0, 166, 160, 0.1);">
                            <div style="font-size:16px; font-weight:bold; color:#00a6a0; margin-bottom:5px;">ערים</div>
                            <div style="font-size:42px; font-weight:900;">${Object.keys(citiesCount).length}</div>
                        </div>
                        <div style="background:#f0fdfa; border: 3px solid #00a6a0; padding:20px; border-radius:24px; color:#007a75; text-align:center; box-shadow: 0 4px 12px rgba(0, 166, 160, 0.1);">
                            <div style="font-size:16px; font-weight:bold; color:#00a6a0; margin-bottom:5px;">תחומים</div>
                            <div style="font-size:42px; font-weight:900;">${Object.keys(groupCount).length}</div>
                        </div>
                    </div>

                    <div style="background:#fff; border:1px solid #e2e8f0; padding:20px; border-radius:20px; margin-bottom:25px;">
                        <h3 style="margin:0 0 15px 0; font-size:18px; font-weight:900; border-bottom:2px solid #f1f5f9; padding-bottom:10px;">⏰ שעות זהב</h3>
                        ${heatMapHtml}
                    </div>

                    <h3 style="font-size:18px; font-weight:900; margin-bottom:15px;">📜 היסטוריה</h3>
                    <div style="max-height:300px; overflow-y:auto; background:#f8fafc; padding:15px; border-radius:15px;">
                        ${logEntriesHtml}
                    </div>
                </div>
                <style>@media print {.no-print {display:none} body {padding:0}}</style>
            </body>
            </html>
        `;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(htmlContent);
    } catch (e) { 
        return res.status(500).send("Error"); 
    }
}
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
            'אורתופדיה': '#312e81',
            'אורולוגיה': '#f59e0b',
            'נוירולוגיה': '#d946ef',
            'אף אוזן גרון': '#6366f1',
            'אונקולוגיה': '#ef4444',
            'אלרגיה': '#fb7185',
            'אנדוקרינולוגיה': '#8b5cf6',
            'גסטרואנטרולוגיה': '#991b1b',
            'גריאטריה': '#78350f',
            'המטולוגיה': '#ec4899',
            'EMG': '#475569',
            'כירורגיה': '#ca8a04',
            'נפרולוגיה': '#2563eb',
            'עור': '#fb923c',
            'עיניים': '#581c87',
            'ראומטולוגיה': '#4ade80',
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
                return `<div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:8px; border-radius:10px; margin-bottom:6px; font-family:sans-serif; font-size:13px; color:#14532d;">🎯 ${content}</div>`;
            }
            return '';
        }).join('');

        const maxAppointmentsInHour = Math.max(...Object.values(hoursCount).map(h => h.total), 1);

        const heatMapHtml = Object.entries(hoursCount).sort().map(([h, data]) => {
            const segments = Object.entries(data.groups).map(([groupName, count], idx, arr) => {
                const width = (count / data.total) * 100;
                const color = colorPalette[groupName] || '#0d9488';
                const borderRadius = `${idx === 0 ? '4px 0 0 4px' : ''} ${idx === arr.length - 1 ? '0 4px 4px 0' : ''}`;
                return `<div class="segment" data-tooltip="${groupName}: ${count}" style="width:${width}%; background:${color}; height:100%; border-radius:${borderRadius}; --bg-color:${color};"></div>`;
            }).join('');

            const topCities = Object.entries(data.cities).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, c]) => `${n} (${c})`).join(', ');
            const totalWidth = (data.total / maxAppointmentsInHour) * 50;

            return `
            <div style="margin-bottom:8px; font-family:sans-serif; display:flex; align-items:center; gap:12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">
                <span style="width:50px; font-weight:bold; color:#1e293b; font-size:14px;">${h}:00</span>
                <div style="flex:1; display:flex; align-items:center; gap:10px;">
                    <div style="flex-shrink:0; width:${totalWidth}%; background:#f1f5f9; height:18px; border-radius:4px; display:flex; border:1px solid #e2e8f0; position:relative;">
                        ${segments}
                    </div>
                    <span style="font-weight:900; color:#1e293b; font-size:14px; min-width:30px;">${data.total}</span>
                    <span style="font-size:12px; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:400px;">${topCities}</span>
                </div>
            </div>`;
        }).join('');

        const legendHtml = Object.entries(colorPalette).map(([name, color]) => `
            <div style="display:flex; align-items:center; gap:6px; font-size:15px; font-weight:900; color:#1e293b;">
                <div style="width:14px; height:14px; background:${color}; border-radius:4px; flex-shrink:0;"></div>
                <span style="white-space: nowrap;">${name}</span>
            </div>`).join('');

        const htmlContent = `
            <html dir="rtl" lang="he">
            <head>
                <meta charset="UTF-8"><title>דוח פעילות</title>
                <style>
                    .segment { position: relative; cursor: pointer; }
                    .segment:hover::after {
                        content: attr(data-tooltip); position: absolute; bottom: 150%; left: 50%; transform: translateX(-50%);
                        background: var(--bg-color, #1e293b); color: white; padding: 6px 12px; border-radius: 6px;
                        font-size: 14px; font-weight: bold; white-space: nowrap; z-index: 10000; box-shadow: 0 4px 10px rgba(0,0,0,0.3); pointer-events: none;
                    }
                    .segment:hover::before {
                        content: ""; position: absolute; bottom: 120%; left: 50%; transform: translateX(-50%);
                        border: 6px solid transparent; border-top-color: var(--bg-color, #1e293b); z-index: 10000; pointer-events: none;
                    }
                    @media print {.no-print {display:none} body {padding:0}}
                </style>
            </head>
            <body style="background:#f8fafc; padding:10px; font-family:sans-serif; text-align:right; color:#1e293b;">
                <div style="max-width:1000px; margin:0 auto; background:white; padding:15px; border-radius:20px; border:1px solid #e2e8f0;">
                    <div style="display:flex; justify-content:space-between; align-items: center; margin-bottom: 12px; background: #f8fafc; padding: 12px 15px; border-radius: 12px; border: 1px solid #e2e8f0;">
                        <div style="display:flex; flex-wrap: wrap; gap: 6px 18px; flex: 1; justify-content: flex-start;">
                            ${legendHtml}
                        </div>
                        <button onclick="window.print()" style="background:#0f172a; color:white; border:none; padding:8px 20px; border-radius:8px; font-weight:bold; cursor:pointer; margin-right: 20px;" class="no-print">🖨️ PDF</button>
                    </div>

                    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-bottom:12px;">
                        <div style="background:#f0fdfa; border: 2px solid #00a6a0; padding:6px 10px; border-radius:15px; text-align:center;">
                            <div style="font-size:13px; font-weight:bold; color:#00a6a0;">תורים</div>
                            <div style="font-size:32px; font-weight:900; line-height:1;">${appointmentsFound}</div>
                        </div>
                        <div style="background:#f0fdfa; border: 2px solid #00a6a0; padding:6px 10px; border-radius:15px; text-align:center;">
                            <div style="font-size:13px; font-weight:bold; color:#00a6a0;">ערים</div>
                            <div style="font-size:32px; font-weight:900; line-height:1;">${Object.keys(citiesCount).length}</div>
                        </div>
                        <div style="background:#f0fdfa; border: 2px solid #00a6a0; padding:6px 10px; border-radius:15px; text-align:center;">
                            <div style="font-size:13px; font-weight:bold; color:#00a6a0;">תחומים</div>
                            <div style="font-size:32px; font-weight:900; line-height:1;">${Object.keys(groupCount).length}</div>
                        </div>
                    </div>

                    <div style="background:#fff; border:1px solid #e2e8f0; padding:15px; border-radius:20px; margin-bottom:15px;">
                        <h3 style="margin:0 0 10px 0; font-size:18px; font-weight:900; border-bottom:2px solid #f1f5f9; padding-bottom:5px;">⏰ שעות זהב</h3>
                        ${heatMapHtml}
                    </div>

                    <h3 style="font-size:18px; font-weight:900; margin-bottom:10px;">📜 היסטוריה</h3>
                    <div style="max-height:200px; overflow-y:auto; background:#f8fafc; padding:10px; border-radius:15px;">${logEntriesHtml}</div>
                </div>
            </body>
            </html>
        `;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(htmlContent);
    } catch (e) { 
        return res.status(500).send("Error"); 
    }
}
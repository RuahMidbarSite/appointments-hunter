import React, { useState, useRef, useEffect } from 'react';
import { CLALIT_GROUPS, CLALIT_SPECIALIZATIONS } from '../scrapers/health/constants/professions';
import { AVAILABLE_CITIES } from '../scrapers/health/constants/cities';

// ייבוא קבצי הרופאים
import { AVAILABLE_DOCTORS as urologyDoctors } from '../scrapers/health/constants/urology';
import { AVAILABLE_DOCTORS as orthopedicsDoctors } from '../scrapers/health/constants/orthopedics';
import { AVAILABLE_DOCTORS as gastroDoctors } from '../scrapers/health/constants/gastroenterology';
import { AVAILABLE_DOCTORS as neurologyDoctors } from '../scrapers/health/constants/neurology';
import { AVAILABLE_DOCTORS as cardioDoctors } from '../scrapers/health/constants/cardiology';
import { AVAILABLE_DOCTORS as endoDoctors } from '../scrapers/health/constants/Endocrinology';
import { AVAILABLE_DOCTORS as dermDoctors } from '../scrapers/health/constants/Dermatology';

const DOCTORS_DATABASE = {
    "אורולוגיה": urologyDoctors,
    "אורתופדיה": orthopedicsDoctors,
    "גסטרואנטרולוגיה": gastroDoctors,
    "נוירולוגיה": neurologyDoctors,
   "קרדיולוגיה": cardioDoctors,
    "אנדוקרינולוגיה": endoDoctors,
    "עור": dermDoctors
};

const MultiSelectDropdown = ({ options, selected, onChange, placeholder, isObject = false, focusClass, isMulti = true }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef(null);

    const filteredOptions = (Array.isArray(options) ? options : []).filter(opt => {
        const text = String(isObject ? (opt?.label || '') : (opt || ''));
        return text.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const toggleOption = (option) => {
        const value = isObject ? (option.key || option.id) : option;
        if (isMulti) {
            if (selected.includes(value)) {
                onChange(selected.filter(item => item !== value));
            } else {
                onChange([...selected, value]);
            }
        } else {
            onChange([value]);
            setIsOpen(false);
        }
        setSearchTerm(''); 
    };

    const getSelectedLabels = () => {
        if (!selected || selected.length === 0) return placeholder;
        if (!isObject) return String(selected.join(', '));
        return selected.map(val => {
            const found = (options || []).find(o => String(o.key || o.id) === String(val));
            return found ? String(found.shortLabel || found.label || found.id) : String(val);
        }).join(', ');
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <div className="relative flex items-center">
               <input 
                    type="text"
                    className={`w-full px-4 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-800 text-xl font-medium shadow-sm outline-none focus:ring-2 ${focusClass}`}
                    placeholder={isOpen && selected.length > 0 ? getSelectedLabels() : placeholder}
                    value={isOpen ? searchTerm : getSelectedLabels()}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        if (!isOpen) setIsOpen(true);
                    }}
                    onFocus={() => { setIsOpen(true); setSearchTerm(''); }}
                />
                {selected.length > 0 && !isOpen && (
                    <button onClick={(e) => { e.stopPropagation(); onChange([]); }} className="absolute left-3 bg-gray-100 text-gray-500 w-8 h-8 rounded-full flex items-center justify-center text-xl">✕</button>
                )}
            </div>
            {isOpen && (
                <div className="absolute z-50 min-w-full mt-1 right-0 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                    {filteredOptions.length > 0 ? filteredOptions.map(option => {
                        const value = isObject ? (option.key || option.id) : option;
                        const labelStr = isObject ? option.label : String(option);
                        const isChecked = selected.includes(value);
                        const name = labelStr.includes('|') ? labelStr.split('|')[0].trim() : labelStr;

                        return (
                            <div key={String(value)} className={`flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer text-xl border-b border-gray-50 ${isChecked ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-800'}`} onClick={() => toggleOption(option)}>
                                {isMulti && <input type="checkbox" className="ml-3 w-5 h-5" checked={!!isChecked} readOnly />}
                                <span className="flex-1 text-right">{name}</span>
                            </div>
                        );
                    }) : <div className="p-4 text-xl text-gray-500 text-center">אין תוצאות</div>}
                </div>
            )}
        </div>
    );
};

export default function BotDashboard() {
   const [config, setConfig] = useState({
       userId: '', userCode: '', password: '', familyMember: '', 
       loginMode: 'password',
       selectedCities: [], includeSurrounding: true, selectedDoctors: [], 
       selectedGroup: '', selectedSpecialization: '', insuranceType: 'הכל', 
       endDate: '', runInLoop: false, loopFrequency: "10-15",
       startTime: '08:00', endTime: '22:00', lastFoundDate: '', doctorDates: {}
    });

    const [botLiveStatus, setBotLiveStatus] = useState('idle');
    const [timeLeft, setTimeLeft] = useState(null);

    useEffect(() => {
        let timer;
        if (botLiveStatus === 'idle' && config.runInLoop) {
            const updateTimerFromServer = () => {
                if (config.nextRunTime) {
                    const now = Date.now();
                    const diffSeconds = Math.max(0, Math.floor((config.nextRunTime - now) / 1000));
                    setTimeLeft(diffSeconds);
                } else {
                    setTimeLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
                }
            };
            updateTimerFromServer();
            timer = setInterval(updateTimerFromServer, 1000);
        } else { if (timeLeft !== null) setTimeLeft(null); }
        return () => clearInterval(timer);
    }, [botLiveStatus, config.runInLoop, config.nextRunTime]); 

    const formatTime = (seconds) => {
        if (seconds === null) return "--:--";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    useEffect(() => {
        let hasLoadedInitialConfig = false;
        const fetchBotData = async () => {
            try {
                const response = await fetch(`/api/save-config?t=${new Date().getTime()}`);
                if (response.ok) {
                    const data = await response.json();
                    if (!hasLoadedInitialConfig) {
                        setConfig(prev => ({ ...prev, ...data }));
                        hasLoadedInitialConfig = true;
                    } else {
                        setConfig(prev => ({ 
                            ...prev, lastFoundDate: data.lastFoundDate || prev.lastFoundDate, 
                            doctorDates: data.doctorDates || prev.doctorDates || {}, 
                            nextRunTime: data.nextRunTime !== undefined ? data.nextRunTime : prev.nextRunTime 
                        }));
                    }
                    setBotLiveStatus(data.botStatus || 'idle');
                }
            } catch (error) { console.error("Sync error:", error); }
        };
        fetchBotData(); 
        const interval = setInterval(fetchBotData, 3000); 
        return () => clearInterval(interval);
    }, []);

    const handleChange = (e) => { setConfig(prev => ({ ...prev, [e.target.name]: e.target.value })); };
    const handleAutoSave = async (updated) => { 
        await fetch('/api/save-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...updated, action: 'save_only' }) }); 
    };

    const handleLoginModeChange = (mode) => {
        const updated = { ...config, loginMode: mode };
        setConfig(updated);
        handleAutoSave(updated);
    };

    const handleCitiesChange = (newCities) => {
        const updated = { ...config, selectedCities: newCities, selectedDoctors: [], selectedDoctorNames: [] };
        setConfig(updated); handleAutoSave(updated);
    };

    const handleDoctorsChange = (newDoctors) => {
        const names = newDoctors.map(docId => {
            for (const db of Object.values(DOCTORS_DATABASE)) {
                const found = db.find(d => (d.key || d.id) === docId);
                if (found) return found.label.split('|')[0].trim();
            }
            return docId;
        });
        
        const updated = { ...config, selectedDoctors: newDoctors, selectedDoctorNames: names };
        setConfig(updated); handleAutoSave(updated);
    };

    const handleRun = async (isSingle = false) => {
        const updated = { ...config, runInLoop: !isSingle };
        const res = await fetch('/api/save-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
        if (res.ok) { setConfig(updated); setBotLiveStatus(isSingle ? 'idle' : 'active'); }
    };

    const handleStop = async () => {
        setConfig(prev => ({ ...prev, runInLoop: false })); setBotLiveStatus('idle');
        await fetch('/api/save-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop' }) });
    };

    const getDoctorsList = () => {
        if (!config.selectedGroup || !config.selectedSpecialization) return [];
        const specs = CLALIT_SPECIALIZATIONS[config.selectedGroup];
        const spec = Object.values(specs || {}).find(s => String(s.id) === String(config.selectedSpecialization));
        if (!spec) return [];
        const matchedKey = Object.keys(DOCTORS_DATABASE).find(key => spec.name.includes(key));
        let list = matchedKey ? DOCTORS_DATABASE[matchedKey] : [];
        if (config.insuranceType === 'כללית') list = list.filter(d => d.serviceType === 'כללית');
        else if (config.insuranceType === 'מושלם') list = list.filter(d => d.serviceType === 'מושלם');
        if (config.selectedCities?.length > 0) list = list.filter(d => config.selectedCities.some(city => d.label.includes(city)));
        return list.map(doc => ({ ...doc, shortLabel: doc.label.split('|')[0].trim() }));
    };

const [showPassword, setShowPassword] = useState(false);
const isSmsMode = config.loginMode === 'sms';    const isLoopActive   = botLiveStatus === 'active' && config.runInLoop;
    const isSingleActive = botLiveStatus === 'active' && !config.runInLoop;
    const isWaiting      = botLiveStatus === 'idle' && timeLeft !== null && timeLeft > 0;

    return (
        <div className="h-screen bg-gray-50 flex flex-col overflow-hidden font-sans">
            <main className="flex-1 flex flex-col overflow-hidden bg-[#f8fbfa]">
                
                {/* 3 Columns Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 border-b border-gray-200 bg-white shrink-0 items-start">
                    
                    {/* Column 1: Connection (Right) */}
                    <div className="p-3 border-l border-gray-100 flex flex-col gap-2">
                        <div className="flex items-center justify-between mb-1">
                            <div className="text-right">
                                <h1 className="text-2xl font-black text-[#005a4c] leading-none">צייד התורים</h1>
                                <p className="text-[#00a896] text-xs font-bold leading-tight">סריקה חכמה ללקוחות כללית</p>
                            </div>
                            {config.lastFoundDate && (
                                <div className="bg-amber-50 rounded-xl border-2 border-amber-200 py-1.5 px-3 shadow-sm max-w-[320px]">
                                    <div className="flex items-center gap-2 border-b border-amber-200 mb-1 pb-0.5">
                                        <span className="text-xs font-black text-amber-800 uppercase opacity-75 whitespace-nowrap">התור המוקדם ביותר:</span>
                                        <span className="text-lg font-black text-amber-900 leading-none">
                                            {config.lastFoundDate.split('-')[0].trim()}
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-amber-800 truncate leading-tight">
                                        {config.lastFoundDate.split('-').slice(1).join('-').trim()}
                                    </p>
                                </div>
                            )}
                        </div>

                        <section className="bg-blue-50/40 border-2 border-blue-100 rounded-2xl p-3 shadow-sm flex flex-col">
                            <h2 className="text-2xl font-black text-blue-800 mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span> פרטי התחברות
                            </h2>

                            {/* Login Mode Tabs */}
                            <div className="flex rounded-xl overflow-hidden border border-blue-200 mb-3 text-base font-bold">
                                <button
                                    onClick={() => handleLoginModeChange('password')}
                                    className={`flex-1 py-1.5 text-center transition-all ${!isSmsMode ? 'bg-blue-600 text-white shadow-inner' : 'bg-white text-blue-600 hover:bg-blue-50'}`}
                                >
                                    קוד משתמש וסיסמה
                                </button>
                                <button
                                    onClick={() => handleLoginModeChange('sms')}
                                    className={`flex-1 py-1.5 text-center transition-all border-r border-blue-200 ${isSmsMode ? 'bg-blue-600 text-white shadow-inner' : 'bg-white text-blue-600 hover:bg-blue-50'}`}
                                >
                                    📱 קוד חד-פעמי
                                </button>
                            </div>

                            <div className="space-y-1.5">
                                {/* תעודת זהות – תמיד מוצג */}
                                <div className="flex items-center gap-2">
                                    <label className="text-base font-bold text-gray-500 w-24 shrink-0 text-left">תעודת זהות</label>
                                    <input type="text" name="userId" value={config.userId} onChange={handleChange} className="flex-1 px-3 py-1.5 text-lg font-bold border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white" />
                                </div>

                                {/* שדות סיסמה – מוצגים רק במצב password */}
                                {!isSmsMode && (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <label className="text-base font-bold text-gray-500 w-24 shrink-0 text-left">קוד</label>
                                            <input type="text" name="userCode" value={config.userCode} onChange={handleChange} className="flex-1 px-3 py-1.5 text-lg font-bold border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="text-base font-bold text-gray-500 w-24 shrink-0 text-left">סיסמה</label>
<div className="flex-1 relative">
    <input type={showPassword ? "text" : "password"} name="password" value={config.password} onChange={handleChange} className="w-full px-3 py-1.5 text-lg font-bold border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white pr-3 pl-8" />
    <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">
        {showPassword ? "🙈" : "👁️"}
    </button>
</div>                                        </div>
                                    </>
                                )}

                                {/* הודעת SMS – מוצגת רק במצב sms כשהבוט פעיל */}
                                {isSmsMode && botLiveStatus === 'active' && (
                                    <div className="flex items-center gap-2 bg-blue-100 border border-blue-300 rounded-xl px-3 py-2 text-blue-800 font-bold text-base">
                                        <span className="animate-pulse text-xl">📱</span>
                                        <span>קוד נשלח לנייד – הזן אותו בדפדפן</span>
                                    </div>
                                )}

                                {/* שם בן משפחה – תמיד מוצג */}
                                <div className="flex items-center gap-2">
                                    <label className="text-base font-bold text-gray-500 w-24 shrink-0 text-left">שם</label>
                                    <input type="text" name="familyMember" value={config.familyMember} onChange={handleChange} className="flex-1 px-3 py-1.5 text-lg font-bold border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white" />
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Column 2: Search Settings (Center) */}
                    <div className="p-3 border-l border-gray-100 flex flex-col gap-2">
                        <section className="bg-teal-50/40 border-2 border-teal-100 rounded-2xl p-3 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-2xl font-black text-teal-800 flex items-center gap-2">
                                    <span className="w-1.5 h-6 bg-teal-500 rounded-full"></span> הגדרות חיפוש
                                </h2>
                                <img src="/clalit-logo.png" alt="כללית" className="h-8 object-contain" />
                            </div>
                            <div className="space-y-2">
                                <div className="space-y-0.5"><label className="text-base font-bold text-gray-500 pr-1">תחום</label><MultiSelectDropdown options={Object.values(CLALIT_GROUPS).map(g => ({ id: String(g.id), label: g.name }))} selected={config.selectedGroup ? [String(config.selectedGroup)] : []} onChange={(val) => setConfig({...config, selectedGroup: val[0], selectedSpecialization: '', selectedDoctors: []})} placeholder="בחר תחום..." isObject isMulti={false} focusClass="focus:ring-[#00a896]" /></div>
                                <div className="space-y-0.5"><label className="text-base font-bold text-gray-500 pr-1">מקצוע</label><MultiSelectDropdown options={CLALIT_SPECIALIZATIONS[config.selectedGroup] ? Object.values(CLALIT_SPECIALIZATIONS[config.selectedGroup]).map(s => ({ id: String(s.id), label: s.name })) : []} selected={config.selectedSpecialization ? [String(config.selectedSpecialization)] : []} onChange={(val) => setConfig({...config, selectedSpecialization: val[0], selectedDoctors: []})} placeholder="בחר מקצוע..." isObject isMulti={false} focusClass="focus:ring-[#00a896]" /></div>
                                <div className="space-y-0.5"><label className="text-base font-bold text-gray-500 pr-1">ערים לסריקה</label><MultiSelectDropdown options={AVAILABLE_CITIES} selected={config.selectedCities} onChange={handleCitiesChange} placeholder="בחר ערים לסריקה..." isObject focusClass="focus:ring-[#00a896]" /></div>
                                <div className="space-y-0.5"><label className="text-base font-bold text-gray-500 pr-1">רופאים מועדפים</label><MultiSelectDropdown options={getDoctorsList()} selected={config.selectedDoctors} onChange={handleDoctorsChange} placeholder="חפש רופאים..." isObject focusClass="focus:ring-[#00a896]" /></div>
                                
                                <div className="flex items-center justify-between bg-white p-2 rounded-2xl border border-teal-100">
                                    <label className="flex items-center gap-2 text-lg font-bold text-gray-600 cursor-pointer leading-none"><input type="checkbox" checked={config.includeSurrounding} onChange={(e) => setConfig({...config, includeSurrounding: e.target.checked})} className="w-5 h-5 accent-[#00a896]" /> כולל יישובים בסביבה</label>
                                    <div className="flex gap-2">
                                        {['הכל', 'כללית', 'מושלם'].map(t => (
                                            <label key={t} className="flex items-center gap-1.5 cursor-pointer text-base font-bold text-gray-500 leading-none"><input type="radio" name="ins" value={t} checked={config.insuranceType === t} onChange={handleChange} className="w-4 h-4 accent-[#00a896]" /> {t}</label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Column 3: Scheduling (Left) */}
                    <div className="p-3 flex flex-col gap-2">
                        <section className="bg-purple-50/40 border-2 border-purple-100 rounded-2xl p-3 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-2xl font-black text-[#005a4c] flex items-center gap-2">
                                    <span className="w-1.5 h-6 bg-[#8c4391] rounded-full"></span> תזמון
                                </h2>
                                {/* אינדיקטור מצב */}
                                <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm border transition-all min-w-[155px]
                                    ${isLoopActive   ? 'bg-green-50 border-green-200' :
                                      isSingleActive ? 'bg-blue-50 border-blue-200' :
                                      isWaiting      ? 'bg-amber-50 border-amber-200' :
                                                       'bg-gray-50 border-gray-200'}`}>
                                    <div className={`w-2.5 h-2.5 rounded-full shrink-0
                                        ${isLoopActive   ? 'bg-green-500 animate-pulse' :
                                          isSingleActive ? 'bg-blue-500 animate-pulse' :
                                          isWaiting      ? 'bg-amber-400 animate-pulse' :
                                                           'bg-gray-300'}`}>
                                    </div>
                                    <span className={`text-sm font-black leading-tight
                                        ${isLoopActive   ? 'text-green-700' :
                                          isSingleActive ? 'text-blue-700' :
                                          isWaiting      ? 'text-amber-700' :
                                                           'text-gray-400'}`}>
                                        {isLoopActive   ? 'רץ בלולאה' :
                                         isSingleActive ? 'בבדיקה' :
                                         isWaiting      ? `⏳ ${formatTime(timeLeft)} להמתנה` :
                                                          'במנוחה'}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="space-y-0.5">
                                    <label className="text-base font-bold text-gray-500 pr-1">עד תאריך יעד</label>
                                    <input type="date" name="endDate" value={config.endDate} onChange={handleChange} className="w-full px-3 py-1.5 text-lg font-bold border border-gray-200 rounded-xl bg-white outline-none" />
                                </div>
                                <div className="space-y-0.5">
                                    <label className="text-base font-bold text-gray-500 pr-1">תדירות סריקה</label>
                                    <select value={config.loopFrequency} onChange={(e) => setConfig({...config, loopFrequency: e.target.value})} className="w-full px-3 py-1.5 text-lg font-bold border border-gray-200 rounded-xl bg-white outline-none">
                                        <option value="10-15">בין 10 ל-15 דקות</option>
                                        <option value="25-30">בין 25 ל-30 דקות</option>
                                        <option value="40-45">בין 40 ל-45 דקות</option>
                                        <option value="55-60">בין 55 ל-60 דקות</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-0.5">
                                        <label className="text-base font-bold text-gray-500 pr-1">שעת התחלה</label>
                                        <input type="time" name="startTime" value={config.startTime} onChange={handleChange} className="w-full px-3 py-1.5 text-lg font-bold border border-gray-200 rounded-xl bg-white outline-none" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <label className="text-base font-bold text-gray-500 pr-1">שעת סיום</label>
                                        <input type="time" name="endTime" value={config.endTime} onChange={handleChange} className="w-full px-3 py-1.5 text-lg font-bold border border-gray-200 rounded-xl bg-white outline-none" />
                                    </div>
                                </div>
                            </div>
                        </section>
                        
                        <div className="grid grid-cols-2 gap-2 mt-1">
                            {/* כפתור לולאה */}
                            <button
                                onClick={() => handleRun(false)}
                                disabled={isSingleActive}
                                className={`py-2.5 text-white font-black text-xl rounded-2xl transition-all duration-150
                                    ${isLoopActive
                                        ? 'bg-[#007060] shadow-inner ring-2 ring-inset ring-[#005a4c] translate-y-0.5 cursor-default'
                                        : isSingleActive
                                            ? 'bg-[#00a896] opacity-30 grayscale cursor-not-allowed shadow-lg'
                                            : 'bg-[#00a896] hover:bg-[#008f80] shadow-lg active:translate-y-0.5 active:shadow-inner active:bg-[#007060] cursor-pointer'}`}
                            >
                                {isLoopActive ? '🔄 רץ בלולאה' : 'לולאה'}
                            </button>

                            {/* כפתור בדיקה */}
                            <button
                                onClick={() => handleRun(true)}
                                disabled={isLoopActive}
                                className={`py-2.5 text-white font-black text-xl rounded-2xl transition-all duration-150
                                    ${isSingleActive
                                        ? 'bg-[#004f80] shadow-inner ring-2 ring-inset ring-[#003d63] translate-y-0.5 cursor-default'
                                        : isLoopActive
                                            ? 'bg-[#007cc3] opacity-30 grayscale cursor-not-allowed shadow-lg'
                                            : 'bg-[#007cc3] hover:bg-[#0066a1] shadow-lg active:translate-y-0.5 active:shadow-inner active:bg-[#004f80] cursor-pointer'}`}
                            >
                                {isSingleActive ? '🔍 בודק...' : 'בדיקה'}
                            </button>

                            {/* כפתור עצור */}
                            <button
                                onClick={handleStop}
                                className="col-span-2 py-2.5 font-black text-xl rounded-2xl transition-all duration-150 bg-[#e11d48] text-white hover:bg-[#be123c] shadow-md active:translate-y-0.5 active:shadow-inner active:bg-[#9f0f35] cursor-pointer"
                            >
                                ⏹ עצור הכל
                            </button>

                            <a 
                                href="/api/download-report" 
                                download 
                                onClick={(e) => {
                                    const btn = e.currentTarget;
                                    btn.classList.add('ring-4', 'ring-gray-400/50', 'bg-gray-700');
                                    setTimeout(() => btn.classList.remove('ring-4', 'ring-gray-400/50', 'bg-gray-700'), 300);
                                }}
                                className="col-span-2 py-2 bg-gray-600 hover:bg-gray-700 text-white font-black text-lg rounded-2xl text-center flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                📄 דוח
                            </a>
                        </div>
                    </div>
                </div>

                {/* Results Section */}
                {config.selectedDoctors.length > 0 && (
                    <div className="flex-1 flex overflow-hidden bg-white shadow-inner border-t-2 border-gray-100">
                        <div className="w-[180px] p-4 border-l border-gray-100 flex flex-col items-center shrink-0 bg-gray-50/50 justify-center">
                            <h2 className="text-lg font-black text-[#005a4c] text-center leading-tight mb-2">תוצאות סריקה ורופאים</h2>
                            <span className="bg-blue-600 text-white text-3xl font-black px-8 py-2 rounded-full shadow-lg border-2 border-white">{config.selectedDoctors.length}</span>
                        </div>

                        <div className="flex-1 p-4 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {config.selectedDoctors.map(docId => {
                                    let docObj = null;
                                    for (const db of Object.values(DOCTORS_DATABASE)) {
                                        const found = db.find(d => (d.key || d.id) === docId);
                                        if (found) { docObj = found; break; }
                                    }
                                    if (!docObj) return null;
                                    const parts = docObj.label.split('|').map(p => p.trim());
                                    const name = parts[0];
                                    return (
                                        <div key={docId} className="bg-white p-4 rounded-[2rem] border-2 border-gray-100 shadow-xl relative hover:border-teal-400 transition-all flex flex-col justify-between min-h-[140px]">
                                            <button onClick={() => handleDoctorsChange(config.selectedDoctors.filter(id => id !== docId))} className="absolute top-4 left-4 text-gray-300 hover:text-red-500 text-xl font-black">✕</button>
                                            <div>
                                                <div className="font-black text-2xl text-gray-800 mb-2 leading-tight border-r-4 border-blue-500 pr-3">{name}</div>
                                                <div className="text-base text-gray-500 font-bold leading-tight space-y-1">
                                                    <div className="truncate"><span className="text-[#007cc3]">מרפאה:</span> {parts[2]}</div>
                                                    <div className="truncate"><span className="text-[#007cc3]">כתובת:</span> {parts[3]}</div>
                                                </div>
                                            </div>
                                            <div className="mt-3 pt-3 border-t-4 border-gray-50 flex items-center justify-between">
                                                <span className="text-xl font-black text-[#005a4c]">תור קרוב:</span>
                                                <span className="text-2xl font-black text-amber-700 bg-[#fff9e6] px-6 py-2 rounded-2xl border-2 border-[#fcefc7] shadow-sm">
                                                    {config.doctorDates[name] || "טרם נמצא"}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
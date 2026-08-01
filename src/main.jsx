import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Camera,
  CloudDownload,
  CloudUpload,
  Copy,
  Download,
  HeartPulse,
  ImagePlus,
  Import,
  KeyRound,
  LineChart,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import {
  createEmptyRecord,
  deleteImages,
  deleteRecord,
  exportBackup,
  getImage,
  importBackup,
  loadRecords,
  loadSettings,
  putImage,
  saveRecords,
  saveSettings,
  todayKey,
  upsertRecord,
} from "./storage.js";
import { buildDailySummary, chartSeries, completionScore, numeric } from "./insights.js";
import {
  downloadEncryptedBackup,
  loadSyncCode,
  saveSyncCode,
  uploadEncryptedBackup,
} from "./sync.js";
import "./styles.css";

const moods = ["很好", "普通", "疲累", "壓力大", "睡不夠"];
const knees = ["正常", "微痠", "疼痛", "腫脹", "休息中"];
const mealLabels = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐" };
const imageGroups = [
  { key: "breakfast", title: "早餐", kind: "meal" },
  { key: "lunch", title: "午餐", kind: "meal" },
  { key: "dinner", title: "晚餐", kind: "meal" },
  { key: "sleepImages", title: "睡眠截圖", kind: "direct" },
  { key: "exerciseImages", title: "運動截圖", kind: "direct" },
];

function App() {
  const [records, setRecords] = useState(() => loadRecords());
  const [settings, setSettings] = useState(() => loadSettings());
  const [selectedDate, setSelectedDate] = useState(() => todayKey());
  const [draft, setDraft] = useState(() => findOrCreate(loadRecords(), todayKey()));
  const [toast, setToast] = useState("");
  const [trendDays, setTrendDays] = useState(7);
  const [syncCode, setSyncCode] = useState(() => loadSyncCode());
  const [syncBusy, setSyncBusy] = useState(false);
  const fileImportRef = useRef(null);

  useEffect(() => {
    const next = findOrCreate(records, selectedDate);
    setDraft(next);
  }, [records, selectedDate]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
  }, []);

  const stats = useMemo(() => summarize(records, settings), [records, settings]);
  const trend = useMemo(() => chartSeries(records, trendDays), [records, trendDays]);
  const summary = useMemo(() => buildDailySummary(draft, records), [draft, records]);

  function commit(nextDraft = draft) {
    const next = upsertRecord(records, nextDraft);
    setRecords(next);
    saveRecords(next);
    pulse("已儲存");
  }

  async function removeCurrent() {
    const ids = collectImageIds(draft);
    await deleteImages(ids);
    const next = deleteRecord(records, draft.id);
    setRecords(next);
    saveRecords(next);
    setSelectedDate(todayKey());
    pulse("已刪除");
  }

  async function addImages(target, files) {
    const uploaded = [];
    for (const file of Array.from(files || [])) uploaded.push(await putImage(file));
    if (!uploaded.length) return;
    const next = clone(draft);
    if (mealLabels[target]) next.meals[target] = [...next.meals[target], ...uploaded];
    else next[target] = [...next[target], ...uploaded];
    setDraft(next);
    commit(next);
  }

  async function removeImage(target, imageId) {
    const next = clone(draft);
    if (mealLabels[target]) next.meals[target] = next.meals[target].filter((item) => item.id !== imageId);
    else next[target] = next[target].filter((item) => item.id !== imageId);
    await deleteImages([imageId]);
    setDraft(next);
    commit(next);
  }

  async function copySummary() {
    await navigator.clipboard.writeText(summary);
    pulse("摘要已複製");
  }

  async function downloadBackup() {
    const backup = await exportBackup(records, settings);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `health-commander-backup-${todayKey()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      const imported = await importBackup(backup);
      setRecords(imported.records);
      setSettings(imported.settings);
      pulse("備份已匯入");
    } catch (error) {
      pulse(error.message || "匯入失敗");
    } finally {
      event.target.value = "";
    }
  }

  async function uploadSync() {
    try {
      setSyncBusy(true);
      saveSyncCode(syncCode);
      const backup = await exportBackup(records, settings, { includeMedia: false });
      await uploadEncryptedBackup(syncCode, backup);
      pulse("已上傳同步");
    } catch (error) {
      pulse(error.message || "同步失敗");
    } finally {
      setSyncBusy(false);
    }
  }

  async function downloadSync() {
    try {
      setSyncBusy(true);
      saveSyncCode(syncCode);
      const backup = await downloadEncryptedBackup(syncCode);
      const imported = await importBackup(backup);
      setRecords(imported.records);
      setSettings(imported.settings);
      pulse("已下載同步");
    } catch (error) {
      pulse(error.message || "同步失敗");
    } finally {
      setSyncBusy(false);
    }
  }

  function updateField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function pulse(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Health Commander V1</p>
          <h1>今天的健康紀錄</h1>
        </div>
        <button className="icon-button" onClick={() => setSelectedDate(todayKey())} title="回到今天">
          <HeartPulse size={22} />
        </button>
      </header>

      <section className="today-strip" aria-label="今日概況">
        <Metric label="完成度" value={`${completionScore(draft)}%`} />
        <Metric label="體重" value={stats.latestWeight || "-"} unit="kg" />
        <Metric label="飲水" value={draft.water || "0"} unit="ml" />
      </section>

      <section className="panel editor-panel">
        <div className="section-title">
          <div>
            <h2>每日輸入</h2>
            <p>{selectedDate}</p>
          </div>
          <input
            className="date-input"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            aria-label="選擇日期"
          />
        </div>

        <div className="grid two">
          <Field label="早上體重 kg" value={draft.morningWeight} onChange={(value) => updateField("morningWeight", value)} inputMode="decimal" />
          <Field label="晚上體重 kg" value={draft.eveningWeight} onChange={(value) => updateField("eveningWeight", value)} inputMode="decimal" />
          <Field label="腰圍 cm" value={draft.waist} onChange={(value) => updateField("waist", value)} inputMode="decimal" />
          <Field label="飲水 ml" value={draft.water} onChange={(value) => updateField("water", value)} inputMode="numeric" />
        </div>

        <Segment label="精神" value={draft.mood} options={moods} onChange={(value) => updateField("mood", value)} />
        <Segment label="膝蓋狀況" value={draft.knee} options={knees} onChange={(value) => updateField("knee", value)} />

        <label className="field wide">
          <span>備註</span>
          <textarea value={draft.note} onChange={(event) => updateField("note", event.target.value)} rows="4" placeholder="今天飲食、運動、疼痛、睡眠感覺..." />
        </label>

        <div className="action-row">
          <button className="primary" onClick={() => commit()}>
            <Save size={18} /> 儲存
          </button>
          <button className="danger" onClick={removeCurrent} disabled={!records.some((record) => record.id === draft.id)}>
            <Trash2 size={18} /> 刪除本日
          </button>
        </div>
      </section>

      <section className="media-section">
        <div className="section-title">
          <div>
            <h2>照片與截圖</h2>
            <p>拍照會在手機開相機，相簿會開照片選擇器</p>
          </div>
        </div>
        <div className="media-grid">
          {imageGroups.map((group) => (
            <ImageBucket
              key={group.key}
              group={group}
              images={group.kind === "meal" ? draft.meals[group.key] : draft[group.key]}
              onAdd={(files) => addImages(group.key, files)}
              onRemove={(id) => removeImage(group.key, id)}
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <h2>趨勢</h2>
            <p>{trendDays} 日體重、腰圍、飲水</p>
          </div>
          <div className="seg small">
            {[7, 30].map((days) => (
              <button key={days} className={trendDays === days ? "active" : ""} onClick={() => setTrendDays(days)}>
                {days}日
              </button>
            ))}
          </div>
        </div>
        <TrendChart data={trend} />
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <h2>每日摘要</h2>
            <p>可直接貼到 ChatGPT 或保存</p>
          </div>
          <button className="icon-text" onClick={copySummary}>
            <Copy size={18} /> 複製
          </button>
        </div>
        <pre className="summary">{summary}</pre>
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <h2>備份與同步</h2>
            <p>同步文字資料；照片請用備份檔保存</p>
          </div>
        </div>
        <label className="field sync-code">
          <span><KeyRound size={16} /> 同步碼</span>
          <input
            value={syncCode}
            onChange={(event) => setSyncCode(event.target.value)}
            minLength="8"
            autoComplete="off"
            placeholder="自己設定，電腦和手機輸入同一組"
          />
        </label>
        <div className="backup-actions">
          <button className="icon-text" onClick={uploadSync} disabled={syncBusy}>
            <CloudUpload size={18} /> 上傳同步
          </button>
          <button className="icon-text" onClick={downloadSync} disabled={syncBusy}>
            <CloudDownload size={18} /> 下載同步
          </button>
        </div>
        <div className="backup-actions">
          <button className="icon-text" onClick={downloadBackup}>
            <Download size={18} /> 匯出備份
          </button>
          <button className="icon-text" onClick={() => fileImportRef.current?.click()}>
            <Import size={18} /> 匯入備份
          </button>
          <input ref={fileImportRef} hidden type="file" accept="application/json" onChange={handleImport} />
        </div>
        <div className="sync-reserved">
          <Activity size={18} />
          <span>Apple Health 自動同步：資料模型已預留，V1 不會連線或讀取健康權限。</span>
        </div>
      </section>

      <nav className="bottom-nav" aria-label="快速操作">
        <a href="#root"><HeartPulse size={20} /> 今日</a>
        <a href="#photos"><Camera size={20} /> 照片</a>
        <a href="#trend"><LineChart size={20} /> 趨勢</a>
        <button onClick={() => commit()}><Plus size={20} /> 儲存</button>
      </nav>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function Field({ label, value, onChange, inputMode }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} inputMode={inputMode} />
    </label>
  );
}

function Segment({ label, value, options, onChange }) {
  return (
    <div className="segment-group">
      <span>{label}</span>
      <div className="seg">
        {options.map((option) => (
          <button key={option} className={value === option ? "active" : ""} onClick={() => onChange(option)}>
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, unit }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {unit && <small>{unit}</small>}
    </div>
  );
}

function ImageBucket({ group, images, onAdd, onRemove }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  return (
    <article className="bucket" id={group.key === "breakfast" ? "photos" : undefined}>
      <div className="bucket-head">
        <h3>{group.title}</h3>
        <span>{images.length} 張</span>
      </div>
      <div className="bucket-actions">
        <button onClick={() => cameraRef.current?.click()} title={`${group.title} 拍照`}>
          <Camera size={18} /> 拍照
        </button>
        <button onClick={() => galleryRef.current?.click()} title={`${group.title} 相簿`}>
          <ImagePlus size={18} /> 相簿
        </button>
        <input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={(event) => onAdd(event.target.files)} />
        <input ref={galleryRef} hidden type="file" accept="image/*" multiple onChange={(event) => onAdd(event.target.files)} />
      </div>
      <div className="thumbs">
        {images.map((image) => (
          <Thumb key={image.id} image={image} onRemove={() => onRemove(image.id)} />
        ))}
      </div>
    </article>
  );
}

function Thumb({ image, onRemove }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true;
    getImage(image.id).then((item) => {
      if (active && item?.blob) setSrc(URL.createObjectURL(item.blob));
    });
    return () => {
      active = false;
      if (src) URL.revokeObjectURL(src);
    };
  }, [image.id]);
  return (
    <figure className="thumb">
      {src ? <img src={src} alt={image.name || "上傳圖片"} /> : <div className="thumb-empty"><Upload size={18} /></div>}
      <button onClick={onRemove} title="刪除圖片"><Trash2 size={15} /></button>
    </figure>
  );
}

function TrendChart({ data }) {
  const width = 640;
  const height = 220;
  const padding = 28;
  const weightPoints = points(data, "weight", width, height, padding);
  const waistPoints = points(data, "waist", width, height, padding);
  const waterPoints = points(data, "water", width, height, padding, true);
  return (
    <div className="chart-wrap" id="trend">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="健康趨勢圖">
        <rect x="0" y="0" width={width} height={height} rx="8" fill="#fffaf0" />
        {[0, 1, 2, 3].map((line) => (
          <line key={line} x1={padding} x2={width - padding} y1={padding + line * 50} y2={padding + line * 50} stroke="#e7dcc8" />
        ))}
        <Polyline points={weightPoints} color="#0f766e" />
        <Polyline points={waistPoints} color="#b45309" />
        <Polyline points={waterPoints} color="#2563eb" />
        {data.map((item, index) => (
          <text key={item.date} x={padding + (index * (width - padding * 2)) / Math.max(data.length - 1, 1)} y={height - 8} textAnchor="middle">
            {item.date}
          </text>
        ))}
      </svg>
      <div className="legend">
        <span><i className="w" />體重</span>
        <span><i className="wa" />腰圍</span>
        <span><i className="h" />飲水</span>
      </div>
    </div>
  );
}

function Polyline({ points, color }) {
  if (!points.length) return null;
  return <polyline points={points.map((point) => point.join(",")).join(" ")} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />;
}

function points(data, key, width, height, padding, scaleWater = false) {
  const values = data.map((item) => numeric(item[key])).filter((value) => value !== null);
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  return data
    .map((item, index) => {
      const value = numeric(item[key]);
      if (value === null) return null;
      const comparable = scaleWater ? value / 30 : value;
      const localMin = scaleWater ? min / 30 : min;
      const localMax = scaleWater ? max / 30 : max;
      const x = padding + (index * (width - padding * 2)) / Math.max(data.length - 1, 1);
      const ratio = localMax === localMin ? 0.5 : (comparable - localMin) / (localMax - localMin);
      const y = height - padding - ratio * (height - padding * 2);
      return [Math.round(x), Math.round(y)];
    })
    .filter(Boolean);
}

function summarize(records) {
  const latest = [...records].sort((a, b) => b.date.localeCompare(a.date))[0];
  const latestWeight = latest ? numeric(latest.eveningWeight) ?? numeric(latest.morningWeight) : null;
  return { latestWeight };
}

function findOrCreate(records, date) {
  return clone(records.find((record) => record.id === date) || createEmptyRecord(date));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function collectImageIds(record) {
  return [
    ...record.meals.breakfast,
    ...record.meals.lunch,
    ...record.meals.dinner,
    ...record.sleepImages,
    ...record.exerciseImages,
  ].map((item) => item.id);
}

createRoot(document.getElementById("root")).render(<App />);

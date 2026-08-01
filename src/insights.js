export function numeric(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

export function sortAsc(records) {
  return [...records].sort((a, b) => a.date.localeCompare(b.date));
}

export function recentRecords(records, days) {
  return sortAsc(records).slice(-days);
}

export function chartSeries(records, days) {
  return recentRecords(records, days).map((record) => ({
    date: record.date.slice(5),
    weight: numeric(record.eveningWeight) ?? numeric(record.morningWeight),
    waist: numeric(record.waist),
    water: numeric(record.water),
  }));
}

export function delta(records, field, days) {
  const values = recentRecords(records, days)
    .map((record) => numeric(record[field]))
    .filter((value) => value !== null);
  if (values.length < 2) return null;
  return round(values.at(-1) - values[0], 1);
}

export function buildDailySummary(record, records = []) {
  const weight = numeric(record.eveningWeight) ?? numeric(record.morningWeight);
  const sevenWeight = delta(records, "eveningWeight", 7);
  const waistDelta = delta(records, "waist", 7);
  const mealCount =
    record.meals.breakfast.length + record.meals.lunch.length + record.meals.dinner.length;
  const sleepCount = record.sleepImages.length;
  const exerciseCount = record.exerciseImages.length;
  const lines = [
    `Health Commander ${record.date} 每日摘要`,
    `體重：${weight === null ? "未記錄" : `${weight} kg`}（早 ${record.morningWeight || "-"} / 晚 ${record.eveningWeight || "-"}）`,
    `腰圍：${record.waist || "未記錄"} cm`,
    `飲水：${record.water || "未記錄"} ml`,
    `精神：${record.mood}`,
    `膝蓋：${record.knee}`,
    `照片：三餐 ${mealCount} 張，睡眠 ${sleepCount} 張，運動 ${exerciseCount} 張`,
  ];
  if (sevenWeight !== null) lines.push(`近 7 日晚間體重變化：${formatSigned(sevenWeight)} kg`);
  if (waistDelta !== null) lines.push(`近 7 日腰圍變化：${formatSigned(waistDelta)} cm`);
  if (record.note.trim()) lines.push(`備註：${record.note.trim()}`);
  lines.push("提醒：V1 為本機紀錄與手動截圖分析，Apple Health 自動同步已預留但尚未啟用。");
  return lines.join("\n");
}

export function completionScore(record) {
  const fields = [
    record.morningWeight,
    record.eveningWeight,
    record.waist,
    record.water,
    record.mood,
    record.knee,
    record.note,
  ];
  const media =
    record.meals.breakfast.length +
    record.meals.lunch.length +
    record.meals.dinner.length +
    record.sleepImages.length +
    record.exerciseImages.length;
  const filled = fields.filter((value) => String(value || "").trim()).length + Math.min(media, 3);
  return Math.round((filled / 10) * 100);
}

function formatSigned(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

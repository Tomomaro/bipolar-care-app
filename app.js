const STORAGE_KEY = "bipolar-care-log-v1";
const signLabels = {
  sleepDrop: "睡眠減少",
  bodyHeavy: "体が重い",
  period: "生理",
  dizzy: "めまい",
  headache: "頭痛",
  nausea: "吐き気",
  restless: "そわそわ",
  racing: "思考加速",
  talkative: "連絡増加",
  irritable: "イライラ",
  noReply: "連絡回避",
  lowAppetite: "食欲低下",
  overeating: "食べすぎ",
  skippedMeals: "食事抜き",
  caffeine: "カフェイン",
  alcohol: "飲酒",
  spending: "過食",
  exercise: "運動",
  withdrawal: "引きこもり",
  hopeless: "強い絶望感"
};

const form = document.querySelector("#entryForm");
const tabs = document.querySelectorAll(".tab");
const views = document.querySelectorAll(".view");
const entryDate = document.querySelector("#entryDate");
const mood = document.querySelector("#mood");
const bedtime = document.querySelector("#bedtime");
const wakeTime = document.querySelector("#wakeTime");
const moodOut = document.querySelector("#moodOut");
const moodFace = document.querySelector("#moodFace");
const moodFaceBg = document.querySelector(".face-bg");
const moodEyeLeft = document.querySelector("#moodEyeLeft");
const moodEyeRight = document.querySelector("#moodEyeRight");
const moodLabel = document.querySelector("#moodLabel");
const moodMouth = document.querySelector("#moodMouth");
const sleepOut = document.querySelector("#sleepOut");
const recentList = document.querySelector("#recentList");
const riskCard = document.querySelector("#riskCard");
const todayStatus = document.querySelector("#todayStatus");
const trendChart = document.querySelector("#trendChart");
const summaryGrid = document.querySelector("#summaryGrid");
const dataPreview = document.querySelector("#dataPreview");

let entries = loadEntries();
saveEntries();

function isoToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function loadEntries() {
  try {
    return normalizeEntries(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []);
  } catch {
    return [];
  }
}

function saveEntries() {
  entries = normalizeEntries(entries);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function sortedEntries() {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

function normalizeEntries(items) {
  return items
    .filter((item) => item && typeof item.date === "string")
    .map((item) => {
      const bedtimeValue = roundTimeValue(item.bedtime || "23:00");
      const fallbackWakeTime = wakeTimeFromSleep(bedtimeValue, item.sleep ?? 8);
      const wakeTimeValue = roundTimeValue(item.wakeTime || fallbackWakeTime);
      return {
        date: item.date,
        mood: Number(item.mood) || 0,
        bedtime: bedtimeValue,
        wakeTime: wakeTimeValue,
        sleep: sleepHoursFromTimes(bedtimeValue, wakeTimeValue),
        meds: item.meds || "done",
        stress: item.stress || "none",
        signs: Array.isArray(item.signs) ? item.signs : [],
        note: item.note || ""
      };
    });
}

function timeToMinutes(value) {
  if (!value || !value.includes(":")) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minutes = String(normalized % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function roundTimeValue(value, stepMinutes = 10) {
  const minutes = timeToMinutes(value);
  if (minutes === null) return value;
  return minutesToTime(Math.round(minutes / stepMinutes) * stepMinutes);
}

function sleepHoursFromTimes(start, end) {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return 0;
  const duration = endMinutes >= startMinutes
    ? endMinutes - startMinutes
    : endMinutes + 1440 - startMinutes;
  return Number((duration / 60).toFixed(1));
}

function wakeTimeFromSleep(start, hours) {
  const startMinutes = timeToMinutes(start);
  if (startMinutes === null || !Number.isFinite(Number(hours))) return "07:00";
  return minutesToTime(startMinutes + Number(hours) * 60);
}

function buildTimeOptions() {
  const options = [];
  for (let minutes = 0; minutes < 1440; minutes += 10) {
    const value = minutesToTime(minutes);
    options.push(`<option value="${value}">${value}</option>`);
  }
  return options.join("");
}

function populateTimeSelects() {
  const options = buildTimeOptions();
  bedtime.innerHTML = options;
  wakeTime.innerHTML = options;
}

function updateCalculatedFields() {
  moodOut.value = mood.value;
  updateMoodFace(Number(mood.value));
  sleepOut.textContent = `${sleepHoursFromTimes(bedtime.value, wakeTime.value).toFixed(1)}h`;
}

function updateMoodFace(value) {
  const normalized = Math.max(-5, Math.min(5, value)) / 5;
  const curve = 40 + normalized * 10;
  const eyeY = 26 - Math.max(0, normalized) * 1.8 + Math.max(0, -normalized) * 1.5;
  const eyeR = 3.6 + Math.max(0, normalized) * 0.5 - Math.max(0, -normalized) * 0.2;
  const warm = Math.max(0, normalized);
  const cool = Math.max(0, -normalized);
  const faceFill = `rgb(${Math.round(255 - cool * 32)}, ${Math.round(227 - cool * 8 - warm * 12)}, ${Math.round(183 + cool * 42 - warm * 3)})`;
  const faceStroke = `rgb(${Math.round(240 - cool * 40)}, ${Math.round(198 - cool * 6 - warm * 26)}, ${Math.round(129 + cool * 38 - warm * 6)})`;

  moodMouth.setAttribute("d", `M21 40 Q32 ${curve.toFixed(1)} 43 40`);
  moodEyeLeft.setAttribute("cy", eyeY.toFixed(1));
  moodEyeRight.setAttribute("cy", eyeY.toFixed(1));
  moodEyeLeft.setAttribute("r", eyeR.toFixed(1));
  moodEyeRight.setAttribute("r", eyeR.toFixed(1));
  moodFaceBg.style.fill = faceFill;
  moodFaceBg.style.stroke = faceStroke;
  moodFace.style.transform = `rotate(${(normalized * 2).toFixed(1)}deg)`;

  if (value <= -4) moodLabel.textContent = "かなり低め";
  else if (value <= -2) moodLabel.textContent = "少し低め";
  else if (value >= 4) moodLabel.textContent = "かなり高め";
  else if (value >= 2) moodLabel.textContent = "少し高め";
  else moodLabel.textContent = "落ち着いている";
}

function entryFor(date) {
  return entries.find((item) => item.date === date);
}

function fillForm(entry) {
  form.reset();
  entryDate.value = entry?.date || isoToday();
  mood.value = entry?.mood ?? 0;
  bedtime.value = entry?.bedtime || "23:00";
  wakeTime.value = entry?.wakeTime || wakeTimeFromSleep(bedtime.value, entry?.sleep ?? 8);
  document.querySelector("#meds").value = entry?.meds || "done";
  document.querySelector("#stress").value = entry?.stress || "none";
  document.querySelector("#note").value = entry?.note || "";
  document.querySelectorAll("input[name='signs']").forEach((box) => {
    box.checked = Boolean(entry?.signs?.includes(box.value));
  });
  updateCalculatedFields();
}

function getRisk(entry) {
  if (!entry) {
    return {
      level: "empty",
      title: "記録すると表示されます",
      body: "睡眠、気分、サインをもとに注意ポイントを出します。"
    };
  }

  const signs = new Set(entry.signs || []);
  const lowSleep = Number(entry.sleep) <= 4.5;
  const highMood = Number(entry.mood) >= 4;
  const lowMood = Number(entry.mood) <= -4;
  const missedMeds = entry.meds === "missed";

  if (signs.has("hopeless")) {
    return {
      level: "danger",
      title: "緊急度が高いサインがあります",
      body: "一人で抱えず、今すぐ信頼できる人・主治医・地域の救急相談につなげてください。"
    };
  }

  if ((lowSleep && highMood) || missedMeds || signs.has("racing") || signs.has("talkative") || signs.has("restless")) {
    return {
      level: "warn",
      title: "上がりすぎに注意",
      body: "睡眠確保、予定の圧縮、重要な決断の保留を優先すると振れ幅を小さくしやすいです。"
    };
  }

  if (lowMood || signs.has("withdrawal") || signs.has("noReply") || signs.has("bodyHeavy") || signs.has("lowAppetite") || signs.has("skippedMeals") || signs.has("dizzy")) {
    return {
      level: "warn",
      title: "下がりすぎに注意",
      body: "小さな予定を1つだけ残し、食事・水分・服薬の確認から始めてください。"
    };
  }

  return {
    level: "steady",
    title: "大きな警戒サインは少なめです",
    body: "睡眠と服薬のリズムを保ち、気になる変化はメモしておきましょう。"
  };
}

function renderRisk() {
  const today = entryFor(isoToday());
  const risk = getRisk(today);
  riskCard.className = `risk-card ${risk.level === "steady" || risk.level === "empty" ? "" : risk.level}`;
  riskCard.innerHTML = `<strong>${risk.title}</strong><p>${risk.body}</p>`;
  todayStatus.textContent = today ? `気分 ${today.mood} / 睡眠 ${today.sleep}h` : "未記録";
}

function renderRecent() {
  const recent = sortedEntries().slice(0, 5);
  if (!recent.length) {
    recentList.innerHTML = '<div class="mini-item"><strong>まだ記録がありません</strong><span>今日の記録から始められます。</span></div>';
    return;
  }

  recentList.innerHTML = recent.map((entry) => {
    const signs = entry.signs.length ? entry.signs.map((sign) => signLabels[sign]).join("、") : "サインなし";
    return `<div class="mini-item"><strong>${entry.date}</strong><span>気分 ${entry.mood} / 睡眠 ${entry.sleep}h / ${signs}</span></div>`;
  }).join("");
}

function renderSummary() {
  const recent = sortedEntries().slice(0, 14);
  const average = (key) => {
    if (!recent.length) return "-";
    return (recent.reduce((sum, item) => sum + Number(item[key]), 0) / recent.length).toFixed(1);
  };
  const signCount = recent.reduce((sum, item) => sum + item.signs.length, 0);
  const missed = recent.filter((item) => item.meds === "missed" || item.meds === "partial").length;
  summaryGrid.innerHTML = [
    ["平均気分", average("mood")],
    ["平均睡眠", `${average("sleep")}h`],
    ["サイン数", signCount],
    ["服薬の乱れ", missed]
  ].map(([label, value]) => `<div class="summary-card"><span>${label}</span><b>${value}</b></div>`).join("");
}

function drawChart() {
  const ctx = trendChart.getContext("2d");
  const width = trendChart.width;
  const height = trendChart.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fbfcfb";
  ctx.fillRect(0, 0, width, height);

  const recent = sortedEntries().slice(0, 14).reverse();
  const pad = { left: 58, right: 28, top: 34, bottom: 58 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  ctx.strokeStyle = "#d9ded8";
  ctx.lineWidth = 1;
  ctx.font = "16px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillStyle = "#67707b";

  for (let i = 0; i <= 5; i += 1) {
    const y = pad.top + (chartH / 5) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
  }

  if (!recent.length) {
    ctx.fillStyle = "#67707b";
    ctx.fillText("記録が増えるとグラフが表示されます", pad.left, height / 2);
    return;
  }

  const xFor = (index) => pad.left + (recent.length === 1 ? chartW / 2 : (chartW / (recent.length - 1)) * index);
  const yMood = (value) => pad.top + chartH - ((Number(value) + 5) / 10) * chartH;
  const ySleep = (value) => pad.top + chartH - (Math.min(Number(value), 12) / 12) * chartH;

  recent.forEach((entry, index) => {
    const x = xFor(index);
    const barH = pad.top + chartH - ySleep(entry.sleep);
    ctx.fillStyle = "#b8d3cb";
    ctx.fillRect(x - 13, ySleep(entry.sleep), 26, barH);
    ctx.fillStyle = "#67707b";
    ctx.save();
    ctx.translate(x - 18, height - 18);
    ctx.rotate(-Math.PI / 5);
    ctx.fillText(entry.date.slice(5), 0, 0);
    ctx.restore();
  });

  ctx.strokeStyle = "#a34e34";
  ctx.lineWidth = 4;
  ctx.beginPath();
  recent.forEach((entry, index) => {
    const x = xFor(index);
    const y = yMood(entry.mood);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  recent.forEach((entry, index) => {
    const x = xFor(index);
    const y = yMood(entry.mood);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#a34e34";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  ctx.fillStyle = "#20242a";
  ctx.fillText("線: 気分 -5から+5", pad.left, 24);
  ctx.fillStyle = "#246b61";
  ctx.fillText("棒: 睡眠 0から12h", pad.left + 190, 24);
}

function renderDataPreview() {
  dataPreview.textContent = JSON.stringify(sortedEntries(), null, 2);
}

function renderAll() {
  renderRisk();
  renderRecent();
  renderSummary();
  drawChart();
  renderDataPreview();
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function toCsv() {
  const rows = [["date", "mood", "bedtime", "wakeTime", "sleep", "meds", "stress", "signs", "note"]];
  sortedEntries().reverse().forEach((entry) => {
    rows.push([
      entry.date,
      entry.mood,
      entry.bedtime || "",
      entry.wakeTime || "",
      entry.sleep,
      entry.meds,
      entry.stress,
      entry.signs.join("|"),
      entry.note.replace(/\n/g, " ")
    ]);
  });
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function addDemoData() {
  const base = new Date(`${isoToday()}T00:00:00`);
  const demo = Array.from({ length: 10 }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() - (9 - index));
    const moodValue = [-1, -2, -1, 0, 1, 3, 4, 2, 0, -1][index];
    const sleepValue = [7.5, 8, 7, 6.5, 6, 4.5, 4, 5.5, 7, 7.5][index];
    return {
      date: date.toISOString().slice(0, 10),
      mood: moodValue,
      bedtime: "23:00",
      wakeTime: wakeTimeFromSleep("23:00", sleepValue),
      sleep: sleepValue,
      meds: index === 6 ? "partial" : "done",
      stress: index > 4 && index < 7 ? "high" : "none",
      signs: index === 6 ? ["sleepDrop", "racing", "talkative", "caffeine"] : index === 1 ? ["bodyHeavy", "lowAppetite", "dizzy", "exercise"] : [],
      note: "サンプル記録"
    };
  });
  entries = [...entries.filter((entry) => !demo.some((item) => item.date === entry.date)), ...demo];
  saveEntries();
  fillForm(entryFor(entryDate.value));
  renderAll();
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    views.forEach((view) => view.classList.toggle("is-active", view.id === tab.dataset.view));
    if (tab.dataset.view === "trends") drawChart();
  });
});

[mood, bedtime, wakeTime].forEach((input) => input.addEventListener("input", updateCalculatedFields));

[bedtime, wakeTime].forEach((input) => {
  input.addEventListener("change", () => {
    input.value = roundTimeValue(input.value);
    updateCalculatedFields();
  });
});

entryDate.addEventListener("change", () => {
  fillForm(entryFor(entryDate.value) || { date: entryDate.value });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const roundedBedtime = roundTimeValue(data.get("bedtime"));
  const roundedWakeTime = roundTimeValue(data.get("wakeTime"));
  bedtime.value = roundedBedtime;
  wakeTime.value = roundedWakeTime;
  const entry = {
    date: data.get("date"),
    mood: Number(data.get("mood")),
    bedtime: roundedBedtime,
    wakeTime: roundedWakeTime,
    sleep: sleepHoursFromTimes(roundedBedtime, roundedWakeTime),
    meds: data.get("meds"),
    stress: data.get("stress"),
    signs: data.getAll("signs"),
    note: data.get("note").trim()
  };
  entries = [...entries.filter((item) => item.date !== entry.date), entry];
  saveEntries();
  renderAll();
});

document.querySelector("#clearToday").addEventListener("click", () => {
  fillForm({ date: entryDate.value });
});

document.querySelector("#seedDemo").addEventListener("click", addDemoData);

document.querySelector("#exportJson").addEventListener("click", () => {
  download("bipolar-care-log.json", JSON.stringify(sortedEntries(), null, 2), "application/json");
});

document.querySelector("#exportCsv").addEventListener("click", () => {
  download("bipolar-care-log.csv", toCsv(), "text/csv;charset=utf-8");
});

document.querySelector("#importFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const imported = JSON.parse(await file.text());
  if (!Array.isArray(imported)) return;
  entries = normalizeEntries(imported);
  saveEntries();
  fillForm(entryFor(isoToday()));
  renderAll();
});

document.querySelector("#deleteAll").addEventListener("click", () => {
  if (!confirm("保存データをすべて削除しますか？")) return;
  entries = [];
  saveEntries();
  fillForm();
  renderAll();
});

entryDate.value = isoToday();
populateTimeSelects();
fillForm(entryFor(isoToday()));
renderAll();

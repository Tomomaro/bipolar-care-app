const STORAGE_KEY = "bipolar-care-log-v1";
const SETTINGS_KEY = "bipolar-care-settings-v1";
const removedDemoNote = "\u30b5\u30f3\u30d7\u30eb\u8a18\u9332";
const signLabels = {
  sleepDrop: "寝すぎ",
  sleepy: "眠気",
  hardToSleep: "入眠しにくい",
  nightWaking: "中途覚醒",
  earlyWaking: "早朝覚醒",
  bodyHeavy: "体が重い",
  period: "生理",
  dizzy: "めまい",
  headache: "頭痛",
  nausea: "吐き気",
  restless: "そわそわ",
  racing: "思考加速",
  anxious: "不安",
  foggy: "ぼんやり",
  moodUp: "気分の上がり",
  moodDown: "気分の下がり",
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
const nightSummary = document.querySelector("#nightSummary");
const awakeningPanel = document.querySelector("#awakeningPanel");
const awakeningList = document.querySelector("#awakeningList");
const addAwakening = document.querySelector("#addAwakening");
const sleepTimeline = document.querySelector("#sleepTimeline");
const moodOut = document.querySelector("#moodOut");
const moodFace = document.querySelector("#moodFace");
const moodFaceBg = document.querySelector(".face-bg");
const moodEyeLeft = document.querySelector("#moodEyeLeft");
const moodEyeRight = document.querySelector("#moodEyeRight");
const moodLabel = document.querySelector("#moodLabel");
const moodMouth = document.querySelector("#moodMouth");
const sleepOut = document.querySelector("#sleepOut");
const postSaveReflection = document.querySelector("#postSaveReflection");
const todayStatus = document.querySelector("#todayStatus");
const trendChart = document.querySelector("#trendChart");
const summaryGrid = document.querySelector("#summaryGrid");
const trendDashboard = document.querySelector("#trendDashboard");
const aiAnalysis = document.querySelector("#aiAnalysis");
const dataPreview = document.querySelector("#dataPreview");
const tagFilterBar = document.querySelector("#tagFilterBar");
const filteredLog = document.querySelector("#filteredLog");
const saveToast = document.querySelector("#saveToast");
const saveEntry = document.querySelector("#saveEntry");
const settingsOpen = document.querySelector("#settingsOpen");
const settingsClose = document.querySelector("#settingsClose");
const settingsModal = document.querySelector("#settingsModal");
const reminderEnabled = document.querySelector("#reminderEnabled");
const reminderTime = document.querySelector("#reminderTime");
const reminderStatus = document.querySelector("#reminderStatus");
const saveSettings = document.querySelector("#saveSettings");
const testReminder = document.querySelector("#testReminder");
const showStepsTrend = document.querySelector("#showStepsTrend");
const TREND_MIN_COUNTS = {
  average: 3,
  comparison: 3,
  line: 3,
  trendComment: 7,
  correlation: 10
};
const TREND_PERIODS = [7, 30, 90];
const EVENT_TAGS = ["仕事", "休み", "通院", "運動", "外出", "デート", "家族・対人", "旅行", "飲み会", "大きな買い物", "生活環境の変化", "生理", "体調不良", "その他"];

let entries = loadEntries();
let activeDoctorTag = "all";
let settings = loadSettings();
let reminderTimer = null;
let formAwakenings = [];
let trendPeriod = 30;
let isSavingEntry = false;
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

function loadSettings() {
  try {
    return {
      reminderEnabled: false,
      reminderTime: "21:00",
      ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {})
    };
  } catch {
    return { reminderEnabled: false, reminderTime: "21:00" };
  }
}

function saveAppSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!["http:", "https:"].includes(window.location.protocol)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

function sortedEntries() {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

function normalizeEntries(items) {
  return items
    .filter((item) => item && typeof item.date === "string")
    .filter((item) => item.note !== removedDemoNote)
    .map((item) => {
      const bedtimeValue = roundTimeValue(item.bedtime || "23:00");
      const fallbackWakeTime = wakeTimeFromSleep(bedtimeValue, item.sleep ?? 8);
      const wakeTimeValue = roundTimeValue(item.wakeTime || fallbackWakeTime);
      const awakenings = normalizeAwakenings(item.awakenings);
      const eventTags = normalizeEventTags(item);
      const eventOther = normalizeEventOther(item, eventTags);
      const eventDetail = String(item.eventDetail || item.eventDetails?.detail || item.eventDetails?.note || "").trim();
      const legacyEvents = normalizeTags(item.events);
      const stepsValue = normalizeSteps(item.steps);
      const stepsSource = item.stepsSource === "auto" ? "auto" : stepsValue !== "" ? "manual" : "none";
      const doctorTags = normalizeTags(item.doctorTags || item.visitMemoTags);
      return {
        date: item.date,
        mood: Number(item.mood) || 0,
        bedtime: bedtimeValue,
        wakeTime: wakeTimeValue,
        sleep: sleepHoursFromTimes(bedtimeValue, wakeTimeValue),
        actualSleep: actualSleepHours(bedtimeValue, wakeTimeValue, awakenings),
        awakenings,
        meds: item.meds || "done",
        stress: item.stress || "none",
        signs: Array.isArray(item.signs) ? item.signs : [],
        events: [...new Set([...mergedEventValues(eventTags, eventOther), ...legacyEvents])],
        eventTags,
        eventOther,
        eventDetail,
        activityLevel: ["none", "low", "usual", "high"].includes(item.activityLevel) ? item.activityLevel : "none",
        steps: stepsValue,
        stepsSource,
        doctorTags,
        doctorNote: String(item.doctorNote || item.visitMemoNote || "").trim(),
        note: item.note || ""
      };
    });
}

function normalizeEventTags(item = {}) {
  const explicit = normalizeTags(item.eventTags);
  if (explicit.length) return explicit.filter((tag) => EVENT_TAGS.includes(tag));
  const legacy = normalizeTags(item.events);
  return [...new Set(legacy.map((tag) => EVENT_TAGS.includes(tag) ? tag : "その他"))];
}

function normalizeEventOther(item = {}, eventTags = []) {
  const explicit = normalizeTags(item.eventOther);
  const legacy = normalizeTags(item.events).filter((tag) => !EVENT_TAGS.includes(tag));
  return [...new Set([...explicit, ...legacy])];
}

function mergedEventValues(eventTags = [], eventOther = []) {
  return [...new Set([
    ...eventTags.filter(Boolean),
    ...eventOther
  ])];
}

function normalizeAwakenings(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    startTime: roundTimeValue(item?.startTime || ""),
    endTime: roundTimeValue(item?.endTime || ""),
    reasons: normalizeTags(item?.reasons),
    nightSnack: ["none", "small", "normal", "binge"].includes(item?.nightSnack) ? item.nightSnack : "none",
    foodTime: roundTimeValue(item?.foodTime || ""),
    food: String(item?.food || "").trim(),
    resleep: ["soon", "within30", "within60", "over60", "none"].includes(item?.resleep) ? item.resleep : "soon",
    memo: String(item?.memo || "").trim()
  })).filter((item) => item.startTime || item.endTime || item.food || item.memo || item.nightSnack !== "none" || item.reasons.length);
}

function normalizeSteps(value) {
  if (value === "" || value === null || value === undefined) return "";
  const steps = Number(value);
  return Number.isFinite(steps) && steps >= 0 ? Math.round(steps) : "";
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (!value) return [];
  return String(value).split(/[、,\s]+/).map((item) => item.trim()).filter(Boolean);
}

function tagsToInput(tags) {
  return Array.isArray(tags) ? tags.join("、") : "";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function allDoctorTags() {
  return [...new Set(entries.flatMap((entry) => entry.doctorTags || []))].sort((a, b) => a.localeCompare(b, "ja"));
}

function filteredEntries() {
  const sorted = sortedEntries();
  if (activeDoctorTag === "all") return sorted;
  return sorted.filter((entry) => (entry.doctorTags || []).includes(activeDoctorTag));
}

function showToast(message = "保存しました") {
  saveToast.textContent = message;
  saveToast.classList.add("is-visible");
  window.setTimeout(() => saveToast.classList.remove("is-visible"), 2200);
}

function notificationSupported() {
  return "Notification" in window;
}

function updateReminderStatus(message) {
  if (message) {
    reminderStatus.textContent = message;
    return;
  }
  if (!notificationSupported()) {
    reminderStatus.textContent = "このブラウザでは通知に対応していません。";
  } else if (Notification.permission === "granted") {
    reminderStatus.textContent = settings.reminderEnabled
      ? `${settings.reminderTime} に記録リマインダーを出します。`
      : "通知はオフです。";
  } else if (Notification.permission === "denied") {
    reminderStatus.textContent = "通知がブロックされています。ブラウザの設定から許可できます。";
  } else {
    reminderStatus.textContent = "通知をオンにすると、ブラウザから許可を求められます。";
  }
}

function minutesUntilReminder(timeValue) {
  const [hours, minutes] = (timeValue || "21:00").split(":").map(Number);
  const now = new Date();
  const next = new Date(now);
  next.setHours(hours || 21, minutes || 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function sendReminderNotification() {
  if (!settings.reminderEnabled || !notificationSupported() || Notification.permission !== "granted") return;
  new Notification("体調ログの時間です", {
    body: "今日の気分、睡眠、サインを少しだけ記録しましょう。"
  });
}

function scheduleReminder() {
  if (reminderTimer) window.clearTimeout(reminderTimer);
  reminderTimer = null;
  if (!settings.reminderEnabled || !notificationSupported() || Notification.permission !== "granted") return;
  reminderTimer = window.setTimeout(() => {
    sendReminderNotification();
    scheduleReminder();
  }, minutesUntilReminder(settings.reminderTime));
}

function openSettings() {
  reminderEnabled.checked = Boolean(settings.reminderEnabled);
  reminderTime.value = settings.reminderTime || "21:00";
  updateReminderStatus();
  settingsModal.classList.add("is-open");
  settingsModal.setAttribute("aria-hidden", "false");
}

function closeSettings() {
  settingsModal.classList.remove("is-open");
  settingsModal.setAttribute("aria-hidden", "true");
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

function durationMinutes(start, end) {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return 0;
  return endMinutes >= startMinutes
    ? endMinutes - startMinutes
    : endMinutes + 1440 - startMinutes;
}

function totalAwakeMinutes(awakenings = []) {
  return normalizeAwakenings(awakenings).reduce((sum, item) => sum + durationMinutes(item.startTime, item.endTime), 0);
}

function actualSleepHours(start, end, awakenings = []) {
  const bedMinutes = durationMinutes(start, end);
  const actualMinutes = Math.max(0, bedMinutes - totalAwakeMinutes(awakenings));
  return Number((actualMinutes / 60).toFixed(1));
}

function formatDurationFromMinutes(minutes) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  if (!hours) return `${mins}分`;
  if (!mins) return `${hours}時間`;
  return `${hours}時間${mins}分`;
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
  const bedHours = sleepHoursFromTimes(bedtime.value, wakeTime.value);
  const actualHours = actualSleepHours(bedtime.value, wakeTime.value, formAwakenings);
  sleepOut.textContent = `${bedHours.toFixed(1)}h`;
  renderNightSummary();
  renderSleepTimeline();
  const actualOut = document.querySelector("#actualSleepOut");
  if (actualOut) actualOut.textContent = `${actualHours.toFixed(1)}h`;
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

function dateOffset(date, offsetDays) {
  const base = new Date(`${date}T00:00:00`);
  if (Number.isNaN(base.getTime())) return "";
  base.setDate(base.getDate() + offsetDays);
  const offset = base.getTimezoneOffset() * 60000;
  return new Date(base.getTime() - offset).toISOString().slice(0, 10);
}

function previousEntryFor(date) {
  return entryFor(dateOffset(date, -1));
}

function actualSleepValue(entry) {
  if (!entry) return null;
  const value = Number(entry.actualSleep ?? entry.sleep);
  return Number.isFinite(value) ? value : null;
}

function averageValue(items, picker) {
  const values = items.map(picker).filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function entriesBefore(date, limit = 30) {
  return sortedEntries()
    .filter((entry) => entry.date < date)
    .slice(0, limit)
    .reverse();
}

function signedHours(value) {
  if (!Number.isFinite(value)) return "比較なし";
  if (Math.abs(value) < 0.05) return "平均との差 0.0h";
  return `平均との差 ${value > 0 ? "+" : ""}${value.toFixed(1)}h`;
}

function compareHoursText(value, emptyText = "比較なし") {
  if (!Number.isFinite(value)) return emptyText;
  if (Math.abs(value) < 0.05) return "普段とほぼ同じ";
  return `普段より${Math.abs(value).toFixed(1)}h${value > 0 ? "長い" : "短い"}`;
}

function formatHours(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}h` : "-";
}

function dateToWeekday(date) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getDay();
}

function blankAwakening() {
  return {
    startTime: "03:00",
    endTime: "03:30",
    reasons: [],
    nightSnack: "none",
    foodTime: "",
    food: "",
    resleep: "soon",
    memo: ""
  };
}

function setSelected(select, value) {
  if (value && [...select.options].some((option) => option.value === value)) select.value = value;
}

function renderAwakeningInputs() {
  const hasAwakening = document.querySelector("input[name='hadAwakening']:checked")?.value === "yes";
  awakeningPanel.hidden = !hasAwakening;
  if (!hasAwakening) {
    awakeningList.innerHTML = "";
    formAwakenings = [];
    updateCalculatedFields();
    return;
  }
  if (!formAwakenings.length) formAwakenings = [blankAwakening()];
  awakeningList.innerHTML = formAwakenings.map((item, index) => awakeningCardHtml(item, index)).join("");
  awakeningList.querySelectorAll(".awakening-card").forEach((card, index) => {
    const item = formAwakenings[index];
    setSelected(card.querySelector("[data-field='startTime']"), item.startTime);
    setSelected(card.querySelector("[data-field='endTime']"), item.endTime);
    setSelected(card.querySelector("[data-field='foodTime']"), item.foodTime);
  });
  updateCalculatedFields();
}

function awakeningCardHtml(item, index) {
  const reasons = [
    ["toilet", "トイレ"],
    ["hot", "暑い"],
    ["cold", "寒い"],
    ["dream", "夢"],
    ["anxiety", "不安"],
    ["other", "その他"]
  ];
  const snacks = [
    ["none", "食べていない"],
    ["small", "少量食べた"],
    ["normal", "普通に食べた"],
    ["binge", "過食した"]
  ];
  const resleeps = [
    ["soon", "すぐ眠れた"],
    ["within30", "30分以内"],
    ["within60", "1時間以内"],
    ["over60", "1時間以上"],
    ["none", "眠れなかった"]
  ];
  const removeButton = formAwakenings.length > 1
    ? `<button class="icon-button awakening-remove" data-action="remove-awakening" data-index="${index}" type="button" aria-label="この中途覚醒を削除">×</button>`
    : "";
  return `
    <article class="awakening-card" data-index="${index}">
      <div class="awakening-card-head">
        <strong>中途覚醒 ${index + 1}</strong>
        ${removeButton}
      </div>
      <div class="grid two compact-grid">
        <label class="field"><span>起きた時間</span><select data-field="startTime">${buildTimeOptions()}</select></label>
        <label class="field"><span>また眠れた時間</span><select data-field="endTime">${buildTimeOptions()}</select></label>
      </div>
      <div class="choice-block">
        <span>起きた理由</span>
        <div class="chip-grid">
          ${reasons.map(([value, label]) => `<label class="chip-option"><input type="checkbox" data-field="reasons" value="${value}" ${item.reasons.includes(value) ? "checked" : ""}><span>${label}</span></label>`).join("")}
        </div>
      </div>
      <div class="choice-block">
        <span>夜食</span>
        <div class="chip-grid">
          ${snacks.map(([value, label]) => `<label class="chip-option"><input type="radio" name="nightSnack-${index}" data-field="nightSnack" value="${value}" ${item.nightSnack === value ? "checked" : ""}><span>${label}</span></label>`).join("")}
        </div>
      </div>
      <div class="grid two compact-grid">
        <label class="field"><span>食べた時刻 任意</span><select data-field="foodTime"><option value="">未入力</option>${buildTimeOptions()}</select></label>
        <label class="field"><span>食べたもの 任意</span><input data-field="food" type="text" value="${escapeAttr(item.food)}" placeholder="小さいおにぎり 1個"></label>
      </div>
      <div class="choice-block">
        <span>再入眠</span>
        <div class="chip-grid resleep-grid">
          ${resleeps.map(([value, label]) => `<label class="chip-option"><input type="radio" name="resleep-${index}" data-field="resleep" value="${value}" ${item.resleep === value ? "checked" : ""}><span>${label}</span></label>`).join("")}
        </div>
      </div>
      <label class="field"><span>メモ 任意</span><textarea data-field="memo" rows="2" placeholder="トイレのあと少し安心した、など">${escapeHtml(item.memo)}</textarea></label>
    </article>
  `;
}

function syncAwakeningsFromDom() {
  const hasAwakening = document.querySelector("input[name='hadAwakening']:checked")?.value === "yes";
  if (!hasAwakening) {
    formAwakenings = [];
    return [];
  }
  formAwakenings = [...awakeningList.querySelectorAll(".awakening-card")].map((card) => ({
    startTime: card.querySelector("[data-field='startTime']").value,
    endTime: card.querySelector("[data-field='endTime']").value,
    reasons: [...card.querySelectorAll("[data-field='reasons']:checked")].map((input) => input.value),
    nightSnack: card.querySelector("[data-field='nightSnack']:checked")?.value || "none",
    foodTime: card.querySelector("[data-field='foodTime']").value,
    food: card.querySelector("[data-field='food']").value.trim(),
    resleep: card.querySelector("[data-field='resleep']:checked")?.value || "soon",
    memo: card.querySelector("[data-field='memo']").value.trim()
  }));
  formAwakenings = normalizeAwakenings(formAwakenings);
  return formAwakenings;
}

function awakeningLabel(value, type) {
  const labels = {
    reasons: { toilet: "トイレ", hot: "暑い", cold: "寒い", dream: "夢", anxiety: "不安", other: "その他" },
    snack: { none: "なし", small: "少量", normal: "普通", binge: "過食" },
    resleep: { soon: "すぐ眠れた", within30: "30分以内", within60: "1時間以内", over60: "1時間以上", none: "眠れなかった" }
  };
  return labels[type]?.[value] || value;
}

function renderNightSummary() {
  if (!nightSummary) return;
  const date = entryDate.value || isoToday();
  const saved = entryFor(date);
  const awakenings = formAwakenings;
  const bedMinutes = durationMinutes(bedtime.value, wakeTime.value);
  const awakeMinutes = totalAwakeMinutes(awakenings);
  const actualHours = actualSleepHours(bedtime.value, wakeTime.value, awakenings);
  const prior7 = entriesBefore(date, 7);
  const prior30 = entriesBefore(date, 30);
  const previous = previousEntryFor(date);
  const avg7 = averageValue(prior7, actualSleepValue);
  const avg30 = averageValue(prior30, actualSleepValue);
  const previousActual = actualSleepValue(previous);
  const baseline = avg30 ?? avg7 ?? previousActual;
  const diff = Number.isFinite(baseline) ? Number((actualHours - baseline).toFixed(1)) : null;
  const diffText = compareHoursText(diff);
  const nightEating = awakenings.some((item) => item.nightSnack !== "none");
  const binge = awakenings.some((item) => item.nightSnack === "binge");
  const foodTime = awakenings.find((item) => item.nightSnack !== "none" && item.foodTime)?.foodTime;
  const medsValue = document.querySelector("#meds")?.value || saved?.meds || "done";
  const medsLabel = { done: "予定通り", partial: "一部のみ", missed: "未服薬", none: "予定なし" }[medsValue] || "未入力";
  nightSummary.innerHTML = `
    <div class="night-hero">
      <div>
        <span class="night-kicker">🌙 昨夜</span>
        <strong>${actualHours.toFixed(1)}h</strong>
        <small>実際の睡眠</small>
      </div>
      <span class="comparison-pill">${escapeHtml(diffText)}</span>
    </div>
    <div class="baseline-strip">
      <span>7日平均 <b>${formatHours(avg7)}</b></span>
      <span>30日平均 <b>${formatHours(avg30)}</b></span>
      <span>${escapeHtml(signedHours(diff))}</span>
    </div>
    <div class="night-summary-list">
      <div><span>🛏 ベッド</span><b>${formatDurationFromMinutes(bedMinutes)}</b></div>
      <div><span>🌃 中途覚醒</span><b>${awakenings.length}回${awakeMinutes ? `（${formatDurationFromMinutes(awakeMinutes)}）` : ""}</b></div>
      <div><span>🍙 夜間の食事</span><b>${binge ? "過食あり" : nightEating ? `あり${foodTime ? ` ${foodTime}` : ""}` : "なし"}</b></div>
      <div><span>🙂 気分</span><b>${mood.value}</b></div>
      <div><span>💊 服薬</span><b>${medsLabel}</b></div>
    </div>
  `;
}

function renderSleepTimeline() {
  if (!sleepTimeline) return;
  const awakenings = formAwakenings;
  const items = [
    { time: bedtime.value, label: "就寝", detail: "ベッドに入った時間", icon: "🌙", type: "sleep" },
    ...awakenings.flatMap((item) => [
      { time: item.startTime, label: "中途覚醒", detail: item.reasons.length ? `理由：${item.reasons.map((reason) => awakeningLabel(reason, "reasons")).join("、")}` : "起きた時間", icon: "🌃", type: "awake" },
      item.foodTime && item.nightSnack !== "none" ? { time: item.foodTime, label: item.nightSnack === "binge" ? "夜間の食事（過食）" : "夜間の食事", detail: item.food || awakeningLabel(item.nightSnack, "snack"), icon: "🍙", type: item.nightSnack === "binge" ? "food warn" : "food" } : null,
      { time: item.endTime, label: "再入眠", detail: `体感：${awakeningLabel(item.resleep, "resleep")}`, icon: "💤", type: "sleep" }
    ].filter(Boolean)),
    { time: wakeTime.value, label: "起床", detail: "朝の記録へ", icon: "☀️", type: "wake" }
  ].filter((item) => item.time);
  if (!items.length) {
    sleepTimeline.innerHTML = "";
    return;
  }
  sleepTimeline.innerHTML = `
    <div class="timeline-head">
      <div>
        <h3>睡眠タイムライン</h3>
        <p>昨夜なにが起きたかを一本で見ます。</p>
      </div>
    </div>
    <div class="timeline-flow">
      ${items.map((item) => `
        <article class="timeline-event ${item.type}">
          <span class="timeline-icon">${item.icon}</span>
          <div>
            <b>${escapeHtml(item.time)}</b>
            <strong>${escapeHtml(item.label)}</strong>
            <small>${escapeHtml(item.detail)}</small>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function fillForm(entry) {
  form.reset();
  hideTodayReflection();
  entryDate.value = entry?.date || isoToday();
  mood.value = entry?.mood ?? 0;
  bedtime.value = entry?.bedtime || "23:00";
  wakeTime.value = entry?.wakeTime || wakeTimeFromSleep(bedtime.value, entry?.sleep ?? 8);
  formAwakenings = normalizeAwakenings(entry?.awakenings);
  document.querySelectorAll("input[name='hadAwakening']").forEach((radio) => {
    radio.checked = radio.value === (formAwakenings.length ? "yes" : "no");
  });
  document.querySelector("#meds").value = entry?.meds || "done";
  document.querySelector("#stress").value = entry?.stress || "none";
  document.querySelectorAll("input[name='eventTags']").forEach((box) => {
    box.checked = Boolean(entry?.eventTags?.includes(box.value));
  });
  const legacyEventOtherText = tagsToInput(entry?.eventOther);
  const legacyEventDetailText = entry?.eventDetail || "";
  document.querySelector("#eventOther").value = legacyEventOtherText;
  document.querySelector("#eventDetail").value = legacyEventDetailText;
  document.querySelector("#activityLevel").value = entry?.activityLevel || "none";
  document.querySelector("#steps").value = entry?.steps === 0 ? "0" : entry?.steps || "";
  document.querySelector("#stepsSource").value = entry?.stepsSource || (entry?.steps || entry?.steps === 0 ? "manual" : "none");
  const memoParts = [entry?.note || "", legacyEventDetailText, legacyEventOtherText].filter(Boolean);
  document.querySelector("#note").value = [...new Set(memoParts)].join("\n");
  document.querySelector("#doctorNote").value = entry?.doctorNote || "";
  document.querySelector("#dailyEventsPanel").open = Boolean((entry?.eventTags || []).length || (entry?.eventOther || []).length || entry?.eventDetail || (entry?.activityLevel && entry.activityLevel !== "none") || ((entry?.steps ?? "") !== "") || entry?.note);
  document.querySelector("#doctorMemoPanel").open = Boolean((entry?.doctorTags || []).length || entry?.doctorNote);
  document.querySelectorAll("input[name='signs']").forEach((box) => {
    box.checked = Boolean(entry?.signs?.includes(box.value));
  });
  document.querySelectorAll("input[name='doctorTags']").forEach((box) => {
    box.checked = Boolean(entry?.doctorTags?.includes(box.value));
  });
  renderAwakeningInputs();
  updateSignSummaries();
  updateEventFields();
  updateCalculatedFields();
}

function selectedLabelForInput(input) {
  return input.closest("label")?.querySelector(".sign-card, span")?.textContent.trim() || input.value;
}

function updateSignSummaries() {
  document.querySelectorAll("[data-sign-group]").forEach((group) => {
    const checked = [...group.querySelectorAll("input[name='signs']:checked")];
    const summary = group.querySelector("[data-sign-summary]");
    const selected = group.querySelector("[data-sign-selected]");
    const labels = checked.map(selectedLabelForInput);

    group.classList.toggle("has-selected", Boolean(checked.length));
    if (summary) summary.textContent = checked.length ? `${checked.length}件選択` : "未選択";
    if (selected) {
      selected.innerHTML = labels.map((label) => `<span>${escapeHtml(label)}</span>`).join("");
    }
  });
}

function updateEventFields() {
  const stepsInput = document.querySelector("#steps");
  const stepsSourceInput = document.querySelector("#stepsSource");

  if (stepsInput && stepsSourceInput && stepsSourceInput.value !== "auto") {
    stepsSourceInput.value = stepsInput.value === "" ? "none" : "manual";
  }
}

function getRisk(entry) {
  if (!entry) {
    return {
      level: "empty",
      title: "記録すると表示されます",
      body: "保存後、その日の睡眠と最近の平均との差を短く振り返ります。"
    };
  }

  const signs = new Set(entry.signs || []);
  const reasons = [];

  if (signs.has("hopeless")) {
    return {
      level: "danger",
      title: "今日の記録から",
      body: "強い絶望感が記録されています。一人で抱えず、信頼できる人・主治医・地域の相談先につなげてください。",
      reasons: ["強い絶望感"]
    };
  }

  const actual = actualSleepValue(entry);
  const baseline = averageValue(entriesBefore(entry.date, 30), actualSleepValue);
  const diff = actual !== null && baseline !== null ? actual - baseline : null;
  const awakeMinutes = totalAwakeMinutes(entry.awakenings || []);
  const awakening = (entry.awakenings || [])[0];
  const nightFood = (entry.awakenings || []).find((item) => item.nightSnack !== "none");
  const sentences = [];

  if (actual !== null) {
    const comparison = diff === null
      ? "最近平均との差はまだ比較できません"
      : Math.abs(diff) < 0.3
        ? "最近の平均と大きな差はありません"
        : `最近の平均より${Math.abs(diff).toFixed(1)}時間${diff > 0 ? "長め" : "短め"}です`;
    sentences.push(`昨夜は実睡眠${actual.toFixed(1)}時間で、${comparison}。`);
  }

  if ((entry.awakenings || []).length) {
    const foodText = nightFood ? `夜間の食事は${nightFood.foodTime || "時刻未入力"}に記録されています` : "夜間の食事はありません";
    sentences.push(`${awakening?.startTime || "夜間"}の中途覚醒があり、起きていた合計は${formatDurationFromMinutes(awakeMinutes)}です。${foodText}。`);
    reasons.push("中途覚醒");
  }

  if (diff !== null && diff <= -1) {
    sentences.push("短い睡眠が続く場合は、受診時に共有できるよう記録しておきましょう。");
    reasons.push("睡眠短め");
  }

  if (!sentences.length) {
    sentences.push("今日は大きな変化は見つかりませんでした。");
  }

  if (entry.meds === "missed" || entry.meds === "partial") reasons.push("服薬メモ");
  if (nightFood) reasons.push(nightFood.nightSnack === "binge" ? "夜食・過食" : "夜食");

  return {
    level: diff !== null && diff <= -1 ? "warn" : "steady",
    title: "今日の記録から",
    body: sentences.slice(0, 3).join(""),
    reasons
  };
}

function estimateTodayState(entry) {
  const signs = new Set(entry.signs || []);
  const actual = actualSleepValue(entry);
  const baseline = averageValue(entriesBefore(entry.date, 30), actualSleepValue);
  const diff = actual !== null && baseline !== null ? actual - baseline : null;
  const awakenings = entry.awakenings || [];
  const noResleep = awakenings.some((item) => item.resleep === "none");
  const longResleep = awakenings.some((item) => item.resleep === "over60");
  const concernSigns = ["sleepy", "restless", "anxious", "moodUp", "moodDown", "hardToSleep", "earlyWaking"];
  const concernCount = concernSigns.filter((sign) => signs.has(sign)).length;

  if (signs.has("hopeless")) return "rest";
  if ((actual !== null && actual < 4.5) || (diff !== null && diff <= -2) || noResleep || concernCount >= 3 || entry.meds === "missed") {
    return "rest";
  }
  if ((diff !== null && diff <= -1) || awakenings.length >= 2 || longResleep || Math.abs(Number(entry.mood)) >= 4 || concernCount >= 1 || entry.meds === "partial") {
    return "care";
  }
  return "steady";
}

function reflectionStateLabel(state) {
  return {
    steady: "安定",
    care: "少し気をつける",
    rest: "休息を優先"
  }[state] || "安定";
}

function bearMessageFor(entry, state) {
  const actual = actualSleepValue(entry);
  const awakenings = entry.awakenings || [];
  if ((entry.signs || []).includes("hopeless")) {
    return "🐻 ここに記録できたことだけでも大切です。今は一人で抱えず、信頼できる人や主治医につなげることを優先してね。";
  }
  if (state === "rest") {
    if (actual !== null && actual < 4.5) return "🐻 昨夜は睡眠がかなり短めでした。今日はできるだけ休む時間を先に置いてみよう。";
    if (awakenings.some((item) => item.resleep === "none")) return "🐻 夜中に起きたあと、眠れない時間がありました。今日は回復を優先してよさそうです。";
    return "🐻 記録上では少し負荷が重なっています。今日は無理を足しすぎない形が合いそうです。";
  }
  if (state === "care") {
    if (awakenings.length) return "🐻 昨夜は途中で起きた記録があります。今日は少しゆるめに様子を見てもよさそうです。";
    return "🐻 いつもと少し違うサインが記録されています。今日はペースを急ぎすぎずにいこう。";
  }
  if (awakenings.length) return "🐻 おはよう。昨夜は途中で起きたけれど、また眠れた記録が残っています。";
  return "🐻 おはよう。今日の記録は大きく崩れている様子は少なそうです。";
}

function buildTodayReflection(entry) {
  const state = estimateTodayState(entry);
  const signs = new Set(entry.signs || []);
  const actual = actualSleepValue(entry);
  const baseline = averageValue(entriesBefore(entry.date, 30), actualSleepValue);
  const diff = actual !== null && baseline !== null ? actual - baseline : null;
  const awakenings = entry.awakenings || [];
  const awakeMinutes = totalAwakeMinutes(awakenings);
  const nightFood = awakenings.find((item) => item.nightSnack !== "none");
  const tags = [];
  const lines = [];

  if (signs.has("hopeless")) {
    lines.push("強い絶望感が記録されています。");
    lines.push("この表示は診断ではありませんが、今は一人で抱えず、信頼できる人・主治医・地域の相談先につなげることを優先してもよさそうです。");
    tags.push("安全", "受診時に共有");
  } else {
    if (actual !== null) {
      const compareText = diff === null
        ? ""
        : Math.abs(diff) < 0.5
          ? "普段と大きな差はありません。"
          : `普段より${Math.abs(diff).toFixed(1)}時間${diff > 0 ? "長め" : "短め"}です。`;
      lines.push(`昨夜は実睡眠${actual.toFixed(1)}時間でした。${compareText}`);
      if (diff !== null && diff <= -1) tags.push("睡眠短め");
    }

    if (awakenings.length) {
      const resleepText = awakenings.some((item) => item.resleep === "none")
        ? "眠れない時間があった記録です。"
        : awakeMinutes ? `${formatDurationFromMinutes(awakeMinutes)}ほど起きていた記録です。` : "途中で起きた記録があります。";
      lines.push(`中途覚醒は${awakenings.length}回で、${resleepText}`);
      tags.push("中途覚醒");
    }

    if (nightFood) {
      lines.push(nightFood.nightSnack === "binge"
        ? "夜間の食事は、過食した自己評価として記録されています。"
        : "夜間の食事が記録されています。");
      tags.push(nightFood.nightSnack === "binge" ? "夜食・過食" : "夜食");
    }

    if (entry.meds === "missed" || entry.meds === "partial") {
      lines.push(entry.meds === "missed" ? "服薬は飲めなかった記録になっています。" : "服薬は一部のみの記録になっています。");
      tags.push("服薬メモ");
    }

    const signLabelsForEntry = (entry.signs || [])
      .filter((sign) => ["sleepy", "restless", "anxious", "moodUp", "moodDown", "hardToSleep", "earlyWaking"].includes(sign))
      .map((sign) => signLabels[sign])
      .filter(Boolean);
    if (signLabelsForEntry.length) {
      lines.push(`${[...new Set(signLabelsForEntry)].slice(0, 2).join("、")}のサインが記録されています。`);
    }

    if (state === "steady" && lines.length < 3) lines.push("今日は大きな変化は記録されていません。普段通り過ごせそうです。");
    if (state === "care") lines.push("今日は予定を詰め込みすぎず、少し余白を残しておくとよさそうです。");
    if (state === "rest") lines.push("今日は休息を先に置き、必要なら受診時に共有できるよう記録を残しておきましょう。");
  }

  return {
    state,
    label: reflectionStateLabel(state),
    bear: bearMessageFor(entry, state),
    lines: lines.filter(Boolean).slice(0, 4),
    tags: [...new Set(tags)].slice(0, 3)
  };
}

function renderTodayReflection(entry) {
  if (!postSaveReflection) return;
  const reflection = buildTodayReflection(entry);
  postSaveReflection.hidden = false;
  postSaveReflection.className = `post-save-reflection ${reflection.state}`;
  const tagHtml = reflection.tags.length
    ? `<div class="reason-list">${reflection.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>`
    : "";
  postSaveReflection.innerHTML = `
    <p class="save-complete">今日の記録を保存しました</p>
    <div class="bear-note">
      <span>朝のくまさん</span>
      <p>${escapeHtml(reflection.bear)}</p>
      <b>状態：${escapeHtml(reflection.label)}</b>
    </div>
    <div class="reflection-body">
      <span>今日の記録から</span>
      <h2>今日の振り返り</h2>
      ${reflection.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
      ${tagHtml}
    </div>
  `;
}

function hideTodayReflection() {
  if (!postSaveReflection) return;
  postSaveReflection.hidden = true;
  postSaveReflection.innerHTML = "";
}

function renderRisk() {
  const today = entryFor(isoToday());
  todayStatus.textContent = today ? `気分 ${today.mood} / 実睡眠 ${today.actualSleep ?? today.sleep}h` : "未記録";
}

function renderRecent() {
}

function renderSummary() {
  if (!summaryGrid) return;
  const recent = sortedEntries().slice(0, 14);
  const average = (key) => {
    if (!recent.length) return "-";
    const values = recent.map((item) => Number(item[key])).filter((value) => Number.isFinite(value));
    if (!values.length) return "-";
    return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);
  };
  const positiveAverage = (key) => {
    const values = recent.map((item) => Number(item[key])).filter((value) => Number.isFinite(value) && value > 0);
    if (!values.length) return "-";
    return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);
  };
  const signCount = recent.reduce((sum, item) => sum + item.signs.length, 0);
  const missed = recent.filter((item) => item.meds === "missed" || item.meds === "partial").length;
  const averageSteps = positiveAverage("steps");
  summaryGrid.innerHTML = [
    ["平均気分", average("mood")],
    ["平均睡眠", `${average("sleep")}h`],
    ["平均歩数", averageSteps === "-" ? "-" : `${Math.round(Number(averageSteps)).toLocaleString()}歩`],
    ["サイン数", signCount],
    ["服薬の乱れ", missed]
  ].map(([label, value]) => `<div class="summary-card"><span>${label}</span><b>${value}</b></div>`).join("");
}

function drawChart() {
  if (!trendChart) return;
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
  const ySteps = (value) => pad.top + chartH - (Math.min(Number(value), 20000) / 20000) * chartH;

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

  if (showStepsTrend.checked && recent.some((entry) => Number(entry.steps) > 0)) {
    ctx.strokeStyle = "#4f86a8";
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    let hasPoint = false;
    recent.forEach((entry, index) => {
      if (!Number(entry.steps)) return;
      const x = xFor(index);
      const y = ySteps(entry.steps);
      if (!hasPoint) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      hasPoint = true;
    });
    ctx.stroke();
    ctx.setLineDash([]);
    recent.forEach((entry, index) => {
      if (!Number(entry.steps)) return;
      const x = xFor(index);
      const y = ySteps(entry.steps);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#4f86a8";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

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
  if (showStepsTrend.checked) {
    ctx.fillStyle = "#4f86a8";
    ctx.fillText("点線: 歩数 0から20000歩", pad.left + 360, 24);
  }
}

function entriesAscending(limit = 30) {
  return sortedEntries().slice(0, limit).reverse();
}

function awakeHourBuckets(items) {
  const buckets = Array.from({ length: 7 }, (_, index) => ({ hour: index, count: 0 }));
  items.forEach((entry) => {
    (entry.awakenings || []).forEach((awakening) => {
      const start = timeToMinutes(awakening.startTime);
      const end = timeToMinutes(awakening.endTime);
      if (start === null || end === null) return;
      const duration = durationMinutes(awakening.startTime, awakening.endTime);
      for (let offset = 0; offset < Math.max(duration, 1); offset += 30) {
        const hour = Math.floor(((start + offset) % 1440) / 60);
        if (hour >= 0 && hour <= 6) buckets[hour].count += 1;
      }
    });
  });
  return buckets;
}

function mostCommonAwakeHour(items) {
  const buckets = awakeHourBuckets(items);
  const top = buckets.reduce((best, item) => item.count > best.count ? item : best, { hour: null, count: 0 });
  return top.count ? `${top.hour}〜${top.hour + 1}時台` : "まだ記録なし";
}

function commonFoodTime(items) {
  const times = {};
  items.forEach((entry) => {
    (entry.awakenings || []).forEach((awakening) => {
      if (awakening.nightSnack !== "none" && awakening.foodTime) {
        const hour = Math.floor(timeToMinutes(awakening.foodTime) / 60);
        times[hour] = (times[hour] || 0) + 1;
      }
    });
  });
  const top = Object.entries(times).sort((a, b) => b[1] - a[1])[0];
  return top ? `${top[0]}時台` : "まだ記録なし";
}

function renderMiniLine(items, key, className = "") {
  const values = items.map((entry) => Number(key(entry))).filter(Number.isFinite);
  if (values.length < 2) return '<div class="mini-empty">記録が増えると表示されます</div>';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
    const y = 84 - ((value - min) / spread) * 68;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg class="mini-chart ${className}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" /></svg>`;
}

function renderAwakeHeatmap(items) {
  const buckets = awakeHourBuckets(items);
  const max = Math.max(1, ...buckets.map((item) => item.count));
  return `<div class="hour-heatmap">${buckets.map((item) => {
    const level = Math.ceil((item.count / max) * 4);
    return `<div><span>${item.hour}時</span><i class="heat-${level}"></i><b>${item.count}</b></div>`;
  }).join("")}</div>`;
}

function renderFoodBars(items) {
  const buckets = [0, 1, 2, 3, 4, 5, 6].map((hour) => ({ hour, count: 0, binge: 0 }));
  items.forEach((entry) => {
    (entry.awakenings || []).forEach((awakening) => {
      if (awakening.nightSnack === "none" || !awakening.foodTime) return;
      const hour = Math.floor(timeToMinutes(awakening.foodTime) / 60);
      const bucket = buckets.find((item) => item.hour === hour);
      if (!bucket) return;
      bucket.count += 1;
      if (awakening.nightSnack === "binge") bucket.binge += 1;
    });
  });
  const max = Math.max(1, ...buckets.map((item) => item.count));
  return `<div class="food-bars">${buckets.map((item) => `<div><i style="height:${Math.max(8, (item.count / max) * 92)}%" class="${item.binge ? "has-binge" : ""}"></i><span>${item.hour}</span></div>`).join("")}</div>`;
}

function adjustedBedMinutes(value) {
  const minutes = timeToMinutes(value);
  if (minutes === null) return null;
  return minutes < 720 ? minutes + 1440 : minutes;
}

function averageDrift(values) {
  const valid = values.filter(Number.isFinite);
  if (valid.length < 2) return null;
  const average = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  return valid.reduce((sum, value) => sum + Math.abs(value - average), 0) / valid.length;
}

function sleepRegularity(items) {
  const bedDrift = averageDrift(items.map((entry) => adjustedBedMinutes(entry.bedtime)));
  const wakeDrift = averageDrift(items.map((entry) => timeToMinutes(entry.wakeTime)));
  const drifts = [bedDrift, wakeDrift].filter(Number.isFinite);
  if (!drifts.length) return { stars: 0, minutes: null, text: "記録が増えると表示されます。" };
  const minutes = drifts.reduce((sum, value) => sum + value, 0) / drifts.length;
  const stars = minutes <= 25 ? 5 : minutes <= 45 ? 4 : minutes <= 70 ? 3 : minutes <= 100 ? 2 : 1;
  const text = stars >= 4
    ? `今週は睡眠リズムが比較的そろっています。平均のずれは約${Math.round(minutes)}分です。`
    : `就寝・起床時刻が平均${Math.round(minutes)}分ずれています。記録上では睡眠リズムにばらつきがあります。`;
  return { stars, minutes, text };
}

function starText(count) {
  return "★★★★★".slice(0, count) + "☆☆☆☆☆".slice(0, 5 - count);
}

function renderWeekdayBars(items, picker, suffix = "") {
  const labels = ["日", "月", "火", "水", "木", "金", "土"];
  const stats = labels.map((label, index) => {
    const dayItems = items.filter((entry) => dateToWeekday(entry.date) === index);
    const avg = averageValue(dayItems, picker);
    return { label, avg };
  });
  const values = stats.map((item) => item.avg).filter(Number.isFinite);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const spread = max - min || 1;
  return `<div class="weekday-bars">${stats.map((item) => {
    const height = Number.isFinite(item.avg) ? 22 + ((item.avg - min) / spread) * 70 : 8;
    return `<div><i style="height:${height}%"></i><span>${item.label}</span><b>${Number.isFinite(item.avg) ? `${item.avg.toFixed(1)}${suffix}` : "-"}</b></div>`;
  }).join("")}</div>`;
}

function averageSleepFor(items) {
  return averageValue(items, actualSleepValue);
}

function exerciseSleepInsight(items) {
  const exerciseDays = items.filter(hasExerciseRecord);
  const noExerciseDays = items.filter((entry) => !hasExerciseRecord(entry));
  const exerciseAvg = averageSleepFor(exerciseDays);
  const restAvg = averageSleepFor(noExerciseDays);
  if (exerciseDays.length < 2 || noExerciseDays.length < 2 || exerciseAvg === null || restAvg === null) {
    return "運動と睡眠の関係は、記録が増えると表示されます。";
  }
  const diff = exerciseAvg - restAvg;
  if (Math.abs(diff) < 0.3) return `運動した日とそれ以外の日の実睡眠は近い傾向です。`;
  return diff > 0
    ? `運動した日の実睡眠は平均${exerciseAvg.toFixed(1)}hで、他の日より${Math.abs(diff).toFixed(1)}h長い傾向があります。`
    : `運動した日の実睡眠は平均${exerciseAvg.toFixed(1)}hで、他の日より${Math.abs(diff).toFixed(1)}h短い傾向があります。`;
}

function eventSleepInsight(items) {
  const eventEntries = items.filter((entry) => (entry.events || []).length);
  if (eventEntries.length < 2) return "イベントと睡眠の関係は、記録が増えると表示されます。";
  const baseline = averageSleepFor(items);
  const groups = {};
  eventEntries.forEach((entry) => {
    (entry.events || []).forEach((eventName) => {
      groups[eventName] = groups[eventName] || [];
      groups[eventName].push(entry);
    });
  });
  const ranked = Object.entries(groups)
    .map(([name, list]) => ({ name, count: list.length, avg: averageSleepFor(list) }))
    .filter((item) => item.count >= 2 && item.avg !== null && baseline !== null)
    .sort((a, b) => Math.abs(b.avg - baseline) - Math.abs(a.avg - baseline))[0];
  if (!ranked) return "イベント名を同じラベルで記録すると、睡眠との関係が見えやすくなります。";
  const diff = ranked.avg - baseline;
  return `「${ranked.name}」がある日は実睡眠が平均${ranked.avg.toFixed(1)}hで、30日平均との差は${diff > 0 ? "+" : ""}${diff.toFixed(1)}hです。`;
}

function foodSummary(items) {
  const foodItems = items.flatMap((entry) => (entry.awakenings || []).filter((awakening) => awakening.nightSnack !== "none"));
  const bingeItems = foodItems.filter((awakening) => awakening.nightSnack === "binge");
  const time = commonFoodTime(items);
  return { count: foodItems.length, binge: bingeItems.length, time };
}

function entriesForTrendPeriod() {
  return entriesAscending(trendPeriod);
}

function formatCount(value, unit = "回") {
  return `${Number(value || 0).toLocaleString()}${unit}`;
}

function standardDeviation(values) {
  const valid = values.filter(Number.isFinite);
  if (valid.length < 2) return null;
  const average = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  const variance = valid.reduce((sum, value) => sum + ((value - average) ** 2), 0) / valid.length;
  return Math.sqrt(variance);
}

function sleepRegularityStats(items) {
  const bedDrift = averageDrift(items.map((entry) => adjustedBedMinutes(entry.bedtime)));
  const wakeDrift = averageDrift(items.map((entry) => timeToMinutes(entry.wakeTime)));
  const sleepSpread = standardDeviation(items.map(actualSleepValue));
  const combined = averageValue([bedDrift, wakeDrift], (value) => value);
  const stars = combined === null ? 0 : combined <= 25 ? 5 : combined <= 45 ? 4 : combined <= 70 ? 3 : combined <= 100 ? 2 : 1;
  return { bedDrift, wakeDrift, sleepSpread, combined, stars };
}

function foodHourBuckets(items) {
  const buckets = [0, 1, 2, 3, 4, 5, 6].map((hour) => ({ hour, count: 0, binge: 0 }));
  items.forEach((entry) => {
    (entry.awakenings || []).forEach((awakening) => {
      if (awakening.nightSnack === "none" || !awakening.foodTime) return;
      const minutes = timeToMinutes(awakening.foodTime);
      if (minutes === null) return;
      const hour = Math.floor(minutes / 60);
      const bucket = buckets.find((item) => item.hour === hour);
      if (!bucket) return;
      bucket.count += 1;
      if (awakening.nightSnack === "binge") bucket.binge += 1;
    });
  });
  return buckets;
}

function topHourLabel(buckets) {
  const top = buckets.reduce((best, item) => item.count > best.count ? item : best, { hour: null, count: 0 });
  return top.count ? `${top.hour}〜${top.hour + 1}時台` : "なし";
}

function renderPeriodControls() {
  return `
    <div class="trend-period-tabs" aria-label="集計期間">
      ${TREND_PERIODS.map((period) => `
        <button class="${trendPeriod === period ? "is-active" : ""}" data-trend-period="${period}" type="button">${period}日</button>
      `).join("")}
    </div>
  `;
}

function renderTrendEmpty(message) {
  return `<div class="trend-empty">${escapeHtml(message)}</div>`;
}

function renderMetricGrid(metrics) {
  return `<div class="trend-metric-grid">${metrics.map((metric) => `
    <article class="trend-metric">
      <span>${escapeHtml(metric.label)}</span>
      <strong>${escapeHtml(metric.value)}</strong>
      <small>${escapeHtml(metric.unit || "")}</small>
    </article>
  `).join("")}</div>`;
}

function renderHorizontalBars(buckets, options = {}) {
  const max = Math.max(1, ...buckets.map((item) => item.count));
  return `<div class="fact-bars ${options.kind || ""}">${buckets.map((item) => {
    const width = item.count ? Math.max(6, (item.count / max) * 100) : 0;
    const bingeText = item.binge ? `<em>過食 ${item.binge}</em>` : "";
    return `
      <div class="fact-bar-row">
        <span>${item.hour}時</span>
        <div class="fact-bar-track"><i style="width:${width}%"></i></div>
        <b>${item.count}</b>
        ${bingeText}
      </div>
    `;
  }).join("")}</div>`;
}

function weekdayStats(items, picker) {
  const labels = ["日", "月", "火", "水", "木", "金", "土"];
  return labels.map((label, index) => {
    const dayItems = items.filter((entry) => dateToWeekday(entry.date) === index);
    const avg = averageValue(dayItems, picker);
    return { label, count: dayItems.length, avg };
  });
}

function renderWeekdayFactBars(stats, options = {}) {
  const values = stats.map((item) => item.avg).filter(Number.isFinite);
  const min = options.min ?? (values.length ? Math.min(...values) : 0);
  const max = options.max ?? (values.length ? Math.max(...values) : 1);
  const spread = max - min || 1;
  return `<div class="weekday-facts">${stats.map((item) => {
    const height = Number.isFinite(item.avg) ? 12 + ((item.avg - min) / spread) * 76 : 4;
    const value = Number.isFinite(item.avg) ? `${item.avg.toFixed(1)}${options.suffix || ""}` : "-";
    const lowCount = item.count > 0 && item.count < TREND_MIN_COUNTS.average ? "is-reference" : "";
    return `
      <div class="weekday-fact ${lowCount}">
        <div class="weekday-bar-area"><i style="height:${height}%"></i></div>
        <span>${item.label}</span>
        <b>${value}</b>
        <small>${item.count}日</small>
      </div>
    `;
  }).join("")}</div>`;
}

function normalizePoint(value, min, max) {
  const spread = max - min || 1;
  return 52 - ((value - min) / spread) * 44;
}

function renderLineFactChart(items, picker, options) {
  const values = items.map((entry) => {
    const value = Number(picker(entry));
    return Number.isFinite(value) ? value : null;
  });
  const valid = values.filter((value) => value !== null);
  if (valid.length < TREND_MIN_COUNTS.line) {
    return renderTrendEmpty(`あと${Math.max(0, TREND_MIN_COUNTS.line - valid.length)}日分の記録で表示できます`);
  }
  const min = options.min ?? Math.min(...valid);
  const max = options.max ?? Math.max(...valid);
  const points = values.map((value, index) => {
    if (value === null) return null;
    const x = values.length === 1 ? 50 : 6 + (index / (values.length - 1)) * 88;
    const y = normalizePoint(value, min, max);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).filter(Boolean).join(" ");
  const first = items[0]?.date?.slice(5) || "";
  const last = items[items.length - 1]?.date?.slice(5) || "";
  return `
    <div class="line-fact-chart">
      <div class="line-axis"><span>${escapeHtml(options.maxLabel)}</span><span>${escapeHtml(options.minLabel)}</span></div>
      <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="${points}"></polyline>
      </svg>
      <div class="line-date-axis"><span>${escapeHtml(first)}</span><span>${escapeHtml(last)}</span></div>
    </div>
  `;
}

function renderSplitSleepMood(items) {
  return `
    <div class="split-chart">
      <article>
        <div class="split-chart-head"><b>実睡眠</b><span>時間</span></div>
        ${renderLineFactChart(items, actualSleepValue, { min: 0, max: 12, minLabel: "0h", maxLabel: "12h" })}
      </article>
      <article>
        <div class="split-chart-head"><b>気分</b><span>-5〜+5</span></div>
        ${renderLineFactChart(items, (entry) => Number(entry.mood), { min: -5, max: 5, minLabel: "-5", maxLabel: "+5" })}
      </article>
    </div>
  `;
}

function eventComparison(items) {
  const groups = {};
  items.forEach((entry) => {
    (entry.events || []).forEach((eventName) => {
      groups[eventName] = groups[eventName] || [];
      groups[eventName].push(entry);
    });
  });
  const event = Object.entries(groups).sort((a, b) => b[1].length - a[1].length)[0];
  if (!event) return null;
  const [name, withEvent] = event;
  const withoutEvent = items.filter((entry) => !(entry.events || []).includes(name));
  return {
    label: name,
    withLabel: `${name}あり`,
    withoutLabel: `${name}なし`,
    withCount: withEvent.length,
    withoutCount: withoutEvent.length,
    withAvg: averageSleepFor(withEvent),
    withoutAvg: averageSleepFor(withoutEvent)
  };
}

function exerciseComparison(items) {
  const withExercise = items.filter(hasExerciseRecord);
  const withoutExercise = items.filter((entry) => !hasExerciseRecord(entry));
  return {
    label: "運動",
    withLabel: "運動あり",
    withoutLabel: "運動なし",
    withCount: withExercise.length,
    withoutCount: withoutExercise.length,
    withAvg: averageSleepFor(withExercise),
    withoutAvg: averageSleepFor(withoutExercise)
  };
}

function hasExerciseRecord(entry) {
  return (entry.signs || []).includes("exercise")
    || (entry.eventTags || []).includes("運動")
    || (entry.events || []).includes("運動")
    || entry.activityLevel === "high"
    || (entry.steps !== "" && Number(entry.steps) >= 5000);
}

function renderComparisonTable(comparisons) {
  const rows = comparisons.filter(Boolean).map((comparison) => {
    const diff = comparison.withAvg !== null && comparison.withoutAvg !== null
      ? comparison.withAvg - comparison.withoutAvg
      : null;
    const reference = comparison.withCount < TREND_MIN_COUNTS.comparison || comparison.withoutCount < TREND_MIN_COUNTS.comparison;
    return `
      <article class="comparison-fact">
        <h4>${escapeHtml(comparison.label)}</h4>
        <div><span>${escapeHtml(comparison.withLabel)}</span><b>${formatHours(comparison.withAvg)}</b><small>対象 ${comparison.withCount}日</small></div>
        <div><span>${escapeHtml(comparison.withoutLabel)}</span><b>${formatHours(comparison.withoutAvg)}</b><small>対象 ${comparison.withoutCount}日</small></div>
        <p>差 ${diff === null ? "-" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}h`}</p>
        ${reference ? `<em>記録が少ないため参考値です</em>` : ""}
      </article>
    `;
  }).join("");
  return rows || renderTrendEmpty("まだ比較できる記録がありません");
}

function renderTrendDashboard() {
  if (!trendDashboard) return;
  const recent = entriesForTrendPeriod();
  const avgActualSleep = recent.length >= TREND_MIN_COUNTS.average ? averageSleepFor(recent) : null;
  const awakeCount = recent.reduce((sum, entry) => sum + (entry.awakenings || []).length, 0);
  const awakeMinutes = recent.reduce((sum, entry) => sum + totalAwakeMinutes(entry.awakenings || []), 0);
  const food = foodSummary(recent);
  const rhythm = sleepRegularityStats(recent);
  const awakeBuckets = awakeHourBuckets(recent);
  const foodBuckets = foodHourBuckets(recent);
  const sleepWeekdays = weekdayStats(recent, actualSleepValue);
  const moodWeekdays = weekdayStats(recent, (entry) => Number(entry.mood));
  const periodLabel = `直近${trendPeriod}日`;
  const dataNote = recent.length < TREND_MIN_COUNTS.average
    ? `あと${Math.max(0, TREND_MIN_COUNTS.average - recent.length)}日分の記録で平均を表示できます`
    : `対象 ${recent.length}日`;

  trendDashboard.innerHTML = `
    <section class="trend-toolbar">
      <div>
        <h3>期間サマリー</h3>
        <p>${escapeHtml(dataNote)}</p>
      </div>
      ${renderPeriodControls()}
    </section>
    ${renderMetricGrid([
      { label: "平均実睡眠", value: formatHours(avgActualSleep), unit: recent.length < TREND_MIN_COUNTS.average ? "3件以上で表示" : periodLabel },
      { label: "中途覚醒", value: formatCount(awakeCount), unit: periodLabel },
      { label: "起きていた合計", value: formatDurationFromMinutes(awakeMinutes), unit: periodLabel },
      { label: "夜間の食事", value: formatCount(food.count), unit: periodLabel },
      { label: "過食した自己評価", value: formatCount(food.binge), unit: periodLabel }
    ])}
    <section class="trend-card rhythm-card">
      <div class="trend-card-head"><h3>睡眠リズム</h3><span>${escapeHtml(periodLabel)}</span></div>
      <div class="rhythm-facts">
        <div><span>総合平均ずれ</span><b>${rhythm.combined === null ? "-" : `${Math.round(rhythm.combined)}分`}</b></div>
        <div><span>就寝時刻</span><b>${rhythm.bedDrift === null ? "-" : `±${Math.round(rhythm.bedDrift)}分`}</b></div>
        <div><span>起床時刻</span><b>${rhythm.wakeDrift === null ? "-" : `±${Math.round(rhythm.wakeDrift)}分`}</b></div>
        <div><span>睡眠時間</span><b>${rhythm.sleepSpread === null ? "-" : `±${rhythm.sleepSpread.toFixed(1)}h`}</b></div>
      </div>
      <strong class="rhythm-stars">${starText(rhythm.stars)}</strong>
      <p class="trend-note">星は表示補助です。判断は上の数値を優先してください。</p>
    </section>
    <section class="trend-card">
      <div class="trend-card-head"><h3>中途覚醒の時間帯</h3><span>${escapeHtml(periodLabel)} / 最多 ${escapeHtml(topHourLabel(awakeBuckets))}</span></div>
      ${renderHorizontalBars(awakeBuckets)}
      <p class="trend-note">0時〜6時台。起きていた時間帯全体を30分単位で集計しています。</p>
    </section>
    <section class="trend-card">
      <div class="trend-card-head"><h3>夜間の食事時刻</h3><span>${escapeHtml(periodLabel)} / 最多 ${escapeHtml(topHourLabel(foodBuckets))}</span></div>
      ${renderHorizontalBars(foodBuckets, { kind: "food-fact-bars" })}
      <p class="trend-note">食べた時刻を基準に集計。過食は自己評価として別表示しています。</p>
    </section>
    <section class="trend-card">
      <div class="trend-card-head"><h3>曜日別の睡眠</h3><span>${escapeHtml(periodLabel)}</span></div>
      ${renderWeekdayFactBars(sleepWeekdays, { suffix: "h", min: 0, max: 12 })}
      <p class="trend-note">各曜日の平均実睡眠と対象日数です。対象1〜2日は参考値です。</p>
    </section>
    <section class="trend-card">
      <div class="trend-card-head"><h3>曜日別の気分</h3><span>${escapeHtml(periodLabel)} / -5〜+5</span></div>
      ${renderWeekdayFactBars(moodWeekdays, { min: -5, max: 5 })}
      <p class="trend-note">気分スケールは -5〜+5 です。対象1〜2日は参考値です。</p>
    </section>
    <section class="trend-card wide">
      <div class="trend-card-head"><h3>睡眠と気分</h3><span>${escapeHtml(periodLabel)}</span></div>
      ${renderSplitSleepMood(recent)}
      <p class="trend-note">上下に分けて表示しています。日付軸のみ共有です。</p>
    </section>
    <section class="trend-card wide">
      <div class="trend-card-head"><h3>運動・イベントとの関係</h3><span>${escapeHtml(periodLabel)}</span></div>
      <div class="comparison-grid">
        ${renderComparisonTable([exerciseComparison(recent), eventComparison(recent)])}
      </div>
    </section>
  `;
}

function hourDiffLabel(hours) {
  const minutes = Math.round(Math.abs(hours) * 60);
  if (minutes < 60) return `${minutes}分`;
  const wholeHours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${wholeHours}時間${rest}分` : `${wholeHours}時間`;
}

function averageAwakeCount(items) {
  if (!items.length) return null;
  return items.reduce((sum, entry) => sum + (entry.awakenings || []).length, 0) / items.length;
}

function averageAwakeMinutes(items) {
  if (!items.length) return null;
  return items.reduce((sum, entry) => sum + totalAwakeMinutes(entry.awakenings || []), 0) / items.length;
}

function averageNightFoodCount(items) {
  if (!items.length) return null;
  return items.reduce((sum, entry) => sum + (entry.awakenings || []).filter((item) => item.nightSnack !== "none").length, 0) / items.length;
}

function averageStepsValue(items) {
  return averageValue(items, (entry) => {
    if (entry.steps === "" || entry.steps === null || entry.steps === undefined) return null;
    const value = Number(entry.steps);
    return Number.isFinite(value) ? value : null;
  });
}

function splitRecentWeeks() {
  const latest14 = entriesAscending(14);
  return {
    previous: latest14.slice(0, Math.max(0, latest14.length - 7)),
    current: latest14.slice(-7)
  };
}

function trendCard(kind, title, body, meta = "", priority = 50, medical = false) {
  return { kind, title, body, meta, priority, medical };
}

function buildWeekChangeFinding() {
  const { current, previous } = splitRecentWeeks();
  if (current.length < 7 || previous.length < 7) return null;

  const changes = [];
  const currentSleep = averageSleepFor(current);
  const previousSleep = averageSleepFor(previous);
  if (currentSleep !== null && previousSleep !== null) {
    const diff = currentSleep - previousSleep;
    if (Math.abs(diff) >= 0.3) {
      changes.push(`実睡眠は前の週より平均${hourDiffLabel(diff)}${diff > 0 ? "長く" : "短く"}なっています`);
    }
  }

  const currentRhythm = sleepRegularityStats(current);
  const previousRhythm = sleepRegularityStats(previous);
  if (currentRhythm.combined !== null && previousRhythm.combined !== null) {
    const diff = currentRhythm.combined - previousRhythm.combined;
    if (Math.abs(diff) >= 15) {
      changes.push(`就寝・起床時刻の平均ずれは前の週より${Math.round(Math.abs(diff))}分${diff > 0 ? "大きく" : "小さく"}なっています`);
    }
  }

  const awakeDiff = averageAwakeCount(current) - averageAwakeCount(previous);
  if (Number.isFinite(awakeDiff) && Math.abs(awakeDiff) >= 0.4) {
    changes.push(`中途覚醒は前の週より1日あたり約${Math.abs(awakeDiff).toFixed(1)}回${awakeDiff > 0 ? "増えています" : "減っています"}`);
  }

  const awakeMinutesDiff = averageAwakeMinutes(current) - averageAwakeMinutes(previous);
  if (Number.isFinite(awakeMinutesDiff) && Math.abs(awakeMinutesDiff) >= 20) {
    changes.push(`起きていた時間は前の週より1日あたり約${Math.round(Math.abs(awakeMinutesDiff))}分${awakeMinutesDiff > 0 ? "長く" : "短く"}なっています`);
  }

  const currentMood = averageValue(current, (entry) => Number(entry.mood));
  const previousMood = averageValue(previous, (entry) => Number(entry.mood));
  const moodDiff = currentMood !== null && previousMood !== null ? currentMood - previousMood : null;
  if (moodDiff !== null && Math.abs(moodDiff) >= 0.8) {
    changes.push(`気分の平均は前の週より${Math.abs(moodDiff).toFixed(1)}ポイント${moodDiff > 0 ? "高め" : "低め"}です`);
  }

  const stepsCurrent = averageStepsValue(current);
  const stepsPrevious = averageStepsValue(previous);
  if (stepsCurrent !== null && stepsPrevious !== null) {
    const diff = stepsCurrent - stepsPrevious;
    if (Math.abs(diff) >= 1500) {
      changes.push(`歩数は前の週より平均${Math.round(Math.abs(diff)).toLocaleString()}歩${diff > 0 ? "多め" : "少なめ"}です`);
    }
  }

  if (!changes.length) {
    return trendCard("stable", "今週の変化", "今週は大きな変化は見つかりませんでした。", "直近7日 vs 前7日", 90);
  }

  return trendCard("change", "今週の変化", `${changes.slice(0, 2).join("。")}。`, "直近7日 vs 前7日", 10, changes.some((item) => item.includes("実睡眠") || item.includes("時刻")));
}

function consecutiveShortSleepFinding() {
  const recent = entriesAscending(30);
  if (recent.length < 10) return null;
  const baseline = averageSleepFor(recent.slice(0, -3));
  if (baseline === null) return null;
  let streak = 0;
  [...recent].reverse().some((entry) => {
    const value = actualSleepValue(entry);
    if (value !== null && value <= baseline - 0.75) {
      streak += 1;
      return false;
    }
    return true;
  });
  if (streak < 3) return null;
  return trendCard(
    "pattern",
    "続いているパターン",
    `実睡眠が本人平均との差より短い日が${streak}日続いています。必要に応じて受診時に共有できます。`,
    "本人の30日平均と比較",
    1,
    true
  );
}

function repeatedAwakeHourFinding() {
  const recent = entriesAscending(14);
  if (recent.length < 7) return null;
  const hourDays = {};
  recent.forEach((entry) => {
    const hours = new Set();
    (entry.awakenings || []).forEach((awakening) => {
      const start = timeToMinutes(awakening.startTime);
      if (start === null) return;
      const duration = Math.max(1, durationMinutes(awakening.startTime, awakening.endTime));
      for (let offset = 0; offset < duration; offset += 30) {
        const hour = Math.floor(((start + offset) % 1440) / 60);
        if (hour >= 0 && hour <= 6) hours.add(hour);
      }
    });
    hours.forEach((hour) => {
      hourDays[hour] = hourDays[hour] || new Set();
      hourDays[hour].add(entry.date);
    });
  });
  const top = Object.entries(hourDays)
    .map(([hour, dates]) => ({ hour: Number(hour), count: dates.size }))
    .sort((a, b) => b.count - a.count)[0];
  if (!top || top.count < 3) return null;
  return trendCard(
    "pattern",
    "続いているパターン",
    `${top.hour}〜${top.hour + 1}時台の中途覚醒が、直近2週間で${top.count}日記録されています。`,
    "単発ではなく複数日で確認",
    2,
    true
  );
}

function concentratedNightFoodFinding() {
  const recent = entriesAscending(30);
  if (recent.length < 7) return null;
  const buckets = foodHourBuckets(recent);
  const total = buckets.reduce((sum, item) => sum + item.count, 0);
  const top = [...buckets].sort((a, b) => b.count - a.count)[0];
  if (!top || total < 3 || top.count < 2 || top.count / total < 0.5) return null;
  return trendCard(
    "pattern",
    "夜間の食事の時間帯",
    `夜間の食事は${top.hour}〜${top.hour + 1}時台に集中しています。過食した自己評価は同じ時間帯で${top.binge}回あります。`,
    "食べた時刻を基準に集計",
    3
  );
}

function missedMedsFinding() {
  const current = entriesAscending(7);
  if (current.length < 3) return null;
  const count = current.filter((entry) => entry.meds === "missed" || entry.meds === "partial").length;
  if (count < 2) return null;
  return trendCard("meds", "服薬の記録", `服薬が予定通りではない記録が直近7日で${count}日あります。必要に応じて受診時に共有できます。`, "直近7日", 4);
}

function conditionComparisonFinding() {
  const recent = entriesAscending(90);
  if (recent.length < TREND_MIN_COUNTS.correlation) return null;
  const candidates = [];
  const exercise = exerciseComparison(recent);
  if (exercise.withCount >= 3 && exercise.withoutCount >= 3 && exercise.withAvg !== null && exercise.withoutAvg !== null) {
    const diff = exercise.withAvg - exercise.withoutAvg;
    if (Math.abs(diff) >= 0.3) {
      candidates.push(trendCard(
        "personal",
        "あなた固有の傾向",
        `運動を記録した日は、その他の日より実睡眠が平均${hourDiffLabel(diff)}${diff > 0 ? "長い" : "短い"}傾向が見られます。`,
        `対象: 運動あり${exercise.withCount}日 / なし${exercise.withoutCount}日`,
        5
      ));
    }
  }

  const event = eventComparison(recent);
  if (event && event.withCount >= 3 && event.withoutCount >= 3 && event.withAvg !== null && event.withoutAvg !== null) {
    const diff = event.withAvg - event.withoutAvg;
    if (Math.abs(diff) >= 0.3) {
      candidates.push(trendCard(
        "personal",
        "あなた固有の傾向",
        `「${event.label}」を記録した日は、それ以外の日より実睡眠が平均${hourDiffLabel(diff)}${diff > 0 ? "長い" : "短い"}傾向が見られます。`,
        `対象: あり${event.withCount}日 / なし${event.withoutCount}日`,
        6
      ));
    }
  }

  return candidates.sort((a, b) => a.priority - b.priority)[0] || null;
}

function buildAiFindings() {
  const recent = entriesAscending(30);
  if (recent.length < 7) {
    return [
      trendCard(
        "empty",
        "記録がもう少し必要です",
        `まだ比較に必要な記録が十分ではありません。あと${Math.max(0, 7 - recent.length)}日分たまると、週ごとの変化を表示できます。`,
        "推測は表示しません",
        1
      )
    ];
  }

  const findings = [
    consecutiveShortSleepFinding(),
    repeatedAwakeHourFinding(),
    concentratedNightFoodFinding(),
    buildWeekChangeFinding(),
    missedMedsFinding(),
    conditionComparisonFinding()
  ].filter(Boolean);

  const unique = [];
  const seenKinds = new Set();
  findings.sort((a, b) => a.priority - b.priority).forEach((finding) => {
    const key = finding.kind === "pattern" ? finding.body.slice(0, 18) : finding.kind;
    if (seenKinds.has(key)) return;
    seenKinds.add(key);
    unique.push(finding);
  });

  return unique.slice(0, 5);
}

function renderAiAnalysis() {
  if (!aiAnalysis) return;
  const findings = buildAiFindings();
  const hasMedicalNote = findings.some((finding) => finding.medical);
  aiAnalysis.innerHTML = `
    <section class="ai-finding-list">
      ${findings.map((finding) => `
        <article class="ai-finding ${finding.kind}">
          <span>${escapeHtml(finding.title)}</span>
          <p>${escapeHtml(finding.body)}</p>
          ${finding.meta ? `<small>${escapeHtml(finding.meta)}</small>` : ""}
        </article>
      `).join("")}
    </section>
    <section class="ai-note">
      <b>分析方法</b>
      <p>この画面は保存済みデータをルールベースで比較しています。${hasMedicalNote ? "睡眠リズムの変化は双極症の体調変化と関連することが報告されています。" : ""}この表示は診断ではありません。</p>
    </section>
  `;
}

function renderDataPreview() {
  const items = filteredEntries();
  dataPreview.textContent = JSON.stringify(items, null, 2);
}

function renderTagFilter() {
  const tags = allDoctorTags();
  const buttons = [
    `<button class="${activeDoctorTag === "all" ? "is-active" : ""}" data-tag="all" type="button">すべて</button>`,
    ...tags.map((tag) => `<button class="${activeDoctorTag === tag ? "is-active" : ""}" data-tag="${escapeAttr(tag)}" type="button">${escapeHtml(tag)}</button>`)
  ];
  tagFilterBar.innerHTML = buttons.join("");
}

function renderFilteredLog() {
  const items = filteredEntries();
  if (!items.length) {
    filteredLog.innerHTML = '<div class="filtered-empty">このタグの記録はまだありません。</div>';
    return;
  }

  filteredLog.innerHTML = items.slice(0, 8).map((entry) => {
    const tags = (entry.doctorTags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
    const note = entry.note ? `<p>${escapeHtml(entry.note)}</p>` : "";
    return `<article class="log-card"><div><strong>${escapeHtml(entry.date)}</strong><small>気分 ${entry.mood} / 睡眠 ${entry.sleep}h</small></div><div class="tag-row">${tags}</div>${note}</article>`;
  }).join("");
}

function renderAll() {
  renderRisk();
  renderRecent();
  renderSummary();
  drawChart();
  renderTrendDashboard();
  renderAiAnalysis();
  renderTagFilter();
  renderFilteredLog();
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
  const rows = [["date", "mood", "bedtime", "wakeTime", "sleep", "actualSleep", "awakenings", "meds", "stress", "activityLevel", "steps", "stepsSource", "signs", "events", "eventTags", "eventOther", "eventDetail", "doctorTags", "doctorNote", "note"]];
  sortedEntries().reverse().forEach((entry) => {
    rows.push([
      entry.date,
      entry.mood,
      entry.bedtime || "",
      entry.wakeTime || "",
      entry.sleep,
      entry.actualSleep ?? entry.sleep,
      JSON.stringify(entry.awakenings || []),
      entry.meds,
      entry.stress,
      entry.activityLevel || "none",
      entry.steps === 0 ? 0 : entry.steps || "",
      entry.stepsSource || "none",
      entry.signs.join("|"),
      (entry.events || []).join("|"),
      (entry.eventTags || []).join("|"),
      (entry.eventOther || []).join("|"),
      entry.eventDetail || "",
      (entry.doctorTags || []).join("|"),
      entry.doctorNote || "",
      entry.note.replace(/\n/g, " ")
    ]);
  });
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    views.forEach((view) => view.classList.toggle("is-active", view.id === tab.dataset.view));
    if (tab.dataset.view === "trends") {
      drawChart();
      renderTrendDashboard();
    }
    if (tab.dataset.view === "plan") {
      renderAiAnalysis();
    }
  });
});

[mood, bedtime, wakeTime].forEach((input) => input.addEventListener("input", updateCalculatedFields));
document.querySelector("#meds").addEventListener("change", renderNightSummary);

[bedtime, wakeTime].forEach((input) => {
  input.addEventListener("change", () => {
    input.value = roundTimeValue(input.value);
    updateCalculatedFields();
  });
});

document.querySelectorAll("input[name='hadAwakening']").forEach((radio) => {
  radio.addEventListener("change", () => {
    if (radio.value === "yes" && radio.checked && !formAwakenings.length) formAwakenings = [blankAwakening()];
    if (radio.value === "no" && radio.checked) formAwakenings = [];
    renderAwakeningInputs();
  });
});

addAwakening.addEventListener("click", () => {
  syncAwakeningsFromDom();
  formAwakenings = [...formAwakenings, blankAwakening()];
  renderAwakeningInputs();
});

awakeningList.addEventListener("input", () => {
  syncAwakeningsFromDom();
  updateCalculatedFields();
});

awakeningList.addEventListener("change", () => {
  syncAwakeningsFromDom();
  updateCalculatedFields();
});

awakeningList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action='remove-awakening']");
  if (!button) return;
  syncAwakeningsFromDom();
  formAwakenings = formAwakenings.filter((_, index) => index !== Number(button.dataset.index));
  if (!formAwakenings.length) {
    document.querySelector("input[name='hadAwakening'][value='no']").checked = true;
  }
  renderAwakeningInputs();
});

trendDashboard?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-trend-period]");
  if (!button) return;
  trendPeriod = Number(button.dataset.trendPeriod) || 30;
  renderTrendDashboard();
});

entryDate.addEventListener("change", () => {
  fillForm(entryFor(entryDate.value) || { date: entryDate.value });
});

form.addEventListener("change", (event) => {
  if (event.target.matches("input[name='signs']")) updateSignSummaries();
  if (event.target.matches("input[name='eventTags'], #activityLevel, #steps")) updateEventFields();
});

form.addEventListener("input", (event) => {
  if (event.target.matches("#eventOther, #steps")) updateEventFields();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (isSavingEntry) return;
  isSavingEntry = true;
  if (saveEntry) {
    saveEntry.disabled = true;
    saveEntry.textContent = "保存中…";
  }
  const data = new FormData(form);
  const roundedBedtime = roundTimeValue(data.get("bedtime"));
  const roundedWakeTime = roundTimeValue(data.get("wakeTime"));
  const awakenings = syncAwakeningsFromDom();
  const signs = data.getAll("signs");
  const eventTags = data.getAll("eventTags");
  const eventOther = eventTags.includes("その他") ? normalizeTags(data.get("eventOther")) : [];
  const eventDetail = String(data.get("eventDetail") || "").trim();
  const activityLevel = ["none", "low", "usual", "high"].includes(data.get("activityLevel")) ? data.get("activityLevel") : "none";
  const stepsValue = normalizeSteps(data.get("steps"));
  const stepsSource = stepsValue === "" ? "none" : (data.get("stepsSource") === "auto" ? "auto" : "manual");
  const doctorTags = data.getAll("doctorTags");
  const doctorNote = String(data.get("doctorNote") || "").trim();
  const note = String(data.get("note") || "").trim();
  if (awakenings.length && !signs.includes("nightWaking")) signs.push("nightWaking");
  bedtime.value = roundedBedtime;
  wakeTime.value = roundedWakeTime;
  const entry = {
    date: data.get("date"),
    mood: Number(data.get("mood")),
    bedtime: roundedBedtime,
    wakeTime: roundedWakeTime,
    sleep: sleepHoursFromTimes(roundedBedtime, roundedWakeTime),
    actualSleep: actualSleepHours(roundedBedtime, roundedWakeTime, awakenings),
    awakenings,
      meds: data.get("meds"),
      stress: data.get("stress"),
      signs,
      events: mergedEventValues(eventTags, eventOther),
      eventTags,
      eventOther,
      eventDetail,
      activityLevel,
      steps: stepsValue,
      stepsSource,
      doctorTags,
      doctorNote,
      note
  };
  entries = [...entries.filter((item) => item.date !== entry.date), entry];
  saveEntries();
  renderAll();
  renderTodayReflection(entry);
  showToast("今日の記録を保存しました");
  window.setTimeout(() => {
    isSavingEntry = false;
    if (saveEntry) {
      saveEntry.disabled = false;
      saveEntry.textContent = "保存";
    }
  }, 450);
});

document.querySelector("#clearToday").addEventListener("click", () => {
  if (!window.confirm("今日の入力を消しますか？保存済みの記録は、もう一度保存するまで変更されません。")) return;
  fillForm({ date: entryDate.value });
});

tagFilterBar.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tag]");
  if (!button) return;
  activeDoctorTag = button.dataset.tag;
  renderTagFilter();
  renderFilteredLog();
  renderDataPreview();
});

if (showStepsTrend) showStepsTrend.addEventListener("change", drawChart);

settingsOpen.addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);
settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) closeSettings();
});

saveSettings.addEventListener("click", async () => {
  settings = {
    ...settings,
    reminderEnabled: reminderEnabled.checked,
    reminderTime: roundTimeValue(reminderTime.value || "21:00")
  };
  reminderTime.value = settings.reminderTime;

  if (settings.reminderEnabled && notificationSupported() && Notification.permission === "default") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") settings.reminderEnabled = false;
  }

  saveAppSettings();
  scheduleReminder();
  updateReminderStatus(settings.reminderEnabled ? "リマインダーを保存しました。" : "リマインダーをオフにしました。");
  showToast("設定を保存しました");
});

testReminder.addEventListener("click", async () => {
  if (!notificationSupported()) {
    updateReminderStatus("このブラウザでは通知に対応していません。");
    return;
  }
  if (Notification.permission === "default") await Notification.requestPermission();
  if (Notification.permission === "granted") {
    new Notification("通知テスト", { body: "このように記録リマインダーが届きます。" });
    updateReminderStatus("通知テストを送信しました。");
  } else {
    updateReminderStatus("通知が許可されていません。");
  }
});

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
registerServiceWorker();
populateTimeSelects();
fillForm(entryFor(isoToday()));
reminderEnabled.checked = Boolean(settings.reminderEnabled);
reminderTime.value = settings.reminderTime || "21:00";
scheduleReminder();
updateReminderStatus();
renderAll();

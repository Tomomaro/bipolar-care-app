const STORAGE_KEY = "bipolar-care-log-v1";
const SETTINGS_KEY = "bipolar-care-settings-v1";
const removedDemoNote = "\u30b5\u30f3\u30d7\u30eb\u8a18\u9332";
const signLabels = {
  sleepDrop: "睡眠の乱れ",
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
const recentList = document.querySelector("#recentList");
const riskCard = document.querySelector("#riskCard");
const todayStatus = document.querySelector("#todayStatus");
const trendChart = document.querySelector("#trendChart");
const summaryGrid = document.querySelector("#summaryGrid");
const trendDashboard = document.querySelector("#trendDashboard");
const aiAnalysis = document.querySelector("#aiAnalysis");
const dataPreview = document.querySelector("#dataPreview");
const tagFilterBar = document.querySelector("#tagFilterBar");
const filteredLog = document.querySelector("#filteredLog");
const saveToast = document.querySelector("#saveToast");
const settingsOpen = document.querySelector("#settingsOpen");
const settingsClose = document.querySelector("#settingsClose");
const settingsModal = document.querySelector("#settingsModal");
const reminderEnabled = document.querySelector("#reminderEnabled");
const reminderTime = document.querySelector("#reminderTime");
const reminderStatus = document.querySelector("#reminderStatus");
const saveSettings = document.querySelector("#saveSettings");
const testReminder = document.querySelector("#testReminder");
const showStepsTrend = document.querySelector("#showStepsTrend");

let entries = loadEntries();
let activeDoctorTag = "all";
let settings = loadSettings();
let reminderTimer = null;
let formAwakenings = [];
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
        events: normalizeTags(item.events),
        steps: normalizeSteps(item.steps),
        doctorTags: normalizeTags(item.doctorTags),
        note: item.note || ""
      };
    });
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
  const steps = Number(value);
  return Number.isFinite(steps) && steps > 0 ? Math.round(steps) : "";
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
  document.querySelector("#events").value = tagsToInput(entry?.events);
  document.querySelector("#steps").value = entry?.steps || "";
  document.querySelector("#note").value = entry?.note || "";
  document.querySelectorAll("input[name='signs']").forEach((box) => {
    box.checked = Boolean(entry?.signs?.includes(box.value));
  });
  document.querySelectorAll("input[name='doctorTags']").forEach((box) => {
    box.checked = Boolean(entry?.doctorTags?.includes(box.value));
  });
  renderAwakeningInputs();
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
  const reasons = [];
  let upScore = 0;
  let downScore = 0;
  let careScore = 0;

  const sleepValue = Number(entry.actualSleep ?? entry.sleep);
  const lowSleep = sleepValue <= 5;
  const veryLowSleep = sleepValue <= 4;
  const longSleep = sleepValue >= 10;
  const highMood = Number(entry.mood) >= 3;
  const veryHighMood = Number(entry.mood) >= 4;
  const lowMood = Number(entry.mood) <= -3;
  const veryLowMood = Number(entry.mood) <= -4;
  const missedMeds = entry.meds === "missed" || entry.meds === "partial";
  const externalLoad = (entry.events || []).length > 0;
  const highSteps = Number(entry.steps) >= 12000;
  const veryHighSteps = Number(entry.steps) >= 16000;

  if (signs.has("hopeless")) {
    return {
      level: "danger",
      title: "緊急度が高いサインがあります",
      body: "一人で抱えず、今すぐ信頼できる人・主治医・地域の救急相談につなげてください。",
      reasons: ["強い絶望感"]
    };
  }

  if (veryHighMood) { upScore += 2; reasons.push("気分がかなり高め"); }
  else if (highMood) { upScore += 1; reasons.push("気分が高め"); }
  if (veryLowMood) { downScore += 2; reasons.push("気分がかなり低め"); }
  else if (lowMood) { downScore += 1; reasons.push("気分が低め"); }
  if (veryLowSleep) { upScore += 2; careScore += 1; reasons.push("睡眠が短い"); }
  else if (lowSleep) { upScore += 1; reasons.push("睡眠が少なめ"); }
  if (longSleep || signs.has("sleepy")) { downScore += 1; reasons.push("眠気・睡眠多め"); }
  if (signs.has("hardToSleep") || signs.has("nightWaking") || signs.has("earlyWaking") || signs.has("sleepDrop")) { upScore += 1; reasons.push("睡眠の乱れ"); }
  if (signs.has("racing") || signs.has("restless") || signs.has("talkative")) { upScore += 2; reasons.push("上がりやすいサイン"); }
  if (signs.has("caffeine") || signs.has("alcohol")) { upScore += 1; reasons.push("刺激になる要因"); }
  if (signs.has("withdrawal") || signs.has("noReply") || signs.has("bodyHeavy") || signs.has("foggy")) { downScore += 2; reasons.push("下がりやすいサイン"); }
  if (signs.has("lowAppetite") || signs.has("skippedMeals") || signs.has("dizzy") || signs.has("headache") || signs.has("nausea")) { careScore += 1; reasons.push("体調ケアが必要"); }
  if (missedMeds) { careScore += 2; reasons.push("服薬の乱れ"); }
  if (entry.stress === "high") { upScore += 1; downScore += 1; reasons.push("ストレス高め"); }
  if (externalLoad) { careScore += 1; reasons.push("イベントあり"); }
  if (veryHighSteps) { upScore += 1; careScore += 1; reasons.push("歩き過ぎ"); }
  else if (highSteps) { careScore += 1; reasons.push("歩数多め"); }

  if (upScore >= 4 || (upScore >= 3 && lowSleep)) {
    return {
      level: "warn",
      title: "睡眠を優先したい日です",
      body: "記録上では睡眠の短さや刺激になる要因が重なっています。今夜は早めの就寝と予定を増やしすぎないことを意識してもよさそうです。",
      reasons
    };
  }

  if (downScore >= 4 || (downScore >= 3 && careScore >= 1)) {
    return {
      level: "warn",
      title: "負担を軽くしたい日です",
      body: "記録上では体調ケアを優先したいサインがいくつか見られます。食事・水分・服薬を確認し、小さな予定から始めてもよさそうです。",
      reasons
    };
  }

  if (careScore >= 2 || reasons.length >= 3) {
    return {
      level: "steady",
      title: "変化をメモしておきたい日です",
      body: "睡眠・食事・服薬とイベントの影響をメモしておくと、受診時に共有してもよい変化として振り返りやすくなります。",
      reasons
    };
  }

  return {
    level: "steady",
    title: "睡眠リズムは比較的安定しています",
    body: "記録上では大きな乱れは少ないようです。気になる変化だけ短くメモしておきましょう。",
    reasons
  };
}

function renderRisk() {
  const today = entryFor(isoToday());
  const risk = getRisk(today);
  riskCard.className = `risk-card ${risk.level === "steady" || risk.level === "empty" ? "" : risk.level}`;
  const reasonList = risk.reasons?.length
    ? `<div class="reason-list">${[...new Set(risk.reasons)].slice(0, 5).map((reason) => `<span>${reason}</span>`).join("")}</div>`
    : "";
  riskCard.innerHTML = `<strong>${risk.title}</strong><p>${risk.body}</p>${reasonList}`;
  todayStatus.textContent = today ? `気分 ${today.mood} / 実睡眠 ${today.actualSleep ?? today.sleep}h` : "未記録";
}

function renderRecent() {
  const recent = sortedEntries().slice(0, 5);
  if (!recent.length) {
    recentList.innerHTML = '<div class="mini-item"><strong>まだ記録がありません</strong><span>今日の記録から始められます。</span></div>';
    return;
  }

  recentList.innerHTML = recent.map((entry) => {
    const signs = entry.signs.length ? entry.signs.map((sign) => signLabels[sign]).join("、") : "サインなし";
    const tags = [...(entry.events || []), ...(entry.doctorTags || [])].slice(0, 3);
    const tagText = tags.length ? ` / ${tags.join("、")}` : "";
    const stepText = entry.steps ? ` / ${entry.steps}歩` : "";
    const awakeText = entry.awakenings?.length ? ` / 中途覚醒 ${entry.awakenings.length}回` : "";
    return `<div class="mini-item"><strong>${entry.date}</strong><span>気分 ${entry.mood} / 実睡眠 ${entry.actualSleep ?? entry.sleep}h${awakeText}${stepText} / ${signs}${tagText}</span></div>`;
  }).join("");
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
  const exerciseDays = items.filter((entry) => (entry.signs || []).includes("exercise") || Number(entry.steps) >= 5000);
  const noExerciseDays = items.filter((entry) => !((entry.signs || []).includes("exercise") || Number(entry.steps) >= 5000));
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

function renderTrendDashboard() {
  if (!trendDashboard) return;
  const recent = entriesAscending(30);
  const seven = entriesAscending(7);
  const awakeCount = recent.reduce((sum, entry) => sum + (entry.awakenings || []).length, 0);
  const awakeMinutes = recent.reduce((sum, entry) => sum + totalAwakeMinutes(entry.awakenings || []), 0);
  const food = foodSummary(recent);
  const avgActualSleep = averageSleepFor(recent);
  const avg7 = averageSleepFor(seven);
  const rhythm = sleepRegularity(seven.length >= 3 ? seven : recent);
  const insightItems = buildAiFindings().slice(0, 4);

  trendDashboard.innerHTML = `
    <section class="trend-hero-card">
      <div>
        <span>30日間の睡眠</span>
        <strong>${formatHours(avgActualSleep)}</strong>
        <small>平均実睡眠</small>
      </div>
      <div class="trend-hero-metrics">
        <p><b>${awakeCount}</b><span>中途覚醒</span></p>
        <p><b>${food.count}</b><span>夜間の食事</span></p>
        <p><b>${food.binge}</b><span>過食した</span></p>
      </div>
      <div class="trend-baseline">
        <span>7日平均 ${formatHours(avg7)}</span>
        <span>起きていた合計 ${formatDurationFromMinutes(awakeMinutes)}</span>
      </div>
    </section>
    <section class="trend-card rhythm-card">
      <div class="trend-card-head"><h3>睡眠リズム</h3><span>${rhythm.minutes === null ? "集計中" : `平均ずれ ${Math.round(rhythm.minutes)}分`}</span></div>
      <strong class="rhythm-stars">${starText(rhythm.stars)}</strong>
      <p class="trend-note">${escapeHtml(rhythm.text)}</p>
    </section>
    <section class="trend-card">
      <div class="trend-card-head"><h3>🌃 中途覚醒の時間帯</h3><span>${mostCommonAwakeHour(recent)}</span></div>
      ${renderAwakeHeatmap(recent)}
    </section>
    <section class="trend-card">
      <div class="trend-card-head"><h3>🍙 夜間の食事</h3><span>${commonFoodTime(recent)}</span></div>
      ${renderFoodBars(recent)}
      <p class="trend-note">食べた時刻をもとに集計しています。</p>
    </section>
    <section class="trend-card">
      <div class="trend-card-head"><h3>曜日別 睡眠</h3><span>30日</span></div>
      ${renderWeekdayBars(recent, actualSleepValue, "h")}
    </section>
    <section class="trend-card">
      <div class="trend-card-head"><h3>曜日別 気分</h3><span>30日</span></div>
      ${renderWeekdayBars(recent, (entry) => Number(entry.mood), "")}
    </section>
    <section class="trend-card wide">
      <div class="trend-card-head"><h3>🙂 睡眠と気分</h3><span>別スケール</span></div>
      <div class="dual-chart">
        ${renderMiniLine(seven, (entry) => Number(entry.actualSleep ?? entry.sleep), "sleep-line")}
        ${renderMiniLine(seven, (entry) => Number(entry.mood), "mood-line")}
      </div>
      <div class="chart-legend"><span class="sleep-dot">睡眠</span><span class="mood-dot">気分</span></div>
      <p class="trend-note">睡眠時間と気分は別スケールで重ねています。</p>
    </section>
    <section class="trend-card insights-card">
      <div class="trend-card-head"><h3>運動・イベント</h3><span>関係メモ</span></div>
      <ul>
        <li>${escapeHtml(exerciseSleepInsight(recent))}</li>
        <li>${escapeHtml(eventSleepInsight(recent))}</li>
      </ul>
    </section>
    <section class="trend-card insights-card">
      <div class="trend-card-head"><h3>あなたのデータから</h3><span>断定しないメモ</span></div>
      <ul>${insightItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
  `;
}

function buildAiFindings() {
  const recent = entriesAscending(30);
  const seven = entriesAscending(7);
  if (recent.length < 3) {
    return [
      "3日以上記録すると、睡眠・中途覚醒・夜間の食事の傾向が表示されます。",
      "この画面では診断ではなく、あなたの記録上の変化だけを扱います。"
    ];
  }

  const findings = [];
  const sevenSleep = averageSleepFor(seven);
  const thirtySleep = averageSleepFor(recent);
  if (sevenSleep !== null && thirtySleep !== null && seven.length >= 3) {
    const diff = sevenSleep - thirtySleep;
    if (Math.abs(diff) >= 0.3) {
      findings.push(`最近7日間の実睡眠は平均${sevenSleep.toFixed(1)}hで、30日平均との差は${diff > 0 ? "+" : ""}${diff.toFixed(1)}hです。`);
    } else {
      findings.push(`最近7日間の実睡眠は30日平均に近い状態です。`);
    }
  }

  const topAwake = mostCommonAwakeHour(seven.length >= 3 ? seven : recent);
  const awakeCount = (seven.length >= 3 ? seven : recent).reduce((sum, entry) => sum + (entry.awakenings || []).length, 0);
  if (awakeCount) {
    findings.push(`記録上では、${topAwake}の中途覚醒が目立つようです。`);
  }

  const food = foodSummary(seven.length >= 3 ? seven : recent);
  if (food.count) {
    findings.push(`夜間の食事は${food.time}に記録されることが多いようです。過食した自己評価は${food.binge}回あります。`);
  }

  const rhythm = sleepRegularity(seven.length >= 3 ? seven : recent);
  if (rhythm.minutes !== null) {
    findings.push(rhythm.text);
  }

  findings.push(exerciseSleepInsight(recent));
  findings.push(eventSleepInsight(recent));
  findings.push("睡眠リズムの乱れは、双極症の変化と関連が報告されています。続く場合は、受診時に共有してもよい変化です。");
  return [...new Set(findings)].slice(0, 7);
}

function renderAiAnalysis() {
  if (!aiAnalysis) return;
  const findings = buildAiFindings();
  const recent = entriesAscending(30);
  const seven = entriesAscending(7);
  const avg7 = averageSleepFor(seven);
  const avg30 = averageSleepFor(recent);
  const food = foodSummary(seven.length >= 3 ? seven : recent);
  const awakeCount = (seven.length >= 3 ? seven : recent).reduce((sum, entry) => sum + (entry.awakenings || []).length, 0);
  aiAnalysis.innerHTML = `
    <section class="ai-hero-card">
      <span>あなたのデータ</span>
      <strong>${formatHours(avg7 ?? avg30)}</strong>
      <small>最近の平均実睡眠</small>
      <div class="ai-metrics">
        <p><b>${awakeCount}</b><span>中途覚醒</span></p>
        <p><b>${food.count}</b><span>夜間の食事</span></p>
        <p><b>${food.binge}</b><span>過食した</span></p>
      </div>
    </section>
    <section class="ai-finding-list">
      ${findings.map((finding) => `<article class="ai-finding"><span>記録から</span><p>${escapeHtml(finding)}</p></article>`).join("")}
    </section>
    <section class="ai-note">
      <b>表現について</b>
      <p>この画面は診断ではありません。「傾向があります」「記録上では」という形で、受診時に共有しやすい変化を整理します。</p>
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
  const rows = [["date", "mood", "bedtime", "wakeTime", "sleep", "actualSleep", "awakenings", "meds", "stress", "steps", "signs", "events", "doctorTags", "note"]];
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
      entry.steps || "",
      entry.signs.join("|"),
      (entry.events || []).join("|"),
      (entry.doctorTags || []).join("|"),
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

entryDate.addEventListener("change", () => {
  fillForm(entryFor(entryDate.value) || { date: entryDate.value });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const roundedBedtime = roundTimeValue(data.get("bedtime"));
  const roundedWakeTime = roundTimeValue(data.get("wakeTime"));
  const awakenings = syncAwakeningsFromDom();
  const signs = data.getAll("signs");
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
    events: normalizeTags(data.get("events")),
    steps: normalizeSteps(data.get("steps")),
    doctorTags: data.getAll("doctorTags"),
    note: data.get("note").trim()
  };
  entries = [...entries.filter((item) => item.date !== entry.date), entry];
  saveEntries();
  renderAll();
  showToast("保存しました");
});

document.querySelector("#clearToday").addEventListener("click", () => {
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

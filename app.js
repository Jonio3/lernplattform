(function(){
"use strict";
const MODS = window.MODULES || [];
const REG = {}; window.registerModule = (id, data) => { REG[id] = data; };
let D = null, IMG = {}, CUR = null, EXAM_DATE = null, KEY = null;
const THEME_KEY = "lernplattform_theme";
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const lzById = id => D.lz.find(l => l.id === id);
const fmt = n => (Math.round(n * 2) / 2).toString().replace(".", ",");
const TOUCH = !!(window.matchMedia && matchMedia("(pointer: coarse)").matches);
const POOLS = {nennen:"Nennen + Beispiel", paar:"Begriffspaar erklären", bestimmen:"Bestimmen", fall:"Fallbeispiel", stellung:"Stellungnahme"};
const qLabel = q => q.gtype === "stellung" ? (q.part === "b" ? "Empfehlung entwickeln" : "Beurteilen") : q.gtype === "fall" ? "Fallbeispiel" + (q.part ? ", Teil " + q.part : "") : POOLS[q.pool] || TYPES[q.t];
const TYPES = {mc:"Multiple Choice", order:"Reihenfolge", match:"Zuordnen", gap:"Lückentext", open:"Offene Frage", tf:"Richtig oder falsch", term:"Fachbegriffe"};

/* ---------- Speicher ---------- */
function load(){ try { const s = JSON.parse(localStorage.getItem(KEY) || "{}"); return Object.assign({q:{}, c:{}, w:{}, rev:{}}, s); } catch(e){ return {q:{}, c:{}, w:{}, rev:{}}; } }
let S = {q:{}, c:{}, w:{}, rev:{}};
let THEME = (() => { try { return localStorage.getItem(THEME_KEY) || "auto"; } catch(e){ return "auto"; } })();
const thc = l => "th-" + ((D.themes[l.theme] && D.themes[l.theme].c) || "ind");
const themeKeys = () => Object.keys(D.themes);
function activate(id){ D = REG[id]; CUR = id; IMG = D.img || {}; EXAM_DATE = new Date(D.meta.examDate + "T00:00:00"); KEY = D.meta.storageKey || ("lern_" + id); S = load(); document.title = D.meta.title + ": Lernplattform"; }
/* ---------- Passwortschutz: Inhalte liegen AES-verschlüsselt im Ordner, entschlüsselt wird nur im Browser ---------- */
const LOCK = window.LOCK || null; let CKEY = null, triedRestore = false;
const KEY_STORE = "lernplattform_key";
const b64dec = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const b64enc = buf => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
async function deriveKey(pw){
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2", salt:b64dec(LOCK.salt), iterations:LOCK.iter, hash:"SHA-256"}, base, {name:"AES-GCM", length:256}, true, ["decrypt"]); }
async function decryptStr(key, o){ return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM", iv:b64dec(o.iv)}, key, b64dec(o.data))); }
async function keyOk(key){ try { return (await decryptStr(key, LOCK.check)) === "lernplattform"; } catch(e){ return false; } }
async function restoreKey(){
  let raw = null; try { raw = localStorage.getItem(KEY_STORE) || sessionStorage.getItem(KEY_STORE); } catch(e){}
  if (raw){ try { const k = await crypto.subtle.importKey("raw", b64dec(raw), "AES-GCM", true, ["decrypt"]); if (await keyOk(k)){ CKEY = k; return true; } } catch(e){} }
  try { localStorage.removeItem(KEY_STORE); sessionStorage.removeItem(KEY_STORE); } catch(e){}
  return false; }
function logout(){ try { localStorage.removeItem(KEY_STORE); sessionStorage.removeItem(KEY_STORE); } catch(e){} location.hash = "#/"; location.reload(); }
function login(m){
  document.body.classList.add("locked"); document.title = "Lernplattform"; m.className = "";
  if (!window.crypto || !crypto.subtle){ m.innerHTML = `<div class="login"><div class="lg-card"><h1>Lernplattform</h1><p>Dieser Browser unterstützt die Entschlüsselung nicht. Bitte einen aktuellen Browser verwenden.</p></div></div>`; return; }
  m.innerHTML = `<div class="login"><form class="lg-card" autocomplete="on">
      <div class="lg-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="10.5" width="16" height="11" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg></div>
      <h1>Lernplattform</h1><p class="muted">Der Lernstoff ist geschützt. Gib das Passwort ein, das du von deiner Klasse bekommen hast.</p>
      <input type="text" name="username" value="Klasse" autocomplete="username" hidden>
      <label class="lg-l" for="lg-pw">Passwort</label>
      <input id="lg-pw" type="password" autocomplete="current-password" required autofocus>
      <label class="lg-rem"><input type="checkbox" checked data-rem> Auf diesem Gerät angemeldet bleiben</label>
      <button class="btn big" type="submit">Öffnen</button><p class="lg-err" role="alert"></p>${STATS ? `<p class="lg-note">Wir zählen anonym und ohne Cookies, wie oft die Seite genutzt wird. Antworten und Lernfortschritt bleiben nur auf deinem Gerät.</p>` : ""}</form></div>`;
  count("/login", "Passwort-Seite");
  const f = $("form", m), pw = $("#lg-pw", m), err = $(".lg-err", m), btn = $("button", f);
  f.addEventListener("submit", async e => { e.preventDefault(); if (!pw.value) return; btn.disabled = true; btn.textContent = "Wird geprüft …"; err.textContent = "";
    let ok = false, key = null; try { key = await deriveKey(pw.value); ok = await keyOk(key); } catch(_){}
    if (!ok){ btn.disabled = false; btn.textContent = "Öffnen"; err.textContent = "Das Passwort stimmt nicht."; f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake"); pw.select(); return; }
    CKEY = key; count("anmeldung", "Anmeldung", true); try { const raw = b64enc(await crypto.subtle.exportKey("raw", key)); ($("[data-rem]", f).checked ? localStorage : sessionStorage).setItem(KEY_STORE, raw); } catch(_){}
    document.body.classList.remove("locked"); route(true); });
}
/* ---------- Anonyme Nutzungsstatistik (GoatCounter: ohne Cookies, ohne Personendaten) ---------- */
const STATS = window.STATS || ""; let statsLast = "", statsQ = [], statsLoaded = false;
const statsOn = () => !!STATS && location.protocol === "https:" && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
function count(path, title, event){
  if (!statsOn()) return;
  if (!event){ if (path === statsLast) return; statsLast = path; }
  statsQ.push({path, title: title || path, event: !!event});
  if (!statsLoaded){ statsLoaded = true; window.goatcounter = {no_onload: true};
    const sc = document.createElement("script"); sc.async = true; sc.src = "https://gc.zgo.at/count.js"; sc.dataset.goatcounter = "https://" + STATS + ".goatcounter.com/count";
    sc.onload = flushStats; document.head.appendChild(sc); }
  else flushStats(); }
function flushStats(){ if (!window.goatcounter || !window.goatcounter.count) return; while (statsQ.length) { try { window.goatcounter.count(statsQ.shift()); } catch(e){} } }
const loadScript = src => new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = src; sc.onload = res; sc.onerror = () => rej(new Error("nicht gefunden")); document.head.appendChild(sc); });
async function loadModule(id){
  if (REG[id]) return;
  if (LOCK){ await loadScript("modules/" + id + "/content.enc.js"); const o = (window.ENC || {})[id]; if (!o) throw new Error("leer");
    new Function(await decryptStr(CKEY, o))(); }
  else await loadScript("modules/" + id + "/content.js");
  if (!REG[id]) throw new Error("leer"); }
const goHash = h => { location.hash = "#/" + CUR + "/" + h.replace(/^#?\/?/, ""); };
function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){} }
function rec(id, s){ const r = S.q[id] || {n:0}; r.n++; r.s = Math.max(0, Math.min(1, s)); r.t = Date.now(); S.q[id] = r; save(); }
function applyTheme(){ const t = THEME; if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t); }

function lzStats(id){
  const qs = D.questions.filter(q => q.lz === id);
  const done = qs.filter(q => S.q[q.id]);
  const avg = done.length ? done.reduce((a, q) => a + S.q[q.id].s, 0) / done.length : 0;
  let st = "offen";
  if (done.length) st = (done.length >= Math.ceil(qs.length * 0.6) && avg >= 0.8) ? "sicher" : "ueben";
  return {total: qs.length, done: done.length, avg, st};
}
const stLabel = {offen:"noch offen", ueben:"am Üben", sicher:"sicher"};

/* ---------- Textvergleich für Lücken ---------- */
function norm(s){ return String(s).toLowerCase().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/[^a-z0-9]/g,""); }
function lev(a, b){ const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let p = Array.from({length:n+1}, (_, j) => j);
  for (let i = 1; i <= m; i++){ const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j-1] + 1, p[j-1] + (a[i-1] === b[j-1] ? 0 : 1)); p = c; } return p[n]; }
function gapOk(input, answers){ const v = norm(input); if (!v) return false;
  return answers.some(a => { const t = norm(a); if (v === t) return true; if (/^\d+$/.test(t)) return false; const tol = t.length >= 10 ? 2 : t.length >= 6 ? 1 : 0; return lev(v, t) <= tol; }); }

/* ---------- Fragen ---------- */
function Q(q, opt){
  opt = opt || {};
  const ctl = {q, score:null, final:false, el:document.createElement("div")};
  ctl.el.className = "q q-" + q.t;
  const finish = s => { ctl.score = s; if (!ctl.final){ ctl.final = true; if (!opt.noRecord && q.id) rec(q.id, s); } opt.onScore && opt.onScore(s, ctl); };
  const head = `<div class="qh"><span class="qtype">${opt.num ? opt.num + ". " : ""}${qLabel(q)}${q.p ? " (" + q.p + " P.)" : ""}</span>${opt.lzTag && q.lz ? `<a class="qtype" href="#/lz/${q.lz}">Lernziel ${q.lz}</a>` : ""}</div>`;
  const fb = (s, why) => { const cls = s >= 0.999 ? "ok" : s > 0 ? "part" : "no"; const t = s >= 0.999 ? "Richtig." : s > 0 ? "Teilweise richtig." : "Nicht richtig.";
    return `<div class="fb ${cls}"><b>${t}</b>${why ? esc(why) : ""}</div>`; };
  const checkBtn = () => opt.exam ? "" : `<div class="actions"><button class="btn" data-check>Prüfen</button></div>`;

  if (q.t === "mc"){
    const order = shuffle(q.o.map((t, i) => ({t, i}))); const single = D.meta.mc === "single"; const nm = "mc" + Math.random().toString(36).slice(2);
    ctl.el.innerHTML = head + `<p class="qtext">${esc(q.q)}</p><p class="hint">${single ? "Genau eine Antwort ist richtig." : "Eine oder zwei Antworten sind richtig."}</p><div class="opts">${order.map((o, k) => `<label class="opt"><input type="${single ? "radio" : "checkbox"}" name="${nm}" value="${o.i}"><span class="lt">${"ABCD"[k]}</span><span>${esc(o.t)}</span></label>`).join("")}</div>` + checkBtn() + `<div class="out"></div>`;
    ctl.check = () => { if (ctl.final) return; const sel = $$("input", ctl.el).filter(i => i.checked).map(i => +i.value);
      const ok = sel.length === q.a.length && sel.every(v => q.a.includes(v));
      $$(".opt", ctl.el).forEach(l => { const v = +$("input", l).value, c = $("input", l).checked; $("input", l).disabled = true;
        if (q.a.includes(v)) l.classList.add(c ? "right" : "missed"); else if (c) l.classList.add("wrong"); });
      $(".out", ctl.el).innerHTML = fb(ok ? 1 : 0, (q.a.length > 1 && D.meta.mc !== "single" ? "Richtig sind zwei Antworten. " : "") + (q.why || ""));
      const b = $("[data-check]", ctl.el); if (b) b.remove(); finish(ok ? 1 : 0); };
  }
  else if (q.t === "order"){
    let cur = shuffle(q.items.map((t, i) => ({t, i}))); if (cur.every((c, k) => c.i === k)) cur.reverse();
    ctl.el.innerHTML = head + `<p class="qtext">${esc(q.q)}</p><p class="hint">${TOUCH ? "Verschiebe die Einträge mit den Pfeilen." : "Ziehe die Einträge oder nutze die Pfeile."}</p><ol class="olist"></ol>` + checkBtn() + `<div class="out"></div>`;
    const ol = $(".olist", ctl.el); let dragI = null;
    const draw = () => { ol.innerHTML = cur.map((c, k) => `<li draggable="true" data-k="${k}"><span class="pos">${k+1}</span><span class="tx">${esc(c.t)}</span><span class="mv"><button data-up="${k}" aria-label="nach oben">▲</button><button data-dn="${k}" aria-label="nach unten">▼</button></span></li>`).join("");
      $$("li", ol).forEach(li => { li.addEventListener("dragstart", e => { dragI = +li.dataset.k; li.classList.add("drag"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", "x"); } catch(_){} });
        li.addEventListener("dragend", () => li.classList.remove("drag"));
        li.addEventListener("dragover", e => { e.preventDefault(); li.classList.add("over"); });
        li.addEventListener("dragleave", () => li.classList.remove("over"));
        li.addEventListener("drop", e => { e.preventDefault(); const to = +li.dataset.k; if (dragI === null || dragI === to) return; const [m] = cur.splice(dragI, 1); cur.splice(to, 0, m); dragI = null; draw(); }); }); };
    ol.addEventListener("click", e => { if (ctl.final) return; const u = e.target.closest("[data-up]"), d = e.target.closest("[data-dn]");
      if (u){ const k = +u.dataset.up; if (k > 0){ [cur[k-1], cur[k]] = [cur[k], cur[k-1]]; draw(); } }
      if (d){ const k = +d.dataset.dn; if (k < cur.length - 1){ [cur[k+1], cur[k]] = [cur[k], cur[k+1]]; draw(); } } });
    draw();
    ctl.check = () => { if (ctl.final) return; const right = cur.filter((c, k) => c.i === k).length; const s = right / cur.length;
      ol.innerHTML = cur.map((c, k) => `<li class="${c.i === k ? "right" : "wrong"}"><span class="pos">${k+1}</span><span class="tx">${esc(c.t)}${c.i === k ? "" : `<br><span class="sol">gehört an Stelle ${c.i + 1}</span>`}</span></li>`).join("");
      $(".out", ctl.el).innerHTML = fb(s, `${right} von ${cur.length} an der richtigen Stelle. ` + (q.why || "")); const b = $("[data-check]", ctl.el); if (b) b.remove(); finish(s); };
  }
  else if (q.t === "match"){
    const rights = shuffle(q.pairs.map(p => p[1]));
    ctl.el.innerHTML = head + `<p class="qtext">${esc(q.q)}</p><div class="mtab">${q.pairs.map((p, k) => `<div class="l">${esc(p[0])}</div><div><select data-k="${k}"><option value="">Bitte wählen</option>${rights.map(r => `<option>${esc(r)}</option>`).join("")}</select></div>`).join("")}</div>` + checkBtn() + `<div class="out"></div>`;
    ctl.check = () => { if (ctl.final) return; let right = 0;
      $$("select", ctl.el).forEach(s => { const p = q.pairs[+s.dataset.k]; const ok = s.value === p[1]; if (ok) right++; s.classList.add(ok ? "right" : "wrong"); s.disabled = true;
        if (!ok) s.insertAdjacentHTML("afterend", `<div class="sol">Richtig: ${esc(p[1])}</div>`); });
      const s = right / q.pairs.length; $(".out", ctl.el).innerHTML = fb(s, `${right} von ${q.pairs.length} richtig zugeordnet.`); const b = $("[data-check]", ctl.el); if (b) b.remove(); finish(s); };
  }
  else if (q.t === "gap"){
    const ans = [], defs = []; let k = 0;
    const html = esc(q.text).replace(/\{\{(.+?)\}\}/g, (m, g) => { const [a, d] = g.split("::"); ans.push(a.split("|")); defs.push(d || ""); k++;
      return `<span class="gn">(${k})</span><input type="text" data-k="${k-1}" size="${Math.max(10, a.split("|")[0].length + 2)}" autocomplete="off" spellcheck="false" aria-label="Lücke ${k}">`; });
    ctl.el.innerHTML = head + `<p class="qtext">${esc(q.q)}</p><p class="hint">Ohne Wörtersammlung, wie an der Prüfung. Gesucht sind Fachbegriffe aus den Lernzielen. Grammatische Formen und kleine Tippfehler werden akzeptiert.</p><div class="gaptext">${html}</div>` + checkBtn() + `<div class="out"></div>`;
    ctl.check = () => { if (ctl.final) return; let right = 0; const res = [];
      $$("input", ctl.el).forEach(i => { const n = +i.dataset.k, a = ans[n]; const ok = gapOk(i.value, a); if (ok) right++; res.push({n, ok, v:i.value.trim()}); i.classList.add(ok ? "right" : "wrong"); i.disabled = true;
        if (!ok) i.insertAdjacentHTML("afterend", `<span class="solw">${esc(a[0])}</span>`); });
      const s = right / ans.length;
      $(".out", ctl.el).innerHTML = fb(s, `${right} von ${ans.length} Lücken richtig.`) + `<ol class="gapdefs">${res.map(r => `<li class="${r.ok ? "ok" : "no"}"><b>${esc(ans[r.n][0])}</b>${defs[r.n] ? ": " + esc(defs[r.n]) : ""}${!r.ok && r.v ? `<span class="muted"> (deine Antwort: ${esc(r.v)})</span>` : ""}</li>`).join("")}</ol>`;
      const b = $("[data-check]", ctl.el); if (b) b.remove(); finish(s); };
  }
  else if (q.t === "tf"){
    ctl.el.innerHTML = head + `<p class="qtext">${esc(q.q)}</p><p class="hint">${D.meta.tfPenalty === false ? "½ Punkt pro richtiger Antwort." : "+½ Punkt pro richtigem Kreuz, −½ pro falschem, nicht unter 0. Lass leer, was du nicht weisst."}</p>
      <div class="tf">${q.items.map((it, i) => `<div class="tfrow" data-i="${i}"><span class="tfs">${String.fromCharCode(97 + i)}. ${esc(it.s)}</span><span class="tfb"><button type="button" data-v="r" aria-label="richtig">R</button><button type="button" data-v="f" aria-label="falsch">F</button></span></div>`).join("")}</div>` + checkBtn() + `<div class="out"></div>`;
    const sel = {};
    $$(".tfrow", ctl.el).forEach(row => $$("button", row).forEach(b => b.addEventListener("click", () => { if (ctl.final) return; const i = +row.dataset.i; sel[i] = sel[i] === b.dataset.v ? undefined : b.dataset.v; $$("button", row).forEach(x => x.classList.toggle("on", sel[i] === x.dataset.v)); })));
    ctl.check = () => { if (ctl.final) return; let p = 0; const max = q.items.length * 0.5;
      q.items.forEach((it, i) => { const row = $(`.tfrow[data-i="${i}"]`, ctl.el); const v = sel[i]; const right = it.r ? "r" : "f";
        if (v) p += v === right ? 0.5 : (D.meta.tfPenalty === false ? 0 : -0.5); row.classList.add(!v ? "skip" : v === right ? "right" : "wrong");
        row.insertAdjacentHTML("beforeend", `<div class="tfsol">${it.r ? "Richtig" : "Falsch"}${it.why ? ": " + esc(it.why) : ""}</div>`); });
      p = Math.max(0, p); const s = p / max; $(".out", ctl.el).innerHTML = fb(s, `${fmt(p)} von ${fmt(max)} Punkten.`); const b = $("[data-check]", ctl.el); if (b) b.remove(); finish(s); };
  }
  else if (q.t === "term"){
    ctl.el.innerHTML = head + `<p class="qtext">${esc(q.q)}</p><div class="terms-q">${q.items.map((it, i) => `<label class="trow"><span>${esc(it.d)}</span><input type="text" data-i="${i}" autocomplete="off" spellcheck="false"></label>`).join("")}</div>` + checkBtn() + `<div class="out"></div>`;
    ctl.check = () => { if (ctl.final) return; let right = 0;
      $$("input", ctl.el).forEach(inp => { const it = q.items[+inp.dataset.i]; const ok = gapOk(inp.value, it.a); if (ok) right++; inp.classList.add(ok ? "right" : "wrong"); inp.disabled = true;
        if (!ok) inp.insertAdjacentHTML("afterend", `<span class="solw">${esc(it.a[0])}</span>`); });
      const s = right / q.items.length; $(".out", ctl.el).innerHTML = fb(s, `${right} von ${q.items.length} Fachbegriffen richtig.`); const b = $("[data-check]", ctl.el); if (b) b.remove(); finish(s); };
  }
  else if (q.t === "open"){
    ctl.el.innerHTML = head + (q.case && !opt.noCase ? `<div class="case"><span class="lbl">${q.gtype === "stellung" ? "Aussage" : "Fallbeispiel"}</span>${esc(q.case)}</div>` : "") + `<p class="qtext">${esc(q.q)}</p><textarea placeholder="Schreibe deine Antwort hier, in ganzen Sätzen und mit Begründung."></textarea>` +
      (opt.exam ? "" : `<div class="actions"><button class="btn" data-reveal disabled>Musterlösung zeigen</button><button class="link" data-skip>Ich weiss es nicht, Lösung zeigen</button></div>`) + `<div class="out"></div>`;
    const ta = $("textarea", ctl.el), rb = $("[data-reveal]", ctl.el);
    if (rb) ta.addEventListener("input", () => { rb.disabled = ta.value.trim().length < 15; });
    const reveal = (skipped) => { if (ctl.revealed) return; ctl.revealed = true; ta.readOnly = true; const a = $(".actions", ctl.el); if (a) a.remove();
      const out = $(".out", ctl.el);
      out.innerHTML = `<div class="model"><b>Musterlösung</b>${esc(q.model)}</div>${q.pit ? `<div class="pit"><b>Achtung:</b> ${esc(q.pit)}</div>` : ""}
        <p class="small"><b>Vergleiche deine Antwort und hake ab, was du wirklich drin hast.</b> Die Formulierung darf anders sein, der Inhalt muss stimmen.</p>
        <ul class="checks">${q.checks.map((c, i) => `<li><label><input type="checkbox" data-c="${i}" ${skipped ? "disabled" : ""}><span>${esc(c)}</span></label></li>`).join("")}</ul>
        ${D.meta.fullSentences ? `<label class="fsgate"><input type="checkbox" data-fs ${skipped ? "disabled" : ""}><span><b>Ich habe in ganzen, korrekten Sätzen geantwortet.</b> Ohne Haken zählt die Antwort 0 Punkte, wie an der Prüfung bei Stichworten.</span></label>` : ""}
        <div class="actions"><span class="pts">0 von ${q.p} Punkten</span>${opt.exam ? "" : `<button class="btn" data-save>Bewertung speichern</button>`}</div>`;
      const upd = () => { const n = $$("[data-c]", out).filter(c => c.checked).length; const fs = $("[data-fs]", out); const s = (fs && !fs.checked) ? 0 : n / q.checks.length; ctl.score = s; $(".pts", out).textContent = `${fmt(s * q.p)} von ${q.p} Punkten`; opt.onChange && opt.onChange(); };
      $$("[data-c], [data-fs]", out).forEach(c => c.addEventListener("change", upd)); upd();
      const sb = $("[data-save]", out); if (sb) sb.addEventListener("click", () => { $$("[data-c], [data-fs]", out).forEach(c => c.disabled = true); sb.remove(); finish(ctl.score); });
      if (skipped){ const sb2 = $("[data-save]", out); if (sb2) sb2.remove(); finish(0); } };
    ctl.check = () => reveal(false);
    ctl.finalize = () => { if (!ctl.final){ $$("[data-c], [data-fs]", ctl.el).forEach(c => c.disabled = true); finish(ctl.score || 0); } };
    if (rb){ rb.addEventListener("click", () => reveal(false)); $("[data-skip]", ctl.el).addEventListener("click", () => reveal(true)); }
  }
  const cb = $("[data-check]", ctl.el); if (cb) cb.addEventListener("click", () => ctl.check());
  return ctl;
}

/* ---------- Karteikarten ---------- */
const IV = [0, 10*60e3, 864e5, 2*864e5, 3*864e5, 5*864e5];
const cst = id => S.c[id] || {b:0, d:0};
const isDue = id => !S.c[id] || S.c[id].d <= Date.now();
function rateCard(id, r){ const c = Object.assign({}, cst(id)); if (r === 3) c.b = Math.min(5, c.b + 1); else if (r === 1) c.b = 0;
  c.d = Date.now() + (r === 1 ? 60e3 : r === 2 ? 10*60e3 : IV[c.b]); c.r = r; S.c[id] = c; save(); }
const lastR = id => { const c = S.c[id]; if (!c) return 0; return c.r || (c.b > 0 ? 3 : 1); };
function cardEl(card, onDone){
  const el = document.createElement("div"); const lz = lzById(card.lz);
  el.innerHTML = `<div class="flash"><div class="inner" title="Klicken zum Umdrehen"><div class="face front"><small>Lernziel ${card.lz}: ${esc(lz.short)}</small>${esc(card.f)}</div><div class="face back"><small>Antwort</small>${esc(card.b)}</div></div></div>
    <div class="actions"><button class="btn sec" data-flip>Umdrehen</button><span class="small muted">Du kannst die Karte beliebig oft hin- und herdrehen.</span></div><div class="rate" hidden><button class="btn sec b1" data-r="1">Wusste ich nicht</button><button class="btn sec b2" data-r="2">Unsicher</button><button class="btn sec b3" data-r="3">Wusste ich</button></div>`;
  const f = $(".flash", el), fb = $("[data-flip]", el);
  const flip = () => { f.classList.toggle("flip"); const back = f.classList.contains("flip"); fb.textContent = back ? "Frage zeigen" : "Antwort zeigen"; if (back) $(".rate", el).hidden = false; };
  $(".inner", el).addEventListener("click", flip); fb.addEventListener("click", flip); fb.textContent = "Antwort zeigen";
  $$("[data-r]", el).forEach(b => b.addEventListener("click", () => { rateCard(card.id, +b.dataset.r); onDone && onDone(+b.dataset.r); }));
  return el;
}

/* ---------- Navigation ---------- */
function nav(active){
  const side = $(".side");
  const lzLink = l => { const st = lzStats(l.id).st; return `<a href="#/lz/${l.id}" class="${active === "lz" + l.id ? "active" : ""}"><span class="n">${l.id}</span><span style="flex:1">${esc(l.short)}</span><span class="dot ${st}" title="${stLabel[st]}"></span></a>`; };
  const it = (h, k, t, ico) => `<a href="#/${h}" class="${active === k ? "active" : ""}"><i class="ico ${ico}"></i>${t}</a>`;
  side.innerHTML = `<a class="backmods" href="#/" data-abs>${ICO.grid}<span>Alle Lernmodule</span></a><div class="brand">${esc(D.meta.title)}<small>${esc(D.meta.examLabel)}</small></div>
  <nav class="nav">
    ${it("start", "start", "Start", "i-ink")}
    ${it("theorie", "theorie", "Gesamte Theorie", "i-learn")}
    ${it("heute", "heute", "Schnellcheck", "i-train")}
    ${it("mindmap", "mindmap", "Mindmaps", "i-src")}
    ${themeKeys().map(k => `<div class="grp th-${D.themes[k].c}">${esc(D.themes[k].nav || D.themes[k].name)}</div><div class="sub th-${D.themes[k].c}">${D.lz.filter(l => l.theme === k).map(lzLink).join("")}</div>`).join("")}
    <div class="grp g-train">Trainieren</div>
    ${it("mix", "mix", "Eigene Übung", "i-train")}
    ${it("pruefen", "pruefen", "Kapitel trainieren", "i-train")}
    ${D.sources.length ? it("quellen", "quellen", "Quellenwerkstatt", "i-train") : ""}
    ${it("karten", "karten", "Karteikarten", "i-train")}
    ${it("probe", "probe", "Probeprüfung", "i-train")}
    <div class="grp">Verwalten</div>
    ${it("sichern", "sichern", "Fortschritt sichern", "i-off")}
    ${it("loesungen", "loesungen", "Alle Lösungen (Gegenlesen)", "i-off")}
  </nav>
  <div class="foot">${esc(D.meta.srcLabel || "")}<br><button class="themebtn" data-themebtn>Darstellung: ${{auto:"automatisch", light:"hell", dark:"dunkel"}[THEME]}</button>${LOCK ? `<button class="themebtn" data-logout>Abmelden</button>` : ""}</div>`;
  $("[data-themebtn]", side).addEventListener("click", () => { THEME = {auto:"light", light:"dark", dark:"auto"}[THEME]; try { localStorage.setItem(THEME_KEY, THEME); } catch(e){} applyTheme(); nav(active); });
  chrome(active);
}
/* ---------- Handy: Leiste oben, ausklappbares Menü, Navigationsleiste unten ---------- */
const ICO = {
  start:'<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  theorie:'<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
  mix:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16.5 9.5"/></svg>',
  karten:'<svg viewBox="0 0 24 24"><rect x="7" y="3" width="13" height="15" rx="2"/><path d="M4 7v12a2 2 0 0 0 2 2h10"/></svg>',
  grid:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>',
  mindmap:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="4.5" cy="5" r="2"/><circle cx="19.5" cy="5" r="2"/><circle cx="4.5" cy="19" r="2"/><circle cx="19.5" cy="19" r="2"/><path d="M9.8 9.8 6 6.4M14.2 9.8 18 6.4M9.8 14.2 6 17.6M14.2 14.2 18 17.6"/></svg>'
};
const menu = open => { document.body.classList.toggle("menu-open", !!open); const b = $(".mb-menu"); if (b) b.setAttribute("aria-expanded", !!open); };
function chrome(active){
  let bar = $(".mbar"), bn = $(".mnav"), bd = $(".mback");
  if (!bar){ bar = document.createElement("header"); bar.className = "mbar"; document.body.prepend(bar); }
  if (!bn){ bn = document.createElement("nav"); bn.className = "mnav"; bn.setAttribute("aria-label", "Schnellnavigation"); document.body.appendChild(bn); }
  if (!bd){ bd = document.createElement("div"); bd.className = "mback"; document.body.appendChild(bd); bd.addEventListener("click", () => menu(false)); }
  const inMod = !!CUR && !!D;
  let pill = "";
  if (inMod){ const d = daysLeft(); pill = d > 1 ? `noch ${d} Tage` : d === 1 ? "morgen Prüfung" : d === 0 ? "heute Prüfung" : ""; }
  bar.innerHTML = `<button type="button" class="mb-menu" aria-label="Menü" aria-expanded="false"><span></span><span></span><span></span></button>
    <div class="mb-t">${inMod ? `${esc(D.meta.title)}<small>${esc(D.meta.examLabel)}</small>` : "Lernplattform"}</div>${pill ? `<span class="mb-pill">${pill}</span>` : ""}${inMod ? `<a class="mb-home" href="#/" data-abs aria-label="Alle Lernmodule">${ICO.grid}<span>Module</span></a>` : ""}`;
  $(".mb-menu", bar).addEventListener("click", () => menu(!document.body.classList.contains("menu-open")));
  bn.hidden = !inMod;
  const grp = {heute:"mix", pruefen:"mix", probe:"mix", mix:"mix"}, on = grp[active] || active;
  if (inMod) bn.innerHTML = [["start", "Start"], ["theorie", "Theorie"], ["mix", "Üben"], ["karten", "Karten"], ["mindmap", "Mindmaps"]]
    .map(([h, t]) => `<a href="#/${h}" class="${on === h ? "on" : ""}" ${on === h ? 'aria-current="page"' : ""}>${ICO[h]}<span>${t}</span></a>`).join("");
}
document.addEventListener("keydown", e => { if (e.key === "Escape") menu(false); });
document.addEventListener("click", e => { if (e.target.closest(".side a")) menu(false); });
document.addEventListener("click", e => { if (e.target.closest("[data-logout]")) logout(); });
function daysLeft(){ const t = new Date(); t.setHours(0,0,0,0); return Math.round((EXAM_DATE - t) / 864e5); }
function fillImgs(root){ $$("img[data-img]", root).forEach(i => { const m = IMG[i.dataset.img]; if (m) i.src = m.src; }); }

/* ---------- Fortschritt ---------- */
function allQids(){ const ids = D.questions.map(q => q.id); D.sources.forEach(s => { if (s.a) ids.push(s.a.id); s.qs.forEach(q => ids.push(q.id)); }); return ids; }
function progress(){ const ids = allQids(); const r = {sicher:0, teil:0, nicht:0, offen:0, total:ids.length};
  ids.forEach(id => { const x = S.q[id]; if (!x) r.offen++; else if (x.s >= 0.8) r.sicher++; else if (x.s > 0) r.teil++; else r.nicht++; }); return r; }
function lzPct(id){ const qs = D.questions.filter(q => q.lz === id); if (!qs.length) return 0; return Math.round(qs.filter(q => S.q[q.id] && S.q[q.id].s >= 0.8).length / qs.length * 100); }
function lzBreak(ids){ const r = {sicher:0, teil:0, nicht:0, offen:0, total:0}; D.questions.filter(q => ids.includes(q.lz)).forEach(q => { const x = S.q[q.id]; r.total++; if (!x) r.offen++; else if (x.s >= 0.8) r.sicher++; else if (x.s > 0) r.teil++; else r.nicht++; }); return r; }
const pctOf = (n, t) => t ? Math.round(n / t * 100) : 0;
/* Fortschrittskarte für ein Kapitel: Ring für das Kapitel, Balken pro Lernziel */
function chapterCard(th, i){
  const T = D.themes[th], ids = T.lz, b = lzBreak(ids), pc = pctOf(b.sicher, b.total), pt = pctOf(b.sicher + b.teil, b.total);
  const lzSafe = ids.filter(id => lzStats(id).st === "sicher").length, done = b.total - b.offen;
  const row = id => { const l = lzById(id), r = lzBreak([id]), st = lzStats(id).st, p = pctOf(r.sicher, r.total);
    return `<a class="lzrow ${st}" href="#/lz/${id}" title="Lernziel ${id}: ${p} % sicher"><span class="lzr-n">${id}</span><span class="lzr-t">${esc(l.short)}</span>
      <span class="lzr-bar"><i class="ok" style="width:${pctOf(r.sicher, r.total)}%"></i><i class="warn" style="width:${pctOf(r.teil, r.total)}%"></i><i class="bad" style="width:${pctOf(r.nicht, r.total)}%"></i></span><span class="lzr-p">${p} %</span></a>`; };
  return `<section class="chap th-${T.c}" style="--i:${i}">
    <div class="chap-h"><div class="gauge" role="img" aria-label="${pc} Prozent sicher"><svg viewBox="0 0 120 120"><defs><linearGradient id="gg${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--ok)"/><stop offset="1" stop-color="var(--th)"/></linearGradient></defs>
        <circle class="g-bg" cx="60" cy="60" r="50"/><circle class="g-teil" cx="60" cy="60" r="50" pathLength="100" style="stroke-dashoffset:${100 - pt}"/><circle class="g-ok" cx="60" cy="60" r="50" pathLength="100" stroke="url(#gg${i})" style="stroke-dashoffset:${100 - pc}"/></svg>
        <div class="g-c"><b>${pc}<small>%</small></b><span>sicher</span></div></div>
      <div class="chap-t"><h3>${esc(T.name)}</h3><p><b>${lzSafe}</b> von ${ids.length} Lernzielen sicher · ${done} von ${b.total} Fragen bearbeitet</p>
        <div class="chap-btns"><a class="btn small train" href="#/mix/${th}">Dieses Kapitel üben</a><a class="btn small sec" href="#/mindmap/${th}">In der Mindmap</a></div></div></div>
    <div class="chap-lz">${ids.map(row).join("")}</div></section>`;
}
/* Beispielbegriffe für die Suche: aus der Mindmap oder den Karteikarten des Moduls */
function searchExamples(){
  if (D.meta.searchHint) return D.meta.searchHint;
  const text = D.lz.map(l => l.kurz + " " + l.kern).join(" ").toLowerCase();
  let pool = D.mindmap && D.mindmap.concepts ? [].concat(...Object.values(D.mindmap.concepts)) : D.cards.map(c => c.f);
  pool = pool.filter(t => t.length >= 4 && t.length <= 22 && !/[:?]/.test(t) && text.includes(t.toLowerCase()));
  return pool.length ? "z. B. " + shuffle(pool).slice(0, 3).join(", ") : "Begriff eingeben";
}
function exportProgress(){ const b = new Blob([JSON.stringify(S)], {type:"application/json"}); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = CUR + "-fortschritt.json"; document.body.appendChild(a); a.click(); a.remove(); S.lastExport = Date.now(); save(); }
function importProgress(file, done){ const r = new FileReader(); r.onload = () => { try { const o = JSON.parse(r.result); if (!o || !o.q || !o.c) throw 0;
    Object.keys(o.q).forEach(k => { if (!S.q[k] || (o.q[k].t || 0) > (S.q[k].t || 0)) S.q[k] = o.q[k]; });
    Object.keys(o.c).forEach(k => { if (!S.c[k] || (o.c[k].d || 0) > (S.c[k].d || 0)) S.c[k] = o.c[k]; });
    S.rev = S.rev || {}; Object.keys(o.rev || {}).forEach(k => { if (!S.rev[k]) S.rev[k] = o.rev[k]; });
    if (o.probe && (!S.probe || (o.probe.best || 0) > (S.probe.best || 0))) S.probe = Object.assign({}, S.probe, {best:o.probe.best});
    save(); done(true); } catch(_){ done(false); } }; r.readAsText(file); }

/* ---------- Seiten ---------- */
const P = {};
P.start = (m) => {
  const d = daysLeft(); const dt = d > 1 ? `Noch ${d} Tage bis zur Prüfung` : d === 1 ? "Morgen ist Prüfung" : d === 0 ? "Heute ist Prüfung" : "Prüfung vorbei";
  const line = (th, i) => chapterCard(th, i);
  const pr = progress(), pc = k => Math.round(pr[k] / pr.total * 100);
  const cards = {g:0, u:0, n:0, neu:0}; D.cards.forEach(c => { const r = lastR(c.id); if (!r) cards.neu++; else if (r === 3) cards.g++; else if (r === 2) cards.u++; else cards.n++; });
  const srcDone = D.sources.filter(s => (s.a && S.q[s.a.id]) || s.qs.some(q => S.q[q.id])).length;
  const exp = S.lastExport ? `Zuletzt gesichert: ${new Date(S.lastExport).toLocaleString("de-CH", {day:"numeric", month:"numeric", hour:"2-digit", minute:"2-digit"})}` : "Noch nie gesichert";
  const tm = MODS.find(x => x.id === CUR) || {};
  m.innerHTML = `<section class="hero"><p class="count"><span class="pill">${dt}</span>${tm.test ? ` <span class="testflag">In Testphase</span>` : ""}</p><h1>${esc(D.meta.heroTitle)}</h1></section>
    ${tm.test ? `<div class="testnote"><b>Dieses Modul ist noch in der Testphase.</b> ${esc(tm.test)}</div>` : ""}
    <section class="stand"><div class="stand-h"><div><p class="muted small" style="margin:0">Dein Lernstand</p><p class="bigpct"><b>${pc("sicher")} %</b> sicher</p></div><p class="small muted" style="max-width:40ch;margin:0">Gezählt werden alle ${pr.total} Fragen, jeweils dein letzter Versuch. «Sicher» heisst mindestens 80 % richtig.</p></div>
      <div class="pbar">${[["sicher","ok"],["teil","warn"],["nicht","bad"],["offen","off"]].map(([k, c]) => pr[k] ? `<i class="pb-${c}" style="flex:${pr[k]}" title="${pc(k)} %"></i>` : "").join("")}</div>
      <div class="plegend"><span><i class="pb-ok"></i>sicher ${pc("sicher")} %</span><span><i class="pb-warn"></i>teilweise ${pc("teil")} %</span><span><i class="pb-bad"></i>nicht gekonnt ${pc("nicht")} %</span><span><i class="pb-off"></i>noch nicht bearbeitet ${pc("offen")} %</span></div>
      <div class="kpis"><a href="#/karten"><b>${cards.g}</b> von ${D.cards.length} Karteikarten gewusst<span>${cards.u} unsicher, ${cards.n} nicht gewusst, ${cards.neu} neu</span></a>
        ${D.sources.length ? `<a href="#/quellen"><b>${srcDone}</b> von ${D.sources.length} Quellen bearbeitet<span>Quellenwerkstatt</span></a>` : `<a href="#/mindmap"><b>${(D.maps || []).length}</b> Mindmaps<span>Schwierige Themen einfach erklärt</span></a>`}
        <a href="#/probe"><b>${S.probe ? fmt(S.probe.best) : "–"}</b> ${S.probe && S.probe.tot ? "von " + fmt(S.probe.tot) + " Punkten" : "Punkte"}<span>${S.probe ? `bestes Ergebnis in ${S.probe.n} Probeprüfung${S.probe.n > 1 ? "en" : ""}` : "noch keine Probeprüfung"}</span></a></div>
      <div class="savebox"><div class="save-steps">
          <div class="sv"><span class="svn">1</span><div><b>Nach dem Lernen:</b> «Fortschritt sichern» klicken, Datei aufbewahren.</div></div>
          <div class="sv"><span class="svn">2</span><div><b>Fortschritt weg?</b> «Datei laden», gesicherte Datei wählen.</div><span class="arrow" aria-hidden="true">➜</span></div></div>
        <div class="save-btns"><button class="btn save" data-exp>Fortschritt sichern</button><label class="btn sec load">Datei laden<input type="file" accept=".json,application/json" hidden data-imp></label><span class="small muted" data-msg>${exp}</span></div></div></section>
    <div class="cta">
      <a class="c-train big" href="#/heute"><span class="tag2">Schnellcheck</span><b>12 Aufgaben, ca. 15 Minuten</b><span>Gemischt aus allen Lernzielen, Schwaches zuerst.</span><em>Jetzt starten</em></a>
      <a class="c-learn big" href="#/theorie"><span class="tag2">Gesamte Theorie</span><b>Hier kannst du alles nachlesen</b><span>Alle ${D.lz.length} Lernziele auf einer Seite, mit Suchfunktion.</span><em>Theorie öffnen</em></a>
      ${D.sources.length ? `<a class="c-src" href="#/quellen"><span class="tag2">Quellenwerkstatt</span><b>Bild- und Textquellen</b><span>Fast die Hälfte der Prüfungspunkte.</span><em>Quellen üben</em></a>` : `<a class="c-src" href="#/karten"><span class="tag2">Karteikarten</span><b>Begriffe festigen</b><span>Was du nicht weisst, kommt bald wieder.</span><em>Karten lernen</em></a>`}
      <a class="c-ink" href="#/probe"><span class="tag2">Probeprüfung</span><b>Prüfung simulieren</b><span>Wie echt, mit Zeitlimit nach Wahl.</span><em>Prüfung simulieren</em></a></div>
    <a class="mixbanner" href="#/mix"><span class="mb-ico" aria-hidden="true"><i></i><i></i><i></i></span><span class="mb-t"><b>Eigene Übung zusammenstellen</b><span>Themen wählen, Zeit festlegen, die passenden Aufgaben kommen automatisch.</span></span><em>Zusammenstellen</em></a>
    <a class="mixbanner mm-b" href="#/mindmap"><span class="mb-ico" aria-hidden="true"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="6"/><circle cx="6" cy="8" r="4"/><circle cx="34" cy="9" r="4"/><circle cx="7" cy="32" r="4"/><circle cx="33" cy="31" r="4"/><path d="M15 16 9 11M25 16 31 12M15 24 10 29M25 24 30 28"/></svg></span><span class="mb-t"><b>Mindmaps: Schwieriges einfach erklärt</b><span>Kleine Mindmaps zeigen, was wozu führt und wie die Themen zusammenhängen.</span></span><em>Mindmaps öffnen</em></a>
    <h2 class="chap-title">Dein Fortschritt pro Kapitel</h2>
    <p class="small muted">Der Ring zeigt, wie viele Fragen eines Kapitels du sicher kannst. Die Balken zeigen jedes Lernziel: grün sicher, gelb teilweise, rot nicht gekonnt.</p>
    <div class="chaps">${themeKeys().map(line).join("")}</div>
    <h2>So lernst du mit dieser Seite</h2>
    <ol class="steps-how"><li class="s-learn"><b>Verstehen:</b> Öffne ein Lernziel, lies «Kurz erklärt» und überfliege das Kernwissen. Die ganze Theorie auf einer Seite findest du unter «Gesamte Theorie».</li>
    <li class="s-try"><b>Ausprobieren:</b> Mach die Übungen auf den Lernzielseiten, wo es welche gibt.</li>
    <li class="s-train"><b>Trainieren:</b> «Kapitel trainieren» ohne nachzuschauen. Täglich den Schnellcheck und die Karteikarten. Zwei Tage vor der Prüfung einmal die Probeprüfung.</li></ol>`;
  const msg = $("[data-msg]", m);
  $("[data-exp]", m).addEventListener("click", () => { exportProgress(); msg.textContent = `Gesichert. Die Datei «${CUR}-fortschritt.json» liegt in deinem Download-Ordner.`; });
  $("[data-imp]", m).addEventListener("change", e => { const f = e.target.files[0]; if (!f) return; importProgress(f, ok => { if (ok){ route(true); setTimeout(() => { const x = $("[data-msg]"); if (x) x.textContent = "Fortschritt geladen."; }, 50); } else msg.textContent = "Diese Datei passt nicht. Wähle die gesicherte Fortschrittsdatei."; }); });
};

P.theorie = (m) => {
  const sec = l => `<section class="tsec ${thc(l)}" id="t${l.id}"><div class="tsec-h"><span class="badge">${l.id}</span><h2>${esc(l.title)}</h2><a class="btn train small" href="#/ueben/${l.id}">Trainieren</a></div>
    <div class="ziel">${esc(l.ziel)}</div><div class="kurz"><span class="lbl">Kurz erklärt</span>${esc(l.kurz)}</div>
    <details class="more" open><summary><span>Kernwissen aus dem Skript</span><span class="tg"></span></summary><div class="kern">${l.kern}</div></details></section>`;
  m.innerHTML = `<div class="theohero"><h1>Gesamte Theorie</h1><p class="lead">Hier kannst du alles nachlesen: alle ${D.lz.length} Lernziele mit Kurzfassung und vollständigem Kernwissen aus den Unterlagen. Suche einen Begriff oder springe direkt zu einem Lernziel.</p></div>
    <div class="tsearch"><input type="search" placeholder="Begriff suchen, ${esc(searchExamples())}" aria-label="Begriff suchen"><span class="small muted" data-hits></span></div>
    <div class="toc">${themeKeys().map(th => `<div class="toc-col th-${D.themes[th].c}"><b>${esc(D.themes[th].name)}</b>${D.lz.filter(l => l.theme === th).map(l => `<a href="#t${l.id}" data-jump><span class="badge sm">${l.id}</span>${esc(l.short)}</a>`).join("")}</div>`).join("")}</div>
    ${themeKeys().map(k => `<h2 class="thead th-${D.themes[k].c}">${esc(D.themes[k].name)}</h2>${D.lz.filter(l => l.theme === k).map(sec).join("")}`).join("")}
    ${D.notTaken ? `<h2>Nicht prüfungsrelevant</h2><p class="muted small">Diese Teile der Unterlagen gehören zu keinem Lernziel und sind deshalb nicht aufbereitet.</p><table class="tbl">${D.notTaken.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("")}</table>` : ""}`;
  fillImgs(m);
  $$("[data-jump]", m).forEach(a => a.addEventListener("click", e => { e.preventDefault(); const t = document.getElementById(a.getAttribute("href").slice(1)); if (t) t.scrollIntoView({behavior:"smooth"}); }));
  const inp = $(".tsearch input", m), hits = $("[data-hits]", m);
  const unmark = () => { $$("mark.hl", m).forEach(k => { const p = k.parentNode; k.replaceWith(document.createTextNode(k.textContent)); p.normalize(); }); };
  const markIn = (root, q) => { let n = 0; const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"); const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const ts = []; while (w.nextNode()) ts.push(w.currentNode);
    ts.forEach(t => { const v = t.nodeValue; if (!re.test(v)) return; re.lastIndex = 0; const f = document.createDocumentFragment(); let last = 0, mm;
      while ((mm = re.exec(v))){ f.appendChild(document.createTextNode(v.slice(last, mm.index))); const k = document.createElement("mark"); k.className = "hl"; k.textContent = mm[0]; f.appendChild(k); last = mm.index + mm[0].length; n++; }
      f.appendChild(document.createTextNode(v.slice(last))); t.replaceWith(f); }); return n; };
  inp.addEventListener("input", () => { unmark(); const q = inp.value.trim(); let total = 0, secs = 0;
    $$(".tsec", m).forEach(se => { if (q.length < 3){ se.hidden = false; return; } const n = markIn(se, q); se.hidden = !n; if (n){ total += n; secs++; $("details", se).open = true; } });
    $$(".thead", m).forEach(h => { let x = h.nextElementSibling, any = false; while (x && x.classList.contains("tsec")){ if (!x.hidden) any = true; x = x.nextElementSibling; } h.hidden = q.length >= 3 && !any; });
    hits.textContent = q.length < 3 ? "" : total ? `${total} Treffer in ${secs} Lernzielen` : "Keine Treffer"; const first = $("mark.hl", m); if (first) first.scrollIntoView({block:"center"}); });
};

P.lz = (m, id) => {
  id = +id; const l = lzById(id); if (!l) return P.start(m);
  const st = lzStats(id); const qs = D.questions.filter(q => q.lz === id); const cards = D.cards.filter(c => c.lz === id);
  m.className = thc(l);
  m.innerHTML = `<div class="crumb"><a href="#/start">Start</a> / ${esc(D.themes[l.theme].name)}</div>
    <div class="lzhero"><span class="badge xl">${id}</span><div><h1>${esc(l.title)}</h1><div class="ziel">${esc(l.ziel)}</div>
      <div class="row"><a class="btn train" href="#/ueben/${id}">Lernziel trainieren: ${qs.length} Fragen</a>${cards.length ? `<a class="btn try-b" href="#/karten/${id}-alle">${cards.length} Karteikarten</a>` : ""}<a class="btn sec" href="#/mindmap/${id}">In der Mindmap</a><span class="small muted">Stand: ${stLabel[st.st]}, ${st.done} von ${st.total} bearbeitet</span></div></div></div>
    <p class="sect s-learn">Verstehen</p>
    <div class="kurz"><h2>Kurz erklärt</h2>${esc(l.kurz)}</div>
    <div class="lzmaps"></div>
    <details class="more" open><summary><span>Kernwissen: alles aus dem Skript zu diesem Lernziel</span><span class="tg"></span></summary><div class="kern">${l.kern}</div></details>
    ${(l.widgets || []).length ? `<p class="sect s-try">Ausprobieren</p>` : ""}<div class="wids"></div>
    <p class="sect s-train">Trainieren</p>
    <div class="trainbox"><div><b>Lernziel trainieren</b><p>Alle ${qs.length} Fragen zu diesem Lernziel, ohne nachzuschauen. Danach zeigt die Station auf der Startseite, wie sicher du bist.</p></div><a class="btn train big" href="#/ueben/${id}">Jetzt trainieren</a></div>
    <h3>Schnelltest: drei zufällige Fragen</h3><div class="quick"></div>
    <div class="row" style="margin-top:30px;justify-content:space-between">${id > 1 ? `<a class="link" href="#/lz/${id-1}">Lernziel ${id-1}</a>` : "<span></span>"}${lzById(id + 1) ? `<a class="link" href="#/lz/${id+1}">Lernziel ${id+1}</a>` : ""}</div>`;
  fillImgs(m);
  const lm = $(".lzmaps", m); mapsFor(id).forEach(mp => lm.appendChild(topicMap(mp)));
  const w = $(".wids", m); (l.widgets || []).forEach(k => { const d = document.createElement("div"); d.className = "widget"; w.appendChild(d); if (typeof k === "string") W[k](d); else W[k.w](d, k); });
  const quick = $(".quick", m); shuffle(qs.filter(q => q.t !== "open")).slice(0, 3).forEach((q, i) => quick.appendChild(Q(q, {num:i+1, onScore:() => nav("lz" + id)}).el));
};

P.ueben = (m, id) => { id = +id; const l = lzById(id); if (!l) return P.start(m); const qs = D.questions.filter(q => q.lz === id); const ord = {mc:0, tf:1, match:2, order:3, term:4, gap:5, open:6};
  session(m, `Lernziel ${id}: ${l.title}`, qs.slice().sort((a, b) => ord[a.t] - ord[b.t]).map(q => ({q})), `#/lz/${id}`, "lz" + id); };

P.heute = (m) => {
  const cards = shuffle(D.cards.filter(c => isDue(c.id))).slice(0, 4).map(c => ({card:c}));
  const pool = D.questions.map(q => ({q, w:!S.q[q.id] ? 2 : (1 - S.q[q.id].s) * 3 + (Date.now() - S.q[q.id].t > 864e5 ? 0.5 : 0)})).filter(x => x.w > 0.2);
  const chosen = []; const usedLz = {};
  shuffle(pool).sort((a, b) => b.w - a.w).forEach(x => { if (chosen.length < 12 - cards.length && (usedLz[x.q.lz] || 0) < 2){ chosen.push({q:x.q}); usedLz[x.q.lz] = (usedLz[x.q.lz] || 0) + 1; } });
  const items = shuffle(chosen.concat(cards));
  if (!items.length){ m.innerHTML = `<h1>Schnellcheck</h1><div class="panel">Alles sitzt. Mach eine <a href="#/probe">Probeprüfung</a> oder stelle dir eine <a href="#/mix">eigene Übung</a> zusammen.</div>`; return; }
  session(m, "Schnellcheck", items, "#/start", "heute");
};

function session(m, title, items, back, act, o){
  o = o || {};
  let i = 0, sum = 0, cnt = 0; const t0 = Date.now(), token = {};
  m.__sess = token; let pending = false;
  GUARD = {on:() => pending && m.__sess === token, msg:"Übung verlassen? Deine angefangene Antwort geht verloren. Bereits bewertete Aufgaben bleiben gespeichert."};
  const mmss = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const tick = () => { if (m.__sess !== token) return clearInterval(iv); const el = $("[data-timer]", m); if (!el) return;
    const left = o.minutes * 60e3 - (Date.now() - t0); el.textContent = left > 0 ? `noch ${mmss(left)} Min.` : `Zeit um (+${mmss(-left)})`; el.classList.toggle("over", left <= 0); };
  const iv = o.minutes ? setInterval(tick, 1000) : null;
  const backLink = () => { const a = $("[data-back]", m); if (a) a.addEventListener("click", e => { if (location.hash === "#/" + CUR + "/" + back.replace(/^#\//, "")){ e.preventDefault(); e.stopPropagation(); route(true); } }); };
  const step = () => {
    if (i >= items.length){ const pct = cnt ? Math.round(sum / cnt * 100) : 0; clearInterval(iv); m.__sess = null;
      const used = o.minutes ? ` in ${Math.max(1, Math.round((Date.now() - t0) / 60e3))} Minuten` : "";
      m.innerHTML = `<h1>${esc(title)}</h1><div class="panel"><p class="muted">Geschafft</p><p class="result">${pct} %</p><p>${cnt} Aufgaben bewertet${used}. Der Fortschritt auf der Startseite ist aktualisiert.</p><div class="row"><a class="btn" href="${back}" data-back>Zurück</a><button class="btn sec" data-again>${o.again || "Nochmals"}</button></div></div>`;
      backLink(); $("[data-again]", m).addEventListener("click", () => route(true)); nav(act); return; }
    const it = items[i];
    m.innerHTML = `<div class="crumb"><a href="${back}" data-back>Zurück</a></div><h1>${esc(title)}</h1><div class="prog"><i style="width:${i / items.length * 100}%"></i></div><p class="small muted sess-info"><span>Aufgabe ${i+1} von ${items.length}</span>${o.minutes ? `<span class="timer" data-timer></span>` : ""}</p><div class="slot"></div><div class="actions"><button class="btn" data-next hidden>Weiter</button><button class="link" data-pass>Überspringen</button></div>`;
    backLink(); if (o.minutes) tick();
    const slot = $(".slot", m), nb = $("[data-next]", m); pending = false;
    slot.addEventListener("input", e => { if (e.target.matches("textarea, input[type=text]")) pending = !!e.target.value.trim(); });
    const ready = () => { nb.hidden = false; const sk = $("[data-pass]", m); if (sk) sk.remove(); nb.focus(); };
    if (it.card) slot.appendChild(cardEl(it.card, r => { i++; step(); }));
    else slot.appendChild(Q(it.q, {lzTag:true, onScore:s => { sum += s; cnt++; pending = false; ready(); }}).el);
    nb.addEventListener("click", () => { i++; step(); window.scrollTo(0, 0); });
    $("[data-pass]", m).addEventListener("click", () => { i++; step(); });
  };
  step();
}

/* ---------- Themen-Mindmap: kleine Begriffskarte mit beschrifteten Beziehungen ---------- */
let TM_UID = 0;
function topicMap(mp){
  const uid = "tm" + (++TM_UID), l0 = lzById(mp.lz[0]);
  const el = document.createElement("div"); el.className = "tm " + (l0 ? thc(l0) : "");
  const N = {}; mp.nodes.forEach(n => N[n.id] = n);
  const E = (mp.edges || []).filter(e => N[e.a] && N[e.b]);
  const triple = e => `<li><span>${esc(N[e.a].t)}</span> <em>${e.dir ? "" : "– "}${esc(e.t)}${e.dir ? " →" : " –"}</em> <span>${esc(N[e.b].t)}</span></li>`;
  const relsOf = id => E.filter(e => e.a === id || e.b === id);
  const ordered = mp.nodes.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const hint = `<p class="tm-hint">Klicke auf einen Begriff: Er wird erklärt und seine Verbindungen leuchten auf.</p>`;
  el.innerHTML = `<div class="tm-head"><span class="tm-tag">Mindmap${mp.lz.length ? " · Lernziel " + mp.lz.join(", ") : ""}</span><h3>${esc(mp.title)}</h3>${mp.intro ? `<p>${esc(mp.intro)}</p>` : ""}</div>
    <div class="tm-canvas" style="padding-bottom:${(mp.h || 0.6) * 100}%"><svg class="tm-svg" aria-hidden="true"><defs><marker id="${uid}a" class="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker><marker id="${uid}h" class="ar hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker></defs><g></g></svg>
      ${mp.nodes.map(n => `<button type="button" class="tm-n ${n.k ? "k-" + n.k : ""}" data-n="${esc(n.id)}" style="left:${n.x}%;top:${n.y}%"><b>${esc(n.t)}</b>${n.s ? `<small>${esc(n.s)}</small>` : ""}</button>`).join("")}<div class="tm-labels"></div></div>
    <div class="tm-info" aria-live="polite">${hint}</div>
    <ol class="tm-list">${ordered.map(n => `<li class="${n.k ? "k-" + n.k : ""}"><details><summary><b>${esc(n.t)}</b>${n.s ? ` <small>${esc(n.s)}</small>` : ""}</summary>${n.d ? `<p>${esc(n.d)}</p>` : ""}${relsOf(n.id).length ? `<ul class="tm-rel">${relsOf(n.id).map(triple).join("")}</ul>` : ""}</details></li>`).join("")}</ol>`;
  const cv = $(".tm-canvas", el), g = $(".tm-svg g", el), svg = $(".tm-svg", el), labs = $(".tm-labels", el), info = $(".tm-info", el);
  let sel = null;
  const draw = () => {
    if (!el.isConnected) return; const B = cv.getBoundingClientRect(); if (!B.width) return;
    svg.setAttribute("viewBox", `0 0 ${B.width} ${B.height}`);
    const R = {}; $$(".tm-n", cv).forEach(b => { const r = b.getBoundingClientRect(); R[b.dataset.n] = {cx:(r.left + r.right) / 2 - B.left, cy:(r.top + r.bottom) / 2 - B.top, w:r.width / 2 + 4, h:r.height / 2 + 4}; });
    const clip = (r, tx, ty) => { const dx = tx - r.cx, dy = ty - r.cy; const s = Math.min(dx ? r.w / Math.abs(dx) : 1e9, dy ? r.h / Math.abs(dy) : 1e9); return [r.cx + dx * s, r.cy + dy * s]; };
    let s = "", l = "";
    E.forEach((e, i) => { const a = R[e.a], b = R[e.b]; const p = clip(a, b.cx, b.cy), q = clip(b, a.cx, a.cy); const hot = sel && (e.a === sel || e.b === sel), dim = sel && !hot;
      s += `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" class="${hot ? "hot" : ""} ${dim ? "dim" : ""}" ${e.dir ? `marker-end="url(#${uid}${hot ? "h" : "a"})"` : ""}/>`;
      if (e.t){ let lx = (p[0] + q[0]) / 2, ly = (p[1] + q[1]) / 2; const len = Math.hypot(q[0] - p[0], q[1] - p[1]), estW = e.t.length * 6 + 16;
        /* kurzer waagrechter Pfeil: Beschriftung über die Lücke setzen, damit sie keinen Kasten verdeckt */
        if (len < estW + 6 && Math.abs(b.cx - a.cx) > Math.abs(b.cy - a.cy)) ly = Math.min(a.cy - a.h, b.cy - b.h) - 7;
        l += `<span class="tm-l ${hot ? "hot" : ""} ${dim ? "dim" : ""}" style="left:${lx}px;top:${ly}px">${esc(e.t)}</span>`; } });
    g.innerHTML = s; labs.innerHTML = l; };
  const select = id => { sel = id; const nb = id ? relsOf(id).map(e => e.a === id ? e.b : e.a) : [];
    $$(".tm-n", cv).forEach(b => { const n = b.dataset.n; b.classList.toggle("sel", n === id); b.classList.toggle("rel", nb.includes(n)); b.classList.toggle("dim", !!id && n !== id && !nb.includes(n)); });
    if (!id) info.innerHTML = hint;
    else { const n = N[id]; info.innerHTML = `<div class="tm-card"><b>${esc(n.t)}</b>${n.s ? ` <small>${esc(n.s)}</small>` : ""}${n.d ? `<p>${esc(n.d)}</p>` : ""}${relsOf(id).length ? `<ul class="tm-rel">${relsOf(id).map(triple).join("")}</ul>` : ""}</div>`; }
    draw(); };
  $$(".tm-n", cv).forEach(b => b.addEventListener("click", e => { e.stopPropagation(); select(sel === b.dataset.n ? null : b.dataset.n); }));
  cv.addEventListener("click", () => { if (sel) select(null); });
  if (typeof ResizeObserver !== "undefined"){ const ro = new ResizeObserver(() => { if (!el.isConnected) return ro.disconnect(); draw(); }); ro.observe(cv); }
  setTimeout(draw, 60);
  return el;
}
const mapsFor = id => (D.maps || []).filter(mp => mp.lz.includes(id));

/* ---------- Mindmap ---------- */
P.mindmap = (m, focus) => {
  m.className = "wide";
  const MM = D.mindmap || {};
  const concepts = id => (MM.concepts && MM.concepts[id]) || D.cards.filter(c => c.lz === id).slice(0, 4).map(c => c.f);
  const links = (MM.links || []).filter(x => lzById(x.a) && lzById(x.b) && x.a !== x.b);
  const keys = themeKeys(), L = [], R = []; let nl = 0, nr = 0;
  keys.slice().sort((a, b) => D.themes[b].lz.length - D.themes[a].lz.length).forEach(k => { const n = D.themes[k].lz.length; if (nl <= nr){ L.push(k); nl += n; } else { R.push(k); nr += n; } });
  [L, R].forEach(a => a.sort((x, y) => keys.indexOf(x) - keys.indexOf(y)));
  let sel = focus && lzById(+focus) ? +focus : null, allC = false, allL = true;
  const group = (k, side) => { const T = D.themes[k];
    return `<div class="mm-g ${side} th-${T.c}" data-g="${k}"><div class="mm-th" data-mth="${k}">${esc(T.name)}</div><div class="mm-lzs">${T.lz.map(id => `<button type="button" class="mm-lz" data-mlz="${id}"><span class="mm-h"><span class="n">${id}</span><span class="t">${esc(lzById(id).short)}</span></span><span class="cs">${concepts(id).map(c => `<span>${esc(c)}</span>`).join("")}</span></button>`).join("")}</div></div>`; };
  const maps = D.maps || [];
  const tFocus = focus && String(focus).startsWith("t-") ? String(focus).slice(2) : null;
  let cur = maps.find(x => x.id === tFocus) || (sel && mapsFor(sel)[0]) || maps[0];
  const mapChip = x => `<button type="button" class="tm-chip ${thc(lzById(x.lz[0]))}" data-map="${esc(x.id)}"><span class="badge sm">${x.lz.join(", ")}</span>${esc(x.title)}</button>`;
  m.innerHTML = `<div class="mmhero"><h1>Mindmaps</h1><p class="lead">Kleine Mindmaps erklären schwierige Themen: Begriffe und Pfeile zeigen, was wozu führt und wie alles zusammenhängt. Klicke auf einen Begriff, um ihn erklärt zu bekommen.</p></div>
    ${maps.length ? `<div class="tm-pick">${themeKeys().map(k => { const ms = maps.filter(x => lzById(x.lz[0]) && lzById(x.lz[0]).theme === k); return ms.length ? `<div class="tm-pickg"><b>${esc(D.themes[k].name)}</b><div>${ms.map(mapChip).join("")}</div></div>` : ""; }).join("")}</div><div class="tm-stage" data-stage></div>` : ""}
    <h2 class="mm-over">Übersicht: alle Lernziele und ihre Zusammenhänge</h2>
    <p class="small muted">Klicke auf ein Lernziel, um seine Fachbegriffe und Verbindungen zu anderen Lernzielen zu sehen.</p>
    <div class="mm-tools"><label class="tog"><input type="checkbox" data-allc><span>Alle Fachbegriffe zeigen</span></label><label class="tog"><input type="checkbox" data-alll checked><span>Alle Zusammenhänge zeigen</span></label></div>
    <div class="mm" data-mm><svg class="mm-svg" aria-hidden="true"></svg>
      <div class="mm-col left">${L.map(k => group(k, "left")).join("")}</div>
      <div class="mm-center"><b>${esc(D.meta.title)}</b><small>${esc(D.meta.subtitle || "")}</small></div>
      <div class="mm-col right">${R.map(k => group(k, "right")).join("")}</div></div>
    <div class="mm-detail" data-det></div>`;
  const box = $("[data-mm]", m), svg = $(".mm-svg", box), det = $("[data-det]", m);
  const node = id => $(`[data-mlz="${id}"]`, box), thNode = k => $(`[data-mth="${k}"]`, box);
  const related = id => links.filter(x => x.a === id || x.b === id).map(x => ({o: x.a === id ? x.b : x.a, t: x.t}));
  const draw = () => {
    if (!box.isConnected) return;
    const B = box.getBoundingClientRect(), mobile = getComputedStyle(box).gridTemplateColumns.trim().split(/\s+/).length < 3; svg.setAttribute("width", B.width); svg.setAttribute("height", B.height); svg.setAttribute("viewBox", `0 0 ${B.width} ${B.height}`);
    const rc = el => { const r = el.getBoundingClientRect(); return {l:r.left - B.left, r:r.right - B.left, t:r.top - B.top, b:r.bottom - B.top, cx:(r.left + r.right) / 2 - B.left, cy:(r.top + r.bottom) / 2 - B.top}; };
    const tree = (a, b) => { if (b.l >= a.r - 2){ const k = (b.l - a.r) / 2; return `M${a.r} ${a.cy}C${a.r + k} ${a.cy} ${b.l - k} ${b.cy} ${b.l} ${b.cy}`; }
      if (b.r <= a.l + 2){ const k = (a.l - b.r) / 2; return `M${a.l} ${a.cy}C${a.l - k} ${a.cy} ${b.r + k} ${b.cy} ${b.r} ${b.cy}`; }
      const x = a.l + 16; if (b.l > x + 4) return `M${x} ${a.b}L${x} ${b.cy - 8}Q${x} ${b.cy} ${x + 8} ${b.cy}L${b.l} ${b.cy}`;
      const xr = a.r - 16; if (b.r < xr - 4) return `M${xr} ${a.b}L${xr} ${b.cy - 8}Q${xr} ${b.cy} ${xr - 8} ${b.cy}L${b.r} ${b.cy}`;
      return `M${a.cx} ${a.b}C${a.cx} ${(a.b + b.t) / 2} ${b.cx} ${(a.b + b.t) / 2} ${b.cx} ${b.t}`; };
    const C = rc($(".mm-center", box)); let s = "";
    keys.forEach(k => { const T = D.themes[k], tr = rc(thNode(k)); const hotT = sel && T.lz.includes(sel);
      if (!mobile) s += `<path class="tr th-${T.c} ${hotT ? "hot" : ""}" d="${tree(C, tr)}"/>`;
      T.lz.forEach(id => s += `<path class="tr th-${T.c} ${sel === id ? "hot" : ""}" d="${tree(tr, rc(node(id)))}"/>`); });
    if (!mobile) links.forEach(x => { const hot = sel && (x.a === sel || x.b === sel); if (!hot && (sel || !allL)) return;
      const a = rc(node(x.a)), b = rc(node(x.b)), la = a.cx < C.cx, lb = b.cx < C.cx; let d;
      if (la === lb){ const left = la, k = 28 + Math.abs(a.cy - b.cy) * 0.18; d = left ? `M${a.l} ${a.cy}C${Math.min(a.l, b.l) - k} ${a.cy} ${Math.min(a.l, b.l) - k} ${b.cy} ${b.l} ${b.cy}` : `M${a.r} ${a.cy}C${Math.max(a.r, b.r) + k} ${a.cy} ${Math.max(a.r, b.r) + k} ${b.cy} ${b.r} ${b.cy}`; }
      else { const p = la ? a : b, q = la ? b : a; d = `M${p.r} ${p.cy}C${C.cx} ${p.cy} ${C.cx} ${q.cy} ${q.l} ${q.cy}`; }
      s += `<path class="x ${hot ? "hot" : ""}" d="${d}"><title>${esc(x.t)}</title></path>`; });
    svg.innerHTML = s; };
  const showDetail = () => {
    if (!sel){ det.innerHTML = links.length ? `<h2>Alle Zusammenhänge</h2><ol class="mm-links">${links.map(x => `<li><button type="button" class="link" data-go="${x.a}">${x.a}: ${esc(lzById(x.a).short)}</button> <span class="arr">↔</span> <button type="button" class="link" data-go="${x.b}">${x.b}: ${esc(lzById(x.b).short)}</button><p>${esc(x.t)}</p></li>`).join("")}</ol>` : `<p class="muted">Klicke auf ein Lernziel, um Details zu sehen.</p>`; }
    else { const l = lzById(sel), rel = related(sel);
      det.innerHTML = `<div class="mm-card ${thc(l)}"><div class="mmc-h"><span class="badge">${sel}</span><div><span class="small muted">${esc(D.themes[l.theme].name)}</span><h2>${esc(l.title)}</h2></div><button type="button" class="mmc-x" data-close aria-label="Schliessen">×</button></div>
        <div class="kurz">${esc(l.kurz)}</div>
        <h3>Fachbegriffe</h3><div class="mm-chips">${concepts(sel).map(c => `<span>${esc(c)}</span>`).join("")}</div>
        ${rel.length ? `<h3>Hängt zusammen mit</h3><ul class="mm-rel">${rel.map(r => `<li><button type="button" class="mm-relb ${thc(lzById(r.o))}" data-go="${r.o}"><span class="badge sm">${r.o}</span>${esc(lzById(r.o).short)}</button><p>${esc(r.t)}</p></li>`).join("")}</ul>` : ""}
        <div class="row"><a class="btn" href="#/lz/${sel}">Lernziel öffnen</a><a class="btn train" href="#/mix/${sel}">Dazu üben</a></div></div>`; }
    $$("[data-go]", det).forEach(b => b.addEventListener("click", () => select(+b.dataset.go, true)));
    const cl = $("[data-close]", det); if (cl) cl.addEventListener("click", () => select(null)); };
  const select = (id, scroll) => { sel = id;
    const rel = sel ? related(sel).map(r => r.o) : [];
    $$("[data-mlz]", box).forEach(b => { const n = +b.dataset.mlz; b.classList.toggle("sel", n === sel); b.classList.toggle("rel", rel.includes(n)); b.classList.toggle("dim", !!sel && n !== sel && !rel.includes(n)); b.classList.toggle("open", allC || n === sel); b.setAttribute("aria-pressed", n === sel); });
    box.classList.toggle("has-sel", !!sel); showDetail(); requestAnimationFrame(draw); setTimeout(draw, 150);
    if (scroll && sel) node(sel).scrollIntoView({block:"nearest", behavior:"smooth"}); };
  $$("[data-mlz]", box).forEach(b => b.addEventListener("click", () => select(+b.dataset.mlz === sel ? null : +b.dataset.mlz)));
  $("[data-allc]", m).addEventListener("change", e => { allC = e.target.checked; select(sel); });
  $("[data-alll]", m).addEventListener("change", e => { allL = e.target.checked; draw(); });
  if (typeof ResizeObserver !== "undefined"){ const ro = new ResizeObserver(() => { if (!box.isConnected) return ro.disconnect(); draw(); }); ro.observe(box); }
  select(sel);
  const stage = $("[data-stage]", m);
  const showMap = (mp, scroll) => { if (!stage || !mp) return; cur = mp; stage.innerHTML = ""; stage.appendChild(topicMap(mp));
    $$("[data-map]", m).forEach(b => b.classList.toggle("on", b.dataset.map === mp.id)); if (scroll) stage.scrollIntoView({block:"start", behavior:"smooth"}); };
  $$("[data-map]", m).forEach(b => b.addEventListener("click", () => showMap(maps.find(x => x.id === b.dataset.map), true)));
  showMap(cur, !!tFocus);
  if (focus && D.themes[focus]){ const g = $(`[data-g="${focus}"]`, box); g.classList.add("flash"); setTimeout(() => g.scrollIntoView({block:"center", behavior:"smooth"}), 50); }
  else if (sel) setTimeout(() => box.scrollIntoView({block:"start", behavior:"smooth"}), 50);
};

/* ---------- Eigene Übung: Themen und Dauer wählen ---------- */
const EST = {mc:1, tf:2, gap:1.5, match:2, order:2, term:1.5, open:4}, EST_CARD = 0.5;
function buildMix(lzs, min, o){
  const qs = D.questions.filter(q => lzs.includes(q.lz) && (o.open || q.t !== "open"));
  const w = q => !S.q[q.id] ? 2 : (1 - S.q[q.id].s) * 3 + (Date.now() - S.q[q.id].t > 864e5 ? 0.5 : 0) + 0.1;
  const byLz = {}; lzs.forEach(id => byLz[id] = []); shuffle(qs).forEach(q => byLz[q.lz].push(q));
  if (o.weak) Object.values(byLz).forEach(a => a.sort((x, y) => w(y) - w(x)));
  const order = o.weak ? shuffle(lzs).sort((a, b) => lzPct(a) - lzPct(b)) : shuffle(lzs);
  const cardBudget = o.cards ? Math.min(min * 0.25, D.cards.filter(c => lzs.includes(c.lz)).length * EST_CARD) : 0, qBudget = min - cardBudget;
  /* offene Fragen höchstens etwa 40 % der Zeit, damit die Fragetypen gemischt bleiben */
  const chosen = []; let t = 0, tOpen = 0, added = true; const openMax = Math.max(EST.open, qBudget * 0.4);
  while (added){ added = false;
    for (const id of order){ const a = byLz[id]; const k = a.findIndex(q => t + (EST[q.t] || 2) <= qBudget + 0.5 && (q.t !== "open" || tOpen + EST.open <= openMax)); if (k < 0) continue;
      const q = a.splice(k, 1)[0]; chosen.push({q}); t += EST[q.t] || 2; if (q.t === "open") tOpen += EST.open; added = true; } }
  const exhausted = Object.values(byLz).every(a => !a.length);
  let cards = [];
  if (o.cards){ const cs = D.cards.filter(c => lzs.includes(c.lz)); const due = shuffle(cs.filter(c => isDue(c.id))), rest = shuffle(cs.filter(c => !isDue(c.id)));
    const n = Math.floor((min - t) / EST_CARD); cards = due.concat(rest).slice(0, Math.max(0, Math.min(n, 15))).map(c => ({card:c})); }
  const items = []; let ci = 0; chosen.forEach((x, k) => { items.push(x); if (k % 3 === 2 && ci < cards.length) items.push(cards[ci++]); }); while (ci < cards.length) items.push(cards[ci++]);
  return {items, est:Math.round(t + cards.length * EST_CARD), nQ:chosen.length, nC:cards.length, exhausted, total:qs.length};
}
P.mix = (m, arg) => {
  const cfg = Object.assign({lz:[], min:15, weak:true, cards:true, open:true}, S.mix || {});
  if (arg && D.themes[arg]) cfg.lz = D.themes[arg].lz.slice(); else if (arg && lzById(+arg)) cfg.lz = [+arg];
  cfg.lz = cfg.lz.filter(id => lzById(id));
  const MINS = [5, 10, 15, 20, 30, 45, 60];
  const draw = () => {
    m.innerHTML = `<div class="mixhero"><h1>Eigene Übung zusammenstellen</h1><p class="lead">Wähle, was du als Nächstes lernen willst, und wie viel Zeit du hast. Die Aufgaben werden passend zusammengestellt, Schwaches zuerst.</p></div>
      <div class="mixstep"><span class="ms-n">1</span><div class="ms-b"><h2>Themen wählen</h2>
        <div class="mixq"><button class="link" data-all>Alle wählen</button><button class="link" data-none>Keine</button><button class="link" data-weak>Nur unsichere Lernziele</button></div>
        ${themeKeys().map(k => { const T = D.themes[k], on = T.lz.every(id => cfg.lz.includes(id)); return `<div class="mixth th-${T.c}"><label class="mixth-h"><input type="checkbox" data-th="${k}" ${on ? "checked" : ""}><span>${esc(T.name)}</span><small>${pctOf(lzBreak(T.lz).sicher, lzBreak(T.lz).total)} % sicher</small></label>
          <div class="lzchips">${T.lz.map(id => { const l = lzById(id), p = lzPct(id); return `<button type="button" class="lzchip ${cfg.lz.includes(id) ? "on" : ""} ${lzStats(id).st}" data-lz="${id}" aria-pressed="${cfg.lz.includes(id)}"><span class="cn">${id}</span>${esc(l.short)}<span class="cp">${p} %</span></button>`; }).join("")}</div></div>`; }).join("")}</div></div>
      <div class="mixstep"><span class="ms-n">2</span><div class="ms-b"><h2>Dauer festlegen</h2>
        <div class="mins">${MINS.map(x => `<button type="button" class="minb ${cfg.min === x ? "on" : ""}" data-min="${x}">${x}<small>Min.</small></button>`).join("")}</div>
        <label class="rng"><input type="range" min="5" max="90" step="5" value="${cfg.min}" data-range><span><b data-minv>${cfg.min}</b> Minuten</span></label></div></div>
      <div class="mixstep"><span class="ms-n">3</span><div class="ms-b"><h2>Optionen</h2>
        <label class="opt2"><input type="checkbox" data-o="weak" ${cfg.weak ? "checked" : ""}><span><b>Schwaches zuerst</b> Fragen, die du noch nicht kannst oder lange nicht gemacht hast, kommen bevorzugt.</span></label>
        <label class="opt2"><input type="checkbox" data-o="open" ${cfg.open ? "checked" : ""}><span><b>Offene Fragen einbauen</b> In ganzen Sätzen antworten, wie an der Prüfung. Brauchen mehr Zeit.</span></label>
        <label class="opt2"><input type="checkbox" data-o="cards" ${cfg.cards ? "checked" : ""}><span><b>Karteikarten einmischen</b> Kurze Begriffsabfragen zwischendurch.</span></label></div></div>
      <div class="mixsum" data-sum></div>`;
    const sum = $("[data-sum]", m);
    const upd = () => { S.mix = cfg; save();
      if (!cfg.lz.length){ sum.innerHTML = `<p>Wähle mindestens ein Lernziel aus.</p><button class="btn train big" disabled>Übung starten</button>`; return; }
      const r = buildMix(cfg.lz, cfg.min, cfg);
      sum.innerHTML = `<div><p class="ms-big"><b>${r.nQ}</b> Aufgaben${r.nC ? ` + <b>${r.nC}</b> Karteikarten` : ""}</p><p class="small">aus ${cfg.lz.length} Lernziel${cfg.lz.length > 1 ? "en" : ""} · geschätzt ca. ${r.est} Minuten${r.exhausted && r.est < cfg.min - 2 ? ` · mehr Aufgaben gibt es zu dieser Auswahl nicht` : ""}</p></div><button class="btn train big" data-go ${r.items.length ? "" : "disabled"}>Übung starten</button>`;
      const go = $("[data-go]", sum); if (go) go.addEventListener("click", () => { const r2 = buildMix(cfg.lz, cfg.min, cfg); window.scrollTo(0, 0);
        count("eigene-uebung", "Eigene Übung gestartet", true); session(m, `Eigene Übung · ${cfg.min} Minuten`, r2.items, "#/mix", "mix", {minutes:cfg.min, again:"Neue Übung zusammenstellen"}); }); };
    const setLz = list => { cfg.lz = list; draw(); };
    $$("[data-lz]", m).forEach(b => b.addEventListener("click", () => { const id = +b.dataset.lz; setLz(cfg.lz.includes(id) ? cfg.lz.filter(x => x !== id) : cfg.lz.concat(id)); }));
    $$("[data-th]", m).forEach(c => c.addEventListener("change", () => { const ids = D.themes[c.dataset.th].lz; setLz(c.checked ? Array.from(new Set(cfg.lz.concat(ids))) : cfg.lz.filter(x => !ids.includes(x))); }));
    $("[data-all]", m).addEventListener("click", () => setLz(D.lz.map(l => l.id)));
    $("[data-none]", m).addEventListener("click", () => setLz([]));
    $("[data-weak]", m).addEventListener("click", () => setLz(D.lz.filter(l => lzStats(l.id).st !== "sicher").map(l => l.id)));
    $$("[data-min]", m).forEach(b => b.addEventListener("click", () => { cfg.min = +b.dataset.min; draw(); }));
    const rg = $("[data-range]", m); rg.addEventListener("input", () => { cfg.min = +rg.value; $("[data-minv]", m).textContent = cfg.min; $$("[data-min]", m).forEach(b => b.classList.toggle("on", +b.dataset.min === cfg.min)); upd(); });
    $$("[data-o]", m).forEach(c => c.addEventListener("change", () => { cfg[c.dataset.o] = c.checked; upd(); }));
    upd();
  };
  draw();
};

P.pruefen = (m) => {
  const card = l => { const s = lzStats(l.id); return `<a class="lzcard ${thc(l)}" href="#/ueben/${l.id}"><span class="num">${l.id}</span><span class="tt">${esc(l.short)}<br><span class="st">${s.done} von ${s.total} bearbeitet, ${stLabel[s.st]}</span><span class="bar"><i style="width:${s.done ? Math.round(s.avg * 100) : 0}%"></i></span></span></a>`; };
  m.innerHTML = `<h1>Kapitel trainieren</h1><p class="lead">Wähle ein Lernziel und trainiere alle Fragen dazu. Der grüne Balken zeigt deinen Durchschnitt.</p>
    <div class="row"><a class="btn train" href="#/heute">Schnellcheck</a><a class="btn sec" href="#/probe">Probeprüfung starten</a></div>
    ${themeKeys().map(k => `<h2>${esc(D.themes[k].name)}</h2><div class="lzgrid">${D.lz.filter(l => l.theme === k).map(card).join("")}</div>`).join("")}`;
};

function distinctLz(list, n){ const out = [], used = new Set(); shuffle(list).forEach(q => { if (out.length < n && !used.has(q.lz)){ out.push(q); used.add(q.lz); } });
  shuffle(list).forEach(q => { if (out.length < n && !out.includes(q)) out.push(q); }); return out; }

const EXAM = {
  beg: n => distinctLz(D.questions.filter(q => q.beg), n).map(q => ({q, pts:1})),
  mc: n => distinctLz(D.questions.filter(q => q.t === "mc"), n).map(q => ({q, pts:1})),
  gap: (n, p) => distinctLz(D.questions.filter(q => q.t === "gap"), n).map(q => ({q, pts:p.pts || 3})),
  tf: n => distinctLz(D.questions.filter(q => q.t === "tf"), n).map(q => ({q, pts:q.items.length * 0.5})),
  term: n => distinctLz(D.questions.filter(q => q.t === "term"), n).map(q => ({q, pts:q.items.length * 0.5})),
  "case": n => distinctLz(D.questions.filter(q => q.case), n).map(q => ({q, pts:q.p})),
  open: n => distinctLz(D.questions.filter(q => q.t === "open" && !q.case && !q.beg), n).map(q => ({q, pts:q.p})),
  match: n => distinctLz(D.questions.filter(q => q.t === "match"), n).map(q => ({q, pts:q.pairs.length * 0.5})),
  /* Aufgaben-Pool aus dem Prüfungsaufbau, z. B. pool:"nennen" */
  pool: (n, p) => distinctLz(D.questions.filter(q => q.pool === p.pool), n).map(q => ({q, pts:p.pts || q.p || 1})),
  /* Zusammengehörige Teilaufgaben (Fall a–e, Stellungnahme a–b) mit gemeinsamem Text */
  set: (n, p) => { const grps = [...new Set(D.questions.filter(q => q.gtype === p.gtype).map(q => q.grp))]; const g = pick(grps);
    return D.questions.filter(q => q.grp === g).sort((a, b) => (a.part || "").localeCompare(b.part || "")).map(q => ({q, pts:q.p, sub:q.part})); }
};
function buildExam(){ const parts = [];
  D.meta.exam.parts.forEach((p, i) => { const t = `Aufgabe ${i + 1}: ${p.t}`;
    if (p.k === "text"){ const ts = pick(D.sources.filter(s => s.type === "text")); parts.push({t, src:ts, items:ts.qs.slice(0, 2).map(q => ({q, pts:q.p}))}); }
    else if (p.k === "bild"){ const bs = pick(D.sources.filter(s => s.type === "bild" && !s.muster)); const bq = bs.qs.find(q => q.p === 3) || bs.qs[0]; parts.push({t, src:bs, gate:true, items:[{q:bs.a, pts:4}, {q:bq, pts:3}]}); }
    else { let items = EXAM[p.k](p.n || 1, p); const used = new Set(parts.flatMap(x => x.items.map(it => it.q.id)));
      for (let k = 0; k < 8 && items.some(it => used.has(it.q.id)); k++) items = EXAM[p.k](p.n || 1, p);
      parts.push({t, items, shared: p.k === "set" && items[0] ? items[0].q.case : null, sharedLbl: p.gtype === "stellung" ? "Aussage" : "Fallbeispiel", no:i + 1}); } });
  parts.forEach(p => p.p = p.items.reduce((a, it) => a + it.pts, 0)); return parts; }
P.probe = (m) => {
  const opts = [0, 30, 45, 60, 75, 90]; const X = D.meta.exam;
  m.innerHTML = `<h1>Probeprüfung</h1><p class="lead">${esc(X.intro || "")} Die Aufgaben werden bei jedem Start neu zusammengestellt.</p>
    <div class="panel"><h3 style="margin-top:0">Aufbau</h3>
      <table class="tbl"><thead><tr><th>Aufgabe</th><th>Inhalt</th></tr></thead><tbody>${X.parts.map((p, i) => `<tr><td>${i + 1}. ${esc(p.t)}</td><td>${esc(p.d || "")}</td></tr>`).join("")}</tbody></table>
      ${D.meta.rules ? `<h3>Regeln wie an der Prüfung</h3><ul>${D.meta.rules.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
      <h3>So läuft es ab</h3>
      <ol class="steps-how"><li>Arbeite ohne Unterlagen und ohne diese Lernseiten. Schreib bei offenen Fragen ganze Sätze und begründe («weil», «dadurch»).</li>
      <li>Klicke am Ende auf «Abgeben». Die automatisch prüfbaren Aufgaben werden sofort bewertet.</li>
      <li>Bei offenen Fragen erscheinen Musterlösung und Checkliste. Hake ehrlich ab, was du wirklich geschrieben hast, und klicke dann «Bewertung abschliessen».</li></ol>
      <h3>Zeit</h3>
      <div class="row"><label for="lim" class="small">Zeitlimit</label><select id="lim" class="plain">${opts.map(o => `<option value="${o}">${o ? o + " Minuten" : "kein Limit, Zeit nur mitzählen"}</option>`).join("")}</select></div>
      <p class="small muted">Mit Limit wird nach Ablauf automatisch abgegeben. Ohne Limit siehst du am Schluss, wie lange du gebraucht hast.</p>
      <div class="actions"><button class="btn" data-start>Probeprüfung starten</button></div></div>`;
  $("[data-start]", m).addEventListener("click", () => { count("probepruefung", "Probeprüfung gestartet", true); runExam(m, +$("#lim", m).value); });
};
function runExam(m, limit){
  const parts = buildExam(); const TOT = parts.reduce((a, p) => a + p.p, 0);
  m.innerHTML = `<h1>Probeprüfung</h1><div class="scorebox"><span data-time></span><b data-total>? / ${fmt(TOT)}</b></div><div class="parts"></div>
    <div class="actions ex-act" style="margin-top:24px"><button class="btn" data-submit>Abgeben</button></div><div class="res"></div>`;
  const wrap = $(".parts", m); const ctls = []; let n = 0;
  parts.forEach(p => { const sec = document.createElement("section"); sec.className = "part"; sec.innerHTML = `<h2>${esc(p.t)}<span>${fmt(p.p)} Punkte</span></h2>`;
    if (p.src){ const s = p.src; sec.insertAdjacentHTML("beforeend", `<p class="small muted">${esc(s.title)}. ${esc(s.meta)}</p>${s.type === "text" ? `<div class="qtext-src">${s.text}</div>` : `<figure class="fig srcimg"><img data-img="${s.img}" alt="${esc(s.title)}"></figure>`}`); fillImgs(sec); }
    if (p.shared) sec.insertAdjacentHTML("beforeend", `<div class="case"><span class="lbl">${p.sharedLbl}</span>${esc(p.shared)}</div>`);
    p.items.forEach((it, idx) => { const c = Q(it.q, {exam:true, num:it.sub ? null : ++n, noCase:!!p.shared, points:it.pts, onChange:total, onScore:total}); c.pts = it.pts; ctls.push(c);
      if (p.gate && idx === 1){ const g = document.createElement("div"); g.className = "panel small"; g.innerHTML = `<p style="margin-top:0">Teil B erscheint, sobald du Teil A beantwortet hast, damit die Frage die Antwort nicht verrät.</p><button class="btn sec small" disabled>Teil B anzeigen</button>`;
        const prevTa = $("textarea", ctls[ctls.length - 2].el), gb = $("button", g); c.el.hidden = true;
        prevTa.addEventListener("input", () => { gb.disabled = prevTa.value.trim().length < 20; });
        gb.addEventListener("click", () => { g.remove(); c.el.hidden = false; }); sec.appendChild(g); }
      sec.appendChild(c.el); });
    wrap.appendChild(sec); });
  const t0 = Date.now(); let used = 0, submitted = false, touched = false, finished = false;
  ["input", "change"].forEach(ev => wrap.addEventListener(ev, () => { touched = true; }));
  GUARD = {on:() => touched && !finished && document.body.contains(wrap), msg:"Probeprüfung wirklich verlassen? Deine Antworten und Bewertungen gehen verloren."};
  const mmss = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  const tick = () => { const el = $("[data-time]", m); if (!el || submitted){ clearInterval(timer); return; } const el2 = Date.now() - t0;
    if (limit){ const left = limit * 60000 - el2; el.textContent = `Verbleibend: ${mmss(left)}`; el.classList.toggle("warn", left < 5 * 60000); if (left <= 0){ submit(true); } }
    else el.textContent = `Zeit: ${mmss(el2)}`; };
  const timer = setInterval(tick, 1000); tick();
  function total(){ if (!submitted) return; let got = 0; ctls.forEach(c => got += (c.score || 0) * c.pts); const g = Math.round(got * 2) / 2; const note = Math.round((g / TOT * 5 + 1) * 10) / 10;
    $("[data-total]", m).textContent = `${fmt(g)} / ${fmt(TOT)}`;
    $(".res", m).innerHTML = `<div class="panel"><p class="muted">Ergebnis</p><p class="result">${fmt(g)} von ${fmt(TOT)} Punkten</p><p>Benötigte Zeit: ${mmss(used)}${limit ? ` von ${limit} Minuten` : ""}. Ungefähre Note nach linearer Skala: ${note.toString().replace(".", ",")}.</p><p class="small muted">Offene Antworten zählen, sobald du sie mit der Checkliste bewertet hast.</p><div class="row"><button class="btn" data-again>Neue Probeprüfung</button><a class="btn sec" href="#/pruefen">Zum Prüfen-Bereich</a></div></div>`;
    $("[data-again]", m).addEventListener("click", () => route(true)); }
  function submit(auto){ if (submitted) return; submitted = true; used = Date.now() - t0; clearInterval(timer);
    $("[data-time]", m).textContent = auto ? `Zeit abgelaufen (${limit} min)` : `Abgegeben nach ${mmss(used)}`;
    $$(".part .panel button", m).forEach(b => b.closest(".panel").remove()); ctls.forEach(c => { c.el.hidden = false; c.check(); }); const sb = $("[data-submit]", m); sb.textContent = "Abgegeben"; sb.disabled = true;
    $(".ex-act", m).insertAdjacentHTML("beforeend", `<button class="btn" data-final>Bewertung abschliessen</button>`);
    $("[data-final]", m).addEventListener("click", ev => { finished = true; ctls.forEach(c => c.finalize && c.finalize()); ev.target.remove(); total();
      let got = 0; ctls.forEach(c => got += (c.score || 0) * c.pts); const g = Math.round(got * 2) / 2; S.probe = {best:Math.max(g, (S.probe && S.probe.best) || 0), last:g, tot:TOT, n:((S.probe && S.probe.n) || 0) + 1}; save(); nav("probe"); });
    total(); if (auto) alert("Die Zeit ist abgelaufen. Die Prüfung wurde abgegeben."); window.scrollTo({top:0, behavior:"smooth"}); }
  $("[data-submit]", m).addEventListener("click", () => submit(false));
  window.scrollTo(0, 0);
}

P.quellen = (m) => {
  if (!D.sources.length || !D.aqua) return P.start(m);
  const card = s => { const im = s.img && IMG[s.img];
    return `<a class="srccard" href="#/quelle/${s.id}"><div class="th" style="${im ? `background-image:url(${im.src})` : ""}">${im ? "" : esc(s.title)}</div><div class="bd">${s.muster ? `<span class="tag m">Musterbeispiel aus der letzten Prüfung</span>` : ""}<span class="tag">${s.type === "bild" ? "Bildquelle" : "Textquelle"}</span><b>${esc(s.title)}</b><span>${esc(s.meta)}</span></div></a>`; };
  m.innerHTML = `<h1>Quellenwerkstatt</h1><p class="lead">In der letzten Prüfung gab es 11 von 25 Punkten für Quellenarbeit. Die Bildquelle stammte direkt aus dem Skript. Hier übst du mit den Quellen aus den Skripten.</p>
    <div class="panel"><h3 style="margin-top:0">Die A-Q-U-A-Methode</h3><div class="aqua">${D.aqua.steps.map(s => `<div class="st"><h4><span class="k">${s.k}</span>${s.n}</h4><p class="fr" style="margin:0">${esc(s.fr)}</p></div>`).join("")}</div><p class="small muted" style="margin-top:10px">${esc(D.aqua.hinweis)}</p></div>
    <h2>Bildquellen</h2><div class="srcgrid">${D.sources.filter(s => s.type === "bild").map(card).join("")}</div>
    <h2>Textquellen</h2><div class="srcgrid">${D.sources.filter(s => s.type === "text").map(card).join("")}</div>`;
};

P.quelle = (m, id) => {
  const s = D.sources.find(x => x.id === id); if (!s) return P.quellen(m);
  m.innerHTML = `<div class="crumb"><a href="#/quellen">Quellenwerkstatt</a></div><h1>${esc(s.title)}</h1><p class="muted">${esc(s.meta)}</p>
    <p>${s.muster ? `<span class="tag m">Musterbeispiel aus der letzten Prüfung</span>` : ""}${s.lz.map(l => `<a class="tag" href="#/lz/${l}">Lernziel ${l}</a>`).join("")}</p>
    ${s.bewertung ? `<div class="bew">${esc(s.bewertung)}</div>` : ""}
    <h2>${s.type === "bild" ? "1. Bild untersuchen" : "1. Text lesen"}</h2><div class="step1"></div>
    <h2>2. A-Q-U-A</h2><p class="muted small">Schreibe zu jedem Schritt ein paar Stichworte, dann vergleiche.</p><div class="aqua">${D.aqua.steps.map((st, i) => `<div class="st"><h4><span class="k">${st.k}</span>${st.n}</h4><p class="fr">${esc(st.fr)}</p><textarea></textarea><div class="actions"><button class="btn sec small" data-a="${i}">Vergleichen</button></div><div class="ao"></div></div>`).join("")}</div>
    <h2>3. Fragen</h2>${s.type === "bild" && s.a ? `<p class="gateB panel small">Die weiteren Fragen erscheinen, sobald du Teil A beantwortet und bewertet hast. So verraten sie dir die Antwort nicht im Voraus.</p>` : ""}<div class="step3" ${s.type === "bild" && s.a ? "hidden" : ""}></div>`;
  const s1 = $(".step1", m);
  if (s.type === "bild"){ s1.innerHTML = `<figure class="fig srcimg"><img data-img="${s.img}" alt="${esc(s.title)}"><figcaption>${esc(s.meta)}</figcaption></figure>`; fillImgs(s1); if (s.a) s1.appendChild(Q(s.a, {onScore:() => { const g = $(".gateB", m); if (g){ g.remove(); $(".step3", m).hidden = false; } }}).el); }
  else s1.innerHTML = `<div class="qtext-src">${s.text}</div>`;
  $$("[data-a]", m).forEach(b => b.addEventListener("click", () => { const i = +b.dataset.a; b.parentNode.nextElementSibling.innerHTML = `<div class="model"><b>Vergleich</b>${esc(s.aqua[i])}</div>`; b.remove(); }));
  const s3 = $(".step3", m); s.qs.forEach((q, i) => s3.appendChild(Q(q, {num:i+1}).el));
};

P.karten = (m, arg) => {
  const [lzS, modeS] = (arg || "").split("-"); const lz = +lzS || 0; const mode = modeS || "faellig";
  const deck = D.cards.filter(c => !lz || c.lz === lz);
  const MODES = [
    {k:"faellig", n:"Fällige Karten (empfohlen)", f:c => isDue(c.id)},
    {k:"nicht", n:"Nur «Wusste ich nicht»", f:c => S.c[c.id] && S.c[c.id].r === 1},
    {k:"unsicher", n:"Nur «Unsicher»", f:c => S.c[c.id] && S.c[c.id].r === 2},
    {k:"gewusst", n:"Nur «Wusste ich»", f:c => S.c[c.id] && S.c[c.id].r === 3},
    {k:"neu", n:"Nur noch nie gesehene", f:c => !S.c[c.id]},
    {k:"alle", n:"Alle Karten", f:() => true}];
  const cntOf = md => deck.filter(md.f).length;
  const cur = MODES.find(x => x.k === mode) || MODES[0];
  const go = (l, md) => goHash("karten/" + l + "-" + md);
  m.innerHTML = `<h1>Karteikarten</h1><p class="lead">Karten, die du nicht weisst, kommen bald wieder. Du kannst aber jederzeit gezielt wiederholen, zum Beispiel nur die unsicheren oder alle.</p>
    <div class="row"><label class="small muted" for="deck">Stapel</label><select id="deck" class="plain"><option value="0">Alle Lernziele</option>${D.lz.filter(l => D.cards.some(c => c.lz === l.id)).map(l => `<option value="${l.id}" ${l.id === lz ? "selected" : ""}>Lernziel ${l.id}: ${esc(l.short)}</option>`).join("")}</select>
    <label class="small muted" for="mode">Welche Karten</label><select id="mode" class="plain">${MODES.map(x => `<option value="${x.k}" ${x.k === cur.k ? "selected" : ""}>${x.n} (${cntOf(x)})</option>`).join("")}</select></div>
    <div class="boxes"><div><b>${cntOf(MODES[4])}</b>noch nie gesehen</div><div><b>${cntOf(MODES[1])}</b>wusste ich nicht</div><div><b>${cntOf(MODES[2])}</b>unsicher</div><div><b>${cntOf(MODES[3])}</b>wusste ich</div></div><div class="cslot"></div>`;
  $("#deck", m).addEventListener("change", e => go(+e.target.value, cur.k));
  $("#mode", m).addEventListener("change", e => go(lz, e.target.value));
  const queue = shuffle(deck.filter(cur.f)); const total = queue.length; const slot = $(".cslot", m); let done = 0;
  const again = () => { const btns = MODES.filter(x => x.k !== "faellig" && x.k !== "neu").map(x => ({x, n:cntOf(x)})).filter(o => o.n > 0);
    return `<div class="row" style="margin-top:12px">${btns.map(o => `<button class="btn sec small" data-go="${o.x.k}">${o.x.n.replace("Nur ", "")} nochmals (${o.n})</button>`).join("")}</div>`; };
  const next = () => { slot.innerHTML = "";
    if (!queue.length){ slot.innerHTML = `<div class="panel"><p>${done ? `Durchgang beendet: ${done} Karten wiederholt.` : cur.k === "faellig" ? "Im Moment ist keine Karte fällig." : "In dieser Auswahl gibt es keine Karten."}</p><p class="small muted">Wiederhole gezielt:</p>${again()}</div>`;
      $$("[data-go]", slot).forEach(b => b.addEventListener("click", () => { if (b.dataset.go === cur.k) route(true); else go(lz, b.dataset.go); })); return; }
    const c = queue.shift(); slot.insertAdjacentHTML("beforeend", `<p class="small muted">Karte ${total - queue.length} von ${total}${queue.length ? "" : " (letzte)"}</p>`);
    slot.appendChild(cardEl(c, r => { done++; if (r === 1 && cur.k === "faellig") queue.splice(Math.min(3, queue.length), 0, c); next(); })); };
  next();
};

P.sichern = (m) => {
  const nq = Object.keys(S.q).length, nc = Object.keys(S.c).length;
  m.innerHTML = `<h1>Fortschritt sichern</h1><p class="lead">Dein Fortschritt liegt nur in diesem Browser auf diesem Laptop. Wenn du den Browser wechselst, den Verlauf löschst oder die Datei an einen anderen Ort verschiebst, kann er verloren gehen.</p>
    <div class="panel"><p>Gespeichert: ${nq} bearbeitete Fragen, ${nc} Karteikarten.</p><div class="row"><button class="btn" data-exp>Fortschritt als Datei sichern</button><label class="btn sec">Gesicherte Datei laden<input type="file" accept=".json,application/json" hidden data-imp></label></div><p class="small muted" data-msg></p></div>
    <div class="panel"><h3 style="margin-top:0">Neu anfangen</h3><p class="small">Löscht alle Resultate und Karteikarten-Stände in diesem Browser.</p><button class="btn sec" data-reset>Alles zurücksetzen</button></div>
    <div class="panel"><h3 style="margin-top:0">Fehler gefunden?</h3><p class="small">Unter <a href="#/loesungen">Alle Lösungen</a> stehen alle Fragen mit Lösungen untereinander. Dort kannst du zu jeder Frage eine Anmerkung schreiben und alle Anmerkungen als Textdatei speichern.</p></div>`;
  $("[data-exp]", m).addEventListener("click", () => { exportProgress(); $("[data-msg]", m).textContent = "Die Fortschrittsdatei wurde heruntergeladen."; });
  $("[data-imp]", m).addEventListener("change", e => { const f = e.target.files[0]; if (!f) return; importProgress(f, ok => { if (ok) route(true); else $("[data-msg]", m).textContent = "Diese Datei passt nicht. Wähle die gesicherte Fortschrittsdatei."; }); });
  $("[data-reset]", m).addEventListener("click", () => { if (confirm("Wirklich alle Resultate löschen?")){ S = {q:{}, c:{}, w:{}, rev:S.rev || {}, theme:S.theme}; save(); route(true); } });
};


/* ---------- Gegenlesen ---------- */
function solHtml(q){
  if (q.t === "mc") return `<ul class="sol-opts">${q.o.map((o, i) => `<li class="${q.a.includes(i) ? "ok" : ""}">${q.a.includes(i) ? "✓ " : ""}${esc(o)}</li>`).join("")}</ul>${q.why ? `<p class="small muted">Erklärung: ${esc(q.why)}</p>` : ""}`;
  if (q.t === "order") return `<ol class="sol-ord">${q.items.map(i => `<li>${esc(i)}</li>`).join("")}</ol>`;
  if (q.t === "match") return `<table class="tbl">${q.pairs.map(p => `<tr><td>${esc(p[0])}</td><td>${esc(p[1])}</td></tr>`).join("")}</table>`;
  if (q.t === "gap"){ const defs = []; const t = esc(q.text).replace(/\{\{(.+?)\}\}/g, (m, g) => { const [a0, d] = g.split("::"); const a = a0.split("|"); defs.push([a[0], d || ""]); return `<b>(${defs.length}) ${esc(a[0])}</b>${a.length > 1 ? `<span class="muted small"> (auch: ${a.slice(1).map(esc).join(", ")})</span>` : ""}`; });
    return `<p class="gapsol">${t}</p><ol class="small">${defs.map(d => `<li>${esc(d[0])}: ${esc(d[1])}</li>`).join("")}</ol>`; }
  if (q.t === "tf") return `<ul class="sol-opts">${q.items.map(it => `<li class="ok">${it.r ? "R" : "F"}: ${esc(it.s)}${it.why ? `<span class="muted small"> (${esc(it.why)})</span>` : ""}</li>`).join("")}</ul>`;
  if (q.t === "term") return `<table class="tbl">${q.items.map(it => `<tr><td>${esc(it.d)}</td><td><b>${esc(it.a[0])}</b>${it.a.length > 1 ? `<span class="muted small"> (auch: ${it.a.slice(1).map(esc).join(", ")})</span>` : ""}</td></tr>`).join("")}</table>`;
  if (q.t === "open") return (q.case ? `<p class="small"><b>Fall:</b> ${esc(q.case)}</p>` : "") + `<div class="model"><b>Musterlösung</b>${esc(q.model)}</div><p class="small"><b>Checkliste (${q.p} P.):</b></p><ul class="small">${q.checks.map(c => `<li>${esc(c)}</li>`).join("")}</ul>${q.pit ? `<div class="pit">${esc(q.pit)}</div>` : ""}`;
  return "";
}
P.loesungen = (m) => {
  const items = []; const reg = (id, label, body, extra) => { items.push({id, label}); const r = S.rev[id] || {};
    return `<div class="sol-item ${r.ok ? "ok" : ""}" data-item="${id}"><div class="sol-h"><span class="sol-id">${id}</span><span>${esc(label)}</span></div>${extra || ""}${body}
      <div class="rv noprint"><label class="small"><input type="checkbox" data-ok="${id}" ${r.ok ? "checked" : ""}> geprüft</label><input class="rvnote" data-note="${id}" placeholder="Fehler oder Anmerkung" value="${esc(r.note || "")}"></div></div>`; };
  let html = `<h1>Alle Lösungen</h1><p class="lead">Zum Gegenlesen: Alle Fragen${D.sources.length ? ", Quellen" : ""} und Karteikarten mit Lösungen. Hake ab, was stimmt, und schreib bei Fehlern eine Anmerkung. Die Anmerkungen lassen sich am Schluss als Textdatei speichern und weitergeben.</p>
    <div class="scorebox noprint"><span data-cnt></span><span class="row"><button class="btn sec small" data-txt style="background:var(--surface);color:var(--ink)">Anmerkungen als Textdatei speichern</button><button class="btn sec small" data-print style="background:var(--surface);color:var(--ink)">Drucken</button></span></div>
    <p class="small noprint">Springen zu: ${D.lz.map(l => `<a href="#lz${l.id}" data-jump>Lernziel ${l.id}</a>`).join(", ")}${D.sources.length ? `, <a href="#qq" data-jump>Quellen</a>` : ""}, <a href="#kk" data-jump>Karteikarten</a></p>`;
  D.lz.forEach(l => { html += `<h2 id="lz${l.id}">Lernziel ${l.id}: ${esc(l.title)}</h2>`;
    D.questions.filter(q => q.lz === l.id).forEach(q => { html += reg(q.id, `LZ ${l.id}, ${qLabel(q)}${q.beg ? ", Begriff" : ""}${q.grp ? " (" + q.grp + ")" : ""}: ${q.q}`, solHtml(q), `<p class="sol-q">${esc(q.q)}</p>`); }); });
  if (D.sources.length) html += `<h2 id="qq">Quellenwerkstatt</h2>`;
  D.sources.forEach(sr => { let body = `<p class="small muted">${esc(sr.meta)}</p>`;
    if (D.aqua) body += `<p class="small"><b>A-Q-U-A:</b></p><ul class="small">${D.aqua.steps.map((st, i) => `<li><b>${st.n}:</b> ${esc(sr.aqua[i])}</li>`).join("")}</ul>`;
    html += reg("src_" + sr.id, `Quelle: ${sr.title}`, body, `<h3 style="margin:4px 0 6px">${esc(sr.title)}</h3>`);
    if (sr.a) html += reg(sr.a.id, `Quelle ${sr.title}, Teil A: ${sr.a.q}`, solHtml(sr.a), `<p class="sol-q">${esc(sr.a.q)}</p>`);
    sr.qs.forEach(q => { html += reg(q.id, `Quelle ${sr.title}, Frage: ${q.q}`, solHtml(q), `<p class="sol-q">${esc(q.q)}</p>`); }); });
  html += `<h2 id="kk">Karteikarten</h2>`;
  D.cards.forEach(c => { html += reg(c.id, `Karte LZ ${c.lz}: ${c.f}`, `<p>${esc(c.b)}</p>`, `<p class="sol-q">${esc(c.f)}</p>`); });
  m.innerHTML = html;
  const cnt = () => { const n = items.filter(i => S.rev[i.id] && S.rev[i.id].ok).length, k = items.filter(i => S.rev[i.id] && S.rev[i.id].note).length; $("[data-cnt]", m).textContent = `${n} von ${items.length} geprüft, ${k} Anmerkungen`; };
  const upd = (id, f) => { S.rev[id] = Object.assign({}, S.rev[id], f); save(); cnt(); };
  $$("[data-ok]", m).forEach(c => c.addEventListener("change", () => { upd(c.dataset.ok, {ok:c.checked}); c.closest(".sol-item").classList.toggle("ok", c.checked); }));
  $$("[data-note]", m).forEach(t => t.addEventListener("input", () => upd(t.dataset.note, {note:t.value})));
  $$("[data-jump]", m).forEach(a => a.addEventListener("click", e => { e.preventDefault(); const t = document.getElementById(a.getAttribute("href").slice(1)); if (t) t.scrollIntoView({behavior:"smooth"}); }));
  $("[data-print]", m).addEventListener("click", () => window.print());
  $("[data-txt]", m).addEventListener("click", () => { const notes = items.filter(i => S.rev[i.id] && S.rev[i.id].note && S.rev[i.id].note.trim());
    const n = items.filter(i => S.rev[i.id] && S.rev[i.id].ok).length;
    const txt = `Anmerkungen zur Lernplattform ${D.meta.title} (${new Date().toLocaleDateString("de-CH")})\n${n} von ${items.length} Einträgen geprüft, ${notes.length} Anmerkungen.\n\n` + notes.map(i => `[${i.id}] ${i.label}\nAnmerkung: ${S.rev[i.id].note.trim()}\n`).join("\n");
    const b = new Blob([txt], {type:"text/plain;charset=utf-8"}); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "anmerkungen-geschichte.txt"; document.body.appendChild(a); a.click(); a.remove(); });
  cnt();
};

/* ---------- Übungen (Widgets) ---------- */
const W = {};
W.zeitstrahl = (el) => {
  const T = D.timeline, span = T.to - T.from, pos = y => (y - T.from) / span * 100;
  const draw = () => {
    const evs = shuffle(T.events.map((e, i) => Object.assign({i}, e))); const tries = {};
    el.innerHTML = `<h3>${esc(T.title || "Zeitstrahl")}</h3><p class="wsub">${esc(T.sub || "Ziehe jedes Ereignis in die richtige Epoche. Du kannst auch zuerst ein Ereignis und dann eine Epoche anklicken.")}</p>
      <div class="axis">${T.epochs.map(e => `<div class="seg" style="left:${pos(e.from)}%;width:${pos(e.to) - pos(e.from)}%;background:${e.c}" title="${esc(e.name)}"></div>`).join("")}${(T.ticks || [1790,1800,1810,1820,1830,1840,1850]).map(y => `<span class="tick" style="left:${pos(y)}%">${y}</span>`).join("")}</div>
      <div class="cols">${T.epochs.map(e => `<div class="col target" data-ep="${e.id}"><div class="ch" style="background:${e.c}">${esc(e.name)}<small>${e.from === T.from ? "bis " + e.to : e.to === T.to ? "ab " + e.from : e.from + "–" + e.to}</small></div></div>`).join("")}</div>
      <div class="tray">${evs.map(e => `<span class="chip" draggable="true" data-i="${e.i}">${esc(e.t)}</span>`).join("")}</div><div class="wmsg"></div>
      <div class="actions"><button class="btn sec small" data-reset>Neu mischen</button></div>`;
    let sel = null; const msg = $(".wmsg", el);
    const place = (i, ep, chip) => { const e = T.events[i]; if (e.ep !== ep){ tries[i] = (tries[i] || 0) + 1; chip.classList.remove("shake"); void chip.offsetWidth; chip.classList.add("shake");
        msg.textContent = tries[i] >= 2 ? (T.unit ? `Tipp: etwa ${String(e.y).replace(".", ",")} ${T.unit}.` : `Tipp: Das Ereignis war ${e.y}.`) : "Passt hier nicht. Versuch es nochmals."; return; }
      chip.remove(); sel = null; const col = $(`.col[data-ep="${ep}"]`, el);
      const items = $$(".placed", col); const n = document.createElement("div"); n.className = "placed"; n.dataset.y = e.y; n.innerHTML = T.unit ? esc(e.t) : `<b>${e.y}</b>${esc(e.t)}`;
      const after = items.find(p => +p.dataset.y > e.y); if (after) col.insertBefore(n, after); else col.appendChild(n);
      $(".axis", el).insertAdjacentHTML("beforeend", `<span class="pin" style="left:${pos(e.y)}%" data-l="${e.y}: ${esc(e.t)}"></span>`);
      const left = $$(".tray .chip", el).length; msg.textContent = left ? `Richtig. Noch ${left} Ereignisse.` : (TOUCH ? "Alle Ereignisse sind am richtigen Ort. Tippe auf die Punkte auf dem Zeitstrahl." : "Alle Ereignisse sind am richtigen Ort. Fahre mit der Maus über die Punkte auf dem Zeitstrahl.");
      if (!left){ S.w.zeitstrahl = true; save(); } };
    $$(".chip", el).forEach(c => { c.addEventListener("dragstart", ev => { ev.dataTransfer.setData("text/plain", c.dataset.i); });
      c.addEventListener("click", () => { $$(".chip", el).forEach(x => x.classList.remove("sel")); sel = c; c.classList.add("sel"); msg.textContent = "Jetzt die passende Epoche anklicken."; }); });
    $$(".col", el).forEach(col => { col.addEventListener("dragover", ev => { ev.preventDefault(); col.classList.add("over"); }); col.addEventListener("dragleave", () => col.classList.remove("over"));
      col.addEventListener("drop", ev => { ev.preventDefault(); col.classList.remove("over"); const i = ev.dataTransfer.getData("text/plain"); const chip = $(`.chip[data-i="${i}"]`, el); if (chip) place(+i, col.dataset.ep, chip); });
      col.addEventListener("click", () => { if (sel) place(+sel.dataset.i, col.dataset.ep, sel); }); });
    $("[data-reset]", el).addEventListener("click", draw);
  };
  draw();
};

W.kreislauf = (el) => {
  let cur = 0;
  const draw = () => { const L = D.loops[cur]; const N = L.nodes.length; const C = 190, R = 118;
    const ang = k => (-90 + k * 360 / N) * Math.PI / 180; const pt = (k, r) => [C + r * Math.cos(ang(k)), C + r * Math.sin(ang(k))];
    const arcs = L.nodes.map((_, k) => { const a1 = ang(k) + .38, a2 = ang(k + 1) - .38; const p1 = [C + R * Math.cos(a1), C + R * Math.sin(a1)], p2 = [C + R * Math.cos(a2), C + R * Math.sin(a2)];
      return `<path class="arc" marker-end="url(#ah${cur})" d="M${p1[0].toFixed(1)},${p1[1].toFixed(1)} A${R},${R} 0 0 1 ${p2[0].toFixed(1)},${p2[1].toFixed(1)}"/>`; }).join("");
    el.innerHTML = `<h3>Kreislauf bauen</h3><p class="wsub">Ein Startpunkt ist gesetzt. Klicke die Karten in der Reihenfolge an, in der eins zum anderen führt.</p>
      <div class="tabs">${D.loops.map((l, i) => `<button class="${i === cur ? "on" : ""}" data-t="${i}">${esc(l.title)}</button>`).join("")}</div>
      <div class="loopwrap"><div class="ring" style="width:${2*C}px;height:${2*C}px"><svg viewBox="0 0 ${2*C} ${2*C}"><defs><marker id="ah${cur}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--ind)"/></marker></defs>${arcs}</svg>
      ${L.nodes.map((n, k) => { const p = pt(k, R + 8); return `<div class="slot ${k === 0 ? "filled" : ""}" data-s="${k}" style="left:${p[0]}px;top:${p[1]}px">${k === 0 ? esc(n) : "?"}</div>`; }).join("")}</div>
      <div><div class="cards-pick">${shuffle(L.nodes.slice(1).map((n, i) => ({n, k:i + 1}))).map(o => `<button data-k="${o.k}">${esc(o.n)}</button>`).join("")}</div><div class="wmsg"></div></div></div>`;
    let next = 1; const msg = $(".wmsg", el);
    $$(".tabs button", el).forEach(b => b.addEventListener("click", () => { cur = +b.dataset.t; draw(); }));
    $$(".cards-pick button", el).forEach(b => b.addEventListener("click", () => { const k = +b.dataset.k;
      if (k !== next){ b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake"); msg.textContent = "Was folgt direkt aus dem letzten Feld?"; return; }
      const s = $(`.slot[data-s="${k}"]`, el); s.textContent = L.nodes[k]; s.classList.add("filled"); b.remove(); next++;
      if (next >= N){ $(".ring", el).classList.add("closed"); msg.innerHTML = `<div class="fb ok"><b>Der Kreis ist geschlossen.</b>${esc(L.done)}</div>`; S.w["loop_" + L.id] = true; save(); }
      else msg.textContent = "Richtig. Was folgt daraus?"; })); };
  draw();
};

W.engpass = (el) => {
  let k = 0; const log = [];
  const draw = () => { const E = D.engpass;
    if (k >= E.length){ el.innerHTML = `<h3>Engpass-Spiel</h3><div class="eng-step">${E.map(() => `<i class="on"></i>`).join("")}</div><div class="fb ok"><b>Alle Engpässe gelöst.</b>So entstand aus einer Kette von Problemen und Erfindungen die Fabrik.</div><ul class="eng-log">${log.map(l => `<li>${esc(l)}</li>`).join("")}</ul><div class="actions"><button class="btn sec small" data-r>Nochmals spielen</button></div>`;
      $("[data-r]", el).addEventListener("click", () => { k = 0; log.length = 0; draw(); }); S.w.engpass = true; save(); return; }
    const s = E[k]; const opts = shuffle(s.o.map((t, i) => ({t, i})));
    el.innerHTML = `<h3>Engpass-Spiel</h3><p class="wsub">Jede Erfindung löst ein Problem und schafft ein neues. Wähle die Erfindung, die den Engpass löst.</p>
      <div class="eng-step">${E.map((_, i) => `<i class="${i < k ? "on" : ""}"></i>`).join("")}</div><p class="eng-p">${esc(s.p)}</p>
      <div class="eng-o">${opts.map(o => `<button data-i="${o.i}">${esc(o.t)}</button>`).join("")}</div><div class="wmsg"></div><ul class="eng-log">${log.map(l => `<li>${esc(l)}</li>`).join("")}</ul>`;
    $$(".eng-o button", el).forEach(b => b.addEventListener("click", () => { if (+b.dataset.i !== s.a){ b.classList.add("no"); $(".wmsg", el).textContent = "Das löst dieses Problem nicht. Lies das Problem nochmals genau."; return; }
      b.classList.add("yes"); log.push(s.after); setTimeout(() => { k++; draw(); }, 450); })); };
  draw();
};

W.stecknadel = (el) => {
  const dots = n => `<svg width="${n * 16}" height="16" aria-hidden="true">${Array.from({length:n}, (_, i) => `<circle cx="${i * 16 + 8}" cy="8" r="6" fill="currentColor"/>`).join("")}</svg>`;
  el.innerHTML = `<h3>Smiths Stecknadel-Vergleich</h3><p class="wsub">Was bringt Arbeitsteilung? Starte einen Arbeitstag (Quelle 3).</p>
    <div class="pins"><div class="box"><div class="people">${dots(1)}</div><div class="who">1 ungelernter Arbeiter, macht alles selbst</div><div class="big" data-a>0</div><div class="who">Nadeln pro Tag (höchstens)</div></div>
    <div class="box"><div class="people">${dots(10)}</div><div class="who">10 Arbeiter, teilen sich 18 Arbeitsgänge</div><div class="big" data-b>0</div><div class="who">Nadeln pro Tag, <span data-c>…</span> pro Person</div></div></div>
    <div class="actions"><button class="btn" data-go>Arbeitstag starten</button></div><div class="wmsg"></div>`;
  $("[data-go]", el).addEventListener("click", () => { const A = $("[data-a]", el), B = $("[data-b]", el); const red = matchMedia("(prefers-reduced-motion: reduce)").matches; const t0 = performance.now(), dur = red ? 1 : 2600;
    const f = t => { const p = Math.min(1, (t - t0) / dur); A.textContent = Math.round(20 * p); B.textContent = Math.round(48000 * p).toLocaleString("de-CH"); if (p < 1) requestAnimationFrame(f);
      else { $("[data-c]", el).textContent = "4800"; $(".wmsg", el).innerHTML = `<div class="fb ok"><b>Etwa 240-mal produktiver pro Person.</b>Arbeitsteilung steigert die Produktivität enorm. Genau dieses Prinzip übernahmen die Fabriken.</div>`; S.w.stecknadel = true; save(); } };
    requestAnimationFrame(f); });
};

W.mehrwert = (el) => {
  const DAY = 14;
  el.innerHTML = `<h3>Mehrwert sichtbar machen</h3><p class="wsub">Veranschaulichung mit frei gewählten Zahlen: ein Arbeitstag von 14 Stunden, wie in Textilfabriken um 1855.</p>
    <label class="small" for="mwr">Wie viele Stunden braucht der Arbeiter, um den Wert seines Lohns zu erarbeiten?</label><input type="range" id="mwr" min="3" max="12" value="6">
    <div class="mw-bar"><div class="mw-l"></div><div class="mw-m"></div></div><p class="mwt"></p>`;
  const r = $("#mwr", el);
  const upd = () => { const l = +r.value, mw = DAY - l; $(".mw-l", el).style.flex = l; $(".mw-m", el).style.flex = mw; $(".mw-l", el).textContent = `Lohn: ${l} h`; $(".mw-m", el).textContent = `Mehrwert: ${mw} h`;
    $(".mwt", el).innerHTML = `Der Arbeiter bekommt den Wert von ${l} Stunden als Lohn. In den übrigen <b>${mw} Stunden</b> schafft er Wert, den sich laut Marx der Unternehmer als Besitzer der Produktionsmittel aneignet. Für Marx ist das <b>Ausbeutung</b>. Je mehr Maschinen den Anteil menschlicher Arbeit senken, desto mehr muss der Unternehmer produzieren, um Mehrwert zu erzielen.`; };
  r.addEventListener("input", upd); upd();
};

W.staatsform = (el) => {
  const F = D.staatsform; let cur = 0;
  const lbl = {organ:"Gemeinsame Einrichtung", entscheid:"Wie wird entschieden?", kantone:"Die Kantone", rechte:"Rechte der Menschen", aussen:"Einfluss von aussen"};
  const svg = f => { const W0 = 640, H0 = 250; const t = (x, y, s, o) => `<text x="${x}" y="${y}" text-anchor="${(o && o.a) || "middle"}" font-size="${(o && o.fs) || 13}" font-weight="${(o && o.fw) || 400}" fill="${(o && o.c) || "var(--ink)"}" font-family="system-ui,sans-serif">${esc(s)}</text>`;
    let s = `<svg class="sf-svg" viewBox="0 0 ${W0} ${H0}" role="img" aria-label="${esc(f.form)}">`;
    const grid = (n, x0, y0, w, h, rows) => { const cols = Math.ceil(n / rows); const out = []; for (let i = 0; i < n; i++){ const c = i % cols, r = Math.floor(i / cols); out.push([x0 + (c + .5) * w / cols, y0 + (r + .5) * h / rows]); } return out; };
    if (f.mode === "einheit"){
      s += `<rect x="220" y="10" width="200" height="34" rx="6" fill="var(--ink)"/>` + t(320, 32, f.top, {c:"var(--surface)", fw:600});
      s += `<line x1="320" y1="44" x2="320" y2="70" stroke="var(--ink)" stroke-width="2.5" marker-end="url(#sfa)"/>` + t(330, 62, "bestimmt alles", {a:"start", fs:11, c:"var(--muted)"});
      s += `<rect x="70" y="74" width="500" height="150" rx="12" fill="var(--ch-soft)" stroke="var(--ch)" stroke-width="3"/>`;
      grid(f.n, 80, 84, 480, 130, 3).forEach(p => s += `<rect x="${p[0] - 22}" y="${p[1] - 15}" width="44" height="30" rx="3" fill="var(--surface)" stroke="var(--ch)" stroke-opacity=".45"/>`);
      s += t(320, 242, "Kasten = ein einziger Staat, kleine Felder = Kantone als Verwaltungsbezirke", {fs:11, c:"var(--muted)"});
    } else if (f.mode === "staat"){
      s += `<rect x="40" y="8" width="560" height="216" rx="16" fill="var(--ind-soft)" stroke="var(--ind)" stroke-width="3"/>` + t(58, 28, "Bund (gemeinsamer Staat)", {a:"start", fs:12, fw:600, c:"var(--ind)"});
      s += `<rect x="170" y="38" width="300" height="32" rx="6" fill="var(--ink)"/>` + t(320, 59, f.top, {c:"var(--surface)", fw:600, fs:12});
      grid(f.n, 70, 82, 500, 132, 2).forEach(p => s += `<circle cx="${p[0]}" cy="${p[1]}" r="17" fill="var(--surface)" stroke="var(--ind)" stroke-width="2.5"/>`);
      s += t(320, 242, "Grosser Kasten = Bund, Kreise = Kantone, die innerhalb des Bundes weiter bestehen", {fs:11, c:"var(--muted)"});
    } else {
      s += `<rect x="245" y="10" width="150" height="32" rx="6" fill="var(--surface)" stroke="var(--ink)" stroke-width="2"/>` + t(320, 31, f.top, {fw:600, fs:12});
      const pts = grid(f.n, 30, 78, 580, 140, 2);
      pts.forEach(p => { s += `<line x1="${p[0]}" y1="${p[1] - 17}" x2="320" y2="42" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 4"/>`; });
      pts.forEach((p, i) => { let fill = "var(--surface)", st = "var(--ink)";
        if (f.mode === "reg"){ const lib = i < 14; fill = lib ? "var(--ok-soft)" : "var(--ch-soft)"; st = lib ? "var(--ok)" : "var(--ch)"; }
        s += `<circle cx="${p[0]}" cy="${p[1]}" r="16" fill="${fill}" stroke="${st}" stroke-width="2.5"/>`; });
      s += f.mode === "reg" ? t(320, 242, "grün: liberale, regenerierte Kantone; rot: konservative Kantone", {fs:11, c:"var(--muted)"})
                            : t(320, 242, "Kreise = eigenständige Kantone; gestrichelt = sie schicken nur Gesandte, kein gemeinsamer Staat", {fs:11, c:"var(--muted)"});
    }
    return s.replace("<svg ", `<svg `) + `<defs><marker id="sfa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--ink)"/></marker></defs></svg>`; };
  const draw = () => { const f = F[cur];
    el.innerHTML = `<h3>Staatsform im Wandel</h3><p class="wsub">Klicke dich durch die Epochen. Achte darauf, wo die Macht liegt: bei den einzelnen Kantonen oder bei einem gemeinsamen Staat.</p>
      <div class="tabs sf-tabs">${F.map((x, i) => `<button class="${i === cur ? "on" : ""}" data-i="${i}">${esc(x.name)}<br><small>${esc(x.zeit)}</small></button>`).join("")}</div>
      <h4 class="sf-h">${esc(f.name)}, ${esc(f.zeit)}: ${esc(f.form)}</h4><p class="sf-cap">${esc(f.cap)}</p>
      <div class="meter"><div class="meter-l"><span>Macht bei den Kantonen</span><span>Macht beim Zentralstaat</span></div><div class="meter-t"><i style="left:${f.macht}%"></i></div><p class="small muted">Grobe Einordnung zur Orientierung, abgeleitet aus dem Skript.</p></div>
      ${svg(f)}
      <table class="tbl sf-tbl">${Object.keys(lbl).map(k => `<tr><th>${lbl[k]}</th><td>${esc(f.f[k])}</td></tr>`).join("")}</table>
      <div class="actions"><button class="btn sec small" data-p ${cur === 0 ? "disabled" : ""}>Vorherige Epoche</button><button class="btn small" data-n ${cur === F.length - 1 ? "disabled" : ""}>Nächste Epoche</button></div>`;
    $$(".sf-tabs button", el).forEach(b => b.addEventListener("click", () => { cur = +b.dataset.i; draw(); }));
    $("[data-p]", el).addEventListener("click", () => { cur--; draw(); }); $("[data-n]", el).addEventListener("click", () => { cur++; draw(); }); };
  draw();
};

W.prognose = (el) => {
  const Dq = D.q6;
  el.innerHTML = `<h3>Erst schätzen, dann aufdecken</h3><p class="wsub">Quelle 6: Anteil an der Weltindustrieproduktion. Welches Land hatte im Jahr 1900 den grössten Anteil?</p>
    <div class="eng-o">${shuffle(["Vereinigtes Königreich","USA","Deutschland","China"]).map(n => `<button data-n="${esc(n)}">${esc(n)}</button>`).join("")}</div><div class="wmsg"></div><div class="chart"></div>`;
  $$(".eng-o button", el).forEach(b => b.addEventListener("click", () => { $$(".eng-o button", el).forEach(x => x.disabled = true); const ok = b.dataset.n === "USA"; b.classList.add(ok ? "yes" : "no");
    if (!ok) $(`.eng-o button[data-n="USA"]`, el).classList.add("yes");
    $(".wmsg", el).innerHTML = `<div class="fb ${ok ? "ok" : "no"}"><b>${ok ? "Richtig geschätzt." : "Überraschend, oder?"}</b>1900 lagen die USA mit 23,6 % vorne. Grossbritannien erreichte um 1880 seinen Höhepunkt (22,9 %). China fiel von 29,8 % (1830) auf 3,6 % (1913).</div>`;
    const W0 = 640, H0 = 300, L = 46, Rr = 150, T = 16, B = 34, xs = y => L + (y - 1830) / (1913 - 1830) * (W0 - L - Rr), ys = v => T + (1 - v / 35) * (H0 - T - B);
    let s = `<svg viewBox="0 0 ${W0} ${H0}" role="img" aria-label="Liniendiagramm Quelle 6">`;
    [0,10,20,30].forEach(v => s += `<line x1="${L}" x2="${W0 - Rr}" y1="${ys(v)}" y2="${ys(v)}" stroke="var(--line)"/><text x="${L - 8}" y="${ys(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="system-ui">${v} %</text>`);
    Dq.years.forEach(y => s += `<text x="${xs(y)}" y="${H0 - 12}" text-anchor="middle" font-size="11" fill="var(--muted)" font-family="system-ui">${y}</text>`);
    Dq.series.forEach(se => { s += `<polyline fill="none" stroke="${se.c}" stroke-width="3" points="${se.v.map((v, i) => xs(Dq.years[i]) + "," + ys(v)).join(" ")}"/>`;
      se.v.forEach((v, i) => s += `<circle cx="${xs(Dq.years[i])}" cy="${ys(v)}" r="4" fill="${se.c}"><title>${esc(se.n)} ${Dq.years[i]}: ${String(v).replace(".", ",")} %</title></circle>`);
      s += `<text x="${xs(1913) + 8}" y="${ys(se.v[4]) + 4}" font-size="12" fill="${se.c}" font-family="system-ui" font-weight="600">${esc(se.n)}</text>`; });
    $(".chart", el).innerHTML = s + `</svg><p class="small muted">Auszug aus Quelle 6 (Skript I-15). Fahre über die Punkte für genaue Werte.</p>`; }));
};

W.kette = (el, o) => { o = o || {q:"q12a", t:"Ereigniskette zum Sonderbundskrieg", s:"Bringe die Eskalation in die richtige Reihenfolge. Wer die Kette versteht, kann den Sonderbundskrieg erklären."}; const q = D.questions.find(x => x.id === o.q);
  el.innerHTML = `<h3>${esc(o.t)}</h3><p class="wsub">${esc(o.s)}</p>`;
  const c = Q(q, {}); c.el.style.border = "0"; c.el.style.padding = "0"; c.el.style.margin = "0"; el.appendChild(c.el); };

/* ---------- Übersicht aller Module ---------- */
function overview(m){
  document.title = "Lernplattform";
  $(".side").innerHTML = `<div class="brand">Lernplattform<small>BMS Gesundheit und Soziales</small></div><nav class="nav">${MODS.map(x => `<a href="#/${x.id}" data-abs><i class="ico i-learn"></i>${esc(x.subject || x.title)}</a>`).join("")}</nav>
    <div class="foot"><button class="themebtn" data-themebtn>Darstellung: ${{auto:"automatisch", light:"hell", dark:"dunkel"}[THEME]}</button>${LOCK ? `<button class="themebtn" data-logout>Abmelden</button>` : ""}</div>`;
  $("[data-themebtn]", $(".side")).addEventListener("click", () => { THEME = {auto:"light", light:"dark", dark:"auto"}[THEME]; try { localStorage.setItem(THEME_KEY, THEME); } catch(e){} applyTheme(); overview(m); });
  chrome("");
  const today = new Date(); today.setHours(0,0,0,0);
  m.innerHTML = `<section class="hero"><h1>Lernplattform</h1><p class="lead">Wähle die Prüfung, für die du lernen willst. Jedes Modul speichert deinen Fortschritt separat.</p></section>
    <div class="modgrid">${MODS.map(x => { const d = Math.round((new Date(x.examDate + "T00:00:00") - today) / 864e5);
      const dt = d > 1 ? `noch ${d} Tage` : d === 1 ? "morgen" : d === 0 ? "heute" : "vorbei";
      return `<a class="modcard ${d < 0 ? "past" : ""}" href="#/${x.id}" data-abs>${x.subject && x.subject !== x.title || x.test ? `<span class="tag2">${x.subject && x.subject !== x.title ? esc(x.title) : ""}${x.test ? ` <i class="testflag">In Testphase</i>` : ""}</span>` : ""}<b>${esc(x.subject || x.title)}</b><span>${esc(x.subtitle || "")}</span><em>${esc(x.examLabel)} · ${dt}</em></a>`; }).join("")}</div>`;
}

/* ---------- Router ---------- */
let routing = 0;
/* Schutz vor versehentlichem Verlassen: Seiten mit ungesicherten Eingaben setzen GUARD = {on:() => bool, msg}. */
let GUARD = null, HERE = location.hash;
window.addEventListener("beforeunload", e => { if (GUARD && GUARD.on()){ e.preventDefault(); e.returnValue = ""; } });
async function route(force){
  if (GUARD && GUARD.on() && !confirm(GUARD.msg)){ if (location.hash !== HERE) history.pushState(null, "", HERE || "#/"); return; }
  GUARD = null; HERE = location.hash;
  const my = ++routing; menu(false); const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean); const m = $("main");
  if (LOCK && !CKEY){ if (!triedRestore){ triedRestore = true; if (await restoreKey()) return route(force); } login(m); return; }
  document.body.classList.remove("locked");
  if (!parts.length || !MODS.find(x => x.id === parts[0])){
    if (parts.length && CUR && P[parts[0]]){ location.replace("#/" + CUR + "/" + parts.join("/")); return; }
    CUR = null; m.className = ""; overview(m); count("/", "Übersicht"); window.scrollTo(0, 0); return; }
  const id = parts[0];
  if (CUR !== id){ m.innerHTML = `<p class="muted">Modul wird geladen …</p>`;
    try { await loadModule(id); } catch(e){ m.innerHTML = `<div class="panel"><h2 style="margin-top:0">Modul konnte nicht geladen werden</h2><p>Die Datei «modules/${esc(id)}/content.js» fehlt oder ist fehlerhaft.</p><p><a href="#/" data-abs>Zurück zur Übersicht</a></p></div>`; return; }
    if (my !== routing) return; activate(id); }
  const page = parts[1] || "start", arg = parts[2], arg2 = parts[3]; m.className = ""; m.innerHTML = "";
  const act = page === "lz" ? "lz" + arg : page === "ueben" ? "lz" + arg : page === "quelle" ? "quellen" : page;
  (P[page] || P.start)(m, arg, arg2); nav(act); count("/" + id + "/" + page + (page === "lz" || page === "ueben" ? "/" + arg : ""), (D.meta.title || id) + ": " + page + (arg && (page === "lz" || page === "ueben") ? " " + arg : "")); if (!force || force === true) window.scrollTo(0, 0); m.focus({preventScroll:true});
}
document.addEventListener("click", e => { const a = e.target.closest('a[href^="#/"]'); if (!a || a.hasAttribute("data-abs") || !CUR) return; const h = a.getAttribute("href");
  if (h.startsWith("#/" + CUR + "/") || h === "#/" + CUR) return; e.preventDefault(); goHash(h); });
/* «Nach oben»-Knopf für lange Seiten (z. B. Gesamte Theorie) */
function topBtn(){ const b = document.createElement("button"); b.type = "button"; b.className = "totop"; b.hidden = true; b.setAttribute("aria-label", "Nach oben");
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14l6-6 6 6"/></svg><span>Nach oben</span>`; document.body.appendChild(b);
  b.addEventListener("click", () => window.scrollTo({top:0, behavior:"smooth"}));
  const upd = () => { b.hidden = window.scrollY < 1200 || !!$(".mixsum") || document.body.classList.contains("locked"); };
  window.addEventListener("scroll", upd, {passive:true}); window.addEventListener("hashchange", () => setTimeout(upd, 50)); }
document.addEventListener("DOMContentLoaded", () => { applyTheme(); topBtn(); window.addEventListener("hashchange", () => route()); route(); });
})();

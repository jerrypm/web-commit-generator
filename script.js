/* =====================================================================
   Commit — Git Commit Message Generator
   script.js — rule-based generation engine + UI wiring (vanilla JS)

   No frameworks, no network. The "intelligence" is a deterministic
   rule engine: it normalizes wording, infers type/scope, rewrites the
   description into an imperative Conventional-Commit subject, scores
   quality, and produces alternative phrasings.
   ===================================================================== */
(function () {
  "use strict";

  /* ===================================================================
     1. DATA — commit types & scope vocabulary
     =================================================================== */
  const TYPES = [
    { key: "feat",     label: "feat",     color: "#3fb950", desc: "A new feature" },
    { key: "fix",      label: "fix",      color: "#f0616d", desc: "A bug fix" },
    { key: "refactor", label: "refactor", color: "#5b6cff", desc: "Code change that neither fixes a bug nor adds a feature" },
    { key: "docs",     label: "docs",     color: "#7c8cff", desc: "Documentation only changes" },
    { key: "style",    label: "style",    color: "#b07cff", desc: "Formatting — whitespace, semicolons, etc. (no logic change)" },
    { key: "test",     label: "test",     color: "#2dd4bf", desc: "Adding or correcting tests" },
    { key: "chore",    label: "chore",    color: "#8b8f9a", desc: "Maintenance, tooling, or housekeeping" },
    { key: "perf",     label: "perf",     color: "#d29922", desc: "A code change that improves performance" },
    { key: "build",    label: "build",    color: "#e0823d", desc: "Build system or external dependency changes" },
    { key: "ci",       label: "ci",       color: "#22b8cf", desc: "CI configuration and scripts" },
    { key: "revert",   label: "revert",   color: "#f0616d", desc: "Reverts a previous commit" }
  ];

  const SCOPE_SUGGESTIONS = ["auth", "profile", "payment", "api", "ui", "settings"];

  // Keyword → type inference. Order matters: earlier = stronger signal.
  const TYPE_SIGNALS = [
    { type: "revert",   words: ["revert", "rollback", "undo", "roll back"] },
    { type: "perf",     words: ["perf", "performance", "optimize", "optimise", "faster", "speed up", "speed", "cache", "memoize", "lazy load", "debounce"] },
    { type: "test",     words: ["test", "tests", "spec", "coverage", "unit test", "e2e", "mock"] },
    { type: "docs",     words: ["docs", "doc", "documentation", "readme", "comment", "changelog", "javadoc", "jsdoc"] },
    { type: "ci",       words: ["ci", "pipeline", "workflow", "github action", "gitlab", "jenkins", "travis", "circleci"] },
    { type: "build",    words: ["build", "webpack", "rollup", "vite", "bundle", "compile", "dockerfile", "makefile", "gradle"] },
    { type: "style",    words: ["format", "formatting", "lint", "prettier", "eslint", "whitespace", "indent", "semicolon"] },
    { type: "chore",    words: ["chore", "bump", "dependency", "dependencies", "deps", "package", "config", "configure", "release", "version", "cleanup repo"] },
    { type: "fix",      words: ["fix", "bug", "crash", "error", "broken", "break", "fail", "resolve", "patch", "prevent", "issue", "regression", "incorrect", "wrong", "leak", "freeze", "hang", "npe", "null"] },
    { type: "refactor", words: ["refactor", "restructure", "simplify", "rename", "reorganize", "reorganise", "extract", "move", "split", "merge", "clean up", "decouple", "rewrite"] },
    { type: "feat",     words: ["add", "new", "create", "implement", "introduce", "support", "feature", "enable", "build out", "allow"] }
  ];

  // Keyword → scope inference (used only when scope toggle is on but empty,
  // shown as a *suggestion*, never forced).
  const SCOPE_SIGNALS = [
    { scope: "auth",      words: ["login", "logout", "log out", "sign in", "signin", "signup", "sign up", "auth", "password", "token", "session", "oauth", "biometric", "2fa"] },
    { scope: "profile",   words: ["profile", "avatar", "account", "bio", "username"] },
    { scope: "payment",   words: ["payment", "checkout", "billing", "invoice", "stripe", "subscription", "card", "refund"] },
    { scope: "api",       words: ["api", "endpoint", "request", "response", "fetch", "http", "rest", "graphql", "network", "networking"] },
    { scope: "settings",  words: ["setting", "settings", "preference", "preferences", "dark mode", "theme", "toggle", "config"] },
    { scope: "ui",        words: ["button", "color", "colour", "css", "layout", "style", "spacing", "modal", "dropdown", "icon", "animation", "responsive", "navbar", "header", "footer"] },
    { scope: "search",    words: ["search", "filter", "query", "autocomplete"] },
    { scope: "db",        words: ["database", "db", "migration", "schema", "query", "sql", "postgres", "mongo"] },
    { scope: "upload",    words: ["upload", "file", "image upload", "attachment"] }
  ];

  /* ===================================================================
     2. LANGUAGE HELPERS
     =================================================================== */

  // Filler / noise words to strip from the subject.
  const FILLER = new Set([
    "the", "a", "an", "some", "please", "just", "really", "very", "currently",
    "now", "actually", "basically", "simply", "also", "that", "which", "in order to",
    "kind of", "sort of", "stuff", "things", "thing", "etc"
  ]);

  // Words that are redundant right after specific types.
  const REDUNDANT_AFTER = {
    fix: ["bug", "bugs", "issue", "issues", "problem", "problems", "error", "errors"]
  };

  // Map past-tense / gerund / 3rd-person verbs to imperative present.
  const IMPERATIVE = {
    added: "add", adds: "add", adding: "add",
    fixed: "fix", fixes: "fix", fixing: "fix",
    removed: "remove", removes: "remove", removing: "remove",
    deleted: "delete", deletes: "delete", deleting: "delete",
    updated: "update", updates: "update", updating: "update",
    changed: "change", changes: "change", changing: "change",
    improved: "improve", improves: "improve", improving: "improve",
    created: "create", creates: "create", creating: "create",
    implemented: "implement", implements: "implement", implementing: "implement",
    refactored: "refactor", refactors: "refactor", refactoring: "refactor",
    resolved: "resolve", resolves: "resolve", resolving: "resolve",
    prevented: "prevent", prevents: "prevent", preventing: "prevent",
    handled: "handle", handles: "handle", handling: "handle",
    optimized: "optimize", optimised: "optimize", optimizing: "optimize",
    supported: "support", supports: "support", supporting: "support",
    introduced: "introduce", introduces: "introduce", introducing: "introduce",
    renamed: "rename", renames: "rename", renaming: "rename",
    moved: "move", moves: "move", moving: "move",
    simplified: "simplify", simplifies: "simplify", simplifying: "simplify",
    enabled: "enable", enables: "enable", enabling: "enable",
    disabled: "disable", disables: "disable", disabling: "disable",
    refreshed: "refresh", made: "add", makes: "add", making: "add"
  };

  // Known imperative verbs (used for detection + scoring).
  const KNOWN_VERBS = new Set([
    "add", "fix", "remove", "delete", "update", "change", "improve", "create",
    "implement", "refactor", "resolve", "prevent", "handle", "optimize", "support",
    "introduce", "rename", "move", "simplify", "enable", "disable", "refresh",
    "correct", "restructure", "streamline", "document", "clarify", "reduce",
    "speed", "revert", "restore", "replace", "migrate", "validate", "ensure",
    "avoid", "skip", "guard", "wrap", "extract", "split", "merge", "expose"
  ]);

  // Default + alternative verbs per type, used to construct/rephrase subjects.
  const TYPE_VERBS = {
    feat:     ["add", "introduce", "implement", "support", "enable"],
    fix:      ["fix", "resolve", "prevent", "handle", "correct"],
    refactor: ["refactor", "simplify", "restructure", "streamline", "rework"],
    docs:     ["document", "update", "add", "clarify"],
    style:    ["format", "tidy", "reformat", "clean up"],
    test:     ["add", "cover", "test", "verify"],
    chore:    ["update", "bump", "configure", "clean up"],
    perf:     ["optimize", "improve", "speed up", "reduce"],
    build:    ["update", "configure", "fix", "bump"],
    ci:       ["update", "fix", "add", "configure"],
    revert:   ["revert", "roll back", "undo"]
  };

  // Scope long-form ↔ short-form, used to generate alternatives.
  const SCOPE_ALIASES = {
    auth: "authentication", authentication: "auth",
    api: "networking", networking: "api",
    config: "configuration", configuration: "config",
    db: "database", database: "db",
    ui: "interface", app: "application",
    repo: "repository"
  };

  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  /* ===================================================================
     3. CORE ENGINE
     =================================================================== */

  /** Lowercase, strip punctuation noise, collapse whitespace. */
  function normalizeRaw(text) {
    return text
      .toLowerCase()
      .replace(/[`'"]/g, "")
      .replace(/[.!?]+\s*$/g, "")       // trailing punctuation
      .replace(/\s+/g, " ")
      .trim();
  }

  /** Detect the best-matching commit type from free text. */
  function detectType(text) {
    const t = " " + text + " ";
    for (const sig of TYPE_SIGNALS) {
      for (const w of sig.words) {
        if (t.includes(" " + w + " ") || t.includes(" " + w)) return sig.type;
      }
    }
    return null;
  }

  /** Suggest a scope from keywords (returns null if nothing obvious). */
  function detectScope(text) {
    const t = " " + text + " ";
    for (const sig of SCOPE_SIGNALS) {
      for (const w of sig.words) {
        if (t.includes(w)) return sig.scope;
      }
    }
    return null;
  }

  /**
   * Turn a normalized description into a clean imperative subject.
   * Steps: tokenize → drop leading filler → normalize the verb to
   * imperative → drop redundant nouns → trim filler → assemble.
   */
  function buildSubject(normalized, type) {
    let words = normalized.split(" ").filter(Boolean);

    // Drop a leading "to" ("to add login" -> "add login")
    if (words[0] === "to") words.shift();

    // Normalize first meaningful word to imperative if it's a verb form.
    if (words.length && IMPERATIVE[words[0]]) {
      words[0] = IMPERATIVE[words[0]];
    }

    // If first word isn't a known verb, prepend the type's default verb.
    let hasVerb = words.length && KNOWN_VERBS.has(words[0]);
    if (!hasVerb) {
      const def = (TYPE_VERBS[type] || ["update"])[0];
      // Avoid e.g. "fix fix ..." when type=fix but text starts with noun
      words.unshift(def);
      hasVerb = true;
    }

    const verb = words[0];

    // Remove redundant nouns right after the verb (e.g. "fix bug ...").
    const redundant = REDUNDANT_AFTER[verb];
    if (redundant) {
      while (words.length > 2 && redundant.includes(words[1])) {
        words.splice(1, 1);
      }
    }

    // Contextual verb for fixes: avoid the clumsy "fix: fix …" duplication
    // and pick a verb that matches the failure described.
    if (type === "fix" && words[0] === "fix" && words.length > 1) {
      const rest = words.slice(1).join(" ");
      if (/\b(crash|freeze|hang|stuck)\b/.test(rest)) words[0] = "prevent";
      else if (/\b(error|exception|null|undefined|fail|failure)\b/.test(rest)) words[0] = "handle";
      else words[0] = "resolve";
      // Drop a dangling subordinator left over from "fix WHEN x happens".
      if (["when", "while", "if", "where", "that", "after", "during"].includes(words[1])) {
        words.splice(1, 1);
      }
    }

    // Drop filler words anywhere (but keep the leading verb).
    words = words.filter((w, i) => i === 0 || !FILLER.has(w));

    // Collapse common connective noise: "when ... and app crash" stays,
    // but trim dangling conjunctions at the end.
    while (words.length && ["and", "or", "but", "when", "to", "of", "for", "with"].includes(words[words.length - 1])) {
      words.pop();
    }

    // De-duplicate immediate repeats ("login login").
    words = words.filter((w, i) => i === 0 || w !== words[i - 1]);

    let subject = words.join(" ").trim();

    // Soft length guard — if very long, keep the first clause.
    if (subject.length > 64) {
      const clause = subject.split(/,| - | – |;/)[0].trim();
      if (clause.length >= 12) subject = clause;
    }
    return subject;
  }

  /** Compose the full Conventional Commit header string. */
  function compose(type, scope, subject, breaking) {
    const scopePart = scope ? "(" + scope + ")" : "";
    const bang = breaking ? "!" : "";
    return `${type}${scopePart}${bang}: ${subject}`;
  }

  /** Build the styled HTML version of a header for the preview. */
  function composeHtml(type, scope, subject, breaking) {
    const scopePart = scope ? `<span class="c-scope">(${escapeHtml(scope)})</span>` : "";
    const bang = breaking ? `<span class="c-bang">!</span>` : "";
    return `<span class="c-type">${escapeHtml(type)}</span>${scopePart}${bang}: ${escapeHtml(subject)}`;
  }

  /* ----- Quality scoring ----- */

  /**
   * Score the commit 1–100 across four weighted criteria.
   * Returns { total, parts: [{name, score}] }.
   */
  function scoreCommit(type, scope, subject) {
    const words = subject.split(" ").filter(Boolean);
    const firstWord = words[0] || "";

    // Grammar: imperative verb up front, no past tense.
    let grammar = 40;
    if (KNOWN_VERBS.has(firstWord)) grammar = 100;
    else if (IMPERATIVE[firstWord]) grammar = 55;
    if (/(ed|ing)$/.test(firstWord) && !KNOWN_VERBS.has(firstWord)) grammar -= 25;
    grammar = clamp(grammar);

    // Conventional compliance: valid type, lowercase, no trailing period.
    let conv = 50;
    if (TYPES.some((t) => t.key === type)) conv += 25;
    if (subject === subject.toLowerCase()) conv += 15;
    if (!/[.]$/.test(subject)) conv += 10;
    conv = clamp(conv);

    // Brevity: ideal subject 20–50 chars, ≤ ~8 words.
    const len = subject.length;
    let brevity = 100;
    if (len > 50) brevity -= (len - 50) * 2.5;
    if (len < 12) brevity -= (12 - len) * 4;
    if (words.length > 9) brevity -= (words.length - 9) * 8;
    const fillerCount = words.filter((w) => FILLER.has(w)).length;
    brevity -= fillerCount * 12;
    brevity = clamp(brevity);

    // Clarity: has an object noun beyond the verb, optional scope bonus.
    let clarity = 55;
    if (words.length >= 2) clarity += 20;
    if (words.length >= 3) clarity += 10;
    if (scope) clarity += 15;
    if (words.length < 2) clarity = 35;
    clarity = clamp(clarity);

    const parts = [
      { name: "Clarity", score: Math.round(clarity) },
      { name: "Grammar", score: Math.round(grammar) },
      { name: "Conventional", score: Math.round(conv) },
      { name: "Brevity", score: Math.round(brevity) }
    ];
    // Weighted blend (clarity & conventional matter most).
    const total = Math.round(
      clarity * 0.3 + grammar * 0.25 + conv * 0.28 + brevity * 0.17
    );
    return { total: clamp(total), parts };
  }

  function clamp(n) { return Math.max(1, Math.min(100, n)); }

  /* ----- Alternatives ----- */

  /**
   * Produce up to 3 distinct alternative headers by swapping the verb
   * and toggling scope long/short form.
   */
  function generateAlternatives(type, scope, subject, breaking) {
    const words = subject.split(" ").filter(Boolean);
    const baseVerb = words[0];
    const rest = words.slice(1).join(" ");
    const verbs = (TYPE_VERBS[type] || ["update"]).filter((v) => v !== baseVerb);

    const altScope = scope && SCOPE_ALIASES[scope] ? SCOPE_ALIASES[scope] : null;
    const seen = new Set();
    const out = [];
    const base = compose(type, scope, subject, breaking);
    seen.add(base);

    const candidates = [];
    // 1) alternate verb, same scope
    if (verbs[0] && rest) candidates.push(compose(type, scope, `${verbs[0]} ${rest}`, breaking));
    // 2) alternate scope form, primary verb
    if (altScope) candidates.push(compose(type, altScope, subject, breaking));
    // 3) second alternate verb + alternate scope
    if (verbs[1] && rest) candidates.push(compose(type, altScope || scope, `${verbs[1]} ${rest}`, breaking));
    // 4) qualifier variant ("... safely / correctly")
    if (type === "fix" && rest) candidates.push(compose(type, scope, `${baseVerb} ${rest} correctly`, breaking));
    // 5) drop scope entirely (sometimes cleaner)
    if (scope) candidates.push(compose(type, "", subject, breaking));

    for (const c of candidates) {
      if (out.length >= 3) break;
      if (!seen.has(c)) { seen.add(c); out.push(c); }
    }
    return out;
  }

  /* ===================================================================
     4. STATE & DOM
     =================================================================== */
  const state = {
    type: "feat",
    typeManual: false,   // did the user click a type chip?
    scopeOn: false,
    scope: "",
    desc: "",
    result: null         // last generated header string
  };

  const $ = (id) => document.getElementById(id);
  const dom = {
    typeGrid: $("typeGrid"), typeHint: $("typeHint"),
    scopeToggle: $("scopeToggle"), scopeWrap: $("scopeWrap"),
    scopeInput: $("scopeInput"), scopeChips: $("scopeChips"),
    descInput: $("descInput"), descCount: $("descCount"), exampleRow: $("exampleRow"),
    generateBtn: $("generateBtn"),
    emptyState: $("emptyState"), previewResult: $("previewResult"),
    commitLine: $("commitLine"), lengthFill: $("lengthFill"), lengthLabel: $("lengthLabel"),
    copyMain: $("copyMain"),
    scoreBlock: $("scoreBlock"), scoreBadge: $("scoreBadge"), scoreGrid: $("scoreGrid"),
    altBlock: $("altBlock"), altList: $("altList"),
    historyPanel: $("historyPanel"), historyList: $("historyList"), clearHistory: $("clearHistory"),
    themeToggle: $("themeToggle"), toast: $("toast"), toastText: $("toastText"),
    footerTip: $("footerTip")
  };

  const EXAMPLES = [
    "fix bug when user logout and app crash",
    "add setting page for dark mode",
    "improve api loading speed",
    "change button color on hover"
  ];

  const TIPS = [
    "Write the subject as if completing: “If applied, this commit will…”.",
    "Use the body (after a blank line) to explain the why, not the how.",
    "Add a ! after the type or scope to flag a breaking change.",
    "Scopes keep history searchable — group commits by module."
  ];

  /* ===================================================================
     5. RENDERING
     =================================================================== */
  function renderTypeChips() {
    dom.typeGrid.innerHTML = "";
    TYPES.forEach((t) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "type-chip" + (t.key === state.type ? " selected" : "");
      btn.dataset.type = t.key;
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", t.key === state.type ? "true" : "false");
      btn.title = t.desc;
      btn.innerHTML = `<span class="dot" style="--chip-c:${t.color}"></span>${t.label}`;
      btn.addEventListener("click", () => selectType(t.key, true));
      dom.typeGrid.appendChild(btn);
    });
    updateTypeHint();
  }

  function updateTypeHint() {
    const t = TYPES.find((x) => x.key === state.type);
    dom.typeHint.textContent = t ? t.desc : "";
  }

  function selectType(key, manual) {
    state.type = key;
    if (manual) state.typeManual = true;
    [...dom.typeGrid.children].forEach((c) => {
      const on = c.dataset.type === key;
      c.classList.toggle("selected", on);
      c.setAttribute("aria-checked", on ? "true" : "false");
    });
    updateTypeHint();
    if (state.result) generate(); // live re-generate once a result exists
  }

  function renderScopeChips() {
    dom.scopeChips.innerHTML = "";
    SCOPE_SUGGESTIONS.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "mini-chip"; b.textContent = s;
      b.addEventListener("click", () => {
        dom.scopeInput.value = s; state.scope = s;
        if (state.result) generate();
        dom.scopeInput.focus();
      });
      dom.scopeChips.appendChild(b);
    });
  }

  function renderExamples() {
    dom.exampleRow.innerHTML = "";
    EXAMPLES.forEach((ex) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "mini-chip"; b.textContent = ex;
      b.addEventListener("click", () => {
        dom.descInput.value = ex; state.desc = ex; updateDescCount(); generate();
        dom.descInput.focus();
      });
      dom.exampleRow.appendChild(b);
    });
  }

  function updateDescCount() {
    const n = dom.descInput.value.length;
    dom.descCount.textContent = n + (n === 1 ? " char" : " chars");
  }

  /** Update the subject-length meter against Conventional Commits limits. */
  function renderLengthMeter(header) {
    const len = header.length;             // full "type(scope): subject"
    const pct = Math.min(100, (len / 72) * 100);
    dom.lengthFill.style.width = pct + "%";
    let color = "var(--green)", label = `${len} chars · good`;
    if (len > 72) { color = "var(--red)"; label = `${len} chars · too long (>72)`; }
    else if (len > 50) { color = "var(--amber)"; label = `${len} chars · over 50`; }
    dom.lengthFill.style.background = color;
    dom.lengthLabel.textContent = label;
  }

  function renderScore(score) {
    dom.scoreBadge.textContent = `${score.total}/100`;
    dom.scoreBadge.style.color = scoreColor(score.total);
    dom.scoreGrid.innerHTML = "";
    score.parts.forEach((p) => {
      const c = scoreColor(p.score);
      const item = document.createElement("div");
      item.className = "score-item";
      item.innerHTML = `
        <div class="score-item-head">
          <span class="score-item-name">${p.name}</span>
          <span class="score-item-val" style="color:${c}">${p.score}</span>
        </div>
        <div class="score-track"><span style="width:${p.score}%;background:${c}"></span></div>`;
      dom.scoreGrid.appendChild(item);
    });
  }

  function scoreColor(n) {
    if (n >= 80) return "var(--green)";
    if (n >= 55) return "var(--amber)";
    return "var(--red)";
  }

  function renderAlternatives(alts) {
    dom.altList.innerHTML = "";
    if (!alts.length) { dom.altBlock.hidden = true; return; }
    dom.altBlock.hidden = false;
    alts.forEach((a) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "alt-item";
      b.innerHTML = `<code>${escapeHtml(a)}</code>
        <span class="alt-copy">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="12" height="12" rx="2.4" stroke="currentColor" stroke-width="1.8"></rect><path d="M16 8V6.2A2.2 2.2 0 0013.8 4H6.2A2.2 2.2 0 004 6.2v7.6A2.2 2.2 0 006.2 16H8" stroke="currentColor" stroke-width="1.8"></path></svg>
          copy</span>`;
      b.addEventListener("click", () => {
        copyText(a);
        b.classList.add("copied");
        b.querySelector(".alt-copy").lastChild.textContent = " copied";
        addToHistory(a);
        setTimeout(() => {
          b.classList.remove("copied");
          b.querySelector(".alt-copy").lastChild.textContent = "copy";
        }, 1600);
      });
      dom.altList.appendChild(b);
    });
  }

  /* ===================================================================
     6. GENERATE (orchestration)
     =================================================================== */
  function generate() {
    const raw = dom.descInput.value.trim();
    if (!raw) {
      // Reset to empty state
      state.result = null;
      dom.previewResult.hidden = true;
      dom.emptyState.hidden = false;
      dom.scoreBlock.hidden = true;
      dom.altBlock.hidden = true;
      dom.copyMain.disabled = true;
      dom.generateBtn.classList.add("nudge");
      setTimeout(() => dom.generateBtn.classList.remove("nudge"), 300);
      return;
    }

    const normalized = normalizeRaw(raw);

    // Type: respect a manual choice; otherwise auto-detect.
    let type = state.type;
    if (!state.typeManual) {
      const detected = detectType(normalized);
      if (detected) { type = detected; selectTypeSilently(detected); }
    }

    // Scope: only when the user opted in.
    let scope = "";
    if (state.scopeOn) {
      scope = (dom.scopeInput.value || "").trim().toLowerCase().replace(/\s+/g, "-");
      if (!scope) {
        const sg = detectScope(normalized);
        if (sg) { scope = sg; dom.scopeInput.placeholder = `suggested: ${sg}`; }
      }
    }

    const subject = buildSubject(normalized, type);
    const header = compose(type, scope, subject, false);
    state.result = header;

    // Render preview
    dom.emptyState.hidden = true;
    dom.previewResult.hidden = false;
    dom.commitLine.innerHTML = composeHtml(type, scope, subject, false);
    renderLengthMeter(header);
    dom.copyMain.disabled = false;

    // Score
    dom.scoreBlock.hidden = false;
    renderScore(scoreCommit(type, scope, subject));

    // Alternatives
    renderAlternatives(generateAlternatives(type, scope, subject, false));
  }

  // Update chip selection state without re-triggering generate().
  function selectTypeSilently(key) {
    state.type = key;
    [...dom.typeGrid.children].forEach((c) => {
      const on = c.dataset.type === key;
      c.classList.toggle("selected", on);
      c.setAttribute("aria-checked", on ? "true" : "false");
    });
    updateTypeHint();
  }

  /* ===================================================================
     7. CLIPBOARD + TOAST
     =================================================================== */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
    showToast("Copied successfully");
  }
  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }
  let toastTimer;
  function showToast(msg) {
    dom.toastText.textContent = msg;
    dom.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove("show"), 2000);
  }

  /* ===================================================================
     8. HISTORY (localStorage)
     =================================================================== */
  const HKEY = "commitgen.history.v1";
  let history = [];

  function loadHistory() {
    try { history = JSON.parse(localStorage.getItem(HKEY)) || []; }
    catch (e) { history = []; }
    renderHistory();
  }
  function saveHistory() {
    try { localStorage.setItem(HKEY, JSON.stringify(history)); } catch (e) {}
  }
  function addToHistory(header) {
    // De-dupe: drop existing identical entry, unshift fresh.
    history = history.filter((h) => h.text !== header);
    history.unshift({ text: header, at: Date.now() });
    if (history.length > 8) history = history.slice(0, 8);
    saveHistory();
    renderHistory();
  }
  function renderHistory() {
    if (!history.length) { dom.historyPanel.hidden = true; return; }
    dom.historyPanel.hidden = false;
    dom.historyList.innerHTML = "";
    history.forEach((h) => {
      const row = document.createElement("div");
      row.className = "history-item";
      row.innerHTML = `<code>${escapeHtml(h.text)}</code>
        <span class="history-time">${timeAgo(h.at)}</span>
        <button class="history-copy" type="button" aria-label="Copy" title="Copy">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="12" height="12" rx="2.4" stroke="currentColor" stroke-width="1.8"></rect><path d="M16 8V6.2A2.2 2.2 0 0013.8 4H6.2A2.2 2.2 0 004 6.2v7.6A2.2 2.2 0 006.2 16H8" stroke="currentColor" stroke-width="1.8"></path></svg>
        </button>`;
      row.querySelector(".history-copy").addEventListener("click", () => copyText(h.text));
      dom.historyList.appendChild(row);
    });
  }
  function timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60); if (m < 60) return m + "m ago";
    const h = Math.floor(m / 60); if (h < 24) return h + "h ago";
    return Math.floor(h / 24) + "d ago";
  }

  /* ===================================================================
     9. THEME
     =================================================================== */
  const TKEY = "commitgen.theme";
  function loadTheme() {
    const saved = localStorage.getItem(TKEY);
    if (saved) document.documentElement.setAttribute("data-theme", saved);
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(TKEY, next); } catch (e) {}
  }

  /* ===================================================================
     10. INIT + EVENTS
     =================================================================== */
  function init() {
    loadTheme();
    renderTypeChips();
    renderScopeChips();
    renderExamples();
    loadHistory();
    dom.footerTip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];

    // Description input
    dom.descInput.addEventListener("input", () => {
      state.desc = dom.descInput.value;
      updateDescCount();
      if (state.result) generate(); // keep result fresh after first generate
    });

    // Scope toggle
    dom.scopeToggle.addEventListener("change", () => {
      state.scopeOn = dom.scopeToggle.checked;
      dom.scopeWrap.hidden = !state.scopeOn;
      if (state.scopeOn) dom.scopeInput.focus();
      if (state.result) generate();
    });
    dom.scopeInput.addEventListener("input", () => {
      state.scope = dom.scopeInput.value;
      if (state.result) generate();
    });

    // Generate
    dom.generateBtn.addEventListener("click", generate);

    // Copy main
    dom.copyMain.addEventListener("click", () => {
      if (!state.result) return;
      copyText(state.result);
      addToHistory(state.result);
      dom.copyMain.classList.add("copied");
      setTimeout(() => dom.copyMain.classList.remove("copied"), 1800);
    });

    // History clear
    dom.clearHistory.addEventListener("click", () => {
      history = []; saveHistory(); renderHistory();
    });

    // Theme
    dom.themeToggle.addEventListener("click", toggleTheme);

    // Keyboard: Cmd/Ctrl+Enter to generate from the textarea
    dom.descInput.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); generate(); }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();

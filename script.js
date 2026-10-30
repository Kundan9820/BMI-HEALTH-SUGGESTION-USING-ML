(function () {
  const input = document.getElementById("symptomInput");
  const addBtn = document.getElementById("addBtn");
  const suggestionsEl = document.getElementById("suggestions");
  const chipField = document.getElementById("chipField");
  const chipPlaceholder = document.getElementById("chipPlaceholder");
  const clearBtn = document.getElementById("clearBtn");

  const slipStatus = document.getElementById("slipStatus");
  const meterFill = document.getElementById("meterFill");
  const meterPct = document.getElementById("meterPct");
  const diseaseSection = document.getElementById("diseaseSection");
  const diseaseName = document.getElementById("diseaseName");
  const descSection = document.getElementById("descSection");
  const descText = document.getElementById("descText");
  const precSection = document.getElementById("precSection");
  const precList = document.getElementById("precList");
  const slipTime = document.getElementById("slipTime");
  const clockEl = document.getElementById("clock");

  let symptoms = [];
  let activeSuggestion = -1;
  let debounceTimer = null;
  let predictDebounce = null;

  if (!input) return; // dataset not loaded, form disabled/absent

  // ---------- live clock ----------
  function tick() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    clockEl.textContent = `${hh}:${mm}:${ss}`;
  }
  tick();
  setInterval(tick, 1000);

  // ---------- chip rendering ----------
  function renderChips() {
    chipField.querySelectorAll(".chip").forEach(el => el.remove());

    if (symptoms.length === 0) {
      chipPlaceholder.hidden = false;
      clearBtn.hidden = true;
    } else {
      chipPlaceholder.hidden = true;
      clearBtn.hidden = false;
      symptoms.forEach((s, idx) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.innerHTML = `${s.replace(/_/g, " ")} <button type="button" aria-label="Remove ${s}">&times;</button>`;
        chip.querySelector("button").addEventListener("click", () => {
          symptoms.splice(idx, 1);
          renderChips();
          runPrediction();
        });
        chipField.appendChild(chip);
      });
    }
  }

  function addSymptom(raw) {
    const cleaned = raw.trim().toLowerCase().replace(/\s+/g, "_");
    if (!cleaned) return;
    if (symptoms.includes(cleaned)) {
      input.value = "";
      hideSuggestions();
      return;
    }
    symptoms.push(cleaned);
    input.value = "";
    hideSuggestions();
    renderChips();
    runPrediction();
  }

  clearBtn.addEventListener("click", () => {
    symptoms = [];
    renderChips();
    runPrediction();
  });

  addBtn.addEventListener("click", () => addSymptom(input.value));

  input.addEventListener("keydown", (e) => {
    const items = suggestionsEl.querySelectorAll("li");
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeSuggestion >= 0 && items[activeSuggestion]) {
        addSymptom(items[activeSuggestion].dataset.value);
      } else {
        addSymptom(input.value);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!items.length) return;
      activeSuggestion = (activeSuggestion + 1) % items.length;
      highlightSuggestion(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!items.length) return;
      activeSuggestion = (activeSuggestion - 1 + items.length) % items.length;
      highlightSuggestion(items);
    } else if (e.key === "Escape") {
      hideSuggestions();
    }
  });

  function highlightSuggestion(items) {
    items.forEach((li, i) => li.classList.toggle("active", i === activeSuggestion));
  }

  // ---------- autocomplete ----------
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    debounceTimer = setTimeout(() => fetchSuggestions(q), 150);
  });

  input.addEventListener("blur", () => {
    setTimeout(hideSuggestions, 120); // allow click to register first
  });

  function fetchSuggestions(q) {
    fetch(`/api/symptoms?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => {
        const list = (data.symptoms || []).filter(s => !symptoms.includes(s));
        renderSuggestions(list);
      })
      .catch(() => hideSuggestions());
  }

  function renderSuggestions(list) {
    activeSuggestion = -1;
    if (!list.length) {
      hideSuggestions();
      return;
    }
    suggestionsEl.innerHTML = "";
    list.forEach(s => {
      const li = document.createElement("li");
      li.textContent = s.replace(/_/g, " ");
      li.dataset.value = s;
      li.addEventListener("mousedown", () => addSymptom(s));
      suggestionsEl.appendChild(li);
    });
    suggestionsEl.hidden = false;
  }

  function hideSuggestions() {
    suggestionsEl.hidden = true;
    suggestionsEl.innerHTML = "";
    activeSuggestion = -1;
  }

  // ---------- live prediction ----------
  function runPrediction() {
    clearTimeout(predictDebounce);
    predictDebounce = setTimeout(fetchPrediction, 200);
  }

  function fetchPrediction() {
    if (symptoms.length === 0) {
      resetSlip();
      return;
    }

    slipStatus.textContent = "Checking…";
    slipStatus.className = "slip-status";

    fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symptoms }),
    })
      .then(r => r.json())
      .then(renderResult)
      .catch(() => {
        slipStatus.textContent = "Could not reach the assessment service.";
        slipStatus.className = "slip-status low";
      });
  }

  function renderResult(data) {
    stampTime();

    if (data.error) {
      slipStatus.textContent = "Dataset error — see server log.";
      slipStatus.className = "slip-status low";
      return;
    }

    const pct = data.confidence || 0;
    meterFill.style.width = pct + "%";
    meterPct.textContent = pct;

    if (data.matched) {
      slipStatus.textContent = `Match found from ${symptoms.length} symptom${symptoms.length > 1 ? "s" : ""}`;
      slipStatus.className = "slip-status active";

      diseaseName.textContent = data.disease.replace(/_/g, " ");
      diseaseSection.hidden = false;

      descText.textContent = data.description;
      descSection.hidden = false;

      precList.innerHTML = "";
      (data.precautions || []).forEach(p => {
        const li = document.createElement("li");
        li.textContent = p;
        precList.appendChild(li);
      });
      precSection.hidden = false;
    } else {
      slipStatus.textContent = data.message || "Not enough matching symptoms yet.";
      slipStatus.className = "slip-status low";
      diseaseSection.hidden = true;
      descSection.hidden = true;
      precSection.hidden = true;
    }
  }

  function resetSlip() {
    slipStatus.textContent = "Waiting for symptoms…";
    slipStatus.className = "slip-status";
    meterFill.style.width = "0%";
    meterPct.textContent = "0";
    diseaseSection.hidden = true;
    descSection.hidden = true;
    precSection.hidden = true;
    slipTime.textContent = "—";
  }

  function stampTime() {
    const now = new Date();
    slipTime.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  renderChips();
})();

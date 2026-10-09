# Symptom Intake — Live Assessment

A real-time Flask web UI built around your original disease-prediction script.
As you add or remove symptoms, the app calls the backend instantly (no page
reload, no "submit" button needed) and updates a live "assessment slip" with
the predicted condition, description, and precautions.

## Project structure

```
disease-checker/
├── app.py                      Flask app (your original matching logic, wrapped in routes)
├── requirements.txt
├── datset/                     ← put your real CSVs here (sample data included)
│   ├── dataset.csv
│   ├── symptom_Description.csv
│   └── symptom_precaution.csv
├── templates/
│   └── index.html
└── static/
    ├── style.css
    └── script.js
```

## Setup

```bash
cd disease-checker
pip install -r requirements.txt
```

Replace the sample files inside `datset/` with your real dataset (same
column layout as your original script: `Disease, Symptom_1, Symptom_2, ...`
for `dataset.csv`; `Disease, Description` for `symptom_Description.csv`;
`Disease, Precaution_1..4` for `symptom_precaution.csv`).

**Note:** if any text field contains commas (e.g. a description with commas
in it), wrap that field in double quotes in the CSV, or pandas will
misparse the row.

## Run

```bash
python3 app.py
```

Then open **http://127.0.0.1:5000** in your browser.

## How it works

- `GET /api/symptoms?q=<text>` — returns matching known symptoms for the
  autocomplete dropdown as you type.
- `POST /api/predict` — takes `{"symptoms": [...]}` and returns the matched
  disease (if confidence ≥ 60%, same threshold as your original script),
  its description, and precautions. The frontend calls this automatically
  every time you add or remove a symptom chip.

The prediction logic (`find_disease`, `get_description`, `get_precaution`)
is unchanged from your original script — it's just wrapped in Flask routes
and the dataset is loaded once at startup instead of per-run.

## Disclaimer

This tool is for informational purposes only and is not a medical
diagnosis. Always consult a physician for clinical care.

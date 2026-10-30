import os
import pandas as pd
from difflib import get_close_matches
from flask import Flask, render_template, request, jsonify

# =========================
# 🚀 APP SETUP
# =========================
app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "datset")

DATASET_PATH = os.path.join(DATA_DIR, "dataset.csv")
DESC_PATH = os.path.join(DATA_DIR, "symptom_Description.csv")
PREC_PATH = os.path.join(DATA_DIR, "symptom_precaution.csv")

# =========================
# 📂 LOAD DATA (once, at startup)
# =========================
df = None
desc_df = None
prec_df = None
ALL_SYMPTOMS = []
LOAD_ERROR = None

def clean_text(text):
    return str(text).strip().lower().replace(" ", "_")

def load_data():
    global df, desc_df, prec_df, ALL_SYMPTOMS, LOAD_ERROR
    try:
        df = pd.read_csv(DATASET_PATH)
        desc_df = pd.read_csv(DESC_PATH)
        prec_df = pd.read_csv(PREC_PATH)

        symptom_set = set()
        for _, row in df.iterrows():
            for val in row[1:].dropna().values:
                cleaned = clean_text(val)
                if cleaned:
                    symptom_set.add(cleaned)
        ALL_SYMPTOMS = sorted(symptom_set)
        LOAD_ERROR = None
    except Exception as e:
        LOAD_ERROR = str(e)
        df, desc_df, prec_df = None, None, None
        ALL_SYMPTOMS = []

load_data()

# =========================
# 🧠 FIND DISEASE
# =========================
def find_disease(user_symptoms):
    user_symptoms = [clean_text(s) for s in user_symptoms if str(s).strip()]
    if not user_symptoms:
        return None, 0

    best_match = None
    best_score = 0

    for _, row in df.iterrows():
        symptoms = row[1:].dropna().values
        symptoms = [clean_text(s) for s in symptoms]

        match_count = 0
        for user_sym in user_symptoms:
            for sym in symptoms:
                if user_sym == sym or user_sym in sym or sym in user_sym:
                    match_count += 1
                    break

        score = match_count / len(user_symptoms)

        if score > best_score:
            best_score = score
            best_match = row["Disease"]

    if best_score >= 0.6:
        return best_match, round(best_score * 100, 1)
    else:
        return None, round(best_score * 100, 1)

# =========================
# 📖 GET DESCRIPTION
# =========================
def get_description(disease_name):
    if not disease_name:
        return "No description available"

    disease_name = disease_name.strip().lower()
    disease_list = desc_df["Disease"].str.lower().tolist()

    match = get_close_matches(disease_name, disease_list, n=1, cutoff=0.6)

    if match:
        row = desc_df[desc_df["Disease"].str.lower() == match[0]]
        return row.iloc[0]["Description"]

    return "Description not found"

# =========================
# 💊 GET PRECAUTION
# =========================
def get_precaution(disease_name):
    if not disease_name:
        return ["No precaution available"]

    disease_name = disease_name.strip().lower()
    disease_list = prec_df["Disease"].str.lower().tolist()

    match = get_close_matches(disease_name, disease_list, n=1, cutoff=0.6)

    if match:
        row = prec_df[prec_df["Disease"].str.lower() == match[0]]

        precautions = []
        for col in row.columns[1:]:
            value = row.iloc[0][col]
            if pd.notna(value):
                precautions.append(str(value).strip())

        return precautions if precautions else ["No specific precautions found"]

    return ["No specific precautions found"]

# =========================
# 🌐 ROUTES
# =========================
@app.route("/")
def index():
    return render_template("index.html", data_ready=(LOAD_ERROR is None), load_error=LOAD_ERROR)


@app.route("/api/symptoms")
def api_symptoms():
    """Return all known symptoms for autocomplete."""
    if LOAD_ERROR:
        return jsonify({"error": LOAD_ERROR}), 500
    query = request.args.get("q", "").strip().lower().replace(" ", "_")
    if query:
        results = [s for s in ALL_SYMPTOMS if query in s][:20]
    else:
        results = ALL_SYMPTOMS[:20]
    return jsonify({"symptoms": results})


@app.route("/api/predict", methods=["POST"])
def api_predict():
    """Real-time prediction endpoint — called as the user updates their symptom list."""
    if LOAD_ERROR:
        return jsonify({"error": LOAD_ERROR}), 500

    payload = request.get_json(force=True, silent=True) or {}
    symptoms = payload.get("symptoms", [])

    if not isinstance(symptoms, list) or not symptoms:
        return jsonify({
            "matched": False,
            "message": "Add at least one symptom to check."
        })

    disease, confidence = find_disease(symptoms)

    if disease:
        return jsonify({
            "matched": True,
            "disease": disease,
            "confidence": confidence,
            "description": get_description(disease),
            "precautions": get_precaution(disease),
        })
    else:
        return jsonify({
            "matched": False,
            "confidence": confidence,
            "message": "Not enough matching symptoms. Try adding more symptoms."
        })


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)

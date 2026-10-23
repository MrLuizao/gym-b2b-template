#!/usr/bin/env python3
"""
Entrena el modelo de predicción de abandono (Churn) con scikit-learn.

Genera la calibración y exporta los pesos y parámetros del StandardScaler
directamente a JSON (server/models/churn-weights.json) para que la inferencia
corra en tiempo real en Vercel Serverless (Node/TypeScript) a <0.1ms por socio.

Uso:
  # Con datos sintéticos calibrados de gimnasio:
  python scripts/train-churn-model.py --synthetic --output server/models/churn-weights.json

  # Con datos reales de Firestore (requiere FIREBASE_SERVICE_ACCOUNT):
  export FIREBASE_SERVICE_ACCOUNT="/ruta/a/service-account.json"
  python scripts/train-churn-model.py --output server/models/churn-weights.json
"""

import argparse
import json
import os
import sys
from pathlib import Path

try:
    import numpy as np
    import pandas as pd
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import classification_report, roc_auc_score
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler
except ImportError:
    print("Aviso: scikit-learn, pandas o numpy no están instalados en este entorno.")
    print("Para entrenar, instala las dependencias: pip install scikit-learn pandas numpy")


FEATURE_COLS = [
    "avg_visits_per_week_last_4",
    "visits_variance",
    "days_since_last_visit",
    "class_cancellation_rate",
    "unique_branches_visited",
    "active_class_types_count",
    "has_payment_late_30d",
    "support_tickets_last_30d",
    "goal_streak_current",
    "weekly_goal",
    "points_balance",
    "membership_months_active",
]

TARGET_COL = "is_churned"


def generate_synthetic_gym_dataset(n_samples=2500, random_state=42):
    """
    Genera un dataset sintético representativo de socios de gimnasio con
    correlaciones realistas de comportamiento y abandono.
    """
    np.random.seed(random_state)

    # 1. Tenencia en meses
    membership_months = np.random.exponential(scale=6.0, size=n_samples).clip(1, 36)

    # 2. Asistencia semanal promedio
    # Socios nuevos o desmotivados tienen menos asistencia
    base_visits = np.random.normal(loc=2.5, scale=1.2, size=n_samples).clip(0.0, 6.0)

    # 3. Días sin visitar el gimnasio
    days_since_last = np.random.exponential(scale=5.0, size=n_samples).clip(0, 45)

    # 4. Varianza de visitas
    visits_variance = np.random.uniform(0.1, 2.0, size=n_samples)

    # 5. Cancelación de clases
    class_cancellation_rate = np.random.beta(a=1, b=5, size=n_samples).clip(0.0, 1.0)

    # 6. Diversidad de sedes y tipos de clase
    unique_branches = np.random.choice([1, 2, 3], size=n_samples, p=[0.75, 0.20, 0.05])
    active_class_types = np.random.poisson(lam=1.5, size=n_samples).clip(0, 6)

    # 7. Retraso en pagos
    has_payment_late = np.random.choice([0, 1], size=n_samples, p=[0.92, 0.08])

    # 8. Tickets de soporte
    support_tickets = np.random.poisson(lam=0.4, size=n_samples).clip(0, 5)

    # 9. Gamificación y lealtad
    weekly_goal = np.random.choice([2, 3, 4, 5], size=n_samples, p=[0.15, 0.35, 0.40, 0.10])
    goal_streak = np.random.geometric(p=0.4, size=n_samples) - 1
    points_balance = (goal_streak * 50 + np.random.exponential(scale=100, size=n_samples)).clip(0, 1500)

    # 10. Función de probabilidad latente de Churn
    # Factores de riesgo positivos aumentan churn; factores protectores lo disminuyen
    risk_score = (
        -0.85
        + (days_since_last / 5.0) * 0.95
        - (base_visits / 2.0) * 0.75
        + (visits_variance * 0.25)
        + (class_cancellation_rate * 0.6)
        + (has_payment_late * 0.8)
        + (support_tickets * 0.3)
        - (goal_streak * 0.2)
        - (unique_branches * 0.1)
        - (active_class_types * 0.1)
        - (membership_months / 12.0) * 0.3
    )

    prob_churn = 1.0 / (1.0 + np.exp(-risk_score))
    is_churned = (np.random.rand(n_samples) < prob_churn).astype(int)

    df = pd.DataFrame({
        "avg_visits_per_week_last_4": base_visits,
        "visits_variance": visits_variance,
        "days_since_last_visit": days_since_last,
        "class_cancellation_rate": class_cancellation_rate,
        "unique_branches_visited": unique_branches,
        "active_class_types_count": active_class_types,
        "has_payment_late_30d": has_payment_late,
        "support_tickets_last_30d": support_tickets,
        "goal_streak_current": goal_streak,
        "weekly_goal": weekly_goal,
        "points_balance": points_balance,
        "membership_months_active": membership_months,
        "is_churned": is_churned,
    })

    return df


def load_firestore_data():
    import firebase_admin
    from firebase_admin import credentials, firestore

    sa_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "service-account.json")
    if not os.path.exists(sa_path):
        raise FileNotFoundError(f"Archivo de credenciales no encontrado en: {sa_path}")

    cred = credentials.Certificate(sa_path)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()

    print("Extrayendo features de socios desde Firestore...")
    records = []
    users_snap = db.collection("users").where("membership_status", "in", ["ACTIVE", "EXPIRED"]).stream()

    for user in users_snap:
        u_data = user.to_dict()
        feat = u_data.get("latest_churn_features")
        if not feat:
            # Buscar en subcolección
            latest_feat_snap = (
                db.collection("users")
                .document(user.id)
                .collection("churn_features")
                .order_by("scored_at", direction=firestore.DESCENDING)
                .limit(1)
                .stream()
            )
            for f in latest_feat_snap:
                feat = f.to_dict()
                break

        if feat:
            row = {col: feat.get(col, 0) for col in FEATURE_COLS}
            row[TARGET_COL] = 1 if u_data.get("membership_status") == "EXPIRED" else 0
            records.append(row)

    if len(records) < 50:
        print(f"Pocos registros en Firestore ({len(records)}). Complementando con sintéticos...")
        synthetic_df = generate_synthetic_gym_dataset(n_samples=1500)
        if records:
            df = pd.concat([pd.DataFrame(records), synthetic_df], ignore_index=True)
        else:
            df = synthetic_df
    else:
        df = pd.DataFrame(records)

    return df


def main():
    parser = argparse.ArgumentParser(description="Entrenar modelo Scikit-Learn para Churn")
    parser.add_argument("--synthetic", action="store_true", help="Usar datos sintéticos de prueba")
    parser.add_argument(
        "--output",
        default="server/models/churn-weights.json",
        help="Ruta de salida JSON (default: server/models/churn-weights.json)",
    )
    args = parser.parse_args()

    if args.synthetic or not os.environ.get("FIREBASE_SERVICE_ACCOUNT"):
        print("Usando generador de datos sintéticos calibrados...")
        df = generate_synthetic_gym_dataset()
    else:
        df = load_firestore_data()

    X = df[FEATURE_COLS]
    y = df[TARGET_COL]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Entrenar Regresión Logística con regularización L2 y pesos balanceados
    model = LogisticRegression(class_weight="balanced", random_state=42, max_iter=1000)
    model.fit(X_train_scaled, y_train)

    y_pred = model.predict(X_test_scaled)
    y_prob = model.predict_proba(X_test_scaled)[:, 1]

    auc = roc_auc_score(y_test, y_prob)
    print("\n--- Métrica AUC-ROC ---")
    print(f"AUC-ROC: {auc:.4f}")
    print("\n--- Reporte de Clasificación ---")
    print(classification_report(y_test, y_pred, digits=3))

    # Exportar parámetros a JSON para inferencia pura en TypeScript
    export_payload = {
        "model_type": "LogisticRegression",
        "framework": "scikit-learn",
        "version": "1.4.0",
        "trained_at": pd.Timestamp.now(tz="UTC").isoformat(),
        "metrics": {
            "auc_roc": round(float(auc), 4),
            "train_samples": len(X_train),
            "test_samples": len(X_test),
        },
        "features": FEATURE_COLS,
        "scaler": {
            "mean": [round(float(m), 4) for m in scaler.mean_],
            "scale": [round(float(s), 4) for s in scaler.scale_],
        },
        "coef": [round(float(c), 4) for c in model.coef_[0]],
        "intercept": round(float(model.intercept_[0]), 4),
        "thresholds": {
            "high": 0.65,
            "medium": 0.35,
        },
        "labels": {
            "high": "Riesgo Alto",
            "medium": "Riesgo Medio",
            "low": "Riesgo Bajo",
        },
    }

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(export_payload, f, indent=2)

    print(f"\nPesos de modelo y StandardScaler exportados con éxito a:")
    print(f"-> {out_path.resolve()} ({out_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

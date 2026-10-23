#!/usr/bin/env python3
"""
Exporta el dataset de entrenamiento para Google Cloud Vertex AI AutoML Tabular.

Genera un archivo CSV con las columnas de features y la columna target 'is_churned',
listo para subirse a un bucket de Google Cloud Storage (GCS) y entrenar
un modelo de AutoML Tabular en Vertex AI.

Uso:
  python scripts/export-vertex-dataset.py --output dataset_vertex_churn.csv
"""

import argparse
import os
import sys
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    print("Aviso: pandas no está instalado. Ejecuta: pip install pandas")

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


def main():
    parser = argparse.ArgumentParser(description="Exportar dataset para Vertex AI")
    parser.add_argument(
        "--output",
        default="dataset_vertex_churn.csv",
        help="Ruta del CSV destino (default: dataset_vertex_churn.csv)",
    )
    args = parser.parse_args()

    # Importar generador sintético o lector de Firestore de train-churn-model
    sys.path.insert(0, str(Path(__file__).parent))
    from train_churn_model import generate_synthetic_gym_dataset, load_firestore_data

    if os.environ.get("FIREBASE_SERVICE_ACCOUNT"):
        try:
            print("Extrayendo datos de Firestore...")
            df = load_firestore_data()
        except Exception as e:
            print(f"Error leyendo Firestore ({e}). Generando dataset sintético...")
            df = generate_synthetic_gym_dataset(n_samples=5000)
    else:
        print("Generando dataset sintético representativo (5,000 registros)...")
        df = generate_synthetic_gym_dataset(n_samples=5000)

    # Ordenar columnas con target al final
    cols = FEATURE_COLS + [TARGET_COL]
    df = df[cols]

    out_path = Path(args.output)
    df.to_csv(out_path, index=False)
    print(f"\nDataset listo para Vertex AI exportado a:")
    print(f"-> {out_path.resolve()} ({len(df)} filas, {out_path.stat().st_size / 1024:.1f} KB)")
    print("\nPasos siguientes en Google Cloud Console:")
    print("1. Subir a Cloud Storage: gsutil cp dataset_vertex_churn.csv gs://tu-bucket/churn/")
    print("2. Ir a Vertex AI -> Datasets -> Create -> Tabular / Regression/Classification")
    print("3. Seleccionar 'Train new model' -> AutoML Tabular")
    print("4. Fijar columna objetivo: 'is_churned' (Optimizar para AUC-ROC / Log-loss)")
    print("5. Desplegar el modelo entrenado a un Endpoint y copiar el 'Endpoint ID' en el B2B.")


if __name__ == "__main__":
    main()

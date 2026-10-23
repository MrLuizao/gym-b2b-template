#!/usr/bin/env python3
"""
Exporta los pesos de un modelo scikit-learn a JSON para usar en TypeScript.

Uso:
  python scripts/export-model-weights.py server/models/churn.pkl server/models/churn-weights.json
"""

import argparse
import json
import pickle
import sys
from pathlib import Path

import numpy as np


def main():
    parser = argparse.ArgumentParser(description="Exportar pesos del modelo")
    parser.add_argument("model_path", help="Ruta al archivo .pkl del modelo")
    parser.add_argument("output_path", help="Ruta donde guardar el JSON")
    args = parser.parse_args()

    model_path = Path(args.model_path)
    if not model_path.exists():
        print(f"Error: {model_path} no existe")
        sys.exit(1)

    with open(model_path, "rb") as f:
        model_data = pickle.load(f)

    model = model_data["model"]
    scaler = model_data["scaler"]
    features = model_data["features"]

    # Extraer coeficientes si es regresión logística
    if hasattr(model, "coef_"):
        coef = model.coef_[0].tolist()
        intercept = float(model.intercept_[0])
    else:
        # Para Random Forest, usar feature importance como proxy
        coef = (model.feature_importances_ * -1).tolist()  # Negativo = riesgo
        intercept = 0.5

    # Extraer scaler params
    scale_ = scaler.scale_.tolist()
    mean_ = scaler.mean_.tolist()

    output = {
        "features": features,
        "coef": coef,
        "intercept": intercept,
        "scaler": {
            "scale": scale_,
            "mean": mean_,
        },
    }

    output_path = Path(args.output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Pesos exportados a {output_path}")


if __name__ == "__main__":
    main()

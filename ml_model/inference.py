import sys
import json
import joblib
import pandas as pd
import warnings
import os

warnings.filterwarnings('ignore')

MODEL_PATH = 'ml_model/isolation_model.pkl'

def main():
    try:
        # Load the pre-trained model
        if not os.path.exists(MODEL_PATH):
            print(json.dumps([{"alert_level": "WARNING", "message": "Model not found. Run training script.", "confidence": 0}]))
            return

        model = joblib.load(MODEL_PATH)
        
        # We need data to predict on. Let's assume the node server passes data or we fetch the latest row.
        # Since this is called periodically without arguments, let's fetch the latest row from DB.
        from sqlalchemy import create_engine
        engine = create_engine('postgresql://postgres:723403@localhost:5432/postgres')
        df = pd.read_sql('SELECT * FROM "SENSOR_SIGNAL_DATA" ORDER BY sl_no DESC LIMIT 1', engine)
        
        if df.empty:
            print(json.dumps([]))
            return
            
        # Feature Engineering (must match training)
        # Select same columns used in training
        numeric_cols = ['temp', 'rh', 'ihg', 'vrg', 'vhg', 'irg', 'idg', 'vdg', 'vhhg', 'ihhg', 'ioff', 'ion', 'ipl', 'pl', 'shpr', 'voff', 'von', 'iaug', 'vaug']
        
        # Ensure all columns exist
        for col in numeric_cols:
            if col not in df.columns:
                df[col] = 0
                
        X = df[numeric_cols]
        # Fill NaNs if any
        X = X.fillna(X.mean())

        # Predict anomaly (-1 is anomaly, 1 is normal)
        predictions = model.predict(X)
        scores = model.decision_function(X) # lower score -> more anomalous
        
        results = []
        for i, pred in enumerate(predictions):
            row = df.iloc[i]
            train_id = str(row.get('sl_no', 'UNKNOWN'))
            
            if pred == -1:
                results.append({
                    "train_id": train_id,
                    "alert_level": "CRITICAL",
                    "message": f"Anomalous sensor readings detected! Score: {scores[i]:.2f}",
                    "predicted_failure": "General Anomaly",
                    "confidence": abs(float(scores[i])) * 100 # Rough proxy
                })
            else:
                results.append({
                    "train_id": train_id,
                    "alert_level": "NORMAL",
                    "message": "Readings are within normal parameters.",
                    "predicted_failure": "None",
                    "confidence": float(scores[i]) * 100
                })
                
        print(json.dumps(results))

    except Exception as e:
        print(json.dumps([{"alert_level": "CRITICAL", "message": f"Inference Error: {str(e)}", "confidence": 0}]))

if __name__ == "__main__":
    main()

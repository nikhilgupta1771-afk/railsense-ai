import pandas as pd
import joblib
from sqlalchemy import create_engine
from sklearn.ensemble import IsolationForest
import os
import warnings

warnings.filterwarnings('ignore')

DB_URI = 'postgresql://postgres:723403@localhost:5432/postgres'
MODEL_PATH = 'ml_model/isolation_model.pkl'

def train():
    print("Starting Model Training...")
    try:
        engine = create_engine(DB_URI)
        
        # Load data
        print("Fetching data from database...")
        # Get up to 50,000 recent rows for training to keep it fast
        query = 'SELECT * FROM "SENSOR_SIGNAL_DATA" ORDER BY sl_no DESC LIMIT 50000'
        df = pd.read_sql(query, engine)
        
        if df.empty:
            print("No data found in SENSOR_SIGNAL_DATA table.")
            return

        print(f"Loaded {len(df)} rows. Engineering features...")
        
        # Use specific numeric columns that make sense for failure prediction
        numeric_cols = ['temp', 'rh', 'ihg', 'vrg', 'vhg', 'irg', 'idg', 'vdg', 'vhhg', 'ihhg', 'ioff', 'ion', 'ipl', 'pl', 'shpr', 'voff', 'von', 'iaug', 'vaug']
        
        # Ensure columns exist, fill missing if any
        available_cols = [c for c in numeric_cols if c in df.columns]
        X = df[available_cols].copy()
        
        # Fill missing values with mean
        X = X.fillna(X.mean())

        print("Training Isolation Forest model...")
        # Contamination is the expected proportion of outliers (anomalies) in the dataset
        model = IsolationForest(n_estimators=100, contamination=0.01, random_state=42)
        model.fit(X)

        # Save the model
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        joblib.dump(model, MODEL_PATH)
        
        print(f"Model trained successfully and saved to {MODEL_PATH}!")
        
        # Optional: Print a few predictions to test
        preds = model.predict(X.head())
        print(f"Sample predictions (1=Normal, -1=Anomaly): {preds}")

    except Exception as e:
        print(f"Error during training: {e}")

if __name__ == "__main__":
    train()

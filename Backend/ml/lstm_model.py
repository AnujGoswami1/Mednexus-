import numpy as np
import pandas as pd
from datetime import datetime, timedelta

class LSTMPredictor:
    """
    LSTM-based predictor for hospital bed occupancy.
    Uses synthetic training when real data is insufficient.
    """

    def __init__(self):
        self.model = None
        self.scaler = None
        self.sequence_length = 24  # 24 hours of history
        self.is_trained = False

    def _build_model(self, input_shape):
        try:
            from tensorflow.keras.models import Sequential
            from tensorflow.keras.layers import LSTM, Dense, Dropout, Bidirectional
            from tensorflow.keras.optimizers import Adam

            model = Sequential([
                Bidirectional(LSTM(64, return_sequences=True, input_shape=input_shape)),
                Dropout(0.3),
                LSTM(32, return_sequences=False),
                Dropout(0.2),
                Dense(16, activation='relu'),
                Dense(1, activation='sigmoid')
            ])
            model.compile(optimizer=Adam(learning_rate=0.001),
                         loss='mse', metrics=['mae'])
            return model
        except ImportError:
            return None

    def _generate_synthetic_data(self, total_beds, days=90):
        """Generate realistic synthetic hospital bed occupancy data"""
        np.random.seed(42)
        hours = days * 24
        timestamps = [datetime.now() - timedelta(hours=hours - i) for i in range(hours)]

        occupancy = []
        base_rate = 0.65

        for i, ts in enumerate(timestamps):
            hour = ts.hour
            dow = ts.weekday()

            # Time-of-day pattern
            if 8 <= hour <= 12:
                time_factor = 0.15
            elif 13 <= hour <= 17:
                time_factor = 0.10
            elif 18 <= hour <= 22:
                time_factor = 0.05
            else:
                time_factor = -0.05

            # Day-of-week pattern
            if dow < 5:
                dow_factor = 0.05
            else:
                dow_factor = -0.08

            # Seasonal trend (simulate flu season etc.)
            seasonal = 0.1 * np.sin(2 * np.pi * i / (24 * 30))

            # Random noise
            noise = np.random.normal(0, 0.05)

            rate = base_rate + time_factor + dow_factor + seasonal + noise
            rate = np.clip(rate, 0.1, 0.98)
            occupancy.append(rate)

        return np.array(occupancy), timestamps

    def _create_sequences(self, data):
        X, y = [], []
        for i in range(self.sequence_length, len(data)):
            X.append(data[i - self.sequence_length:i])
            y.append(data[i])
        return np.array(X), np.array(y)

    def train(self, hospital_id, bed_history_data=None, total_beds=100):
        """Train LSTM model"""
        from sklearn.preprocessing import MinMaxScaler

        if bed_history_data and len(bed_history_data) > self.sequence_length * 2:
            occupancy_rates = [1 - (h.available_count / h.total_count)
                             for h in bed_history_data if h.total_count > 0]
            data = np.array(occupancy_rates)
        else:
            data, _ = self._generate_synthetic_data(total_beds)

        self.scaler = MinMaxScaler(feature_range=(0, 1))
        scaled_data = self.scaler.fit_transform(data.reshape(-1, 1)).flatten()

        X, y = self._create_sequences(scaled_data)
        X = X.reshape((X.shape[0], X.shape[1], 1))

        self.model = self._build_model((self.sequence_length, 1))

        if self.model:
            split = int(len(X) * 0.8)
            self.model.fit(X[:split], y[:split],
                          validation_data=(X[split:], y[split:]),
                          epochs=20, batch_size=32, verbose=0)
            self.is_trained = True
            return True

        # Fallback: use statistical prediction
        self.is_trained = True
        self._fallback_data = data
        return True

    def predict(self, hours_ahead=24, total_beds=100):
        """Predict bed occupancy for next N hours"""
        predictions = []

        if self.model and self.scaler is not None:
            # Use LSTM
            last_sequence = self._fallback_data[-self.sequence_length:] if hasattr(self, '_fallback_data') else None
            if last_sequence is None:
                last_sequence, _ = self._generate_synthetic_data(total_beds, days=2)
                last_sequence = last_sequence[-self.sequence_length:]

            scaled = self.scaler.transform(last_sequence.reshape(-1, 1)).flatten()
            current_seq = scaled.copy()

            for i in range(hours_ahead):
                X_pred = current_seq[-self.sequence_length:].reshape(1, self.sequence_length, 1)
                pred = self.model.predict(X_pred, verbose=0)[0][0]
                predictions.append(pred)
                current_seq = np.append(current_seq, pred)

            predictions = self.scaler.inverse_transform(
                np.array(predictions).reshape(-1, 1)).flatten()
        else:
            # Statistical fallback
            if hasattr(self, '_fallback_data'):
                base = np.mean(self._fallback_data[-48:])
            else:
                base = 0.7

            for i in range(hours_ahead):
                hour = (datetime.now().hour + i) % 24
                if 8 <= hour <= 12:
                    factor = 0.1
                elif 18 <= hour <= 22:
                    factor = 0.05
                else:
                    factor = -0.03
                pred = base + factor + np.random.normal(0, 0.02)
                predictions.append(np.clip(pred, 0.1, 0.98))

        results = []
        for i, rate in enumerate(predictions):
            rate = float(np.clip(rate, 0.05, 0.98))
            pred_time = datetime.now() + timedelta(hours=i + 1)
            available = max(1, int(total_beds * (1 - rate)))
            results.append({
                'hour': i + 1,
                'timestamp': pred_time.isoformat(),
                'predicted_occupancy_rate': round(rate * 100, 1),
                'predicted_available_beds': available,
                'predicted_occupied_beds': total_beds - available,
                'confidence': round(max(0.7, 0.95 - (i * 0.008)), 2)
            })

        return results

    def predict_patients(self, days_ahead=7, avg_daily_patients=50):
        """Predict incoming patients for next N days"""
        predictions = []
        base = avg_daily_patients

        for d in range(days_ahead):
            pred_date = datetime.now() + timedelta(days=d + 1)
            dow = pred_date.weekday()

            if dow < 5:
                factor = 1.1
            elif dow == 5:
                factor = 0.8
            else:
                factor = 0.7

            seasonal = 1 + 0.15 * np.sin(2 * np.pi * d / 30)
            noise = np.random.normal(1, 0.1)

            predicted = int(base * factor * seasonal * noise)
            predictions.append({
                'day': d + 1,
                'date': pred_date.strftime('%Y-%m-%d'),
                'day_name': pred_date.strftime('%A'),
                'predicted_patients': max(5, predicted),
                'confidence': round(max(0.6, 0.92 - (d * 0.04)), 2)
            })

            
            
        return predictions
import numpy as np
from geopy.distance import geodesic
from datetime import datetime

class HospitalRecommender:
    """
    Smart hospital recommender combining distance, bed availability,
    and ML predictions to find the best hospital.
    """

    def __init__(self):
        self.weights = {
            'distance': 0.35,
            'availability': 0.30,
            'predicted_availability': 0.15,
            'rating': 0.10,
            'emergency': 0.10
        }

    def calculate_distance(self, user_lat, user_lng, hospital_lat, hospital_lng):
        """Calculate distance in km between user and hospital"""
        try:
            return geodesic(
                (user_lat, user_lng),
                (hospital_lat, hospital_lng)
            ).kilometers
        except Exception:
            # Haversine fallback
            R = 6371
            lat1, lat2 = np.radians(user_lat), np.radians(hospital_lat)
            dlat = np.radians(hospital_lat - user_lat)
            dlng = np.radians(hospital_lng - user_lng)
            a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlng/2)**2
            return R * 2 * np.arctan2(np.sqrt(a), np.sqrt(1-a))

    def _normalize(self, value, min_val, max_val, inverse=False):
        """Normalize value between 0 and 1"""
        if max_val == min_val:
            return 0.5
        normalized = (value - min_val) / (max_val - min_val)
        if inverse:
            normalized = 1 - normalized
        return np.clip(normalized, 0, 1)

    def recommend(self, user_lat, user_lng, hospitals, bed_type=None,
                  priority='normal', lstm_predictor=None, arima_predictor=None,
                  max_distance=50, top_n=10):
        """
        Recommend hospitals based on multiple factors.
        Returns sorted list of hospitals with scores.
        """
        candidates = []

        for hospital in hospitals:
            distance = self.calculate_distance(
                user_lat, user_lng,
                hospital.latitude, hospital.longitude
            )

            if distance > max_distance:
                continue

            # Calculate bed availability
            if bed_type:
                relevant_beds = [b for b in hospital.beds if b.bed_type == bed_type]
            else:
                relevant_beds = hospital.beds

            total_beds = sum(b.total_count for b in relevant_beds)
            available_beds = sum(b.available_count for b in relevant_beds)

            if total_beds == 0:
                continue

            availability_rate = available_beds / total_beds

            # Get predicted availability (next 4 hours average)
            predicted_availability = availability_rate  # default
            if lstm_predictor and lstm_predictor.is_trained:
                try:
                    preds = lstm_predictor.predict(hours_ahead=4, total_beds=total_beds)
                    predicted_availability = np.mean([
                        p['predicted_available_beds'] / total_beds for p in preds
                    ])
                except Exception:
                    pass

            candidates.append({
                'hospital': hospital,
                'distance': distance,
                'available_beds': available_beds,
                'total_beds': total_beds,
                'availability_rate': availability_rate,
                'predicted_availability': predicted_availability,
                'rating': hospital.rating or 3.0,
                'emergency_available': hospital.emergency_available
            })

        if not candidates:
            return []

        # Normalize all factors
        distances = [c['distance'] for c in candidates]
        min_dist, max_dist = min(distances), max(distances)

        availabilities = [c['availability_rate'] for c in candidates]
        min_avail, max_avail = min(availabilities), max(availabilities)

        pred_avails = [c['predicted_availability'] for c in candidates]
        min_pred, max_pred = min(pred_avails), max(pred_avails)

        ratings = [c['rating'] for c in candidates]
        min_rating, max_rating = min(ratings), max(ratings)

        # Adjust weights for priority
        weights = self.weights.copy()
        if priority == 'emergency':
            weights['distance'] = 0.45
            weights['availability'] = 0.30
            weights['emergency'] = 0.15
            weights['predicted_availability'] = 0.05
            weights['rating'] = 0.05

        results = []
        for c in candidates:
            dist_score = self._normalize(c['distance'], min_dist, max_dist, inverse=True)
            avail_score = self._normalize(c['availability_rate'], min_avail, max_avail)
            pred_score = self._normalize(c['predicted_availability'], min_pred, max_pred)
            rating_score = self._normalize(c['rating'], min_rating, max_rating)
            emergency_score = 1.0 if c['emergency_available'] else 0.0

            total_score = (
                weights['distance'] * dist_score +
                weights['availability'] * avail_score +
                weights['predicted_availability'] * pred_score +
                weights['rating'] * rating_score +
                weights['emergency'] * emergency_score
            )

            hospital_data = c['hospital'].to_dict()
            hospital_data.update({
                'distance_km': round(c['distance'], 2),
                'recommendation_score': round(total_score * 100, 1),
                'score_breakdown': {
                    'distance_score': round(dist_score * 100, 1),
                    'availability_score': round(avail_score * 100, 1),
                    'prediction_score': round(pred_score * 100, 1),
                    'rating_score': round(rating_score * 100, 1),
                    'emergency_score': round(emergency_score * 100, 1)
                },
                'estimated_travel_time': self._estimate_travel_time(c['distance']),
                'availability_status': self._get_status(c['availability_rate'])
            })
            results.append(hospital_data)

        results.sort(key=lambda x: x['recommendation_score'], reverse=True)
        return results[:top_n]

    def _estimate_travel_time(self, distance_km):
        """Estimate travel time in minutes (assume avg 30 km/h in city)"""
        minutes = (distance_km / 30) * 60
        if minutes < 1:
            return "< 1 min"
        elif minutes < 60:
            return f"{int(minutes)} min"
        else:
            hours = int(minutes // 60)
            mins = int(minutes % 60)
            return f"{hours}h {mins}m"

    def _get_status(self, rate):
        if rate >= 0.5:
            return 'high'
        elif rate >= 0.2:
            return 'medium'
        elif rate > 0:
            return 'low'
        else:
            return 'none'
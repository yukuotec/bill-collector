# Round 3: AI Transaction Categorization

## Feature: ML-Based Auto-Categorization with Learning

### Core Functionality
- Automatically categorize new transactions based on historical patterns
- Learn from user corrections to improve accuracy over time
- Confidence scoring - auto-apply high confidence, suggest for low confidence
- Multi-language support (Chinese/English merchant names)

### Implementation Plan

1. **Category Prediction Engine** (`src/main/category-ml.ts`)
   - Feature extraction: merchant name, amount, description, time patterns
   - Naive Bayes classifier (lightweight, no external ML libs)
   - Confidence scoring based on training data size
   - Incremental learning from user corrections

2. **Database Schema**
   - `category_models` table - store trained model weights
   - `category_training_data` table - store user corrections for retraining
   - `category_predictions` table - prediction history

3. **UI Components**
   - Category suggestion dropdown in transaction edit
   - "Auto-categorize all" button with preview
   - Training data management page
   - Accuracy metrics display

4. **Algorithm**
   - TF-IDF for merchant name similarity
   - Bayesian classification with Laplace smoothing
   - Amount binning (0-50, 50-200, 200-500, 500+)
   - Time-based features (weekday/weekend, hour of day)

### Privacy
- All model training happens locally
- No data sent to external services
- User can export/import their trained model

# Round 4: Voice Input & Natural Language

## Feature: Voice Commands and Natural Language Transaction Entry

### Core Functionality
- Voice-to-text for transaction entry
- Natural language parsing ("Lunch at McDonalds for 45 yuan yesterday")
- Command recognition ("Show me my budget for this month")
- Offline speech recognition using Web Speech API (browser) or native APIs

### Implementation Plan

1. **Voice Recognition Service** (`src/main/voice.ts`)
   - Web Speech API integration (renderer-side)
   - Command pattern matching
   - Confidence scoring

2. **Natural Language Parser** (`src/main/nlp.ts`)
   - Pattern matching for amounts, dates, merchants
   - Chinese and English support
   - Relative date parsing (today, yesterday, last week)

3. **Command System**
   - "Add [amount] for [description] on [date]"
   - "Show [report type] for [time period]"
   - "What's my [account/category] balance"

### Supported Patterns
- Amount: 45, 45元, ¥45, 45.50
- Dates: today, yesterday, last week, March 15, 3/15
- Merchants: at [name], from [name], for [item]
- Categories: category [name], for [category]

### Privacy
- Speech recognition via browser APIs (local)
- No audio data stored
- Text-only processing after recognition

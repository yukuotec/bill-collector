# Smart Assignment Feature Documentation

## Overview

The Smart Assignment feature automatically assigns transactions to family members based on learned patterns and predefined triage rules. This reduces manual work when managing shared expenses across multiple family members.

## Key Components

### 1. Triage Rules (Phase 1)
Predefined keyword-based rules that automatically assign transactions to specific family members:

- **老公 (Husband)**: 游戏, 数码, 电子, 汽车, 烟, 酒
- **老婆 (Wife)**: 化妆品, 护肤, 包包, 服饰, 美甲  
- **孩子 (Child)**: 学校, 培训, 玩具, 奶粉, 童装
- **家庭 (Family)**: 水电煤, 物业, 买菜, 日用品

When a transaction is imported, the system checks the counterparty and description against these rules and automatically assigns it to the matching member.

### 2. Machine Learning Patterns (Phase 2+)
The system learns from manual assignments and builds confidence-based patterns:

- **Feature Extraction**: Extracts features from counterparty, category, description, and merchant keywords
- **Pattern Learning**: Records assignment history and calculates confidence scores
- **Prediction**: Suggests or auto-assigns members based on learned patterns
- **Confidence Thresholds**:
  - ≥ 70%: Auto-assign automatically
  - 30-69%: Suggest assignment for user confirmation
  - < 30%: No suggestion

### 3. Batch Assignment Prompt
When manually assigning a transaction to a member, the system checks for similar transactions:

- **Similarity Detection**: Finds transactions with same counterparty, category, or merchant keywords
- **Threshold**: Prompts for batch assignment when 2+ similar transactions exist
- **User Choice**: User can choose to assign only current transaction or apply to all similar ones

## Usage Workflow

### Automatic Assignment During Import
1. CSV file is imported with multiple transactions
2. System applies triage rules to each transaction
3. Transactions matching rules are automatically assigned to corresponding members
4. Results show in import preview with member assignments

### Manual Assignment with Learning
1. User manually assigns a transaction to a member in the Transactions page
2. System extracts features from the transaction (counterparty, category, etc.)
3. Assignment is recorded in history and pattern confidence is updated
4. Future similar transactions will be suggested or auto-assigned

### Batch Assignment Workflow
1. User assigns transaction A to member X
2. System detects transactions B, C, D with similar features already assigned to X
3. Modal appears: "检测到 [Member X] 已有 2 笔或更多相似交易。是否将所有相似交易都分配给 [Member X]？"
4. User chooses:
   - **仅分配当前交易**: Only transaction A is assigned
   - **批量应用**: Transactions A, B, C, D are all assigned to member X

## Technical Implementation

### Database Schema
```sql
-- Assignment history table
CREATE TABLE assignment_history (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  member_id TEXT NOT NULL, 
  feature_key TEXT NOT NULL,
  feature_value TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Assignment patterns table  
CREATE TABLE assignment_patterns (
  id TEXT PRIMARY KEY,
  feature_key TEXT NOT NULL,
  feature_value TEXT NOT NULL,
  member_id TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  confidence REAL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE(feature_key, feature_value, member_id)
);
```

### Feature Extraction
The system extracts these features from transactions:
- **counterparty**: Exact merchant name (normalized)
- **category**: Transaction category 
- **description**: Transaction description text
- **merchant_keyword**: First 2-3 significant words from counterparty + description

### Confidence Calculation
For each feature combination (e.g., counterparty="麦当劳"), the system calculates:
```
confidence = (count_for_member / total_count_for_feature) * priority_weight
```

Priority weights: counterparty (4) > merchant_keyword (3) > category (2) > description (1)

## API Endpoints

### Main Process IPC Handlers
- `apply-triage-rules`: Apply triage rules to batch of transactions
- `auto-apply-triage-rules`: Apply triage rules and auto-assign matching transactions
- `check-similar-assignments`: Check for similar transactions when assigning
- `batch-assign-similar`: Batch assign similar transactions to a member
- `predict-member`: Predict member assignment for a single transaction

### CLI Integration
The CLI supports member assignment through the standard import process, with triage rules applied automatically during CSV import.

## Configuration

### Custom Triage Rules
Currently, triage rules are hardcoded in `src/shared/constants.ts`. To customize:

1. Edit the `TRIAGE_RULES` array in the constants file
2. Rebuild the application
3. Rules will apply to new imports

Future versions may support dynamic rule configuration through the UI.

### Pattern Management
- **View Patterns**: Available through database inspection (patterns table)
- **Clear Patterns**: `clearAllPatterns()` function resets all learned patterns
- **Delete Individual Pattern**: `deletePattern(id)` removes specific pattern

## Limitations and Future Improvements

### Current Limitations
- Triage rules require manual code changes to customize
- No UI for managing learned patterns
- Pattern learning only works with manual assignments (not bulk operations)

### Planned Enhancements
- Dynamic triage rule configuration in UI
- Pattern management interface
- Support for negative patterns (exclude certain keywords)
- Integration with receipt OCR for better feature extraction
- Cross-device pattern synchronization (when cloud sync is implemented)

## Testing

### Unit Tests
- Triage rule matching logic
- Feature extraction from transactions  
- Confidence calculation algorithms
- Similar transaction detection

### Integration Tests
- End-to-end import with automatic assignment
- Manual assignment with pattern learning
- Batch assignment workflow
- CLI import with member assignment

## Example Scenarios

### Scenario 1: Restaurant Bill
- **Transaction**: Counterparty="海底捞", Description="火锅消费"
- **Triage Rule**: Matches "火锅" → Category="餐饮" 
- **Result**: No automatic member assignment (no member-specific keywords)
- **Manual Assignment**: User assigns to "家庭" member
- **Learning**: Future "海底捞" transactions will be suggested for "家庭" member

### Scenario 2: Gaming Purchase  
- **Transaction**: Counterparty="Steam", Description="游戏购买"
- **Triage Rule**: Matches "游戏" → Automatically assigned to "老公"
- **Result**: Transaction appears with "老公" member assignment in import preview

### Scenario 3: School Fees
- **Transaction**: Counterparty="XX学校", Description="学费缴纳"  
- **Triage Rule**: Matches "学校" → Automatically assigned to "孩子"
- **Batch Effect**: If user later manually assigns another school transaction to "孩子", similar transactions will trigger batch assignment prompt

This comprehensive smart assignment system significantly reduces the manual effort required to manage shared family expenses while continuously improving through machine learning.
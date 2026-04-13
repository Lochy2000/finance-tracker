# AI Service

> **Current state: fully MOCKED.** Every function in `backend/services/ai_service.py` uses rule-based logic or templates. No external API is called. The architecture is designed so that each function can be replaced with a call to a local/self-hosted model (Ollama, vLLM, etc.) with minimal changes.

File: `backend/services/ai_service.py`

---

## Functions

### `categorize_transaction(merchant_raw, amount) → dict`

**Purpose:** Assign a spending category and subcategory to a transaction based on the merchant name.

**Current implementation:**
- Keyword matching against a hardcoded `CATEGORY_KEYWORDS` dictionary.
- 10 categories: Groceries, Transport, Dining, Shopping, Entertainment, Bills, Health, Subscriptions, Travel, Income.
- Each category has a list of subcategories in `SUBCATEGORIES`.
- If a keyword matches, returns `{ category, subcategory, confidence_score }` with confidence randomly sampled between 0.75–0.95.
- If no match, returns `{ category: "Other", subcategory: None, confidence_score: 0.30–0.50 }`.

**To replace with a real model:**
```python
async def categorize_transaction(merchant_raw: str, amount: float) -> Dict:
    prompt = f"Categorize this bank transaction: merchant='{merchant_raw}', amount={amount}. ..."
    response = await ollama_client.generate(model="llama3", prompt=prompt)
    # parse response into { category, subcategory, confidence_score }
    return parsed_result
```

---

### `normalize_merchant_name(merchant_raw) → str`

**Purpose:** Clean up messy merchant strings (e.g. `"TESCO STORES 6432**"` → `"Tesco Stores"`).

**Current implementation:**
- Strips whitespace.
- Removes sequences of 4+ digits (card numbers, reference codes).
- Removes `*` and `#` characters.
- Collapses multiple spaces.
- Applies `.title()` capitalisation.

**To replace:** An LLM could map raw merchant strings to a canonical merchant database.

---

### `detect_recurring_payments(transactions) → list[dict]`

**Purpose:** Find subscriptions and regular payments.

**Current implementation:**
- Groups transactions by `merchant_clean` (case-insensitive).
- For each merchant with ≥2 transactions, checks if all amounts are within 10% of the average.
- If consistent, marks as recurring with `frequency: "Monthly"` and `confidence: 0.6–0.8`.
- Returns top 10 sorted by amount.

**Limitations:**
- Doesn't actually check time intervals (monthly vs weekly).
- Marks any merchant with 2+ consistent payments as "Monthly".
- A proper implementation would analyse date gaps.

---

### `generate_monthly_summary(transactions, month, year) → dict`

**Purpose:** Generate a natural-language summary of the month's spending.

**Current implementation:**
- Calculates total spend, total income, top category.
- Returns a templated string: `"In this period, you spent £X across N transactions. Your largest spending category was Y."`
- Returns `{ summary_text, highlights: [...], generated_at }`.

**To replace:** An LLM could generate genuinely insightful commentary about spending patterns, comparisons, and advice.

---

### `detect_unusual_spending(transactions, historical_avg=None) → list[dict]`

**Purpose:** Flag transactions that are significantly larger than usual.

**Current implementation:**
- Calculates average spending across all negative transactions.
- Flags anything > 2.5× the average as unusual.
- Returns up to 5 items with `{ transaction_id, merchant, amount, date, reason, severity }`.
- Severity is "high" if > 3.75× average, otherwise "medium".

**Limitations:**
- Uses a flat average — doesn't account for category-specific norms.
- Doesn't consider time-of-month patterns.

---

### `generate_savings_suggestions(transactions, recurring) → list[dict]`

**Purpose:** Give personalised tips to reduce spending.

**Current implementation:**
- If monthly subscription total > £50, suggests reviewing subscriptions (potential savings = 20% of total).
- If dining spending > £200, suggests meal prepping (potential savings = 30% of dining).
- Always includes a generic "set up automatic savings" suggestion.

**To replace:** An LLM could analyse the full transaction history and give specific, non-obvious advice.

---

### `compare_months(current_month_txns, previous_month_txns) → dict`

**Purpose:** Compare spending between two periods.

**Current implementation:**
- Sums negative amounts for each period.
- Calculates absolute and percentage change.
- Breaks down changes by category.
- Returns `{ current_total, previous_total, absolute_change, percent_change, category_changes, trend }`.

---

## How to integrate a real model

The recommended approach for integrating Ollama or another local model:

1. **Install Ollama** and pull a model (e.g. `ollama pull llama3`).
2. **Create a client wrapper** in `services/ai_client.py`:
   ```python
   import httpx
   
   OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
   
   async def generate(prompt: str, model: str = "llama3") -> str:
       async with httpx.AsyncClient() as client:
           response = await client.post(f"{OLLAMA_URL}/api/generate", json={
               "model": model,
               "prompt": prompt,
               "stream": False
           })
           return response.json()["response"]
   ```
3. **Replace individual functions** in `ai_service.py` one at a time, keeping the same return types.
4. **Add a feature flag** (`AI_BACKEND=mock|ollama`) to switch between implementations during development.

## Category list

These are the categories used throughout the app (hardcoded in both backend AI service and frontend dropdowns):

```
Groceries, Transport, Dining, Shopping, Entertainment,
Bills, Health, Subscriptions, Travel, Income, Other
```

Adding a new category requires updating:
- `CATEGORY_KEYWORDS` and `SUBCATEGORIES` in `ai_service.py`
- `CATEGORIES` array in `TransactionsPage.js`
- `CATEGORIES` array in `ReportsPage.js`
- `getCategoryColor()` in `utils.js`

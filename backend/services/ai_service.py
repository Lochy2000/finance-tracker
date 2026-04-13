"""
AI Service for LedgerLens
--------------------------
This service provides AI-powered features for transaction analysis.
Currently uses mock implementations - designed for easy integration with 
local/self-hosted models (Ollama, etc.) later.

TODO: Replace mock implementations with actual AI model calls
"""

from typing import List, Dict, Optional
import secrets
from datetime import datetime, timezone

# Cryptographically secure RNG for confidence scores and mock data
_rng = secrets.SystemRandom()


# Category mappings for rule-based categorization
CATEGORY_KEYWORDS = {
    "Groceries": ["tesco", "sainsbury", "asda", "lidl", "aldi", "waitrose", "morrisons", "co-op", "ocado"],
    "Transport": ["uber", "tfl", "trainline", "national rail", "bus", "taxi", "bolt", "lyft", "petrol", "shell", "bp"],
    "Dining": ["restaurant", "cafe", "coffee", "starbucks", "costa", "pret", "mcdonald", "kfc", "nando", "deliveroo", "just eat", "uber eats"],
    "Shopping": ["amazon", "ebay", "asos", "zara", "h&m", "primark", "john lewis", "argos", "currys"],
    "Entertainment": ["netflix", "spotify", "cinema", "theatre", "disney", "apple music", "youtube", "prime video"],
    "Bills": ["electricity", "gas", "water", "council tax", "internet", "broadband", "phone", "mobile", "ee", "vodafone", "three", "o2"],
    "Health": ["pharmacy", "boots", "doctor", "dentist", "gym", "fitness", "nhs"],
    "Subscriptions": ["subscription", "monthly", "membership", "patreon"],
    "Travel": ["hotel", "airbnb", "booking", "expedia", "flight", "easyjet", "ryanair", "british airways"],
    "Income": ["salary", "payroll", "dividend", "interest", "refund", "cashback"],
}

SUBCATEGORIES = {
    "Groceries": ["Supermarket", "Convenience Store", "Online Grocery"],
    "Transport": ["Public Transport", "Ride Share", "Fuel", "Parking"],
    "Dining": ["Restaurant", "Fast Food", "Coffee Shop", "Food Delivery"],
    "Shopping": ["Online Shopping", "Clothing", "Electronics", "Home & Garden"],
    "Entertainment": ["Streaming", "Events", "Gaming", "Books & Media"],
    "Bills": ["Utilities", "Telecom", "Housing"],
    "Health": ["Medical", "Pharmacy", "Fitness"],
    "Subscriptions": ["Digital Services", "Memberships"],
    "Travel": ["Accommodation", "Flights", "Car Rental"],
    "Income": ["Salary", "Investment", "Refunds"],
}


async def categorize_transaction(merchant_raw: str, amount: float) -> Dict:
    """
    Categorize a transaction based on merchant name.
    
    TODO: Replace with AI model call for more accurate categorization
    Currently uses keyword matching as a placeholder.
    """
    merchant_lower = merchant_raw.lower()
    
    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in merchant_lower:
                subcategories = SUBCATEGORIES.get(category, [])
                subcategory = subcategories[0] if subcategories else None
                confidence = _rng.uniform(0.75, 0.95)
                return {
                    "category": category,
                    "subcategory": subcategory,
                    "confidence_score": round(confidence, 2)
                }
    
    # Default to uncategorized with low confidence
    return {
        "category": "Other",
        "subcategory": None,
        "confidence_score": round(_rng.uniform(0.3, 0.5), 2)
    }


async def normalize_merchant_name(merchant_raw: str) -> str:
    """
    Clean and normalize merchant names.
    
    TODO: Replace with AI-powered merchant recognition
    Currently uses basic string cleaning.
    """
    # Remove common suffixes and clean up
    cleaned = merchant_raw.strip()
    
    # Remove card numbers and reference codes
    import re
    cleaned = re.sub(r'\d{4,}', '', cleaned)
    cleaned = re.sub(r'[*#]+', '', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    
    # Capitalize properly
    return cleaned.title()


async def detect_recurring_payments(transactions: List[Dict]) -> List[Dict]:
    """
    Detect recurring payments from transaction history.
    
    TODO: Replace with AI pattern detection
    Currently uses simple merchant frequency analysis.
    """
    from collections import defaultdict
    
    merchant_transactions = defaultdict(list)
    for txn in transactions:
        merchant = txn.get("merchant_clean") or txn.get("merchant_raw", "")
        merchant_transactions[merchant.lower()].append(txn)
    
    recurring = []
    for merchant, txns in merchant_transactions.items():
        if len(txns) >= 2:
            amounts = [t["amount"] for t in txns]
            avg_amount = sum(amounts) / len(amounts)
            
            # Check if amounts are consistent (within 10%)
            is_consistent = all(abs(a - avg_amount) / avg_amount < 0.1 for a in amounts if avg_amount != 0)
            
            if is_consistent:
                recurring.append({
                    "merchant": merchant.title(),
                    "average_amount": round(avg_amount, 2),
                    "frequency": "Monthly" if len(txns) >= 2 else "Occasional",
                    "total_count": len(txns),
                    "confidence": 0.8 if len(txns) >= 3 else 0.6
                })
    
    return sorted(recurring, key=lambda x: x["average_amount"], reverse=True)[:10]


async def generate_monthly_summary(
    transactions: List[Dict],
    month: int,
    year: int
) -> Dict:
    """
    Generate an AI-powered monthly summary.
    
    TODO: Replace with actual LLM call for natural language generation
    Currently returns templated summary.
    """
    total_spend = sum(t["amount"] for t in transactions if t["amount"] < 0)
    total_income = sum(t["amount"] for t in transactions if t["amount"] > 0)
    
    # Category breakdown
    from collections import defaultdict
    categories = defaultdict(float)
    for t in transactions:
        cat = t.get("category", "Other")
        categories[cat] += abs(t["amount"])
    
    top_category = max(categories.items(), key=lambda x: x[1]) if categories else ("None", 0)
    
    highlights = []
    
    if total_spend != 0:
        highlights.append(f"Total spending: £{abs(total_spend):.2f}")
    if total_income > 0:
        highlights.append(f"Total income: £{total_income:.2f}")
    if top_category[0] != "None":
        highlights.append(f"Highest spending category: {top_category[0]} (£{top_category[1]:.2f})")
    
    # Generate mock AI summary text
    summary_text = f"In this period, you spent £{abs(total_spend):.2f} across {len(transactions)} transactions. "
    if top_category[0] != "None":
        summary_text += f"Your largest spending category was {top_category[0]}. "
    
    return {
        "summary_text": summary_text,
        "highlights": highlights,
        "generated_at": datetime.now(timezone.utc)
    }


async def detect_unusual_spending(
    transactions: List[Dict],
    historical_avg: Optional[Dict] = None
) -> List[Dict]:
    """
    Detect unusual spending patterns.
    
    TODO: Replace with anomaly detection model
    Currently uses simple threshold-based detection.
    """
    unusual = []
    
    # Find transactions significantly above average
    amounts = [abs(t["amount"]) for t in transactions if t["amount"] < 0]
    if amounts:
        avg_spend = sum(amounts) / len(amounts)
        threshold = avg_spend * 2.5  # Flag anything 2.5x above average
        
        for t in transactions:
            if abs(t["amount"]) > threshold and t["amount"] < 0:
                unusual.append({
                    "transaction_id": t.get("transaction_id", ""),
                    "merchant": t.get("merchant_clean") or t.get("merchant_raw", ""),
                    "amount": t["amount"],
                    "date": t.get("date"),
                    "reason": f"Amount is {abs(t['amount']) / avg_spend:.1f}x your average spending",
                    "severity": "high" if abs(t["amount"]) > threshold * 1.5 else "medium"
                })
    
    return unusual[:5]


async def generate_savings_suggestions(
    transactions: List[Dict],
    recurring: List[Dict]
) -> List[Dict]:
    """
    Generate personalized savings suggestions.
    
    TODO: Replace with AI-powered recommendation engine
    Currently returns templated suggestions.
    """
    suggestions = []
    
    # Analyze subscriptions
    subscription_total = sum(r["average_amount"] for r in recurring if r.get("frequency") == "Monthly")
    if subscription_total > 50:
        suggestions.append({
            "title": "Review your subscriptions",
            "description": f"You're spending approximately £{subscription_total:.2f}/month on recurring payments. Consider reviewing which ones you actively use.",
            "potential_savings": round(subscription_total * 0.2, 2),
            "priority": "high"
        })
    
    # Analyze dining spending
    from collections import defaultdict
    categories = defaultdict(float)
    for t in transactions:
        if t["amount"] < 0:
            cat = t.get("category", "Other")
            categories[cat] += abs(t["amount"])
    
    dining_spend = categories.get("Dining", 0)
    if dining_spend > 200:
        suggestions.append({
            "title": "Reduce dining out expenses",
            "description": f"You spent £{dining_spend:.2f} on dining. Consider meal prepping to save money.",
            "potential_savings": round(dining_spend * 0.3, 2),
            "priority": "medium"
        })
    
    # Generic savings suggestion
    suggestions.append({
        "title": "Set up automatic savings",
        "description": "Consider setting up a standing order to move money to savings on payday.",
        "potential_savings": None,
        "priority": "low"
    })
    
    return suggestions


async def compare_months(
    current_month_txns: List[Dict],
    previous_month_txns: List[Dict]
) -> Dict:
    """
    Compare spending between two months.
    
    TODO: Enhance with AI-powered trend analysis
    """
    current_total = sum(abs(t["amount"]) for t in current_month_txns if t["amount"] < 0)
    previous_total = sum(abs(t["amount"]) for t in previous_month_txns if t["amount"] < 0)
    
    change = current_total - previous_total
    change_percent = (change / previous_total * 100) if previous_total > 0 else 0
    
    # Category changes
    from collections import defaultdict
    current_cats = defaultdict(float)
    previous_cats = defaultdict(float)
    
    for t in current_month_txns:
        if t["amount"] < 0:
            current_cats[t.get("category", "Other")] += abs(t["amount"])
    
    for t in previous_month_txns:
        if t["amount"] < 0:
            previous_cats[t.get("category", "Other")] += abs(t["amount"])
    
    category_changes = []
    all_categories = set(current_cats.keys()) | set(previous_cats.keys())
    
    for cat in all_categories:
        curr = current_cats.get(cat, 0)
        prev = previous_cats.get(cat, 0)
        if prev > 0:
            cat_change = ((curr - prev) / prev) * 100
            category_changes.append({
                "category": cat,
                "current": curr,
                "previous": prev,
                "change_percent": round(cat_change, 1)
            })
    
    return {
        "current_total": round(current_total, 2),
        "previous_total": round(previous_total, 2),
        "absolute_change": round(change, 2),
        "percent_change": round(change_percent, 1),
        "category_changes": sorted(category_changes, key=lambda x: abs(x["change_percent"]), reverse=True)[:5],
        "trend": "increased" if change > 0 else "decreased" if change < 0 else "unchanged"
    }

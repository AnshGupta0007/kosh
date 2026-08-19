"""The rewards catalogue.

Six rewards, priced against what the seeded dataset actually earns so the
redeem flow is exercisable end to end: the cheapest is affordable
immediately, the most expensive is deliberately out of reach for a while.
Coin prices follow a flat ₹1 of value per 10 coins, which puts the
return on spend at roughly 1% — in line with a real rewards card.
"""

CATEGORIES = [
    ("food-dining", "Food & Dining", 12, 10),
    ("groceries", "Groceries", 95, 20),
    ("shopping", "Shopping", 320, 30),
    ("travel", "Travel", 205, 40),
    ("fuel", "Fuel", 25, 50),
    ("utilities", "Utilities", 45, 60),
    ("entertainment", "Entertainment", 285, 70),
    ("health", "Health", 155, 80),
    ("education", "Education", 262, 90),
    ("insurance", "Insurance", 180, 100),
]

REWARDS = [
    {
        "slug": "swiggy-250",
        "title": "₹250 Swiggy credit",
        "description": "Applied to your next Swiggy order. Valid for 60 days.",
        "kind": "VOUCHER",
        "coin_cost": 2500,
        "value_paise": 25000,
        "stock": None,
        "icon": "🍜",
        "accent": "coral",
        "sort_order": 10,
    },
    {
        "slug": "movie-night",
        "title": "Movie night for two",
        "description": "Two BookMyShow tickets, any screen, any day of the week.",
        "kind": "VOUCHER",
        "coin_cost": 6000,
        "value_paise": 60000,
        "stock": 25,
        "icon": "🎬",
        "accent": "violet",
        "sort_order": 30,
    },
    {
        "slug": "akshaya-patra-500",
        "title": "₹500 to Akshaya Patra",
        "description": "Funds roughly 20 school meals. We send the receipt to your email.",
        "kind": "DONATION",
        "coin_cost": 5000,
        "value_paise": 50000,
        "stock": None,
        "icon": "🤝",
        "accent": "green",
        "sort_order": 20,
    },
    {
        "slug": "amazon-1000",
        "title": "₹1,000 Amazon voucher",
        "description": "A one-time code for Amazon.in. No minimum order value.",
        "kind": "VOUCHER",
        "coin_cost": 10000,
        "value_paise": 100000,
        "stock": None,
        "icon": "📦",
        "accent": "amber",
        "sort_order": 40,
    },
    {
        "slug": "fuel-2500",
        "title": "₹2,500 fuel top-up",
        "description": "Loaded onto your fuel card at Indian Oil, HP and Shell.",
        "kind": "VOUCHER",
        "coin_cost": 25000,
        "value_paise": 250000,
        "stock": 40,
        "icon": "⛽",
        "accent": "blue",
        "sort_order": 50,
    },
    {
        "slug": "statement-cashback-50k",
        "title": "₹50,000 statement cashback",
        "description": "Wipes a full billing cycle. The one everyone is saving for.",
        "kind": "CASHBACK",
        "coin_cost": 500000,
        "value_paise": 5000000,
        "stock": 3,
        "icon": "💸",
        "accent": "teal",
        "sort_order": 60,
    },
]

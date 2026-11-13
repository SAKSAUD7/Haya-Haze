"""Starter CMS content. Legal pages are sensible starting points for an Indian D2C
store, not legal advice: have them reviewed before launch."""

ABOUT = [
    ("paragraph", "<p>Haya &amp; Haze was created with one simple truth: modesty and beauty have always belonged together. The name says it all. <b>Haya</b> — the Arabic word for modesty, dignity, and inner grace. <b>Haze</b> — the soft, effortless beauty of fabric that moves with you. Together, they represent the woman we design for. A woman who is rooted in her values, expressive in her style, and completely at ease in who she is.</p>"),
    ("paragraph", "<p>We design hijabs and modest wear for women who want to get dressed and simply feel good. No compromise, no overthinking — just pieces that are elegant, comfortable, and made for real life. From quiet weekday mornings to special occasions, every Haya &amp; Haze piece is thoughtfully crafted to feel as beautiful as it looks.</p>"),
    ("quote", {"text": "When a woman feels good in what she wears, she shows up differently. Softer where she wants to be. Stronger where it matters.", "attribution": ""}),
    ("paragraph", "<p>We believe modest fashion should feel like you — timeless, personal, and effortlessly graceful. Because when a woman feels good in what she wears, she shows up differently. Softer where she wants to be. Stronger where it matters.</p>"),
    ("paragraph", "<p>This is not just a brand. It is a space where faith, femininity and fashion come together — naturally, beautifully, unapologetically.</p>"),
    ("paragraph", "<p><b>Draped in Grace. Defined by You.</b><br/>— The Haya &amp; Haze Family</p>"),
]

FAQ = [
    ("Orders & payment", [
        ("Which payment methods do you accept?", "<p>UPI, credit and debit cards, netbanking and wallets through Razorpay, and Cash on Delivery across most of India. International cards are accepted through Stripe.</p>"),
        ("Is Cash on Delivery available?", "<p>Yes, on most pincodes. A small COD handling fee applies and is shown at checkout. Enter your pincode on any product page to check.</p>"),
        ("Can I change or cancel my order?", "<p>You can cancel from your account any time before the order ships. To change an address or item, message us on WhatsApp as soon as possible and we will do our best.</p>"),
        ("Do I need an account to order?", "<p>No. You can check out as a guest and track your order with your order number and email. An account simply keeps your orders, addresses and wishlist in one place.</p>"),
    ]),
    ("Shipping & delivery", [
        ("How long does delivery take?", "<p>Standard delivery takes 5–7 working days and Express takes 2–3 working days. Metro cities are usually faster. Your estimated date is shown at checkout.</p>"),
        ("How much is shipping?", "<p>Shipping is free on orders above ₹1499. Below that, a flat rate applies and is shown in your bag before you pay.</p>"),
        ("How do I track my order?", "<p>We email you a tracking link the moment your order ships. You can also use the Track Order page with your order number and email.</p>"),
    ]),
    ("Returns & exchanges", [
        ("What is your return policy?", "<p>If something is not right, you can request a return or exchange within 7 days of delivery. Items should be unworn, unwashed and in their original packaging.</p>"),
        ("How do I start a return or exchange?", "<p>Sign in, open the order under My Orders and choose Return or Exchange. Add a photo if the item arrived damaged. We will arrange a pickup once approved.</p>"),
        ("When will I get my refund?", "<p>Refunds are issued to your original payment method within 5–7 working days of us receiving the item. COD orders are refunded by bank transfer or store credit.</p>"),
    ]),
    ("Fabric & care", [
        ("Which fabric should I choose?", "<p><b>Chiffon and georgette</b> are light and airy. <b>Modal and jersey</b> are soft, breathable and grip well. <b>Silk</b> is our most luxurious, for special occasions. <b>Crepe and nida</b> give abayas their elegant fall.</p>"),
        ("How do I care for silk?", "<p>Dry clean, or hand wash cold with a gentle detergent. Never wring. Iron on low, inside out, while slightly damp.</p>"),
        ("Are your hijabs opaque?", "<p>Jersey, modal, crepe and nida are fully opaque. Chiffon and organza are softly sheer by nature and are best worn with an undercap.</p>"),
    ]),
]

LEGAL = {
    "privacy-policy": ("Privacy Policy", "How we collect, use and protect your information.", [
        ("heading", "What we collect"),
        ("paragraph", "<p>When you place an order or create an account we collect your name, email address, phone number, delivery address and order details. Payments are processed by our payment partners (Razorpay and Stripe); we never see or store your full card number, UPI PIN or netbanking password.</p>"),
        ("heading", "How we use it"),
        ("paragraph", "<ul><li>To process, deliver and support your orders</li><li>To send order updates by email, SMS or WhatsApp</li><li>To send marketing emails if you have opted in (you can unsubscribe at any time)</li><li>To improve our store and prevent fraud</li></ul>"),
        ("heading", "Who we share it with"),
        ("paragraph", "<p>Only with the services needed to run the store: payment gateways, courier partners and email providers. We do not sell your personal information.</p>"),
        ("heading", "Cookies and analytics"),
        ("paragraph", "<p>We use essential cookies to keep your bag and sign-in working. With your consent we also use analytics and advertising cookies (Google Analytics, Meta Pixel) to understand how the store is used.</p>"),
        ("heading", "Your rights"),
        ("paragraph", "<p>You can ask to see, correct or delete your personal information at any time by writing to hello@hayaandhaze.com.</p>"),
    ]),
    "terms-and-conditions": ("Terms & Conditions", "The terms that apply when you shop with us.", [
        ("paragraph", "<p>By using this website and placing an order you agree to these terms.</p>"),
        ("heading", "Products and pricing"),
        ("paragraph", "<p>We take care to show colours and details accurately, but screens vary and slight differences can occur. All prices are in Indian Rupees and include GST unless stated otherwise. We may change prices or withdraw products at any time; this does not affect orders already confirmed.</p>"),
        ("heading", "Orders"),
        ("paragraph", "<p>An order is confirmed once payment is received, or for Cash on Delivery once we have verified it with you. We may cancel an order if an item is unavailable, a price was shown incorrectly or we suspect fraud; any payment taken will be refunded in full.</p>"),
        ("heading", "Intellectual property"),
        ("paragraph", "<p>All content on this site, including the Haya &amp; Haze name, logo, photographs and text, belongs to Haya &amp; Haze and may not be used without permission.</p>"),
        ("heading", "Governing law"),
        ("paragraph", "<p>These terms are governed by the laws of India.</p>"),
    ]),
    "returns-and-refunds": ("Returns & Refunds", "Easy returns and exchanges within 7 days of delivery.", [
        ("heading", "Returns and exchanges"),
        ("paragraph", "<p>You can request a return or exchange within <b>7 days of delivery</b>. Items must be unworn, unwashed, free of perfume or make-up marks, and returned with their original tags and packaging.</p>"),
        ("heading", "What cannot be returned"),
        ("paragraph", "<ul><li>Items marked Final Sale</li><li>Inner caps and undercaps, for hygiene reasons</li><li>Gift cards</li></ul>"),
        ("heading", "How it works"),
        ("paragraph", "<ol><li>Sign in and open the order under My Orders, then choose Return or Exchange.</li><li>We review your request, usually within one working day.</li><li>Once approved we arrange a pickup from your address.</li><li>After a quality check we issue your refund or send your exchange.</li></ol>"),
        ("heading", "Refunds"),
        ("paragraph", "<p>Refunds go to your original payment method within 5–7 working days of us receiving the item. Cash on Delivery orders are refunded by bank transfer or store credit. Shipping and COD fees are not refundable unless the item arrived damaged or incorrect.</p>"),
        ("heading", "Damaged or wrong item"),
        ("paragraph", "<p>We are sorry if that happens. Please request a return within 48 hours of delivery with a photo, and we will replace it or refund you in full, including shipping.</p>"),
    ]),
    "shipping-policy": ("Shipping Policy", "Delivery times, charges and tracking.", [
        ("table", {"caption": "Delivery options", "rows": [
            "Method | Delivery time | Charge",
            "Standard | 5–7 working days | Free above ₹1499, otherwise ₹79",
            "Express | 2–3 working days | ₹149 (₹70 on orders above ₹1499)",
        ]}),
        ("paragraph", "<p>Orders are packed within 1–2 working days. Delivery times are estimates from our courier partners and can be longer during sales, festivals and bad weather.</p>"),
        ("heading", "Cash on Delivery"),
        ("paragraph", "<p>COD is available on most pincodes for orders up to ₹10,000. A handling fee is shown at checkout. We may call or message to confirm a COD order before it ships.</p>"),
        ("heading", "Tracking"),
        ("paragraph", "<p>You will receive a tracking link by email as soon as your order ships. You can also check its status on the Track Order page.</p>"),
        ("heading", "International orders"),
        ("paragraph", "<p>We currently ship within India. International shipping is coming soon; write to us if you would like to be told when it opens.</p>"),
    ]),
    "cancellation-policy": ("Cancellation Policy", "Cancelling an order before it ships.", [
        ("paragraph", "<p>You can cancel an order at any time before it ships, from My Orders or the Track Order page. Prepaid orders are refunded in full to the original payment method within 5–7 working days.</p>"),
        ("paragraph", "<p>Once an order has shipped it can no longer be cancelled. You are welcome to refuse the parcel or request a return after delivery under our Returns &amp; Refunds policy.</p>"),
        ("paragraph", "<p>We may cancel an order if an item turns out to be unavailable, the delivery address cannot be serviced, or a COD order cannot be verified. You will be told straight away and refunded in full.</p>"),
    ]),
}

SIZE_GUIDE = [
    ("paragraph", "<p>Our abayas are cut for a relaxed, flowing fit. If you are between sizes, choose by length first: measure from the top of your shoulder to where you would like the hem to fall, wearing the shoes you plan to wear.</p>"),
    ("table", {"caption": "Abayas & modest dresses", "rows": [
        "Size | Bust | Shoulder | Length | Height guide",
        "S | 38\" | 15\" | 52\" | up to 5'2\"",
        "M | 40\" | 15.5\" | 54\" | 5'2\" – 5'4\"",
        "L | 42\" | 16\" | 56\" | 5'4\" – 5'6\"",
        "XL | 44\" | 16.5\" | 58\" | 5'6\" – 5'8\"",
    ]}),
    ("table", {"caption": "Hijabs & scarves", "rows": [
        "Style | Size | Notes",
        "Standard scarf | 180 × 70 cm | Full coverage, most wrap styles",
        "Silk square | 110 × 110 cm | Classic folded styles",
        "Instant hijab | Free Size | Stretch fit, covers the chest",
    ]}),
    ("paragraph", "<p>Still unsure? Message us on WhatsApp with your height and usual size and we will help you choose.</p>"),
]

JOURNAL = [
    ("three-everyday-hijab-styles", "Three everyday hijab styles in under two minutes", "tutorial",
     "Simple wraps for chiffon, jersey and modal that stay put from morning to Maghrib.", 4, [
        ("paragraph", "<p>Some mornings there is time for a mirror and a dozen pins. Most mornings there is not. These three styles take under two minutes each and work with the scarves you already own.</p>"),
        ("heading", "1. The classic wrap"),
        ("paragraph", "<p>Best in chiffon or georgette. Place the scarf with one side longer, pin under the chin, then bring the long side over your head and let it fall across the chest. One pin at the shoulder and you are done.</p>"),
        ("heading", "2. The no-pin tuck"),
        ("paragraph", "<p>Best in jersey or modal. Wrap once around, cross at the nape and tuck the end into the fold at your shoulder. The fabric grips itself, so there is nothing to adjust.</p>"),
        ("heading", "3. The loose drape"),
        ("paragraph", "<p>Best in silk. Drape the scarf evenly over an undercap, cross the ends at the front and let one fall behind the shoulder. Soft, unstructured and quietly elegant.</p>"),
        ("quote", {"text": "The best style is the one you stop thinking about the moment you leave the house.", "attribution": ""}),
     ]),
    ("how-to-care-for-silk", "How to care for a silk hijab so it lasts for years", "care",
     "Washing, drying, ironing and storing silk, without the worry.", 3, [
        ("paragraph", "<p>Silk has a reputation for being difficult. It is not: it simply likes to be treated gently. Look after it and a good silk hijab will outlast almost everything else in your wardrobe.</p>"),
        ("heading", "Washing"),
        ("paragraph", "<ul><li>Hand wash in cold water with a mild, pH-neutral detergent.</li><li>Swirl gently for a minute or two. Never rub, twist or wring.</li><li>Rinse in cold water until it runs clear.</li></ul>"),
        ("heading", "Drying and ironing"),
        ("paragraph", "<p>Press the water out in a clean towel, then dry flat or hang in the shade. Iron on the lowest setting, inside out, while the silk is still slightly damp.</p>"),
        ("heading", "Storing"),
        ("paragraph", "<p>Fold loosely or roll, and keep away from direct sunlight and perfume, both of which fade colour over time.</p>"),
     ]),
    ("the-meaning-of-haya", "The meaning of Haya", "stories",
     "On modesty as a quiet kind of confidence, and why we named a brand after it.", 5, [
        ("paragraph", "<p>Haya is one of those words that does not translate neatly. Modesty comes close. So does dignity, and so does a certain inner grace. It is the feeling of being at ease with yourself, with nothing to prove.</p>"),
        ("paragraph", "<p>When we started this brand we kept returning to that feeling. Not modesty as a set of rules, but as a kind of calm. The woman who walks into a room and is simply, comfortably herself.</p>"),
        ("quote", {"text": "Modesty and beauty have always belonged together.", "attribution": "The Haya & Haze Family"}),
        ("paragraph", "<p>Haze is the other half: softness, movement, fabric that follows you instead of fighting you. Put them together and you have what we hope every piece gives you. Grounded in your values, fluid in your expression.</p>"),
     ]),
]

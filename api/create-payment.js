export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { tariff } = req.body || {};

    const tariffs = {
      card:    { amount: "999.00",    description: "Обучение «Карточка товара»" },
      wb0:     { amount: "56000.00",  description: "Курс «Бизнес на WB с нуля»" },
      self:    { amount: "9900.00",   description: "Самостоятельный тариф" },
      consult: { amount: "14000.00",  description: "Консультация" },
      indiv:   { amount: "169000.00", description: "Индивидуальное обучение" }
    };

    const t = tariffs[tariff];
    if (!t) return res.status(400).json({ error: "Unknown tariff" });

    const proto = req.headers["x-forwarded-proto"] || "https";
    const origin = `${proto}://${req.headers.host}`;
    const returnUrl = `${origin}/success.html?tariff=${encodeURIComponent(tariff)}`;

    const idempotenceKey =
      globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

    const auth = Buffer.from(
      `${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`
    ).toString("base64");

    const payload = {
      amount: { value: t.amount, currency: "RUB" },
      confirmation: { type: "redirect", return_url: returnUrl },
      capture: true,
      description: t.description,
      metadata: { tariff }
    };

    const r = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        "Idempotence-Key": idempotenceKey
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(400).json({ error: "YooKassa error", details: data });
    }

    return res.status(200).json({
      confirmation_url: data.confirmation?.confirmation_url
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
}

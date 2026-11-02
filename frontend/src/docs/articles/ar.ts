import type { DocsArticle, DocsArticleKey } from "./types";

const articles: Record<DocsArticleKey, DocsArticle> = {
  quickstart: {
    sections: [
      {
        id: "keys",
        title: "المفاتيح",
        blocks: [
          {
            kind: "p",
            text: "Merchant API يستقبل الدفع بالعملات المشفرة: تنشئ فاتورة، يدفع العميل، ويعرف خادمك بالنتيجة عبر webhook. كل الأمثلة تستخدم Base URL، والبادئة /api/v1/client داخله أصلًا.",
          },
          {
            kind: "list",
            ordered: true,
            items: [
              "في لوحة التاجر افتح «مفاتيح API» وأنشئ مفتاحًا.",
              "المفتاح العام يبقى ظاهرًا. المفتاح السري يُعرض مرة واحدة — احفظه فورًا.",
              "احتفظ بالقيمتين على الخادم فقط: متغيرات بيئة أو مخزن أسرار.",
              "استدعِ GET /rates واختر عملة وشبكة متاحتين للعميل.",
              "أنشئ فاتورة اختبار عبر POST /invoices وأرسل للعميل رابطًا أو عنوانًا.",
              "اضبط webhook وجرّب التسليم قبل الطلبات الحقيقية.",
            ],
          },
          {
            kind: "note",
            tone: "warn",
            text: "لا تضع المفتاح السري في الواجهة أو تطبيق الجوال أو مستودع عام. بعد تدوير المفاتيح حدّث إعداد الخادم فورًا.",
          },
        ],
      },
      {
        id: "auth",
        title: "المصادقة",
        blocks: [
          {
            kind: "p",
            text: "الفواتير والرصيد والأسعار والمعاملات طلبات من خادم إلى خادم. أضف هذين الترويستين في كل طلب. أسماء الترويسات لا تفرّق حالة الأحرف، والقيم يجب أن تطابق.",
          },
          {
            kind: "code",
            label: "الترويسات",
            text: "X-API-Key: <public_key>\nX-API-Secret: <secret_key>",
          },
          {
            kind: "params",
            rows: [
              { name: "X-API-Key", required: "نعم", text: "المفتاح العام للمشروع." },
              { name: "X-API-Secret", required: "نعم", text: "المفتاح السري. يفتح الوصول إلى API. لا ترسله إلى المتصفح." },
            ],
          },
          {
            kind: "p",
            text: "إعداد webhook يتم عبر واجهة اللوحة: POST /auth/login يعيد JWT في Authorization: Bearer. إنشاء الفواتير نفسها يتم بزوج مفاتيح API وليس برمز اللوحة.",
          },
        ],
      },
      {
        id: "first-invoice",
        title: "أول فاتورة",
        blocks: [
          {
            kind: "p",
            text: "الفاتورة طلب إيداع. تحدد المبلغ بالعملة الورقية، والمنصة تحسب مبلغ العملة المشفرة. merchant_order_id هو رقم طلبك — به تطابق الدفع لاحقًا.",
          },
          {
            kind: "code",
            label: "الطلب",
            text: `curl -X POST "{{apiBase}}/invoices" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "<project_id>",
    "merchant_order_id": "order_1001",
    "amount_fiat": 100,
    "fiat_currency": "USD",
    "crypto_currency": "USDT",
    "network": "TRC20"
  }'`,
          },
          {
            kind: "params",
            rows: [
              { name: "project_id", required: "نعم", text: "المشروع المرتبط بالمفتاح. معرّف مشروع آخر يعيد 400." },
              { name: "merchant_order_id", required: "نعم", text: "معرّف طلبك، حتى 255 حرفًا. احفظه بجانب الدفع." },
              { name: "amount_fiat", required: "نعم", text: "المبلغ بالعملة الورقية، أكبر من صفر." },
              { name: "fiat_currency", required: "لا", text: "عملة المبلغ. الافتراضي USD." },
              { name: "crypto_currency", required: "لا", text: "الرمز المتوقع. الافتراضي USDT. خذ الزوج من GET /rates." },
              { name: "network", required: "لا", text: "الشبكة، مثل TRC20. الافتراضي TRC20. يجب أن تكون في rates ومتاحة." },
              { name: "metadata", required: "لا", text: "كائن حر لمطابقتك. لا يُعاد في رد API." },
            ],
          },
        ],
      },
      {
        id: "response",
        title: "ماذا يعني الرد",
        blocks: [
          {
            kind: "code",
            label: "نجاح · 201",
            text: `{
  "id": "inv_01J_DOCS_EXAMPLE",
  "merchant_order_id": "order_1001",
  "amount_fiat": "100.00",
  "amount_crypto": "100.25",
  "crypto_currency": "USDT",
  "network": "TRC20",
  "payment_page_url": "https://noren.digital/pay/abc123example",
  "checkout_delivery": "payment_page",
  "status": "pending",
  "expires_at": "2026-04-06T11:45:00Z"
}`,
          },
          {
            kind: "p",
            text: "لا تعرض JSON كاملًا للعميل. checkout_delivery يحدد الحقول. payment_page يعطي payment_page_url فقط. h2h يعطي payment_address و qr_url بلا رابط الصفحة. مسؤول المنصة يضبط الوضع، والتاجر يراه ولا يبدّله.",
          },
          {
            kind: "note",
            tone: "info",
            text: "amount_crypto هو المبلغ الذي يجب أن يرسله العميل. الشبكة مهمة: USDT على شبكة أخرى إلى هذا العنوان لن يُقيَّد.",
          },
        ],
      },
      {
        id: "statuses",
        title: "حالات الفاتورة",
        blocks: [
          {
            kind: "p",
            text: "الحالة تأتي في GET /invoices/{id} وفي webhook. لا تعتبر رد الإنشاء حالة الدفع النهائية.",
          },
          {
            kind: "table",
            headers: ["الحالة", "المعنى"],
            rows: [
              ["pending", "أُنشئت الفاتورة ولم يظهر تحويل بعد."],
              ["confirming", "وُجد التحويل وننتظر تأكيدات الشبكة."],
              ["paid", "وصل المبلغ ويجري تسويته. الزيادة تُقيَّد هنا بالمبلغ الفعلي."],
              ["confirmed", "تم تأكيد الدفع. يمكن إغلاق الطلب."],
              ["underpaid", "وصل أقل من المتوقع. الفاتورة تبقى مفتوحة: يكمل العميل على نفس العنوان أو تقبل ما وصل."],
              ["expired", "انتهت مهلة الفاتورة بلا دفع جديد."],
              ["cancelled", "أُلغيت الفاتورة."],
              ["failed", "خطأ، بما فيه عملة أو شبكة غير صحيحة."],
              ["aml_frozen", "يوجد إيداع والأموال قيد مراجعة الامتثال. لا تغلق الطلب قبل تغيّر الحالة."],
            ],
          },
        ],
      },
      {
        id: "errors",
        title: "الأخطاء",
        blocks: [
          {
            kind: "p",
            text: "الخطأ هو رمز HTTP مع JSON فيه detail. أصلح 4xx عندك. أعد محاولة 5xx والمهلة بعد توقف قصير.",
          },
          {
            kind: "code",
            label: "المبلغ خارج الحد · 400",
            text: `{
  "detail": {
    "code": "amount_out_of_range",
    "message": "Amount is outside the allowed range.",
    "currency": "USDT",
    "network": "TRC20",
    "min_amount": "5",
    "max_amount": "5000"
  }
}`,
          },
          {
            kind: "list",
            items: [
              "401 — ترويسات ناقصة أو مفتاح خاطئ.",
              "400 — جسم غير صالح: project_id غريب، أو طلب فارغ، أو مبلغ خارج حدود /rates.",
              "404 — هذا المفتاح لا يرى الفاتورة أو المعاملة.",
              "503 — API غير متاح مؤقتًا. أعد المحاولة.",
            ],
          },
        ],
      },
    ],
  },
  invoices: {
    sections: [
      {
        id: "create",
        title: "إنشاء فاتورة",
        blocks: [
          {
            kind: "p",
            text: "POST /invoices ينشئ طلب إيداع. يُحوَّل المبلغ الورقي إلى العملة المشفرة التي تختارها. استدعِه من الخادم بعد أن يكون لطلبك merchant_order_id.",
          },
          {
            kind: "p",
            text: "المصادقة: X-API-Key و X-API-Secret. قبل أول فاتورة حقيقية راجع GET /rates. min_deposit حد بالعملة المشفرة، و min_deposit_fiat دليل بالدولار.",
          },
          {
            kind: "code",
            label: "الطلب",
            text: `curl -X POST "{{apiBase}}/invoices" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "<project_id>",
    "merchant_order_id": "order_1001",
    "amount_fiat": 100,
    "fiat_currency": "USD",
    "crypto_currency": "USDT",
    "network": "TRC20"
  }'`,
          },
          {
            kind: "params",
            rows: [
              { name: "project_id", required: "نعم", text: "يجب أن يطابق مشروع المفتاح." },
              { name: "merchant_order_id", required: "نعم", text: "معرّف طلبك. تبحث عن الدفع به." },
              { name: "amount_fiat", required: "نعم", text: "المبلغ الورقي، أكبر من صفر." },
              { name: "fiat_currency", required: "لا", text: "الافتراضي USD." },
              { name: "crypto_currency", required: "لا", text: "الافتراضي USDT. استخدم زوجًا من rates حيث client_available = true." },
              { name: "network", required: "لا", text: "الافتراضي TRC20. إذا كانت memo_required فلا تسقط المذكرة." },
            ],
          },
          {
            kind: "p",
            text: "id في الرد هو invoice_id للاستدعاءات التالية. status بعد الإنشاء غالبًا pending. expires_at هو آخر وقت: بعده لا تتوقع تحويلًا جديدًا إذا بقيت الحالة pending.",
          },
        ],
      },
      {
        id: "list",
        title: "قائمة الفواتير",
        blocks: [
          {
            kind: "p",
            text: "GET /invoices يعيد فواتير هذا المفتاح، الأحدث أولًا. للمطابقة والدعم. لحالة طلب واحد استخدم الجلب بالمعرّف.",
          },
          {
            kind: "code",
            label: "الطلب",
            text: `curl -X GET "{{apiBase}}/invoices?limit=20&offset=0" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "params",
            rows: [
              { name: "limit", required: "لا", text: "حجم الصفحة. الافتراضي 50 والحد 200." },
              { name: "offset", required: "لا", text: "الإزاحة للصفحة التالية. الافتراضي 0." },
              { name: "sync", required: "لا", text: "true يحدّث الفواتير النشطة لدى المزوّد قبل الرد. أبطأ ويحتاج صلاحية كتابة. للقائمة العادية اتركه false." },
            ],
          },
        ],
      },
      {
        id: "get",
        title: "فاتورة واحدة",
        blocks: [
          {
            kind: "p",
            text: "GET /invoices/{invoice_id} يعيد الحالة الحالية وبيانات الدفع، وبعد وجود دفع كتلة التسوية: الإجمالي والعمولة والصافي. استخدمه إذا لم يصل webhook، أو لعرض المتبقي عند النقص.",
          },
          {
            kind: "code",
            label: "الطلب",
            text: `curl -X GET "{{apiBase}}/invoices/inv_01J_DOCS_EXAMPLE" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "p",
            text: "المعامل sync=true يعمل كـ POST /sync: تُسحب حالة المزوّد داخل هذا الرد. مناسب لفحص يدوي، لا لاستطلاع كل ثانية. القناة الأساسية هي webhook.",
          },
          {
            kind: "code",
            label: "جزء من رد النقص",
            text: `{
  "status": "underpaid",
  "amount_review": {
    "kind": "underpaid",
    "expected_amount": "250",
    "received_amount": "249.84",
    "remaining_amount": "0.16",
    "credited": false
  }
}`,
          },
        ],
      },
      {
        id: "sync",
        title: "مزامنة الحالة",
        blocks: [
          {
            kind: "p",
            text: "POST /invoices/{invoice_id}/sync يسأل المزوّد فورًا ويعيد نفس كائن جلب فاتورة واحدة. استخدمه إذا ضاع webhook والطلب ما زال مفتوحًا (pending أو confirming أو underpaid).",
          },
          {
            kind: "code",
            label: "الطلب",
            text: `curl -X POST "{{apiBase}}/invoices/inv_01J_DOCS_EXAMPLE/sync" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "note",
            tone: "info",
            text: "نجاح المزامنة لا يغني عن webhook. إذا صارت الحالة confirmed فتأكد أنك خزّنت الحدث مرة واحدة عبر event_id.",
          },
        ],
      },
      {
        id: "accept",
        title: "قبول الدفع الناقص",
        blocks: [
          {
            kind: "p",
            text: "POST /invoices/{invoice_id}/accept-received يقيّد المبلغ الذي وصل أصلًا ويوقف انتظار الإكمال. استدعِه فقط بعد أن يختار العميل «أبقِ هذا المبلغ» في شاشة H2H.",
          },
          {
            kind: "list",
            items: [
              "يجب أن تكون الحالة underpaid وأن يكون amount_review.received_amount معروفًا.",
              "بعد النجاح تنتقل الحالة إلى confirming أو confirmed ويصبح amount_review.credited = true.",
              "إذا كان العميل سيُكمل، لا تستدعِ الطريقة. التحويل الثاني إلى نفس العنوان يبقى على هذه الفاتورة، والمبلغ في webhook تراكمي.",
              "في صفحة الدفع المستضافة الزر على /pay/{token} يستدعي POST عامًا بلا مفاتيحك.",
            ],
          },
          {
            kind: "code",
            label: "الطلب",
            text: `curl -X POST "{{apiBase}}/invoices/inv_01J_DOCS_EXAMPLE/accept-received" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "note",
            tone: "warn",
            text: "الزيادة لا تحتاج تأكيدًا منفصلًا: تُقيَّد كمبلغ مدفوع حسب ما وصل فعلًا.",
          },
        ],
      },
    ],
  },
  checkout: {
    sections: [
      {
        id: "mode",
        title: "وضع المشروع",
        blocks: [
          {
            kind: "p",
            text: "checkout_delivery يحدد ما تعرضه للدافع. الحقل نفسه في POST /invoices وفي GET وداخل كائن invoice في webhook.",
          },
          {
            kind: "table",
            headers: ["الوضع", "ماذا تعطي العميل"],
            rows: [
              ["payment_page", "فقط payment_page_url. العنوان ورمز QR على الصفحة."],
              ["h2h", "payment_address و qr_url. API لا يعيد /pay/{token}. أنت ترسم الشاشة."],
              ["both", "كل الحقول. للتكاملات القديمة."],
            ],
          },
          {
            kind: "p",
            text: "الوضع الحالي في اللوحة ضمن التكامل → Webhook. يغيّره مسؤول المنصة.",
          },
        ],
      },
      {
        id: "payment-page",
        title: "صفحة الدفع",
        blocks: [
          {
            kind: "p",
            text: "أقصر طريق: إعادة توجيه أو زر إلى payment_page_url. صفحة /pay/{token} تعرض المبلغ والشبكة وQR والمؤقت والحالة. لا تحتاج لاستطلاع السلسلة.",
          },
          {
            kind: "code",
            label: "جزء من الرد",
            text: `{
  "payment_page_url": "https://noren.digital/pay/abc123example",
  "checkout_delivery": "payment_page"
}`,
          },
          {
            kind: "p",
            text: "إذا لففت الصفحة بنفسك، الحالة العامة بلا مفاتيح: GET /api/v1/public/pay/{token}. هذا المسار ليس تحت Base URL للوحة — مضيفه موقع الدفع.",
          },
        ],
      },
      {
        id: "h2h",
        title: "شاشتك (H2H)",
        blocks: [
          {
            kind: "p",
            text: "H2H حين يعيش العنوان وQR داخل تطبيقك. اعرض الشبكة و amount_crypto بدقة والعنوان والمذكرة إن وُجدت. اطلب نسخ المبلغ كاملًا: التقريب يعطي underpaid.",
          },
          {
            kind: "code",
            label: "جزء من الرد",
            text: `{
  "payment_address": "TG9exampleAddress",
  "qr_url": "https://example.com/qr/inv_01J",
  "checkout_delivery": "h2h"
}`,
          },
          {
            kind: "list",
            items: [
              "لا تعِد استخدام العنوان بين الطلبات. هو لفاتورة واحدة.",
              "حدّث الحالة من webhook. GET مسار احتياطي.",
              "بعد expires_at توقف عن عرض العنوان كعنوان صالح إذا بقيت الحالة pending.",
            ],
          },
        ],
      },
      {
        id: "underpaid",
        title: "النقص على الشاشة",
        blocks: [
          {
            kind: "p",
            text: "عندما يصل أقل، تصبح الحالة underpaid. amount_review يفسّر الأرقام: expected_amount المتوقع، received_amount ما وصل، remaining_amount المتبقي.",
          },
          {
            kind: "list",
            items: [
              "في الصفحة المستضافة يضغط الدافع «أبقِ المبلغ» أو يكمل إلى نفس العنوان.",
              "في H2H اعرض الخيار نفسه. «أبقِ» هو POST /invoices/{id}/accept-received.",
              "الإكمال لا ينشئ فاتورة جديدة. webhook التالي يحمل نفس invoice.id ومبلغًا تراكميًا.",
            ],
          },
        ],
      },
    ],
  },
  webhooks: {
    sections: [
      {
        id: "events",
        title: "أي الأحداث تصل",
        blocks: [
          {
            kind: "p",
            text: "المنصة تستدعي عنوانك عندما تتغير حالة الفاتورة. هكذا تُغلق الطلب. لا تستطلع GET في حلقة.",
          },
          {
            kind: "table",
            headers: ["event", "متى"],
            rows: [
              ["invoice.status_changed", "تغيّر حقيقي: ظهر تحويل، أو تأكد، أو نقص، أو إلغاء."],
              ["invoice.test_deposit", "اختبار من اللوحة أو POST /webhooks/test. حالة الفاتورة لا تتغير، وفي الجسم simulated: true."],
            ],
          },
          {
            kind: "p",
            text: "اسم الحدث يتكرر في X-Merset-Event. عالج الجسم فقط بعد نجاح التوقيع.",
          },
        ],
      },
      {
        id: "setup",
        title: "إلى أين يُرسل",
        blocks: [
          {
            kind: "p",
            text: "العنوان والسر لكل مشروع. هذا نداء لوحة: JWT المالك وصلاحية client.webhooks.write، وليس زوج مفاتيح الدفع.",
          },
          {
            kind: "code",
            label: "حفظ webhook",
            text: `curl -X POST "{{apiBase}}/webhooks" \\
  -H "Authorization: Bearer <jwt_access>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "<project_id>",
    "webhook_url": "https://merchant.example.com/webhooks/noren",
    "webhook_secret": "merchant-webhook-secret"
  }'`,
          },
          {
            kind: "p",
            text: "webhook_url يجب أن يكون HTTPS ومتاحًا من الإنترنت. webhook_secret سلسلتك، وبها تتحقق من HMAC. استخدم السر نفسه لوحدة CMS إن ركّبت إضافة.",
          },
          {
            kind: "code",
            label: "إرسال اختبار",
            text: `curl -X POST "{{apiBase}}/webhooks/test" \\
  -H "Authorization: Bearer <jwt_access>" \\
  -H "Content-Type: application/json" \\
  -d '{ "project_id": "<project_id>" }'`,
          },
        ],
      },
      {
        id: "payload",
        title: "جسم الطلب",
        blocks: [
          {
            kind: "p",
            text: "الجسم JSON مضغوط. حقول invoice تطابق API الفاتورة وتتبع checkout_delivery: التفاصيل الزائدة تُحذف ببساطة.",
          },
          {
            kind: "code",
            label: "مثال invoice.status_changed",
            text: `{
  "event": "invoice.status_changed",
  "event_id": "wh_01J_DOCS_EXAMPLE",
  "sent_at": "2026-03-30T12:45:00+00:00",
  "invoice": {
    "id": "inv_01J_DOCS_EXAMPLE",
    "merchant_order_id": "order_1001",
    "status": "confirmed",
    "amount_crypto": "100.25",
    "crypto_currency": "USDT",
    "network": "TRC20",
    "checkout_delivery": "payment_page"
  },
  "transaction": {
    "id": "tx_01J_DOCS_EXAMPLE",
    "status": "confirmed",
    "gross_amount": "100.00",
    "total_fee": "1.10",
    "net_amount": "98.90",
    "currency": "USDT"
  }
}`,
          },
          {
            kind: "params",
            rows: [
              { name: "event_id", required: "نعم", text: "معرّف فريد لهذا التسليم. احفظه وتجاهل التكرار بنفس المعرّف." },
              { name: "sent_at", required: "نعم", text: "وقت الإرسال، ISO-8601." },
              { name: "invoice.id", required: "نعم", text: "فاتورة المنصة. الإيداع الثاني عند النقص يبقي هذا المعرّف." },
              { name: "invoice.merchant_order_id", required: "نعم", text: "رقم طلبك من POST /invoices." },
              { name: "invoice.status", required: "نعم", text: "الحالة الحالية. أغلق الطلب عند confirmed (أو paid حسب سياستك)." },
              { name: "transaction", required: "لا", text: "يظهر عند وجود قيد. net_amount ما يبقى بعد العمولة. null إن لم يُدفع شيء." },
            ],
          },
        ],
      },
      {
        id: "signature",
        title: "التوقيع",
        blocks: [
          {
            kind: "p",
            text: "التوقيع يغطي جسم الطلب الخام كما هو. لا تحلّل JSON ثم تعيد تسلسله. مسافة أو ترتيب مفاتيح مختلف يكسر HMAC.",
          },
          {
            kind: "list",
            ordered: true,
            items: [
              "اقرأ الجسم الخام كـ UTF-8.",
              "خذ webhook_secret الخاص بالمشروع.",
              "احسب HMAC-SHA256(secret, body) وحوّله إلى hex.",
              "قارن مع X-Merset-Signature. الشكل المتوقع sha256=<hex>.",
              "قارن بزمن ثابت. عند الاختلاف أجب 401 ولا تقيّد شيئًا.",
              "إذا عولج event_id سابقًا فأجب 2xx واخرج. لا تُجرِ الدفع مرتين.",
            ],
          },
          {
            kind: "code",
            label: "التحقق في Python",
            text: `import hmac
import hashlib

def signature_ok(secret: str, raw_body: bytes, header: str) -> bool:
    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    expected = f"sha256={digest}"
    return hmac.compare_digest(expected, header or "")`,
          },
          {
            kind: "table",
            headers: ["الترويسة", "لماذا"],
            rows: [
              ["Content-Type", "application/json"],
              ["User-Agent", "Merset-Webhook/1.0"],
              ["X-Merset-Event", "اسم الحدث، مثل invoice.status_changed"],
              ["X-Merset-Event-Id", "نفس معرّف event_id في الجسم"],
              ["X-Merset-Timestamp", "وقت الإرسال"],
              ["X-Merset-Signature", "sha256= ثم HMAC بالنظام الست عشري"],
            ],
          },
          {
            kind: "note",
            tone: "warn",
            text: "أجب 2xx فقط بعد حفظ الحدث عندك. 4xx و 5xx فشل، والمنصة تعيد المحاولة.",
          },
        ],
      },
      {
        id: "retries",
        title: "إعادة المحاولة",
        blocks: [
          {
            kind: "p",
            text: "يُحاول التسليم حتى ثلاث مرات مع توقف قصير. إذا لم يعد أي منها 2xx يُسجَّل فشل التسليم. قد تكون حالة الفاتورة على المنصة قد تغيّرت. اقرأها عبر GET /invoices/{id} أو POST /sync.",
          },
          {
            kind: "p",
            text: "قد تصل إعادة المحاولة بـ event_id جديد ونفس invoice.id. أزل التكرار للتسليم (event_id) وللعملية (لا تقيّد merchant_order_id نفسه مرتين).",
          },
        ],
      },
    ],
  },
  balance: {
    sections: [
      {
        id: "get",
        title: "جلب الرصيد",
        blocks: [
          {
            kind: "p",
            text: "GET /balance يعيد رصيد التسوية للتاجر بعملة المستأجر، غالبًا USDT. ليس محفظة العميل ولا فاتورة واحدة. هو ما قُيّد لك فعلًا.",
          },
          {
            kind: "code",
            label: "الطلب",
            text: `curl -X GET "{{apiBase}}/balance" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "code",
            label: "نجاح",
            text: `{
  "currency": "USDT",
  "available_amount": "980.50",
  "frozen_amount": "0",
  "pending_amount": "20.00",
  "locked_amount": "0",
  "total_amount": "1000.50",
  "hold_hours": 24,
  "next_release_at": "2026-04-07T11:30:00Z",
  "holds": [
    {
      "transaction_id": "tx_01J_DOCS_EXAMPLE",
      "invoice_id": "inv_01J_DOCS_EXAMPLE",
      "merchant_order_id": "order_1001",
      "amount": "98.90",
      "available_at": "2026-04-07T11:30:00Z"
    }
  ]
}`,
          },
        ],
      },
      {
        id: "fields",
        title: "معنى المبالغ",
        blocks: [
          {
            kind: "params",
            rows: [
              { name: "available_amount", required: "نعم", text: "المتاح للاستخدام. الحقل amount يكرر هذا الرقم." },
              { name: "pending_amount", required: "نعم", text: "دُفع لكنه ما زال محجوزًا وغير متاح." },
              { name: "frozen_amount", required: "نعم", text: "مجمّد، مثلًا أثناء مراجعة." },
              { name: "locked_amount", required: "نعم", text: "مقفل لعملية لم تكتمل." },
              { name: "total_amount", required: "نعم", text: "مجموع الأجزاء الأربعة. ليس «كم يمكن سحبه»." },
              { name: "hold_hours", required: "نعم", text: "كم ساعة يبقى الدفع محجوزًا قبل أن يصبح متاحًا." },
            ],
          },
          {
            kind: "p",
            text: "السحب إلى عنوان خارجي يتم من اللوحة، لا بهذه الطريقة. API الرصيد يقرأ الأرقام فقط.",
          },
        ],
      },
      {
        id: "holds",
        title: "الحجوزات",
        blocks: [
          {
            kind: "p",
            text: "holds قائمة مدفوعات لم تصبح متاحة بعد. amount هنا صافٍ بعد العمولة. available_at وقت تحرير هذا السطر. next_release_at أقرب تحرير في القائمة.",
          },
          {
            kind: "note",
            tone: "info",
            text: "قائمة holds فارغة و pending_amount = 0 تعني أنه لا حجز الآن. available_amount قد يبقى أكبر من صفر.",
          },
        ],
      },
    ],
  },
  transactions: {
    sections: [
      {
        id: "list",
        title: "قائمة العمليات",
        blocks: [
          {
            kind: "p",
            text: "GET /transactions سجل قيود مستأجرك: ماذا وصل، أي عمولة أُخذت، وماذا قُيّد. الفواتير بلا دفع لا تظهر هنا.",
          },
          {
            kind: "code",
            label: "الطلب",
            text: `curl -X GET "{{apiBase}}/transactions?limit=20&offset=0" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "params",
            rows: [
              { name: "limit", required: "لا", text: "حجم الصفحة. الافتراضي 50 والحد 200." },
              { name: "offset", required: "لا", text: "الإزاحة. للصفحة التالية مرّر عدد الصفوف التي استلمتها." },
            ],
          },
        ],
      },
      {
        id: "one",
        title: "عملية واحدة",
        blocks: [
          {
            kind: "p",
            text: "GET /transactions/{transaction_id} يعيد نفس صف القائمة. خذ المعرّف من webhook (transaction.id) أو من القائمة. معرّف مفتاح آخر يعيد 404.",
          },
          {
            kind: "code",
            label: "الطلب",
            text: `curl -X GET "{{apiBase}}/transactions/tx_01J_DOCS_EXAMPLE" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "code",
            label: "نجاح",
            text: `{
  "id": "tx_01J_DOCS_EXAMPLE",
  "invoice_id": "inv_01J_DOCS_EXAMPLE",
  "gross_amount": "100.00",
  "total_fee": "1.10",
  "net_amount": "98.90",
  "currency": "USDT",
  "status": "confirmed",
  "invoice_status": "confirmed",
  "paid_at": "2026-04-06T11:40:00Z"
}`,
          },
        ],
      },
      {
        id: "fees",
        title: "العمولة في القيد",
        blocks: [
          {
            kind: "p",
            text: "ثلاثة حقول تكفي للمطابقة. gross_amount المبلغ قبل الخصم. total_fee عمولة المنصة (نسبة لا تقل عن الحد الأدنى). net_amount ما يخص رصيد التاجر: الإجمالي ناقص العمولة.",
          },
          {
            kind: "p",
            text: "عمولة شبكة البلوكشين ليست داخل هذه الحقول. تعتمد على TRC20 و ERC20 وغيرها وتظهر منفصلة في اللوحة. شرح التعرفة في قسم العمولات.",
          },
          {
            kind: "note",
            tone: "info",
            text: "فاتورة أُنشئت للتو بلا قيد بعد. مبلغ صفر قبل الدفع ليس خطأ تكامل.",
          },
        ],
      },
    ],
  },
  rates: {
    sections: [
      {
        id: "list",
        title: "العملات والشبكات",
        blocks: [
          {
            kind: "p",
            text: "GET /rates يقول ماذا يمكن قبوله الآن: العملة والشبكة والحدود والتوفر. استدعِه قبل إنشاء فاتورة ولا تخزّنه طويلًا. الحدود والأعلام تتغير.",
          },
          {
            kind: "code",
            label: "الطلب",
            text: `curl -X GET "{{apiBase}}/rates" \\
  -H "X-API-Key: <public_key>" \\
  -H "X-API-Secret: <secret_key>"`,
          },
          {
            kind: "code",
            label: "جزء من الرد",
            text: `{
  "items": [
    {
      "currency": "USDT",
      "networks": [
        {
          "network": "TRC20",
          "min_deposit": "5",
          "max_deposit": "5000",
          "min_deposit_fiat": "5",
          "max_deposit_fiat": "5000",
          "network_fee": "1",
          "client_available": true,
          "memo_required": false,
          "acquiring": true,
          "withdrawal": true
        }
      ]
    }
  ]
}`,
          },
        ],
      },
      {
        id: "fields",
        title: "كيف تقرأ الشبكة",
        blocks: [
          {
            kind: "params",
            rows: [
              { name: "currency", required: "نعم", text: "رمز العملة. أرسله في crypto_currency." },
              { name: "network", required: "نعم", text: "الشبكة. أرسلها في network. USDT على TRC20 و USDT على ERC20 مساران مختلفان." },
              { name: "min_deposit / max_deposit", required: "نعم", text: "النطاق المسموح بالعملة المشفرة. فاتورة خارجه تعيد amount_out_of_range." },
              { name: "min_deposit_fiat / max_deposit_fiat", required: "لا", text: "نفس النطاق كدليل بالدولار لفحص amount_fiat قبل الطلب." },
              { name: "client_available", required: "نعم", text: "true — يمكن عرض هذا الزوج. false — لا تنشئ فاتورة حتى لو كان المزوّد يعمل." },
              { name: "acquiring", required: "نعم", text: "true — قبول الدفع على هذه الشبكة مفعّل." },
              { name: "withdrawal", required: "نعم", text: "true — يمكن استخدام الشبكة للسحب." },
              { name: "memo_required", required: "نعم", text: "true — تحويل بلا مذكرة أو وسم لا يُقيَّد. اعرضها بجانب العنوان." },
              { name: "network_fee", required: "لا", text: "دليل لعمولة الشبكة. ليست تعرفة المنصة 0.4%." },
              { name: "availability_reason", required: "لا", text: "سبب قصير عند إيقاف الزوج. للدعم. للعميل أخفِ طريقة الدفع." },
            ],
          },
        ],
      },
      {
        id: "choose",
        title: "ماذا تضع في الفاتورة",
        blocks: [
          {
            kind: "list",
            ordered: true,
            items: [
              "أبقِ الشبكات التي client_available و acquiring فيها true.",
              "تأكد أن amount_fiat داخل min_deposit_fiat و max_deposit_fiat.",
              "في POST /invoices أرسل currency كـ crypto_currency و network كـ network.",
              "إذا كانت memo_required فلا تخفِ payment_memo من رد الفاتورة في شاشة H2H.",
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "قائمة items فارغة أو كل client_available = false تعني أن القبول مغلق. لا تفترض TRC20 من العادة.",
          },
        ],
      },
    ],
  },
  reference: {
    sections: [
      {
        id: "map",
        title: "أين كل طريقة",
        blocks: [
          {
            kind: "p",
            text: "لكل طريقة صفحة: لماذا تستدعيها، والحقول، ومثال الطلب والرد. هذه خريطة.",
          },
          {
            kind: "links",
            items: [
              { to: "/invoices", title: "الفواتير", text: "POST /invoices والقائمة والفاتورة والمزامنة وقبول النقص." },
              { to: "/balance", title: "الرصيد", text: "GET /balance — المتاح والحجز والتجميد." },
              { to: "/transactions", title: "المعاملات", text: "سجل القيود والعمولة في عملية واحدة." },
              { to: "/rates", title: "الأسعار والحدود", text: "GET /rates — العملات والشبكات والحد الأدنى/الأقصى." },
              { to: "/webhooks", title: "Webhook", text: "الجسم والترويسات والتحقق من HMAC." },
              { to: "/checkout", title: "Checkout", text: "رابط /pay/{token} أو العنوان وQR." },
            ],
          },
        ],
      },
      {
        id: "auth",
        title: "أي مصادقة",
        blocks: [
          {
            kind: "table",
            headers: ["الطريقة", "الترويسات"],
            rows: [
              ["GET /health", "بلا مصادقة. الرد: status ok و scope client."],
              ["POST /invoices و GET /invoices و GET /balance و GET /rates و GET /transactions", "X-API-Key و X-API-Secret"],
              ["POST /invoices/{id}/sync و /accept-received", "نفس المفاتيح مع صلاحية كتابة الفواتير."],
              ["POST /auth/login", "جسم فيه البريد وكلمة المرور. الرد access_token."],
              ["POST /webhooks و POST /webhooks/test", "Authorization: Bearer <jwt>"],
            ],
          },
          {
            kind: "p",
            text: "مخطط OpenAPI على /openapi.json في API الحي، والوثائق التفاعلية على /docs. الأمثلة في هذه الأقسام تستخدم Base URL الخاص بك.",
          },
        ],
      },
    ],
  },
};

export const docsArticlesAr = articles;

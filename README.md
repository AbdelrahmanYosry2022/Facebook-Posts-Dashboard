# FB Posts Dashboard

لوحة بسيطة لعرض آخر بوستات فيسبوك (آخر 5) مع إجمالي التفاعلات و Breakdown عند الطلب، مع طبقة Backend وسيط للأمان وتقليل استهلاك Facebook Graph API.

## التشغيل

1. إعداد متغيرات البيئة في مجلد `fb-server` (يفضل استخدام ملف `.env` خارج المستودع الفعلي):
```
FB_USER_LONG_LIVED_TOKEN=ضع_التوكن_الخاص_بك
CACHE_TTL_SECONDS=1800
```
2. تشغيل السيرفر:
```
cd fb-server
npm install
npm run start
```
3. تشغيل الواجهة:
```
cd ..
npm install
npm run dev
```
4. تأكد أن `VITE_API_BASE_URL` في `.env.local` يشير إلى `http://localhost:4000` أو رابط النشر.

## Endpoints (Backend)
- `GET /posts` يعيد آخر 5 بوستات (مخزنة في كاش داخلي).
- `GET /breakdown/:postId` يعيد تفاصيل التفاعلات باستخدام Facebook Batch API.
- `GET /metrics` عدادات الاستهلاك.
- `POST /invalidate-cache` تفريغ الكاش.

## أمان
- تمت إزالة التوكن من الفرونت، الآن يُدار فقط في السيرفر.
- لا تضع التوكن في ملفات مبنية أو `VITE_` متغيرات عامة.

## تحسينات مستقبلية
- دعم pagination / اختيار Page ID.
- Redis بدلاً من node-cache عند النشر.
- إضافة مصادقة خفيفة (API Key) لواجهات السيرفر.
- اختبارات وحدة وتحميل.

## تطوير
- الكود الرئيسي للواجهة في `src/App.jsx`.
- منطق الكاش المحلي ما زال يعمل (يمكن تعطيله لاحقاً لو أردت الاعتماد فقط على السيرفر).

## رخصة
مشروع تجريبي داخلي.

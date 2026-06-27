# Paymob setup for Matrouh Cup

## Files to copy

- `app/page.tsx`
- `app/api/paymob/create-intention/route.ts`
- `app/api/paymob/webhook/route.ts`
- `app/payment/result/page.tsx`
- optional: `.env.paymob.example`

## Required env variables

Add these locally in `.env.local` and on Vercel in Project Settings → Environment Variables:

```env
PAYMOB_BASE_URL=https://accept.paymob.com
PAYMOB_SECRET_KEY=
PAYMOB_PUBLIC_KEY=
PAYMOB_HMAC_SECRET=
PAYMOB_INTEGRATION_IDS=
NEXT_PUBLIC_SITE_URL=https://matrouhcup.online
```

`PAYMOB_INTEGRATION_IDS` should contain the Paymob payment method integration IDs separated by commas.

## Paymob dashboard URLs

Transaction processed callback / webhook:

```txt
https://matrouhcup.online/api/paymob/webhook
```

Transaction response callback:

```txt
https://matrouhcup.online/payment/result
```

The app itself also sends an order-specific redirection URL when it creates the payment intention:

```txt
https://matrouhcup.online/payment/result?orderId=<ORDER_ID>
```

## Local test

```bash
npm run dev
```

Then open `/admin`, add products, then open the shop and choose Paymob payment.

## Build and deploy

```bash
npm run build
vercel --prod
```

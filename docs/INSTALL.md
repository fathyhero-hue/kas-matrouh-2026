# Matrouh Sports Compliance Pages + Footer Installation

## Included files

- `components/SiteFooter.tsx`
- `app/products/page.tsx`
- `app/about/page.tsx`
- `app/contact/page.tsx`
- `app/privacy-policy/page.tsx`
- `app/delivery-shipping-policy/page.tsx`
- `app/refund-cancellation-policy/page.tsx`
- `install-compliance-pages-with-footer.bat`
- `scripts/add-footer-to-layout.ps1`

## Install

Extract the package directly into your project root:

```txt
C:\Users\HERO\tournament-app2
```

Then run:

```txt
install-compliance-pages-with-footer.bat
```

The script backs up:

```txt
app/layout.tsx
app/page.tsx
```

into:

```txt
backup-before-compliance-footer
```

Then it injects:

```tsx
import SiteFooter from "@/components/SiteFooter";
```

and adds:

```tsx
<SiteFooter />
```

after `{children}` in `app/layout.tsx`.

## Test routes

- `/products`
- `/about`
- `/contact`
- `/privacy-policy`
- `/delivery-shipping-policy`
- `/refund-cancellation-policy`

# Landing screenshot slots

Drop full-resolution PNG screenshots of the live app here. The
landing page references them by filename; once a file exists at the
expected path, the corresponding stylized fallback is replaced with
the real screenshot inside a browser-chrome frame.

## Expected files

| Filename         | Page captured              | Recommended viewport |
|------------------|----------------------------|----------------------|
| `results.png`    | `/` (Results) with a query | 1440 × 900           |
| `outreach.png`   | `/outreach`                | 1440 × 900           |
| `followups.png`  | `/followups`               | 1440 × 900           |
| `analytics.png`  | `/analytics`               | 1440 × 900           |
| `search.png`     | Search modal / filter open | 1440 × 900           |

## Capture tips

- Light mode only — landing is locked to light, dark screenshots
  will look out of place.
- Use Cleanshot (Cmd+Shift+5 on macOS, then choose "Window" or
  "Selection") at 2x retina if possible — Next.js will downscale.
- Crop tightly to the app surface — don't include browser chrome,
  the `ScreenshotFrame` component adds its own.
- Make sure no real customer data is visible (PII, real emails).
- Aim for ~1MB or smaller. Run through TinyPNG / Squoosh if needed.

## Wiring a screenshot in

```tsx
import { ScreenshotFrame } from '@/components/ui/screenshot-frame'

<ScreenshotFrame src="/screenshots/outreach.png" alt="Outreach board" />
```

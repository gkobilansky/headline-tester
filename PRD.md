## Headline Tester Product Requirements

### 1. Product Overview
Headline Tester is a conversational experimentation platform that helps indie hackers, solopreneurs, startup founders, marketers, and agencies ship headline A/B tests without touching code. Built on Vercel's Next.js AI Chatbot template, the product embeds a single-line script on any website, interprets page context to recommend experiments, and lets site admins manage tests through a chat-first interface. Stripe's Agent Toolkit powers usage-based billing with the first test free.

### 2. Goals
- Reduce the friction required to launch and manage headline experiments for resource-constrained teams.
- Provide context-aware recommendations that increase the likelihood of impactful tests.
- Monetize through a per-test billing model while offering a low-friction free tier.

### 3. Non-Goals
- Full multivariate testing beyond headlines during the initial release.
- Deep integrations with analytics suites or CMS platforms.
- Complex role-based admin controls (single admin auth via Auth.js only).

### Lean Delivery Principles
- Ship the simplest end-to-end flow that delivers value; prefer manual or synchronous steps over background automation until usage proves the need.
- Defer optional services (landingpage.report, headless rendering, advanced analytics) to backlog spikes after MVP adoption signals.
- Optimize for developer velocity and observability over theoretical scale; invest in caching or performance tuning only when metrics require it.
- Keep conversational UX consistent—avoid parallel dashboards or control surfaces unless validated by user demand.

### 4. Target Users
- Indie hackers launching new landing pages.
- Solo founders iterating on positioning.
- Small marketing teams and agencies managing client sites.

### 5. Success Metrics
- Time-to-first-test (from sign-up to launching a test) under 10 minutes.
- Percentage of users completing at least one recommended test.
- Conversion from free test to paid tests.
- Experiment success rate uplift compared to user baseline (captured via self-report or analytics).

### 6. Key Features & Requirements

#### 6.1 Embeddable Chatbot Widget
- Provide a minified single-line JavaScript snippet that site admins paste before the closing `</body>` tag.
- Snippet includes a domain-scoped public token and loads a lightweight iframe from Headline Tester CDN.
- On load, iframe performs a handshake with the backend using the token to fetch widget configuration and issue a short-lived session key.
- Admins authenticate at `app.headlinetester.com`; the session issues a signed control token that the widget can read via secure postMessage before enabling privileged actions.
- Widget remains hidden by default on production pages and reveals when an authorized admin appends `?headlinetester=1` (or similar) or enters the Konami code (↑↑↓↓←→←→BA) on the keyboard.
- Graceful fallback when the service is unreachable.

#### 6.2 Context Ingestion
- MVP: fetch raw HTML server-side and parse key elements with a lightweight Cheerio worker (Node.js HTML parser) to populate context.
- Allow admins to optionally supply additional site-wide context (brand voice, audience, value prop) through chat-managed settings.
- Persist context snapshots per page and update them periodically (e.g., every 24 hours) or on-demand when the admin requests a refresh.
- Backlog exploration: landingpage.report APIs for structured audits that enrich model context with readability scores, messaging insights, and SEO attributes.
- Backlog exploration: headless browser scraping (Puppeteer via Browserless or browser-use) to handle client-rendered content, gated sections, and screenshot capture when traffic or accuracy needs justify the cost.

#### 6.3 Conversational Test Creation
- Chat UI allows admins to describe goals in natural language; the system proposes headline variants and experiment setup.
- Generated tests include control and variant copy, targeting rules (URL path or query params), and success metrics suggestions.
- Provide confirmation flow summarizing the test before activation.
- Store test definitions in the database with status tracking (draft, active, paused, completed).

#### 6.4 Test Recommendations
- AI agent offers proactive suggestions based on page context, industry best practices, and historical performance.
- Recommendations include rationale, expected impact, and suggested metrics.
- Allow users to accept, modify, or dismiss recommendations; dismissed suggestions should inform future recommendations.

#### 6.5 Chat-Centric Test Management
- Conversational commands let admins list tests, filter by status or URL, and request deep dives.
- The bot surfaces interactive summary cards with variants, performance metrics, and related conversations.
- Inline chat actions support pausing, resuming, archiving, or duplicating tests.
- Recurring recap messages highlight billing status and remaining free tests, with optional shareable summaries for stakeholders.

#### 6.6 Experiment Analytics (MVP)
- Track impressions and conversions per variant via lightweight client-side script bundled with the widget.
- Present aggregate results with statistical significance guidance (basic Bayesian or frequentist approximation).
- Export results as CSV for manual analysis.
- Note: integration with third-party analytics is out of scope for MVP but keep architecture extensible.

#### 6.7 Headline Delivery & Experiment Execution
- Variants are stored with targeting rules (URL patterns, audience attributes), assignment strategy, and status.
- Embed script calls `/experiments/resolve` with domain token + page metadata; backend returns the applicable experiment, control headline, variant copy, and assignment decision (respecting traffic allocation and sticky user bucketing).
- Client swaps the target DOM node with the assigned headline via a small helper; if delivery fails, it gracefully leaves the original content in place.
- Impression and conversion events include experiment/variant IDs so analytics can aggregate performance.
- Optional static-site endpoint returns the current control headline for teams that prefer manual integration.

#### 6.8 Billing & Usage Management
- Integrate Stripe Agent Toolkit to meter tests, collect payment methods, and charge per completed test beyond the first free one.
- Enforce free tier limit (one active test without billing info).
- Allow admins to request billing history, invoices, and usage summaries directly through chat, with downloadable links when needed.
- Handle compliance events (refunds, payment failures) gracefully with clear messaging.

#### 6.9 Authentication & Onboarding
- Use Auth.js for passwordless email or OAuth sign-in (final providers TBD).
- Guided onboarding flow capturing domain(s) to authorize, initial context, and snippet delivery.
- Secure token issuance for widget authentication tied to verified domains.

### 7. User Experience Scenarios

#### Scenario A: First-Time Founder Ships a Test
1. Founder visits Headline Tester, signs in via Auth.js email link, and completes onboarding by adding their domain.
2. Chat flow presents a personalized widget snippet and instructions; founder pastes it into their landing page.
3. Chatbot detects the home page, summarizes existing headline, and suggests two alternative variants aligned with the founder’s stated value proposition.
4. Founder converses with the bot to tweak wording, confirms the experiment, and launches the free test.
5. Chat thread posts real-time impression summaries; the founder receives a winning-variant notification via chat and email once significance is reached.

#### Scenario B: Agency Manages Multiple Client Pages
1. Agency marketer signs in, opens the chat console, and switches between authorized domains via quick commands.
2. Chatbot reviews a client’s pricing page context and recommends a new headline focusing on ROI proof points.
3. Marketer accepts recommendation and asks the bot to schedule the test for next Monday; bot queues activation accordingly.
4. Bot surfaces current billing status inline; marketer purchases additional test credits via a chat-triggered Stripe checkout.
5. After completion, marketer requests a CSV export link from the bot to share with the client, using the query parameter or Konami code only when they need to surface the on-site interface.

#### Scenario C: Returning User Iterates on Recommendations
1. Solo marketer reopens the chat and reviews an underperforming test flagged in the summary feed.
2. Chatbot explains performance insights and recommends pausing the variant, then proposes a new headline emphasizing social proof.
3. Marketer requests more conservative tone; bot regenerates variants and presents expected uplift distribution.
4. User activates the new test through chat controls and sets an alert for when conversions reach 500.

### 8. Functional Requirements
- F1: Authenticated users can register domains and generate unique widget tokens.
- F2: Widget loads chatbot UI, streams responses, and passes page context payloads securely.
- F3: Admins can create, launch, pause, and archive tests entirely through the chat interface.
- F4: System tracks experiment metrics and surfaces performance insights in near real time.
- F5: Billing flow limits free usage and charges per additional test using Stripe Agent Toolkit.
- F6: Recommendations adapt to accepted/dismissed history to minimize repetition.

### 9. Non-Functional Requirements
- Performance: Widget must load in under 200 ms added blocking time on a standard broadband connection.
- Reliability: Test tracking continues even if chatbot service is temporarily offline; queued events flush once reconnected.
- Security: Cross-origin iframe communication secured via postMessage with signed tokens; only verified domains can activate tests.
- Privacy: Comply with GDPR/CCPA basics by not storing personally identifiable visitor data; provide opt-out instructions.
- Scalability: Support at least 1,000 concurrent active tests without degraded performance.

### 10. Technical Architecture Notes
- Base platform: Next.js App Router with server actions for conversational flows.
- Data layer: Drizzle ORM with PostgreSQL (Neon or Vercel Postgres) storing users, domains, tests, variants, events, billing state.
- Edge caching: Utilize Vercel Edge Functions for low-latency recommendation requests where feasible.
- AI orchestration: Extend the existing chatbot agent to call proprietary tools for context fetching, test creation, and billing triggers.
- Event ingestion: Lightweight client collector sends impression/conversion events to an API route or Edge function.
- Context pipeline (MVP): synchronous HTML fetch + Cheerio parsing triggered by chat requests; queue-based enrichment with landingpage.report or headless rendering deferred until usage warrants.
- Embed architecture: shared widget script served from CDN, parameterized with domain token; script boots an iframe that establishes a signed session via backend API. Admin control requires a separate authenticated channel—after login on the core app, a control token is passed to the widget through postMessage or a transient API call, enabling management commands without shipping a unique script per user.
- Headline delivery: experiment resolver service consults stored targeting rules, assigns variants using deterministic bucketing, and returns control/variant copy to the embed; DOM swap helper applies the headline and records impressions/conversions.

### 11. External Dependencies
- Vercel deployment and hosting for Next.js application.
- OpenAI (or compatible) LLM access leveraged by the Vercel template for conversational capabilities.
- Stripe Agent Toolkit for per-test billing, customer portal, and webhook handling.
- Auth.js for authentication workflows.
- Database hosting (e.g., Vercel Postgres or Neon) compatible with Drizzle migrations.
- Email service (e.g., Resend, SendGrid) for onboarding links and test alerts.
- Optional feature flag/queue service if scheduled activations require delayed execution (e.g., Upstash Redis or Vercel KV).
- Node.js runtime for Cheerio-based ingestion workers (e.g., serverless function or containerized job).
- Backlog: landingpage.report API access for enriched page context once base ingestion proves stable.
- Backlog: headless rendering infrastructure (self-hosted Puppeteer, Browserless, or browser-use service) for dynamic content capture if needed later.

### 12. Risks & Mitigations
- LLM hallucinations produce poor or non-compliant headlines → add guardrails, prompt tuning, and allow manual overrides.
- Widget performance impact → ship minimal bundle, leverage lazy loading, and monitor Core Web Vitals.
- Inaccurate analytics due to ad blockers → provide server-side tracking fallbacks or confidence intervals communicating uncertainty.
- Billing disputes → surface transparent usage logs and offer manual review tools.

### 13. Open Questions
- Which authentication providers will Auth.js support beyond email, if any?
- Should analytics be fully in-house or integrate with an external solution later (e.g., a plug-in with GA4)?
- Do we need multi-domain management under a single account at launch or as a fast-follow?
- What statistical engine will we use for significance (Bayesian vs frequentist) and how will we present confidence?
- How will we handle multilingual sites and localization for headline variants?
- Do we need a lightweight read-only view for audits or stakeholders if chat-based management proves limiting?
- What signal (traffic volume, accuracy gap, manual feedback) should trigger investment in landingpage.report or headless ingestion, and how will we orchestrate those fallbacks?

### 14. Release Milestones (Draft)
- Milestone 1: Core embedding + conversational test creation (snippet, context ingestion, onboarding).
- Milestone 2: Chat-centric management experience with analytics MVP and recommendation engine.
- Milestone 3: Stripe billing integration and paywall enforcement.
- Milestone 4: Performance hardening, alerting, and beta polish (email alerts, CSV export).

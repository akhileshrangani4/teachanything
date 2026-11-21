> Exported from Obvious document `art_GFoVZKhr` ("Product and feature gaps: ranked findings (professor, student, admin)") on 2026-11-17. Content is unchanged from the live source.

# Teach Anything: product and feature gaps (professor, student, admin)

**Short version.** The best new work is finishing features the product already half-promises. The docs tell professors they can theme and position the embedded widget, but nothing in the app reads or writes those settings. Suggested starter questions are stored and served to the public chat, but no screen lets a professor set them and no screen shows them to students. After those two come chatbot duplication (for reusing a bot across sections and semesters), quiz-performance analytics for professors (the attempt data is already stored and indexed for it), and letting students pick up a chat after a reload. All five are new ideas. Every open GitHub issue today belongs to the Issue Triage track, so none of these candidates has a backing issue.

Research was read-only against `akhileshrangani4/teachanything` `main` at `7fee02e` (13 Nov 2026). "Observed" means I read the code cited. "Inferred" means the code points that way but I didn't run or test anything.

## 1. What I explored

I covered every route under `apps/web/src/app` and the components behind each one. On the **professor side**, that means the dashboard home (three stat cards and a messages chart, `app/(dashboard)/dashboard/page.tsx:84-107`), the chatbot list (search and pagination only, `dashboard/chatbots/page.tsx:149-179`), chatbot creation (`components/dashboard/chatbots/CreateChatbotDialog.tsx`), the file library and web sources, and the chatbot detail page with its Chat, Files, Web sources, Conversations, Analytics, Settings and Embed tabs (`app/chatbot/[id]/chatbot-detail-tabs.tsx:71-88`). On the **student side**, it covers the public chat at `app/chat/[shareToken]/page.tsx`, the embed button and window pages under `app/embed/[shareToken]/`, the shared-chat hook `hooks/useChat.ts`, quizzes (`components/chat/messages/QuizMessage.tsx`), sources (`source-list.tsx`) and export (`lib/export-chat.ts`). On the **admin side**, it covers the four admin tabs (pending users, all users, all chatbots, allowed domains; `app/(admin)/admin/page.tsx`) and the procedures in `server/routers/admin/`. Underneath all of that, I read the data model in `packages/db/src/schema.ts`, the tRPC routers for chatbots, analytics, files and crawler, and the instructor docs in `apps/docs/docs/instructors/`. I also ran `gh issue list --state open` (11 issues) and `gh pr list --state open` (8 PRs). Every open issue is #559, #465, #463, #462, #399, #398, #137, #136, #129, #128 or #126, and all of them are on the off-limits list.

Coverage is broad and mostly finished. Professors already get conversation review with search, delete and HTML/CSV/text export. Students already get their own transcript export, voice input and accessible quizzes. The gaps sit at the edges: config columns no UI touches, docs that promise more than the app does, and stored data no screen summarizes.

## 2. Ranked top 5

### #1: Make the embed widget's appearance configurable (theme, corner, colours), as the docs already promise

**What it is.** Add an Appearance card to chatbot Settings that writes `chatbots.embedSettings`. Then apply it in two places: the generated snippet (button corner, window position) and the embed pages (light/dark theme, button and header colour). While touching those files, give the two generated iframes `title` attributes.

**Who benefits.** Professors embedding in a course site or LMS page, plus their students. It also removes a docs-vs-product mismatch that costs operators trust.

**Evidence (observed).**
- The column exists with a typed default of `{theme, position, buttonColor, chatColor}` (`packages/db/src/schema.ts:188-200`). A repo-wide grep for `embedSettings|embed_settings|buttonColor|chatColor` across `apps/web/src` and `packages` turns up nothing outside `schema.ts`. Nothing reads or writes the column. `git log -S embedSettings` shows it arrived in the original migration commit `c825cbc` and was never wired up.
- `createChatbotSchema` (`server/routers/chatbot/schemas.ts:11-21`) has no `embedSettings` field, and `update` reuses it as `.partial()` (`mutations.ts:65-88`), so the API can't set it either.
- The snippet hard-codes the corner and colours: `position:fixed;right:0;bottom:0`, `border:2px solid #e2e8f0` (`components/embed/embed-code-generators.ts:18-21`, `:47-62`, `:79-80`). The button page renders a fixed icon with no colour input (`app/embed/[shareToken]/button/page.tsx:40-49`).
- The docs promise all of it: "Light or dark theme / Position — bottom-right or bottom-left corner / Button and chat colors" (`apps/docs/docs/instructors/customize.mdx:66-72`, `share-and-embed.mdx:58-62`, `tutorials/embed-on-your-site.mdx:14-23`). The tutorial's first step is "Make it match your site" in settings that don't exist.
- Dark tokens already exist (`app/globals.css:134` defines `.dark`), and the embed layout has no theme switch (`app/embed/layout.tsx`).
- Neither generated iframe has a `title` attribute (zero matches for `title=` in `embed-code-generators.ts`). Screen readers announce untitled iframes poorly.

**Size.** M, about 2 PRs. PR 1: schema field, `getByShareToken` returns `embedSettings`, Settings card. PR 2: snippet generator takes the settings, and the embed pages apply `.dark` and colours.

**Risks.** Snippets already pasted on course sites carry their position inline, so position changes only reach newly copied snippets. Theme and colour can be applied server-side through the embed pages, so those reach existing embeds. The UI must say which settings need a re-copy. Inferred and unverified: the React snippet injects its listener through `<script dangerouslySetInnerHTML>` (`embed-code-generators.ts:65`). On a client-only render, React doesn't execute inline scripts, so open/close may never wire up. Test this while in the file.

**Overlap check.** No overlap with any listed item. New Settings labels add locale-catalog keys, so coordinate key additions with the dashboard i18n work (#560/#540) rather than editing catalogs those PRs are mid-way through.

### #2: Suggested starter questions: let professors set them, and show them as tappable chips in an empty chat

**What it is.** Add a "Suggested questions" field (up to 5) to Settings, next to the welcome message. Render the questions as buttons in the empty state of `ChatInterface`. Tapping one sends it.

**Who benefits.** Students facing an empty box ("what do I even ask?"). Professors, who get to steer students toward what the bot covers well.

**Evidence (observed).**
- The data path exists end to end except for the UI. The column is `suggestedQuestions jsonb string[]` (`schema.ts:180-182`). It's validated as `z.array(z.string()).max(5)` (`schemas.ts:19`), written on create (`mutations.ts:53`), and returned by the *public* `getByShareToken` (`queries.ts:110`).
- A grep for `suggestedQuestions` across `apps/web/src` hits only those three server files. No component sets or reads it. `CreateChatbotDialog.tsx` sends no suggestions, so every chatbot stores `[]`.
- The empty state shows just a greeting and the welcome message (`components/chat/messages/ChatInterface.tsx:163-171`). `sendMessage(text)` already exists in `hooks/useChat.ts:66-73`, so a chip can call it directly.

**Size.** S, one PR: Settings field, prop through `ChatInterface`, chips in the empty state.

**Risks.** Low. A list kept by hand goes stale when course materials change. Professors could later get "suggest from Common Questions" built on the existing insights procedure, but that is out of scope here. Chips must be real buttons, reachable by keyboard.

**Overlap check.** No overlap. It touches the welcome-message area of Settings and adds catalog keys, so the same i18n coordination note as #1 applies.

### #3: Duplicate a chatbot (for a new section or semester)

**What it is.** Add a "Duplicate" item to the chatbot card menu. It creates a copy with the same prompt, model, temperature, max tokens, welcome message, suggestions and show-sources setting. It gets a fresh share token and the same file and web-source attachments, and no conversations come with it.

**Who benefits.** Professors who teach the same course to several sections or every term. Today they rebuild the bot by hand and re-attach every file.

**Evidence (observed).**
- The card menu offers only Open and Delete (`components/dashboard/chatbots/ChatbotCard.tsx:67-86`). The chatbot router has `create`, `update`, `updateShowSources`, `delete`, `generateShareToken` and `disableSharing`, and no copy (`server/routers/chatbot/mutations.ts:16-158`). Grepping `duplicate|clone` in `server/` and `components/dashboard` finds nothing chatbot-related.
- Files and crawl sources live in a per-user library joined through association tables (`chatbotFileAssociations`, `chatbotCrawlSourceAssociations` in `schema.ts:249-260`, `567-577`). A copy only inserts association rows. No files get re-uploaded and no embeddings get recomputed. The attach procedures exist (`files/procedures/associations.ts:12`, `crawler/procedures/attach-to-chatbot.ts:13`).
- Creation pre-fills only one translated default prompt (`CreateChatbotDialog.tsx:55-61`, `chatbot-constants.ts:13-19`). Duplication is the realistic way for a professor to reuse a configuration that works.

**Size.** S to M. One server mutation that runs in a transaction and respects `chatbotCreationRateLimit` the way `create` does (`mutations.ts:20-37`), plus the menu item. Call it M if "copy into another account" is wanted. I'd leave that out.

**Risks.** A copy shares the source files, so deleting a file from the library removes it from both bots. That is the current library behaviour, but it needs to be stated in the confirm dialog. Leave `featured` and `customAuthorName` uncopied (admin-owned, `admin/procedures/chatbots.ts:124,186`).

**Overlap check.** No overlap. Adds one or two catalog keys.

### #4: Quiz performance in the Analytics tab

**What it is.** Add an Analytics card summarising quiz attempts per chatbot: quizzes taken, average score, retake rate and score distribution over the selected period. A later step could add per-question miss rates.

**Who benefits.** Professors, who see where students struggle without opening conversations one by one.

**Evidence (observed).**
- Every attempt is stored as `study_tool_responses` with `attempt` and a JSON `response` (`schema.ts:404-436`). The response holds `answers`, `score` and `total`, with score derived on the server (`lib/quiz/response.ts:4-15`). The schema comment says the unique attempt index makes the column "safe to build on (analytics, ordering)" (`schema.ts:429-431`). So analytics were intended.
- Today the table is read only per conversation (`analytics/procedures/conversations.ts:145-152`) and for export (`export-conversations.ts:119-126`). The Analytics tab has message, session, common-question and low-confidence cards but nothing for quizzes (`components/chatbot/AnalyticsTab.tsx:115-177`).
- Inferred: per-question miss rates need the quiz definition, which lives in the assistant message's tool-call input rather than in `study_tool_responses`. That join makes phase 2 the bigger half.

**Size.** M: one PR for the aggregate procedure and card, one for per-question breakdown.

**Risks.** Sessions are anonymous (`conversations` has only `sessionId` and metadata, `schema.ts:311-326`). These would be cohort statistics, not gradebook data. Say so in the UI so nobody mistakes them for assessment. The `response` column is typed `unknown`, so aggregation must validate against `quizResponseSchema` and skip rows that don't match.

**Overlap check.** Different data from response ratings (#559, PR #564), but both add cards to `AnalyticsTab.tsx`. Sequence this after #564 merges. It also borders the AI tutoring track's pedagogy scope (todo_Mhuo5Kdu). Confirm that track isn't proposing the same card.

### #5: Let students resume a chat after a reload or a closed tab

**What it is.** Keep the shared-chat `sessionId` per share token in `localStorage`. On load, rehydrate the transcript and quiz attempts from the server through a public read scoped to that session. "New chat" keeps starting fresh, as it does today.

**Who benefits.** Students. An accidental refresh, a phone app switch or closing the tab mid-study currently wipes the visible conversation, including finished quizzes.

**Evidence (observed).**
- `hooks/useChat.ts:19-24` says it outright: "A fresh sessionId is generated per page load … no cross-reload history rehydration in this phase", with `useState(() => nanoid())`. "In this phase" marks this as planned work that never got built.
- The server already persists everything per session (`messages`, `study_tool_responses`). The only reader is the professor-only `getConversationMessages` (`analytics/procedures/conversations.ts:96`). No public history endpoint exists.
- Quiz attempts are held in client state only for this session (`useChat.ts:27-30`). The widget can already restore from rehydrated attempts (`lib/quiz/response.ts:28-36`).

**Size.** M: a public read endpoint (session-scoped, rate-limited), then client rehydration and UI.

**Risks.** Once the `sessionId` reads history, it becomes a bearer secret, so it must stay unguessable and never appear in URLs. Shared lab computers would show the previous student's chat. Mitigations are a visible "New chat" (it exists), an expiry, and possibly sessionStorage instead of localStorage. Decide which.

**Overlap check.** This touches the same shared-chat route and session semantics as the single-turn lock (#465, PR #572). Wait for #572 to merge and build on its session handling. It does not touch quiz-JSON leak recovery (#398).

## 3. Considered and rejected

- **Student conversation export.** Already shipped, in both the public chat (`ChatInterface.tsx:107-129`) and the embed header (`EmbedHeader.tsx:30-38`), including quiz attempts.
- **Professor-side conversation review.** Already shipped: list, search, per-conversation messages with quiz attempts, bulk delete, and HTML/CSV/text export (`analytics/procedures/conversations.ts:20-259`, `lib/export-conversations/types.ts:5`).
- **Chatbot templates (a gallery of starter configurations).** Deferred behind #3. Template content means new prompt text in every locale catalog, which collides with the i18n track. Duplication covers the reuse case without new copy.
- **LMS integration (LTI 1.3 / Canvas).** No code exists (grep for LTI/LMS/OIDC providers found nothing). The docs already route Canvas users to the embed snippet (`share-and-embed.mdx:53`). Real LTI needs a student identity model the product lacks today (anonymous sessions), so it is L size and needs a product decision first. See open questions.
- **Course/section grouping of chatbots.** Absent from the schema (no course, folder or tag column on `chatbots`, `schema.ts:168-203`), and the list page already has search and pagination. Nothing in the code or backlog shows professors with enough bots to need folders. Revisit if #3 lands and bot counts grow.
- **Scheduled availability (open/close windows, exam lockout).** Absent: sharing is a single boolean checked in `getByShareToken` (`queries.ts:116-120`) and the shared-chat route (`api/chat/shared/route.ts:57`). It's plausible, but no backlog signal exists and the manual toggle covers the need. Low priority.
- **Onboarding checklist.** Creation already routes straight to the new bot (`CreateChatbotDialog.tsx:82`), and the files tab has an empty state. The remaining gap (a professor can chat with a bot that has no materials, with no nudge) is real but inferred and small. Fold it into a later polish pass.
- **Broad accessibility pass.** The chat and quiz already carry `aria-live`, `role="group"`/`status` and labelled controls (`ChatInterface.tsx:158-160`, `QuizMessage.tsx:148-219`). The one concrete gap I found (untitled embed iframes) is folded into #1. The embed button's hard-coded English `aria-label` (`button/page.tsx:45`) belongs to i18n.
- **Phase 2 study tools (flashcards, test, mind map, matching).** Flagged as planned in `server/chat/study-tools.ts:11`, but it's tutoring and pedagogy scope. Handed to the AI tutoring track.
- **Admin console additions.** Approvals, user status, domains, featured toggling and data export are all wired to UI. The one loose end is `admin.getAllConversations` (`admin/procedures/conversations.ts:8-24`), which has no caller anywhere in `apps/web/src`. That's dead-code cleanup for the platform health track, not a feature.
- **Hardening embed `postMessage` (`"*"` target, no origin check; `embed-code-generators.ts:6`, `button/page.tsx:31`, `hooks/useEmbedVisibility.ts:31`).** A security item, so it goes to the platform health track. The messages carry only open/close commands today.

## 4. Open questions

1. **Is a student identity model on the roadmap?** LTI, per-student quiz history and gradebook-style analytics all depend on knowing who the student is. Today every session is anonymous. The answer decides whether #4 and #5 stay cohort- and device-scoped, or wait.
2. **For #1, should appearance changes reach already-pasted embeds?** Theme and colour can be served live. Position is baked into the snippet. Moving position to a hosted loader script would make every setting live, but it's a bigger change (L) and introduces a script dependency on the platform's uptime.
3. **For #5, localStorage or sessionStorage?** localStorage survives closing the tab but leaks between students on shared lab machines. sessionStorage survives only a reload. Teaching context should decide.
4. **Locale catalog coordination.** #1–#3 each add a few UI strings. Should this track add English keys only and let the i18n track (#560/#540) translate, or wait for that work to land?
5. **Does the React embed snippet actually work today?** Inferred risk from the inline-script pattern (`embed-code-generators.ts:65`). Someone should paste it into a fresh Next.js or Vite app and confirm the button opens the chat.

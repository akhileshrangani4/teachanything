# Changelog

## [1.34.9](https://github.com/akhileshrangani4/teachanything/compare/v1.34.8...v1.34.9) (2026-08-24)


### Bug Fixes

* **crawler:** name the hourly web source limits in errors and on the dashboard ([#459](https://github.com/akhileshrangani4/teachanything/issues/459)) ([6c629b3](https://github.com/akhileshrangani4/teachanything/commit/6c629b3f46b58b56a780f7cceb93900f2e68101e))

## [1.34.8](https://github.com/akhileshrangani4/teachanything/compare/v1.34.7...v1.34.8) (2026-08-22)


### Bug Fixes

* **quiz:** close the loophole that let a model deliver a quiz as a table ([#455](https://github.com/akhileshrangani4/teachanything/issues/455)) ([001ce54](https://github.com/akhileshrangani4/teachanything/commit/001ce54d7d8c143f6802cd16ba61a59df653384d))


### Documentation

* label the tutorials for instructors and signpost them ([#456](https://github.com/akhileshrangani4/teachanything/issues/456)) ([24dbf83](https://github.com/akhileshrangani4/teachanything/commit/24dbf83f3dc42ec61097ec284f652f2f7311b436))

## [1.34.7](https://github.com/akhileshrangani4/teachanything/compare/v1.34.6...v1.34.7) (2026-08-21)


### Bug Fixes

* **quiz:** fill the silence while a leaked quiz is buffering ([#453](https://github.com/akhileshrangani4/teachanything/issues/453)) ([beda43c](https://github.com/akhileshrangani4/teachanything/commit/beda43c0936818b1500e299608c37eb650856380))

## [1.34.6](https://github.com/akhileshrangani4/teachanything/compare/v1.34.5...v1.34.6) (2026-08-21)


### Bug Fixes

* **ai:** stop retrying an exhausted API quota, and say so when the provider is the problem ([#452](https://github.com/akhileshrangani4/teachanything/issues/452)) ([4a70b2b](https://github.com/akhileshrangani4/teachanything/commit/4a70b2b7b2fa0dcb35cc264d277a8e0bb046aab9))
* **db:** disable prepared statements on the transaction-mode pooler ([#450](https://github.com/akhileshrangani4/teachanything/issues/450)) ([78bc899](https://github.com/akhileshrangani4/teachanything/commit/78bc8994c7fc4feaaedf95bb25610efc8d95acdd))

## [1.34.5](https://github.com/akhileshrangani4/teachanything/compare/v1.34.4...v1.34.5) (2026-08-21)


### Bug Fixes

* Bug Fixes in file uploads and quiz ([#448](https://github.com/akhileshrangani4/teachanything/issues/448)) ([fd2b673](https://github.com/akhileshrangani4/teachanything/commit/fd2b673a83cb49e79cf110b90c825f3795a83655))

## [1.34.4](https://github.com/akhileshrangani4/teachanything/compare/v1.34.3...v1.34.4) (2026-08-17)


### Bug Fixes

* **crawler:** recover stuck crawls, add a stop button, unblock deletion ([#445](https://github.com/akhileshrangani4/teachanything/issues/445)) ([7b68788](https://github.com/akhileshrangani4/teachanything/commit/7b687884535ccf01a6da5307e2a551840a73ecda))
* **quiz:** accept the answer field models actually emit ([#446](https://github.com/akhileshrangani4/teachanything/issues/446)) ([c23823d](https://github.com/akhileshrangani4/teachanything/commit/c23823dea1159b30c77207405e110105ddeff9e8))


### Documentation

* **instructors:** add Choose an open-source LLM page ([#443](https://github.com/akhileshrangani4/teachanything/issues/443)) ([3967a74](https://github.com/akhileshrangani4/teachanything/commit/3967a74e0eb7bb61983aab3405002b4b031ea409))

## [1.34.3](https://github.com/akhileshrangani4/teachanything/compare/v1.34.2...v1.34.3) (2026-08-17)


### Bug Fixes

* **build:** declare RESEND_SEGMENT_ID in turbo.json env ([#441](https://github.com/akhileshrangani4/teachanything/issues/441)) ([1021996](https://github.com/akhileshrangani4/teachanything/commit/10219961aaaad7eb78424dad8aa445d17b2cf975))

## [1.34.2](https://github.com/akhileshrangani4/teachanything/compare/v1.34.1...v1.34.2) (2026-08-17)


### Miscellaneous Chores

* **ci:** move CI and engines from Node.js 20 to 24 ([#439](https://github.com/akhileshrangani4/teachanything/issues/439)) ([36a7411](https://github.com/akhileshrangani4/teachanything/commit/36a7411d15cbffa3d618201084c63175777bbf72))

## [1.34.1](https://github.com/akhileshrangani4/teachanything/compare/v1.34.0...v1.34.1) (2026-08-17)


### Bug Fixes

* **ci:** stop building docs during tests and cache its webfonts ([#436](https://github.com/akhileshrangani4/teachanything/issues/436)) ([b3f0f04](https://github.com/akhileshrangani4/teachanything/commit/b3f0f04f1b5ee0d65c2c94aee0bd7d49774d1c71))

## [1.34.0](https://github.com/akhileshrangani4/teachanything/compare/v1.33.6...v1.34.0) (2026-08-12)


### Features

* **chat:** surface pipeline working steps in the thinking indicator ([#404](https://github.com/akhileshrangani4/teachanything/issues/404)) ([6cca00f](https://github.com/akhileshrangani4/teachanything/commit/6cca00fdb2ff08de5d9da4e3c98328ac3273bc65))

## [1.33.6](https://github.com/akhileshrangani4/teachanything/compare/v1.33.5...v1.33.6) (2026-08-12)


### Bug Fixes

* **quiz:** recover leaked quiz calls after prose and in pseudo-call syntax ([#432](https://github.com/akhileshrangani4/teachanything/issues/432)) ([6f3c046](https://github.com/akhileshrangani4/teachanything/commit/6f3c046787b21fefe5f9619256fa42b05cd52f27))
* **quiz:** salvage a quiz the token limit cut off instead of failing ([#433](https://github.com/akhileshrangani4/teachanything/issues/433)) ([285120b](https://github.com/akhileshrangani4/teachanything/commit/285120b0b16adaf1e21d8f09461ddc7ec9c77382))

## [1.33.5](https://github.com/akhileshrangani4/teachanything/compare/v1.33.4...v1.33.5) (2026-08-11)


### Miscellaneous Chores

* **brand:** switch trademark symbol from TM to registered mark ([#430](https://github.com/akhileshrangani4/teachanything/issues/430)) ([86defb0](https://github.com/akhileshrangani4/teachanything/commit/86defb06c3e6dd8bcd7f0a7030f410964ce4037a))

## [1.33.4](https://github.com/akhileshrangani4/teachanything/compare/v1.33.3...v1.33.4) (2026-07-28)


### Documentation

* **landing:** update non-profit language with 501(c)(3) and tax-deductible notice ([#412](https://github.com/akhileshrangani4/teachanything/issues/412)) ([dd1aefa](https://github.com/akhileshrangani4/teachanything/commit/dd1aefaa2a52c72d8b59d1aa75b192642cff5fdd))

## [1.33.3](https://github.com/akhileshrangani4/teachanything/compare/v1.33.2...v1.33.3) (2026-07-19)


### Bug Fixes

* **quiz:** restore finished quiz on remount and recover text-leaked quizzes ([#400](https://github.com/akhileshrangani4/teachanything/issues/400)) ([7dfe633](https://github.com/akhileshrangani4/teachanything/commit/7dfe633a24685c1719cee13cc2a312ecbf251ac5))

## [1.33.2](https://github.com/akhileshrangani4/teachanything/compare/v1.33.1...v1.33.2) (2026-07-19)


### Documentation

* surface and document the quiz feature ([#395](https://github.com/akhileshrangani4/teachanything/issues/395)) ([ac539c2](https://github.com/akhileshrangani4/teachanything/commit/ac539c2f6065e3623d9d38a511f9d3ff165f2e98))

## [1.33.1](https://github.com/akhileshrangani4/teachanything/compare/v1.33.0...v1.33.1) (2026-07-19)


### Documentation

* **students:** add quiz feature guide ([#393](https://github.com/akhileshrangani4/teachanything/issues/393)) ([29927ac](https://github.com/akhileshrangani4/teachanything/commit/29927ac2c459a8fa85be3dea05f9b11fe39c20e7))

## [1.33.0](https://github.com/akhileshrangani4/teachanything/compare/v1.32.1...v1.33.0) (2026-07-19)


### Features

* **auth:** auto-sync approved users to Resend audience ([#378](https://github.com/akhileshrangani4/teachanything/issues/378)) ([7991594](https://github.com/akhileshrangani4/teachanything/commit/7991594167f41897f7de78b090adf1ce8eed7dbb))
* **chat:** migrate chat to AI SDK transport with quiz study tool (Phase 1) ([#380](https://github.com/akhileshrangani4/teachanything/issues/380)) ([fd31463](https://github.com/akhileshrangani4/teachanything/commit/fd3146387defa4d27584f7ac8cc3e2a531bc5cff))
* **conversations:** export student chat records from the dashboard ([#386](https://github.com/akhileshrangani4/teachanything/issues/386)) ([be22761](https://github.com/akhileshrangani4/teachanything/commit/be227618651b2b4376c94aa37dd067a43c92b56b))
* **db:** add --dry-run flag to Resend segment backfill ([#391](https://github.com/akhileshrangani4/teachanything/issues/391)) ([4b4704e](https://github.com/akhileshrangani4/teachanything/commit/4b4704eaedcf0d1c948723616278410e40e594e6))


### Bug Fixes

* **auth:** fail closed on rate-limit outage for updatePassword ([#389](https://github.com/akhileshrangani4/teachanything/issues/389)) ([6cf2271](https://github.com/akhileshrangani4/teachanything/commit/6cf2271d5555d25a740973b43e3e5fc10be69e88))
* **auth:** never reset unsubscribed when syncing to Resend segment ([#392](https://github.com/akhileshrangani4/teachanything/issues/392)) ([9ffb02b](https://github.com/akhileshrangani4/teachanything/commit/9ffb02b42746660c9e123f109f121de2e772a86a))

## [1.32.1](https://github.com/akhileshrangani4/teachanything/compare/v1.32.0...v1.32.1) (2026-07-18)


### Documentation

* **instructors:** apply Prof Joubin's requested revisions ([#387](https://github.com/akhileshrangani4/teachanything/issues/387)) ([ebbdc19](https://github.com/akhileshrangani4/teachanything/commit/ebbdc199cf73a93eadb48c14080fc3c1d4f3ce7b))

## [1.32.0](https://github.com/akhileshrangani4/teachanything/compare/v1.31.1...v1.32.0) (2026-07-14)


### Features

* **legal:** add Terms of Use page and reposition DC flag on homepage ([#383](https://github.com/akhileshrangani4/teachanything/issues/383)) ([861f4e9](https://github.com/akhileshrangani4/teachanything/commit/861f4e9283158c01cafc43c74a4218cc2611da3b))


### Documentation

* **readme:** add docs site + apps/docs to README ([#385](https://github.com/akhileshrangani4/teachanything/issues/385)) ([e2d6423](https://github.com/akhileshrangani4/teachanything/commit/e2d6423e2a1f03873046ec5048e6bbb626800748))

## [1.31.1](https://github.com/akhileshrangani4/teachanything/compare/v1.31.0...v1.31.1) (2026-07-13)


### Documentation

* **site:** add non-technical docs site served at /docs ([#381](https://github.com/akhileshrangani4/teachanything/issues/381)) ([f9442da](https://github.com/akhileshrangani4/teachanything/commit/f9442da872da52a9d40654c2344bd8c9ff650191))

## [1.31.0](https://github.com/akhileshrangani4/teachanything/compare/v1.30.0...v1.31.0) (2026-07-07)


### Features

* **ai:** add Mistral Large 3 to the model lineup ([#375](https://github.com/akhileshrangani4/teachanything/issues/375)) ([851c170](https://github.com/akhileshrangani4/teachanything/commit/851c170df5777e879ab08ca45dba8f54995caa3f))

## [1.30.0](https://github.com/akhileshrangani4/teachanything/compare/v1.29.0...v1.30.0) (2026-07-07)


### Features

* **embed:** enable voice input in embedded chatbots via delegation opt-in ([#373](https://github.com/akhileshrangani4/teachanything/issues/373)) ([7a3bbc4](https://github.com/akhileshrangani4/teachanything/commit/7a3bbc4fa70f6f9222ce5b78ba8dd8b407d38380))

## [1.29.0](https://github.com/akhileshrangani4/teachanything/compare/v1.28.5...v1.29.0) (2026-07-07)


### Features

* **chat:** add multilingual voice input via Whisper ([#307](https://github.com/akhileshrangani4/teachanything/issues/307)) ([78d1c64](https://github.com/akhileshrangani4/teachanything/commit/78d1c6475bd6a7f4580ff3c47c38be72982747ee))

## [1.28.5](https://github.com/akhileshrangani4/teachanything/compare/v1.28.4...v1.28.5) (2026-07-07)


### Bug Fixes

* **chat:** cut agentic RAG latency and harden stream transport ([#370](https://github.com/akhileshrangani4/teachanything/issues/370)) ([cad7843](https://github.com/akhileshrangani4/teachanything/commit/cad7843d76e4b1adfb85cb947ddcc60b6d873f25))

## [1.28.4](https://github.com/akhileshrangani4/teachanything/compare/v1.28.3...v1.28.4) (2026-06-29)


### Bug Fixes

* **chat:** retire nemotron from tool models + cap static-path chunks ([#368](https://github.com/akhileshrangani4/teachanything/issues/368)) ([42518bb](https://github.com/akhileshrangani4/teachanything/commit/42518bb05557d9bdb56b29bfe6a4bfd160efc909))

## [1.28.3](https://github.com/akhileshrangani4/teachanything/compare/v1.28.2...v1.28.3) (2026-06-29)


### Bug Fixes

* **files:** externalize officeparser to fix PowerPoint upload error ([#366](https://github.com/akhileshrangani4/teachanything/issues/366)) ([f0f6124](https://github.com/akhileshrangani4/teachanything/commit/f0f612438cd9037a4b2187bcdbc0787e07c7b6e9))

## [1.28.2](https://github.com/akhileshrangani4/teachanything/compare/v1.28.1...v1.28.2) (2026-06-29)


### Bug Fixes

* **chat:** stop inline citation markers in answers ([#363](https://github.com/akhileshrangani4/teachanything/issues/363)) ([dd7081d](https://github.com/akhileshrangani4/teachanything/commit/dd7081de0f247ec70e3e820a843c0624a363a5e4))


### Performance Improvements

* **chat:** fix many-files slowness/timeouts (reprocess throttle + manifest cap + step budget) ([#365](https://github.com/akhileshrangani4/teachanything/issues/365)) ([ef7b7f7](https://github.com/akhileshrangani4/teachanything/commit/ef7b7f7f50a3f9e680dfbca31f08d4c23eb95c0c))

## [1.28.1](https://github.com/akhileshrangani4/teachanything/compare/v1.28.0...v1.28.1) (2026-06-29)


### Bug Fixes

* **db:** setup-extensions must run statements individually for CONCURRENTLY ([#360](https://github.com/akhileshrangani4/teachanything/issues/360)) ([8c7feb9](https://github.com/akhileshrangani4/teachanything/commit/8c7feb989a8cf3766d9ecbe91dc3feb85f4f4820))

## [1.28.0](https://github.com/akhileshrangani4/teachanything/compare/v1.27.0...v1.28.0) (2026-06-29)


### Features

* **rag:** agentic retrieval with hybrid search + page citations ([#271](https://github.com/akhileshrangani4/teachanything/issues/271)) ([#357](https://github.com/akhileshrangani4/teachanything/issues/357)) ([1b6a555](https://github.com/akhileshrangani4/teachanything/commit/1b6a5551a4961f9304cb8705e4503bb154bdb328))

## [1.27.0](https://github.com/akhileshrangani4/teachanything/compare/v1.26.0...v1.27.0) (2026-06-16)


### Features

* **landing:** non-profit status note + DC flag in footer ([#350](https://github.com/akhileshrangani4/teachanything/issues/350)) ([dbcdbf4](https://github.com/akhileshrangani4/teachanything/commit/dbcdbf4270c38ca2e405d6fdd7901aaacf5ce757))

## [1.26.0](https://github.com/akhileshrangani4/teachanything/compare/v1.25.0...v1.26.0) (2026-06-15)


### Features

* **auth:** add approval email whitelist note to signup screen ([#345](https://github.com/akhileshrangani4/teachanything/issues/345)) ([796b7ea](https://github.com/akhileshrangani4/teachanything/commit/796b7ea5ae84ed08b6019e4b4d153867bd9f24f0))

## [1.25.0](https://github.com/akhileshrangani4/teachanything/compare/v1.24.0...v1.25.0) (2026-06-14)


### Features

* **web-sources:** table layout for chatbot tab + dashboard page ([#343](https://github.com/akhileshrangani4/teachanything/issues/343)) ([cab0dba](https://github.com/akhileshrangani4/teachanything/commit/cab0dba70a06a047370e6710d594efeb627e3a34))

## [1.24.0](https://github.com/akhileshrangani4/teachanything/compare/v1.23.1...v1.24.0) (2026-06-14)


### Features

* **web-sources:** list view for attaching existing web sources ([#341](https://github.com/akhileshrangani4/teachanything/issues/341)) ([c041a51](https://github.com/akhileshrangani4/teachanything/commit/c041a518da683ef29349b491d641374027f05433))

## [1.23.1](https://github.com/akhileshrangani4/teachanything/compare/v1.23.0...v1.23.1) (2026-06-11)


### Documentation

* **agents:** clarify AGENTS.md applies to all contributors, AI optional ([#339](https://github.com/akhileshrangani4/teachanything/issues/339)) ([8470a22](https://github.com/akhileshrangani4/teachanything/commit/8470a2247323966e43ba8ba0bd3e7fea5e7b4c92))
* make CONTRIBUTING.md the front door for contributors ([#337](https://github.com/akhileshrangani4/teachanything/issues/337)) ([0a77375](https://github.com/akhileshrangani4/teachanything/commit/0a773751369b5b2fd80dd4927970e51cc59250e2))

## [1.23.0](https://github.com/akhileshrangani4/teachanything/compare/v1.22.1...v1.23.0) (2026-06-11)


### Features

* **web-sources:** make chatbot attachment optional ([#332](https://github.com/akhileshrangani4/teachanything/issues/332)) ([9ed3231](https://github.com/akhileshrangani4/teachanything/commit/9ed3231b3cdf9fe241985b61620fc33881b27210))


### Bug Fixes

* **ci:** apply DB migrations on release deploy, not every main merge ([#335](https://github.com/akhileshrangani4/teachanything/issues/335)) ([7482456](https://github.com/akhileshrangani4/teachanything/commit/74824564e8a2a7cab8769b76d6c943b636c7f80f))
* **db:** only tolerate a missing .env (ENOENT), fail fast on other load errors ([#336](https://github.com/akhileshrangani4/teachanything/issues/336)) ([800e46e](https://github.com/akhileshrangani4/teachanything/commit/800e46ebff1219abdda491a3fff2a5fdc6ebc7d8))

## [1.22.1](https://github.com/akhileshrangani4/teachanything/compare/v1.22.0...v1.22.1) (2026-06-08)


### Miscellaneous Chores

* **deps-dev:** bump turbo from 2.9.6 to 2.9.16 ([#298](https://github.com/akhileshrangani4/teachanything/issues/298)) ([8ecbb26](https://github.com/akhileshrangani4/teachanything/commit/8ecbb2627f2c4218a4440168cfcc6a7082bfd965))
* **deps:** bump @supabase/supabase-js from 2.104.1 to 2.105.1 in the supabase group ([#277](https://github.com/akhileshrangani4/teachanything/issues/277)) ([47cdf7b](https://github.com/akhileshrangani4/teachanything/commit/47cdf7b047f79f426ade37cfa7f9db826fc36196))
* **deps:** bump @tanstack/react-query from 5.100.6 to 5.100.8 in the tanstack group ([#276](https://github.com/akhileshrangani4/teachanything/issues/276)) ([7a0d0a9](https://github.com/akhileshrangani4/teachanything/commit/7a0d0a9f9fd24c71336ad27dbd9112d63069c932))
* **deps:** bump axios from 1.15.2 to 1.17.0 ([#310](https://github.com/akhileshrangani4/teachanything/issues/310)) ([ef73db4](https://github.com/akhileshrangani4/teachanything/commit/ef73db4d944d963e9e8c2752fc50742ca0c1c01d))
* **deps:** bump better-auth from 1.4.9 to 1.6.11 ([#309](https://github.com/akhileshrangani4/teachanything/issues/309)) ([7765350](https://github.com/akhileshrangani4/teachanything/commit/776535003f94a614a8bd25fab0d6805d472bfa76))
* **deps:** bump better-auth from 1.6.11 to 1.6.14 ([#320](https://github.com/akhileshrangani4/teachanything/issues/320)) ([e0286f6](https://github.com/akhileshrangani4/teachanything/commit/e0286f691489044474d867d114af7094fa9e9a22))
* **deps:** bump kysely from 0.28.16 to 0.28.17 ([#285](https://github.com/akhileshrangani4/teachanything/issues/285)) ([aa35373](https://github.com/akhileshrangani4/teachanything/commit/aa353731de1455e78cabea562851240e96963a8d))
* **deps:** bump langsmith from 0.5.21 to 0.7.5 ([#308](https://github.com/akhileshrangani4/teachanything/issues/308)) ([5a96905](https://github.com/akhileshrangani4/teachanything/commit/5a96905edaa03b399f4b61149ce1921d389050e9))
* **deps:** bump marked from 18.0.2 to 18.0.3 in the markdown group ([#280](https://github.com/akhileshrangani4/teachanything/issues/280)) ([c607af4](https://github.com/akhileshrangani4/teachanything/commit/c607af476a0bd0eaf34f286ad2ce2952cb72076a))
* **deps:** bump mermaid from 11.12.0 to 11.15.0 ([#284](https://github.com/akhileshrangani4/teachanything/issues/284)) ([89a6feb](https://github.com/akhileshrangani4/teachanything/commit/89a6feba95310e7ea264cd49bc2550d62321ec69))
* **deps:** bump next from 16.2.4 to 16.2.6 ([#283](https://github.com/akhileshrangani4/teachanything/issues/283)) ([82f00bf](https://github.com/akhileshrangani4/teachanything/commit/82f00bf48575eead88eb9bba7b517aed666ac8e4))
* **deps:** bump next from 16.2.6 to 16.2.7 ([#319](https://github.com/akhileshrangani4/teachanything/issues/319)) ([ffeee3c](https://github.com/akhileshrangani4/teachanything/commit/ffeee3c590c0981a714096f1f1fc83e173f31add))
* **deps:** bump the ai-sdk group with 2 updates ([#274](https://github.com/akhileshrangani4/teachanything/issues/274)) ([83c8d70](https://github.com/akhileshrangani4/teachanything/commit/83c8d704681fe2b16fdfd8b835088caa8dde9684))
* **deps:** bump the langchain group across 1 directory with 3 updates ([#286](https://github.com/akhileshrangani4/teachanything/issues/286)) ([f2e8d3b](https://github.com/akhileshrangani4/teachanything/commit/f2e8d3b8bd80d9f9fc9ea7c8cf5b4dac405a8aec))
* **deps:** bump the small-safe-packages group across 1 directory with 4 updates ([#296](https://github.com/akhileshrangani4/teachanything/issues/296)) ([f742e88](https://github.com/akhileshrangani4/teachanything/commit/f742e880426f35ebefccb0331f46b1b84c527037))
* **deps:** bump the tailwind group across 1 directory with 4 updates ([#292](https://github.com/akhileshrangani4/teachanything/issues/292)) ([d330620](https://github.com/akhileshrangani4/teachanything/commit/d330620f00ff0a60e61e4b310bdccf1ad158aad1))
* **deps:** bump the trpc group with 4 updates ([#272](https://github.com/akhileshrangani4/teachanything/issues/272)) ([1d4c382](https://github.com/akhileshrangani4/teachanything/commit/1d4c3821baec9cb952789e0912e6fba71495bb01))

## [1.22.0](https://github.com/akhileshrangani4/teachanything/compare/v1.21.0...v1.22.0) (2026-06-08)


### Features

* **analytics:** enhance chatbot analytics with session-level insights ([#305](https://github.com/akhileshrangani4/teachanything/issues/305)) ([992dccb](https://github.com/akhileshrangani4/teachanything/commit/992dccbd4beed9be4f6617070a0ab017493cc379))


### Bug Fixes

* **analytics:** correct common-questions counts and paginate the card ([#317](https://github.com/akhileshrangani4/teachanything/issues/317)) ([6e7d051](https://github.com/akhileshrangani4/teachanything/commit/6e7d051a18b1fcc4e552e9ff4996f98303dc7e48))

## [1.21.0](https://github.com/akhileshrangani4/teachanything/compare/v1.20.1...v1.21.0) (2026-06-08)


### Features

* **web-sources:** add crawl/add controls to top-level Web Sources page ([#314](https://github.com/akhileshrangani4/teachanything/issues/314)) ([09e9883](https://github.com/akhileshrangani4/teachanything/commit/09e9883a131c4c983990753c4d465ff78e996743))


### Miscellaneous Chores

* **build:** exclude .next/standalone from turbo cache outputs ([#311](https://github.com/akhileshrangani4/teachanything/issues/311)) ([b350f85](https://github.com/akhileshrangani4/teachanything/commit/b350f852c3c31466a9f6e9b9073d1cfa97fad123))

## [1.20.1](https://github.com/akhileshrangani4/teachanything/compare/v1.20.0...v1.20.1) (2026-05-05)


### Miscellaneous Chores

* **deps-dev:** bump turbo from 2.8.20 to 2.9.6 in the turbo group across 1 directory ([#262](https://github.com/akhileshrangani4/teachanything/issues/262)) ([511fe90](https://github.com/akhileshrangani4/teachanything/commit/511fe90e15880681d6ea30caa5c3da32538708c2))
* **deps:** bump @supabase/supabase-js from 2.103.3 to 2.104.1 in the supabase group ([#257](https://github.com/akhileshrangani4/teachanything/issues/257)) ([3e19e6f](https://github.com/akhileshrangani4/teachanything/commit/3e19e6faf27ddba8206c8d15c5ca45bd5b2db421))
* **deps:** bump @tanstack/react-query from 5.99.1 to 5.100.6 in the tanstack group across 1 directory ([#256](https://github.com/akhileshrangani4/teachanything/issues/256)) ([8985109](https://github.com/akhileshrangani4/teachanything/commit/898510959e6e3d8c8c8a8e900919b633882699b6))
* **deps:** bump googleapis/release-please-action from 4 to 5 in the actions group ([#253](https://github.com/akhileshrangani4/teachanything/issues/253)) ([3c9c057](https://github.com/akhileshrangani4/teachanything/commit/3c9c0573f3793fad6d7146657f6423a2a4170412))
* **deps:** bump marked from 17.0.4 to 18.0.2 in the markdown group across 1 directory ([#261](https://github.com/akhileshrangani4/teachanything/issues/261)) ([1b286ea](https://github.com/akhileshrangani4/teachanything/commit/1b286ea3ebc9a82a4bddca36c4b18e8123f1e30e))
* **deps:** bump postcss from 8.5.10 to 8.5.11 ([#265](https://github.com/akhileshrangani4/teachanything/issues/265)) ([ecfcf63](https://github.com/akhileshrangani4/teachanything/commit/ecfcf6350ff3327c380d143ff003a6a6c01a2f60))
* **deps:** bump postcss from 8.5.11 to 8.5.12 ([#270](https://github.com/akhileshrangani4/teachanything/issues/270)) ([aa7d16b](https://github.com/akhileshrangani4/teachanything/commit/aa7d16bdc671ca5e95d6123b4663682336b86405))
* **deps:** bump the langchain group across 1 directory with 2 updates ([#254](https://github.com/akhileshrangani4/teachanything/issues/254)) ([3ac539b](https://github.com/akhileshrangani4/teachanything/commit/3ac539bfffeb4108d34b2223a7973d46be1095ab))
* **deps:** bump the react group across 1 directory with 2 updates ([#255](https://github.com/akhileshrangani4/teachanything/issues/255)) ([b139086](https://github.com/akhileshrangani4/teachanything/commit/b1390868a496887257a7dc02e308c8cb175e12ad))
* **deps:** bump the tailwind group with 2 updates ([#259](https://github.com/akhileshrangani4/teachanything/issues/259)) ([bea561d](https://github.com/akhileshrangani4/teachanything/commit/bea561dc529f0b63fbab94bdbd56c27205fac124))

## [1.20.0](https://github.com/akhileshrangani4/teachanything/compare/v1.19.0...v1.20.0) (2026-05-02)


### Features

* **site:** add trademark status to site logos ([#267](https://github.com/akhileshrangani4/teachanything/issues/267)) ([52320e4](https://github.com/akhileshrangani4/teachanything/commit/52320e40b2e6b5def5356271b862b6672baa2e34))

## [1.19.0](https://github.com/akhileshrangani4/teachanything/compare/v1.18.1...v1.19.0) (2026-05-02)


### Features

* **web-sources:** improve source management UX ([#266](https://github.com/akhileshrangani4/teachanything/issues/266)) ([bb5cb65](https://github.com/akhileshrangani4/teachanything/commit/bb5cb657a8520f11a711e1127dc552bebb761496))


### Miscellaneous Chores

* **deps:** bump officeparser from 6.0.7 to 6.1.0 ([#263](https://github.com/akhileshrangani4/teachanything/issues/263)) ([ea0a375](https://github.com/akhileshrangani4/teachanything/commit/ea0a375d76a4b14a42215bc7a875f5f3c0146923))
* **deps:** bump the small-safe-packages group across 1 directory with 4 updates ([#260](https://github.com/akhileshrangani4/teachanything/issues/260)) ([94b4d7f](https://github.com/akhileshrangani4/teachanything/commit/94b4d7ff9ef78064971d2c951d22bc0ad5b9c15d))

## [1.18.1](https://github.com/akhileshrangani4/teachanything/compare/v1.18.0...v1.18.1) (2026-04-23)


### Documentation

* refresh README, AGENTS, SETUP, CONTRIBUTING and diagrams for 1.15-1.18 ([#251](https://github.com/akhileshrangani4/teachanything/issues/251)) ([f58a940](https://github.com/akhileshrangani4/teachanything/commit/f58a9403a669a583e542e9a6c7bf1fd35b6bd507))

## [1.18.0](https://github.com/akhileshrangani4/teachanything/compare/v1.17.1...v1.18.0) (2026-04-23)


### Features

* **analytics:** add conversation viewer for professors ([#232](https://github.com/akhileshrangani4/teachanything/issues/232)) ([196ec71](https://github.com/akhileshrangani4/teachanything/commit/196ec71bb674f4a67ed229bc0850de36e32b998a))

## [1.17.1](https://github.com/akhileshrangani4/teachanything/compare/v1.17.0...v1.17.1) (2026-04-22)


### Miscellaneous Chores

* **deps-dev:** bump drizzle-kit from 0.31.9 to 0.31.10 in the drizzle group across 1 directory ([#249](https://github.com/akhileshrangani4/teachanything/issues/249)) ([399e00e](https://github.com/akhileshrangani4/teachanything/commit/399e00e319fe83eed4c2f7fd468c44f423513849))
* **deps-dev:** bump flatted from 3.3.3 to 3.4.2 ([#236](https://github.com/akhileshrangani4/teachanything/issues/236)) ([d65350a](https://github.com/akhileshrangani4/teachanything/commit/d65350a6957a458d713834e41b2f6bdf03230d8e))
* **deps-dev:** bump the eslint group with 6 updates ([#191](https://github.com/akhileshrangani4/teachanything/issues/191)) ([ab8c7a2](https://github.com/akhileshrangani4/teachanything/commit/ab8c7a2f327a9731f3d6498dce72acbaabc19a22))
* **deps:** bump @supabase/supabase-js from 2.99.3 to 2.100.1 in the supabase group ([#216](https://github.com/akhileshrangani4/teachanything/issues/216)) ([b106c4d](https://github.com/akhileshrangani4/teachanything/commit/b106c4dcc124df81afa062108830957c05ef1f6b))
* **deps:** bump @tanstack/react-query from 5.90.21 to 5.95.2 in the tanstack group ([#215](https://github.com/akhileshrangani4/teachanything/issues/215)) ([ed442fe](https://github.com/akhileshrangani4/teachanything/commit/ed442fed3772ab38c583d94e2546980da30e180a))
* **deps:** bump @xmldom/xmldom from 0.8.11 to 0.8.13 ([#243](https://github.com/akhileshrangani4/teachanything/issues/243)) ([d6154c3](https://github.com/akhileshrangani4/teachanything/commit/d6154c35d00fd0a8e173b317a75696caba0f16fa))
* **deps:** bump axios from 1.12.2 to 1.15.2 ([#246](https://github.com/akhileshrangani4/teachanything/issues/246)) ([b372d5d](https://github.com/akhileshrangani4/teachanything/commit/b372d5d06cdd03392d732f71abf23f475d0cad21))
* **deps:** bump better-auth from 1.4.5 to 1.4.9 ([#219](https://github.com/akhileshrangani4/teachanything/issues/219)) ([f955104](https://github.com/akhileshrangani4/teachanything/commit/f9551048fb4b4e07c827d12319ed695dd5e2ea83))
* **deps:** bump codecov/codecov-action from 5 to 6 in the actions group across 1 directory ([#209](https://github.com/akhileshrangani4/teachanything/issues/209)) ([ac72fbe](https://github.com/akhileshrangani4/teachanything/commit/ac72fbe3005c971dda95088c6777a70f40664064))
* **deps:** bump defu from 6.1.4 to 6.1.7 ([#242](https://github.com/akhileshrangani4/teachanything/issues/242)) ([6e7d923](https://github.com/akhileshrangani4/teachanything/commit/6e7d923ce15a2294ae8364d4fcabba3d8c05db00))
* **deps:** bump dompurify from 3.3.0 to 3.4.1 ([#239](https://github.com/akhileshrangani4/teachanything/issues/239)) ([9809387](https://github.com/akhileshrangani4/teachanything/commit/9809387faedb93a91fdd6d4a2c52be32d74026ed))
* **deps:** bump drizzle-orm from 0.45.1 to 0.45.2 ([#223](https://github.com/akhileshrangani4/teachanything/issues/223)) ([2330bf7](https://github.com/akhileshrangani4/teachanything/commit/2330bf7987b29f667cc0c0e272b002ddbf0549be))
* **deps:** bump follow-redirects from 1.15.11 to 1.16.0 ([#240](https://github.com/akhileshrangani4/teachanything/issues/240)) ([5e9f74f](https://github.com/akhileshrangani4/teachanything/commit/5e9f74f3f4587116fe7eda80902ebe92318635ee))
* **deps:** bump kysely from 0.28.8 to 0.28.16 ([#237](https://github.com/akhileshrangani4/teachanything/issues/237)) ([bf83b39](https://github.com/akhileshrangani4/teachanything/commit/bf83b394508220edee180c18ac14f2ff42e28d1a))
* **deps:** bump langsmith from 0.5.2 to 0.5.21 ([#245](https://github.com/akhileshrangani4/teachanything/issues/245)) ([28b8fce](https://github.com/akhileshrangani4/teachanything/commit/28b8fce9ad1cd73cc4d72cf2d952b7340ea92bae))
* **deps:** bump lodash from 4.17.23 to 4.18.1 ([#241](https://github.com/akhileshrangani4/teachanything/issues/241)) ([5828c29](https://github.com/akhileshrangani4/teachanything/commit/5828c29f1866bb85192b22226d1c4af14b3f3d0a))
* **deps:** bump mdast-util-to-hast from 13.2.0 to 13.2.1 ([#238](https://github.com/akhileshrangani4/teachanything/issues/238)) ([761e8e3](https://github.com/akhileshrangani4/teachanything/commit/761e8e351537ad51d2a677dbd85631f58db52d07))
* **deps:** bump recharts from 2.15.4 to 3.8.0 ([#194](https://github.com/akhileshrangani4/teachanything/issues/194)) ([c87dc4f](https://github.com/akhileshrangani4/teachanything/commit/c87dc4f6b8ec2c51c78ca0b638f589e3a6b6c606))
* **deps:** bump socket.io-parser from 4.2.4 to 4.2.6 ([#235](https://github.com/akhileshrangani4/teachanything/issues/235)) ([d3fa203](https://github.com/akhileshrangani4/teachanything/commit/d3fa203fda2fcea8ff8f055854750ed34188c044))
* **deps:** bump the ai-sdk group with 2 updates ([#212](https://github.com/akhileshrangani4/teachanything/issues/212)) ([34fb7cd](https://github.com/akhileshrangani4/teachanything/commit/34fb7cdce69d325bec241f4e34123cb3e2c35d60))
* **deps:** bump the langchain group across 1 directory with 3 updates ([#221](https://github.com/akhileshrangani4/teachanything/issues/221)) ([22a61a4](https://github.com/akhileshrangani4/teachanything/commit/22a61a458b2cabd030c08d87cf29599820a9ec45))
* **deps:** bump the next group across 1 directory with 2 updates ([#220](https://github.com/akhileshrangani4/teachanything/issues/220)) ([05e80b8](https://github.com/akhileshrangani4/teachanything/commit/05e80b8138f18608031e97e4a2908c2ebe085f2b))
* **deps:** bump the tailwind group across 1 directory with 3 updates ([#225](https://github.com/akhileshrangani4/teachanything/issues/225)) ([ef9f3fc](https://github.com/akhileshrangani4/teachanything/commit/ef9f3fcc09bf0d0d4f1cbc3f92d469a93b669ae5))
* **deps:** bump the trpc group with 4 updates ([#210](https://github.com/akhileshrangani4/teachanything/issues/210)) ([b857df2](https://github.com/akhileshrangani4/teachanything/commit/b857df202454d15deb8f47e1f286f0bf3b716d0c))
* **deps:** bump underscore from 1.13.7 to 1.13.8 ([#244](https://github.com/akhileshrangani4/teachanything/issues/244)) ([4884011](https://github.com/akhileshrangani4/teachanything/commit/488401178e6a4e45da5739347138295abafdcf13))

## [1.17.0](https://github.com/akhileshrangani4/teachanything/compare/v1.16.1...v1.17.0) (2026-04-21)


### Features

* **crawler:** add web crawler for site content ingestion ([#222](https://github.com/akhileshrangani4/teachanything/issues/222)) ([fd67ef5](https://github.com/akhileshrangani4/teachanything/commit/fd67ef5634f29bffe2396fedaeb736764af51449))


### Bug Fixes

* **chat:** surface stream errors and truncation via fullStream ([#233](https://github.com/akhileshrangani4/teachanything/issues/233)) ([fd69369](https://github.com/akhileshrangani4/teachanything/commit/fd69369b1e85a39962151ae5aed470ae5bd45395))

## [1.16.1](https://github.com/akhileshrangani4/teachanything/compare/v1.16.0...v1.16.1) (2026-04-19)


### Bug Fixes

* **privacy:** update section 16 for self-service account deletion ([#230](https://github.com/akhileshrangani4/teachanything/issues/230)) ([7d1f1cf](https://github.com/akhileshrangani4/teachanything/commit/7d1f1cf63b430c17a4c80bb35b35496e9aa69127))

## [1.16.0](https://github.com/akhileshrangani4/teachanything/compare/v1.15.0...v1.16.0) (2026-04-18)


### Features

* add privacy policy page and self-service account deletion ([#228](https://github.com/akhileshrangani4/teachanything/issues/228)) ([2d33f18](https://github.com/akhileshrangani4/teachanything/commit/2d33f182266a86ee317aa9b6a0c11c6ed3d59a33))

## [1.15.0](https://github.com/akhileshrangani4/teachanything/compare/v1.14.1...v1.15.0) (2026-04-18)


### Features

* RAG pipeline & chat system overhaul ([#226](https://github.com/akhileshrangani4/teachanything/issues/226)) ([9a53d03](https://github.com/akhileshrangani4/teachanything/commit/9a53d03c07d4cd6a01fc6af0cff78a6e32f600f1))

## [1.14.1](https://github.com/akhileshrangani4/teachanything/compare/v1.14.0...v1.14.1) (2026-03-27)


### Miscellaneous Chores

* **deps-dev:** bump brace-expansion from 1.1.12 to 1.1.13 ([#207](https://github.com/akhileshrangani4/teachanything/issues/207)) ([af8d199](https://github.com/akhileshrangani4/teachanything/commit/af8d199eecb4ded09beb67b8d7aa51d510ea650a))
* **deps:** bump handlebars from 4.7.8 to 4.7.9 ([#206](https://github.com/akhileshrangani4/teachanything/issues/206)) ([d3afe97](https://github.com/akhileshrangani4/teachanything/commit/d3afe97e46783a7a5a23efac649e32d7b59c7804))
* **deps:** bump next from 16.2.0 to 16.2.1 ([#205](https://github.com/akhileshrangani4/teachanything/issues/205)) ([f0d0c3b](https://github.com/akhileshrangani4/teachanything/commit/f0d0c3ba019cbc7476d19c45f3c3425e229f3c6d))

## [1.14.0](https://github.com/akhileshrangani4/teachanything/compare/v1.13.2...v1.14.0) (2026-03-26)


### Features

* **ai:** add slide boundaries and speaker notes to PowerPoint extraction ([#159](https://github.com/akhileshrangani4/teachanything/issues/159)) ([42e4d21](https://github.com/akhileshrangani4/teachanything/commit/42e4d219a0c047ef72f6415c0717ce21a96e0b5a))


### Miscellaneous Chores

* **deps-dev:** bump @types/node from 22.18.11 to 25.4.0 ([#195](https://github.com/akhileshrangani4/teachanything/issues/195)) ([755f9c7](https://github.com/akhileshrangani4/teachanything/commit/755f9c7b9021df31276af508d344c7ba20d6b9b8))
* **deps-dev:** bump picomatch from 2.3.1 to 2.3.2 ([#203](https://github.com/akhileshrangani4/teachanything/issues/203)) ([5fc3f85](https://github.com/akhileshrangani4/teachanything/commit/5fc3f8596859c11df62d97ae6d7de1e2ab9d5e74))
* **deps-dev:** bump turbo from 2.8.16 to 2.8.17 in the turbo group ([#192](https://github.com/akhileshrangani4/teachanything/issues/192)) ([a048456](https://github.com/akhileshrangani4/teachanything/commit/a048456cf36930706e2392bc0648fa6087a7c345))
* **deps-dev:** bump typescript from 5.9.2 to 5.9.3 ([#193](https://github.com/akhileshrangani4/teachanything/issues/193)) ([ed4ea5c](https://github.com/akhileshrangani4/teachanything/commit/ed4ea5cd7ba106e7414bde71ae913fc2fd082ed1))
* **deps:** bump @supabase/supabase-js from 2.98.0 to 2.99.1 in the supabase group ([#190](https://github.com/akhileshrangani4/teachanything/issues/190)) ([79a4fd8](https://github.com/akhileshrangani4/teachanything/commit/79a4fd8b694ca29b5dc5f9f574b85cdb6a5795b1))
* **deps:** bump bcryptjs and @types/bcryptjs ([#197](https://github.com/akhileshrangani4/teachanything/issues/197)) ([367497f](https://github.com/akhileshrangani4/teachanything/commit/367497fff7397bd25ff780dbad17491fc8e02a92))
* **deps:** bump mammoth from 1.11.0 to 1.12.0 ([#196](https://github.com/akhileshrangani4/teachanything/issues/196)) ([8919746](https://github.com/akhileshrangani4/teachanything/commit/89197469f6e6ae15d4a89564fa5ea5555c799723))
* **deps:** bump next from 16.1.6 to 16.1.7 ([#198](https://github.com/akhileshrangani4/teachanything/issues/198)) ([8fc2072](https://github.com/akhileshrangani4/teachanything/commit/8fc207265a47b5f0260ad906e7c4c8ded10d725e))
* **deps:** bump next from 16.1.7 to 16.2.0 ([#204](https://github.com/akhileshrangani4/teachanything/issues/204)) ([47083ae](https://github.com/akhileshrangani4/teachanything/commit/47083ae705d48b9ee734920cbefc018ef9baad59))
* **deps:** bump the langchain group across 1 directory with 3 updates ([#201](https://github.com/akhileshrangani4/teachanything/issues/201)) ([fc3da89](https://github.com/akhileshrangani4/teachanything/commit/fc3da89cd713f3a1a87c9744c1a42e17f7853307))
* **deps:** bump the upstash group across 1 directory with 2 updates ([#200](https://github.com/akhileshrangani4/teachanything/issues/200)) ([b2e1306](https://github.com/akhileshrangani4/teachanything/commit/b2e1306468667d6ddd10f94fbda3306270e44489))
* **deps:** bump ytanikin/pr-conventional-commits from 1.5.1 to 1.5.2 in the actions group ([#199](https://github.com/akhileshrangani4/teachanything/issues/199)) ([395fc22](https://github.com/akhileshrangani4/teachanything/commit/395fc22faadb06825d0e72efb9d46eea52d22a28))

## [1.13.2](https://github.com/akhileshrangani4/teachanything/compare/v1.13.1...v1.13.2) (2026-03-13)


### Miscellaneous Chores

* **deps-dev:** bump globals from 17.0.0 to 17.4.0 ([#178](https://github.com/akhileshrangani4/teachanything/issues/178)) ([da02f76](https://github.com/akhileshrangani4/teachanything/commit/da02f766a273f50423cc383f85fcdc853633eb45))
* **deps-dev:** bump turbo from 2.8.10 to 2.8.15 in the turbo group ([#176](https://github.com/akhileshrangani4/teachanything/issues/176)) ([784ef13](https://github.com/akhileshrangani4/teachanything/commit/784ef13e55b6ba7d5556c5f77bcedc24f5220e6b))
* **deps:** bump @upstash/redis from 1.36.3 to 1.36.4 in the upstash group ([#171](https://github.com/akhileshrangani4/teachanything/issues/171)) ([6d3c50d](https://github.com/akhileshrangani4/teachanything/commit/6d3c50d09526b4c8801c3033145444a15729bc7c))
* **deps:** bump marked from 17.0.1 to 17.0.4 in the markdown group ([#175](https://github.com/akhileshrangani4/teachanything/issues/175)) ([2c2531c](https://github.com/akhileshrangani4/teachanything/commit/2c2531c0e84e0d9c243d343b4402c10133e80918))
* **deps:** bump postcss from 8.5.6 to 8.5.8 in the tailwind group across 1 directory ([#183](https://github.com/akhileshrangani4/teachanything/issues/183)) ([bc9f3d2](https://github.com/akhileshrangani4/teachanything/commit/bc9f3d2826458ad428fd797ac60c1e46df2ffbb9))
* **deps:** bump postgres from 3.4.7 to 3.4.8 ([#186](https://github.com/akhileshrangani4/teachanything/issues/186)) ([7707de6](https://github.com/akhileshrangani4/teachanything/commit/7707de609e00eec71b8ce118018adb26d5064004))
* **deps:** bump prettier 3.6→3.8, framer-motion, lucide-react, superjson ([#187](https://github.com/akhileshrangani4/teachanything/issues/187)) ([fdfe574](https://github.com/akhileshrangani4/teachanything/commit/fdfe574643eee8445c30373c013418dd5600fc5e))
* **deps:** bump the langchain group with 2 updates ([#170](https://github.com/akhileshrangani4/teachanything/issues/170)) ([bc15f01](https://github.com/akhileshrangani4/teachanything/commit/bc15f0145a1eb2192640e596673e1c8f9a321da5))
* **deps:** bump the trpc group with 4 updates ([#169](https://github.com/akhileshrangani4/teachanything/issues/169)) ([acdd661](https://github.com/akhileshrangani4/teachanything/commit/acdd661b652d5221cebf01a27b381c6970af03ad))
* **deps:** bump tldts from 7.0.19 to 7.0.25 ([#177](https://github.com/akhileshrangani4/teachanything/issues/177)) ([de6c505](https://github.com/akhileshrangani4/teachanything/commit/de6c50582c3ec1219120cc602b110b46c1d7aed7))
* **deps:** remove unused pino and pino-pretty ([#167](https://github.com/akhileshrangani4/teachanything/issues/167)) ([d3a907b](https://github.com/akhileshrangani4/teachanything/commit/d3a907bc4bd24562a73206f880f532d68877711e))
* **deps:** update dependabot groups after dependency upgrades ([#185](https://github.com/akhileshrangani4/teachanything/issues/185)) ([583a2e4](https://github.com/akhileshrangani4/teachanything/commit/583a2e41786a21e7157acac7f60ec3c407c8b5f2))


### Dependencies

* **tailwind:** upgrade Tailwind CSS 3.x to 4.x and tailwind-merge 2.x to 3.x ([#182](https://github.com/akhileshrangani4/teachanything/issues/182)) ([71ffe5b](https://github.com/akhileshrangani4/teachanything/commit/71ffe5b9593184dec9af5cc5e3bead5bc1751671))
* **zod:** upgrade Zod 3.x to 4.x and remove unused form deps ([#180](https://github.com/akhileshrangani4/teachanything/issues/180)) ([5460207](https://github.com/akhileshrangani4/teachanything/commit/5460207f5b0bc5cda7be411f4893c5005464f9bb))

## [1.13.1](https://github.com/akhileshrangani4/teachanything/compare/v1.13.0...v1.13.1) (2026-03-12)


### Miscellaneous Chores

* **deps-dev:** bump @types/react from 19.2.13 to 19.2.14 in the react group ([#143](https://github.com/akhileshrangani4/teachanything/issues/143)) ([b72430c](https://github.com/akhileshrangani4/teachanything/commit/b72430cd9f97ed854d18ce2353f705e43b1e9f1d))
* **deps-dev:** bump drizzle-kit from 0.31.8 to 0.31.9 in the drizzle group ([#141](https://github.com/akhileshrangani4/teachanything/issues/141)) ([312a3f8](https://github.com/akhileshrangani4/teachanything/commit/312a3f8725f829ac209557130ae527a4ae49f4d2))
* **deps-dev:** bump minimatch from 3.1.2 to 3.1.5 ([#157](https://github.com/akhileshrangani4/teachanything/issues/157)) ([73b6c88](https://github.com/akhileshrangani4/teachanything/commit/73b6c885160861f5287e55ffeee32d17c41049d5))
* **deps:** bump @langchain/community from 1.1.15 to 1.1.18 ([#158](https://github.com/akhileshrangani4/teachanything/issues/158)) ([b448083](https://github.com/akhileshrangani4/teachanything/commit/b448083a262855b23aac0792ca753d40b1c6426b))
* **deps:** bump @supabase/supabase-js from 2.95.2 to 2.95.3 in the supabase group ([#146](https://github.com/akhileshrangani4/teachanything/issues/146)) ([2085b83](https://github.com/akhileshrangani4/teachanything/commit/2085b83634280c7af435a5c121c0c7a82c97d5f7))
* **deps:** bump @tanstack/react-query from 5.90.20 to 5.90.21 in the tanstack group ([#144](https://github.com/akhileshrangani4/teachanything/issues/144)) ([8addfe3](https://github.com/akhileshrangani4/teachanything/commit/8addfe32f0de67a19aa2343b261108d7869c3e6e))
* **deps:** bump crazy-max/ghaction-github-labeler from 5.3.0 to 6.0.0 in the actions group ([#160](https://github.com/akhileshrangani4/teachanything/issues/160)) ([25d5a62](https://github.com/akhileshrangani4/teachanything/commit/25d5a62110efd5614bfc6a4428daf26c94913887))
* **deps:** bump the ai-sdk group with 2 updates ([#142](https://github.com/akhileshrangani4/teachanything/issues/142)) ([0c4e0be](https://github.com/akhileshrangani4/teachanything/commit/0c4e0be96ea0d8cddfdaf4c8181f598ec66f840a))
* **deps:** bump the trpc group with 4 updates ([#140](https://github.com/akhileshrangani4/teachanything/issues/140)) ([47eac06](https://github.com/akhileshrangani4/teachanything/commit/47eac0620dcda4a66c6076e6caa26ab05798df2f))
* **deps:** bump the upstash group with 2 updates ([#145](https://github.com/akhileshrangani4/teachanything/issues/145)) ([d1d89c5](https://github.com/akhileshrangani4/teachanything/commit/d1d89c50073462d7d44025dc2c55121de0ad7aac))

## [1.13.0](https://github.com/akhileshrangani4/teachanything/compare/v1.12.1...v1.13.0) (2026-03-03)


### Features

* **web:** add Hong Kong to country dropdown list ([#161](https://github.com/akhileshrangani4/teachanything/issues/161)) ([fa00ece](https://github.com/akhileshrangani4/teachanything/commit/fa00ece672957dd49435f3327329bafca8a136aa))

## [1.12.1](https://github.com/akhileshrangani4/teachanything/compare/v1.12.0...v1.12.1) (2026-02-24)


### Tests

* **web:** add 242 tests for validation, password, domain, and file utils ([#155](https://github.com/akhileshrangani4/teachanything/issues/155)) ([7062ede](https://github.com/akhileshrangani4/teachanything/commit/7062edeb23316644de4d8a594af63e330eff67cf))

## [1.12.0](https://github.com/akhileshrangani4/teachanything/compare/v1.11.0...v1.12.0) (2026-02-24)


### Features

* **test:** add Jest test suite with CI and Codecov ([#152](https://github.com/akhileshrangani4/teachanything/issues/152)) ([d3be5f3](https://github.com/akhileshrangani4/teachanything/commit/d3be5f34794cc96dca632720c54f64db18f4c46d))


### Bug Fixes

* **ci:** ignore release-please generated files in prettier ([#154](https://github.com/akhileshrangani4/teachanything/issues/154)) ([dd06b81](https://github.com/akhileshrangani4/teachanything/commit/dd06b813f1f77d7304f395f299604273b566f467))

## [1.11.0](https://github.com/akhileshrangani4/teachanything/compare/v1.10.2...v1.11.0) (2026-02-24)

### Features

- **web:** simplify local development setup with Docker and graceful degradation ([#148](https://github.com/akhileshrangani4/teachanything/issues/148)) ([c055e8d](https://github.com/akhileshrangani4/teachanything/commit/c055e8ddf17f647472b95040c5d7db769bedf088))

### Bug Fixes

- **security:** harden local storage path traversal checks ([#151](https://github.com/akhileshrangani4/teachanything/issues/151)) ([cc5b636](https://github.com/akhileshrangani4/teachanything/commit/cc5b636c311926eac14399d1559177f6694563b2))

### Documentation

- **readme:** link Contributing section to CONTRIBUTING.md, SETUP.md, AGENTS.md ([#150](https://github.com/akhileshrangani4/teachanything/issues/150)) ([47d4f42](https://github.com/akhileshrangani4/teachanything/commit/47d4f42f6f077e62b25a69941df7db609ac22665))

## [1.10.2](https://github.com/akhileshrangani4/teachanything/compare/v1.10.1...v1.10.2) (2026-02-16)

### Documentation

- add CONTRIBUTING.md to guide new contributors ([#138](https://github.com/akhileshrangani4/teachanything/issues/138)) ([7653abe](https://github.com/akhileshrangani4/teachanything/commit/7653abe440a35e5c8956113c221ab75d5765293b))

## [1.10.1](https://github.com/akhileshrangani4/teachanything/compare/v1.10.0...v1.10.1) (2026-02-16)

### Miscellaneous Chores

- **deps:** bump the langchain group across 1 directory with 3 updates ([#133](https://github.com/akhileshrangani4/teachanything/issues/133)) ([8a2782e](https://github.com/akhileshrangani4/teachanything/commit/8a2782e58077cb348bd99f88b8376d5a57cd6b04))
- **deps:** bump the react group across 1 directory with 3 updates ([#105](https://github.com/akhileshrangani4/teachanything/issues/105)) ([121b836](https://github.com/akhileshrangani4/teachanything/commit/121b836a75b250a571d0a5694bc32d29ea4c53e9))

## [1.10.0](https://github.com/akhileshrangani4/teachanything/compare/v1.9.1...v1.10.0) (2026-02-16)

### Features

- **email:** route all emails through QStash with delivery tracking ([#134](https://github.com/akhileshrangani4/teachanything/issues/134)) ([ebf87ef](https://github.com/akhileshrangani4/teachanything/commit/ebf87ef5859ce256e78b3aac711666039999d8ab))

### Miscellaneous Chores

- **deps:** bump @langchain/community from 1.1.4 to 1.1.14 ([#121](https://github.com/akhileshrangani4/teachanything/issues/121)) ([5207191](https://github.com/akhileshrangani4/teachanything/commit/5207191dc885e3c7dc932deb704c12f1d0f4af74))
- **deps:** bump @supabase/supabase-js from 2.90.1 to 2.91.0 in the supabase group ([#101](https://github.com/akhileshrangani4/teachanything/issues/101)) ([e8d6aa3](https://github.com/akhileshrangani4/teachanything/commit/e8d6aa30a005476c51668116c4ee96ec75725f41))
- **deps:** bump @tanstack/react-query from 5.90.19 to 5.90.20 in the tanstack group ([#100](https://github.com/akhileshrangani4/teachanything/issues/100)) ([52dc815](https://github.com/akhileshrangani4/teachanything/commit/52dc815cba504390872dbc8617e6fe00cd15f2b6))
- **deps:** bump the ai-sdk group with 2 updates ([#96](https://github.com/akhileshrangani4/teachanything/issues/96)) ([5c7a893](https://github.com/akhileshrangani4/teachanything/commit/5c7a893f16e7a26d5c813f90c2ee39209bc6395d))
- **deps:** bump the next group across 1 directory with 2 updates ([#106](https://github.com/akhileshrangani4/teachanything/issues/106)) ([34986e4](https://github.com/akhileshrangani4/teachanything/commit/34986e497af11f3135128ca0bbc1c425e444b7b1))

## [1.9.1](https://github.com/akhileshrangani4/teachanything/compare/v1.9.0...v1.9.1) (2026-02-13)

### Miscellaneous Chores

- add more featured links ([#122](https://github.com/akhileshrangani4/teachanything/issues/122)) ([cf22d69](https://github.com/akhileshrangani4/teachanything/commit/cf22d69c5e6f619fc16859832b969a2a11aabcc8))

## [1.9.0](https://github.com/akhileshrangani4/teachanything/compare/v1.8.0...v1.9.0) (2026-02-08)

### Features

- **seo:** add sitemap.xml and robots.txt generation ([#119](https://github.com/akhileshrangani4/teachanything/issues/119)) ([5b3a1df](https://github.com/akhileshrangani4/teachanything/commit/5b3a1df9e115d55f6b2b59c87e3e0c927a7ae779))

## [1.8.0](https://github.com/akhileshrangani4/teachanything/compare/v1.7.0...v1.8.0) (2026-02-08)

### Features

- **seo:** update metadata for open source education branding ([#117](https://github.com/akhileshrangani4/teachanything/issues/117)) ([3f512e6](https://github.com/akhileshrangani4/teachanything/commit/3f512e65b24f3eb2c26751d3bd4121a58d480ae4))

## [1.7.0](https://github.com/akhileshrangani4/teachanything/compare/v1.6.1...v1.7.0) (2026-02-08)

### Features

- **user:** add country field and rename faculty labels ([#116](https://github.com/akhileshrangani4/teachanything/issues/116)) ([28177c2](https://github.com/akhileshrangani4/teachanything/commit/28177c2c4c3c0df8cbd785ae6fe36bce409dc409))

### Bug Fixes

- **chat:** redesign shared chat page as full-screen chatbot ([#114](https://github.com/akhileshrangani4/teachanything/issues/114)) ([849b337](https://github.com/akhileshrangani4/teachanything/commit/849b337d76423aa6bedbaaf973f32bfb49683d91))

## [1.6.1](https://github.com/akhileshrangani4/teachanything/compare/v1.6.0...v1.6.1) (2026-02-08)

### Bug Fixes

- **layout:** use h-dvh instead of h-screen for mobile viewport ([#112](https://github.com/akhileshrangani4/teachanything/issues/112)) ([4bbb71c](https://github.com/akhileshrangani4/teachanything/commit/4bbb71c3c477899b3ecdabe2d4bcd6c758647ba0))

## [1.6.0](https://github.com/akhileshrangani4/teachanything/compare/v1.5.3...v1.6.0) (2026-02-08)

### Features

- **dashboard:** responsive UI redesign with skeleton loading states ([#110](https://github.com/akhileshrangani4/teachanything/issues/110)) ([e313ee0](https://github.com/akhileshrangani4/teachanything/commit/e313ee0c3c89c7d0a29ba457ffcb5376705de90c))

## [1.5.3](https://github.com/akhileshrangani4/teachanything/compare/v1.5.2...v1.5.3) (2026-02-07)

### Bug Fixes

- **embed:** enable message copying in cross-origin iframe widgets ([#109](https://github.com/akhileshrangani4/teachanything/issues/109)) ([9864e33](https://github.com/akhileshrangani4/teachanything/commit/9864e3339d2665a3359087b951f3866e9536647e))

### Miscellaneous Chores

- update license information in README.md ([#107](https://github.com/akhileshrangani4/teachanything/issues/107)) ([943a504](https://github.com/akhileshrangani4/teachanything/commit/943a504a05d702d67abb723ab01bc0959aa3f584))

## [1.5.2](https://github.com/akhileshrangani4/teachanything/compare/v1.5.1...v1.5.2) (2026-01-22)

### Miscellaneous Chores

- **deps-dev:** bump globals from 16.4.0 to 17.0.0 ([#87](https://github.com/akhileshrangani4/teachanything/issues/87)) ([a78f037](https://github.com/akhileshrangani4/teachanything/commit/a78f0379dbffb0ef95ae9119d2dd949f566af79d))
- **deps:** bump @tanstack/react-query in the tanstack group ([#82](https://github.com/akhileshrangani4/teachanything/issues/82)) ([23e4837](https://github.com/akhileshrangani4/teachanything/commit/23e4837b4761552cb1461cc4c8156479f3266614))
- **deps:** bump marked from 16.4.1 to 17.0.1 in the markdown group ([#86](https://github.com/akhileshrangani4/teachanything/issues/86)) ([65f10f4](https://github.com/akhileshrangani4/teachanything/commit/65f10f4bfe999933097cfb1d4909bbdf8c2a63a5))
- **deps:** bump next from 16.1.0 to 16.1.1 ([#91](https://github.com/akhileshrangani4/teachanything/issues/91)) ([554dd92](https://github.com/akhileshrangani4/teachanything/commit/554dd9233c77f046cf4fd9870e42d1a6c138b4d6))
- **deps:** bump next from 16.1.3 to 16.1.4 ([#95](https://github.com/akhileshrangani4/teachanything/issues/95)) ([129118f](https://github.com/akhileshrangani4/teachanything/commit/129118f9912aa8bbd65bfeb3044b26f0aca6d0fe))
- **deps:** bump the ai-sdk group with 2 updates ([#79](https://github.com/akhileshrangani4/teachanything/issues/79)) ([24199a9](https://github.com/akhileshrangani4/teachanything/commit/24199a9e07332c0d19721cfd34434f211e75afe0))
- **deps:** bump the langchain group with 2 updates ([#80](https://github.com/akhileshrangani4/teachanything/issues/80)) ([16c80ce](https://github.com/akhileshrangani4/teachanything/commit/16c80ce5b40e8d08187cc06949d237d9b0dcc153))
- **deps:** bump the next group with 2 updates ([#81](https://github.com/akhileshrangani4/teachanything/issues/81)) ([3dc9817](https://github.com/akhileshrangani4/teachanything/commit/3dc9817919eed466fc2f487d9b970ff929b1eaf2))

## [1.5.1](https://github.com/akhileshrangani4/teachanything/compare/v1.5.0...v1.5.1) (2026-01-20)

### Miscellaneous Chores

- update sign up form brand message ([#92](https://github.com/akhileshrangani4/teachanything/issues/92)) ([42b4d38](https://github.com/akhileshrangani4/teachanything/commit/42b4d3867d41fa2f01703a6137d89cf0a0171c5c))

## [1.5.0](https://github.com/akhileshrangani4/teachanything/compare/v1.4.1...v1.5.0) (2026-01-20)

### Features

- **admin:** add Excel export for admin dashboard data ([#89](https://github.com/akhileshrangani4/teachanything/issues/89)) ([42ad2f6](https://github.com/akhileshrangani4/teachanything/commit/42ad2f6d008c790ce063eb912b5fff01276c3eb9))

## [1.4.1](https://github.com/akhileshrangani4/teachanything/compare/v1.4.0...v1.4.1) (2026-01-19)

### Bug Fixes

- **settings:** title dropdown persistence and component refactor ([#77](https://github.com/akhileshrangani4/teachanything/issues/77)) ([41e392d](https://github.com/akhileshrangani4/teachanything/commit/41e392d5dcf3ecb47a1e235f34e4355cd3ba576c))

## [1.4.0](https://github.com/akhileshrangani4/teachanything/compare/v1.3.0...v1.4.0) (2026-01-19)

### Features

- **ui:** improve mobile responsiveness and consolidate settings page ([#75](https://github.com/akhileshrangani4/teachanything/issues/75)) ([15b1832](https://github.com/akhileshrangani4/teachanything/commit/15b1832f307917d02c91fbfedc57064e7f18167f))

## [1.3.0](https://github.com/akhileshrangani4/teachanything/compare/v1.2.0...v1.3.0) (2026-01-19)

### Features

- **auth:** make all verification fields required ([#73](https://github.com/akhileshrangani4/teachanything/issues/73)) ([4a9f9cd](https://github.com/akhileshrangani4/teachanything/commit/4a9f9cdfcbf3e32734a71d88aec09ac01261b234))

## [1.2.0](https://github.com/akhileshrangani4/teachanything/compare/v1.1.0...v1.2.0) (2026-01-19)

### Features

- **auth:** add user verification fields for registration and admin review ([#71](https://github.com/akhileshrangani4/teachanything/issues/71)) ([8519cb0](https://github.com/akhileshrangani4/teachanything/commit/8519cb00fa51e1c101330c1e98697ec753d301f2))

## [1.1.0](https://github.com/akhileshrangani4/teachanything/compare/v1.0.5...v1.1.0) (2026-01-19)

### Features

- **email:** add do-not-reply footer to all automated emails ([#69](https://github.com/akhileshrangani4/teachanything/issues/69)) ([1b120e2](https://github.com/akhileshrangani4/teachanything/commit/1b120e2eacc8a7d08798e050189139497ebc628f))

## [1.0.5](https://github.com/akhileshrangani4/teachanything/compare/v1.0.4...v1.0.5) (2026-01-19)

### Bug Fixes

- **ui:** improve markdown list spacing in chat messages ([#66](https://github.com/akhileshrangani4/teachanything/issues/66)) ([38bec83](https://github.com/akhileshrangani4/teachanything/commit/38bec8385a9b6d5e31cb93b63e20328df6282108))

### Miscellaneous Chores

- **deps:** bump next from 16.0.10 to 16.1.0 ([#64](https://github.com/akhileshrangani4/teachanything/issues/64)) ([14e9846](https://github.com/akhileshrangani4/teachanything/commit/14e984621a69312663cb73392e7159ae763f420d))

### Continuous Integration

- add production deployment to release-please workflow ([#68](https://github.com/akhileshrangani4/teachanything/issues/68)) ([52ad963](https://github.com/akhileshrangani4/teachanything/commit/52ad963acaeece00c466f287aa26404cf18bf118))

## [1.0.4](https://github.com/akhileshrangani4/teachanything/compare/v1.0.3...v1.0.4) (2026-01-19)

### Bug Fixes

- **ai:** switch to official OpenRouter provider for AI SDK 5 compatibility ([#62](https://github.com/akhileshrangani4/teachanything/issues/62)) ([50453d0](https://github.com/akhileshrangani4/teachanything/commit/50453d032adf7f61b06f83e8e79acdca2ede1ca0))

## [1.0.3](https://github.com/akhileshrangani4/teachanything/compare/v1.0.2...v1.0.3) (2026-01-17)

### Documentation

- update documentation for Next.js 16 and simplify README ([#60](https://github.com/akhileshrangani4/teachanything/issues/60)) ([05a773b](https://github.com/akhileshrangani4/teachanything/commit/05a773bd9e01bbbe4518a67379512093dababd42))

## [1.0.2](https://github.com/akhileshrangani4/teachanything/compare/v1.0.1...v1.0.2) (2026-01-17)

### Miscellaneous Chores

- **deps:** bump ai from 4.3.19 to 5.0.52 ([#50](https://github.com/akhileshrangani4/teachanything/issues/50)) ([3c355ed](https://github.com/akhileshrangani4/teachanything/commit/3c355ed93a30cc9616ae83ee23be479302d3ff62))
- **deps:** bump next from 15.5.9 to 16.0.10 ([#53](https://github.com/akhileshrangani4/teachanything/issues/53)) ([a342abb](https://github.com/akhileshrangani4/teachanything/commit/a342abb329d17890d427a45c948bce024a956362))

## [1.0.1](https://github.com/akhileshrangani4/teachanything/compare/v1.0.0...v1.0.1) (2026-01-17)

### Miscellaneous Chores

- **deps:** bump @langchain/core from 0.3.78 to 0.3.80 ([#47](https://github.com/akhileshrangani4/teachanything/issues/47)) ([2f802d6](https://github.com/akhileshrangani4/teachanything/commit/2f802d6b9c60d5274de1da7b56d35306bd901625))
- **deps:** bump the drizzle group with 2 updates ([#33](https://github.com/akhileshrangani4/teachanything/issues/33)) ([ebcafaf](https://github.com/akhileshrangani4/teachanything/commit/ebcafaf5116bef199f08e1b4f0cf32457a623017))
- **deps:** bump the langchain group across 1 directory with 3 updates ([#57](https://github.com/akhileshrangani4/teachanything/issues/57)) ([81ce79b](https://github.com/akhileshrangani4/teachanything/commit/81ce79b61b3aba0b8ea125840d4e745f73af43ce))
- **deps:** bump the radix-ui group with 3 updates ([#32](https://github.com/akhileshrangani4/teachanything/issues/32)) ([676583c](https://github.com/akhileshrangani4/teachanything/commit/676583cd749b4ad1540f04cc3a16e64d535b2c82))

## 1.0.0 (2026-01-17)

### Features

- add a lot of things ([#2](https://github.com/akhileshrangani4/teachanything/issues/2)) ([6b739a9](https://github.com/akhileshrangani4/teachanything/commit/6b739a9ffe0a3026d52c0d9226b5e7bc2a1e13a6))
- add a lot of things ([#7](https://github.com/akhileshrangani4/teachanything/issues/7)) ([96275b1](https://github.com/akhileshrangani4/teachanything/commit/96275b135ad0570ecb000fb480f5ebcb145ee32d))
- add diagrams ([#4](https://github.com/akhileshrangani4/teachanything/issues/4)) ([a22064d](https://github.com/akhileshrangani4/teachanything/commit/a22064dda14b6773a99bd60d60a7b6b10bb6ce12))
- add file retry functionality and enhance processing progress tracking ([#13](https://github.com/akhileshrangani4/teachanything/issues/13)) ([55b34a3](https://github.com/akhileshrangani4/teachanything/commit/55b34a370b70145d9a2ad8cf3cf343f8b06bcbfc))
- add MIT License and update README and SETUP documentation ([#3](https://github.com/akhileshrangani4/teachanything/issues/3)) ([5883baa](https://github.com/akhileshrangani4/teachanything/commit/5883baa5e24a16260aa314a4a6440133bb97cecb))
- Add server-side search and sorting to all tables ([#21](https://github.com/akhileshrangani4/teachanything/issues/21)) ([9a942f5](https://github.com/akhileshrangani4/teachanything/commit/9a942f53fb6259e36c7d05abedfb91da82707930))
- add showSources feature to chatbot and chat components ([98512af](https://github.com/akhileshrangani4/teachanything/commit/98512af89c4d1fa1aaf0e90e8183f50ceb8ee7c6))
- Add stop streaming button with cancelled message indicator ([#20](https://github.com/akhileshrangani4/teachanything/issues/20)) ([181d9f2](https://github.com/akhileshrangani4/teachanything/commit/181d9f2f993217aebdca8142f269852cdf2cbd84))
- add text sanitization for file content extraction ([#12](https://github.com/akhileshrangani4/teachanything/issues/12)) ([f4e6c8f](https://github.com/akhileshrangani4/teachanything/commit/f4e6c8fe559206f878e4b6969493c2b87ad3139f))
- **create-turbo:** apply official-starter transform ([d5a646e](https://github.com/akhileshrangani4/teachanything/commit/d5a646ec8b8eecb75f0d345f5058cb6a1f62ee19))
- **create-turbo:** apply package-manager transform ([69744ef](https://github.com/akhileshrangani4/teachanything/commit/69744ef5f12309a712ad8a2a8de832cff3040085))
- **create-turbo:** create basic ([cd32fbc](https://github.com/akhileshrangani4/teachanything/commit/cd32fbc8c27fb0e561b642bd43af3c05c47d2a3d))
- Direct client-to-Supabase uploads & authenticated file downloads ([#14](https://github.com/akhileshrangani4/teachanything/issues/14)) ([6dd305d](https://github.com/akhileshrangani4/teachanything/commit/6dd305d65413229447ddb03b63789f46b34f774d))
- enhance admin user management features ([98071ba](https://github.com/akhileshrangani4/teachanything/commit/98071ba0603a2b652ba4c1202d23f9d3222954bf))
- enhance domain validation in AllowedDomainsTab ([#15](https://github.com/akhileshrangani4/teachanything/issues/15)) ([42e318d](https://github.com/akhileshrangani4/teachanything/commit/42e318de5b239dd4daafc6119f5dc7cf633cd76a))
- enhance file upload and management features ([2440785](https://github.com/akhileshrangani4/teachanything/commit/24407854c6b2ace5f4358a3d660d4862c7664f7e))
- enhance file upload and rate limiting features ([#8](https://github.com/akhileshrangani4/teachanything/issues/8)) ([0475c0e](https://github.com/akhileshrangani4/teachanything/commit/0475c0eef9bdfd274f5fb05ef5ad500ddcf94d2e))
- enhance Support Us section with donations, publicity, and UX improvements ([#18](https://github.com/akhileshrangani4/teachanything/issues/18)) ([35f98b1](https://github.com/akhileshrangani4/teachanything/commit/35f98b1702fea24ffb52615151f80297d7f4dcf7))
- implement admin email retrieval from database ([364ebc9](https://github.com/akhileshrangani4/teachanything/commit/364ebc9f5c55e74408a47dad5afc7f361bd7700b))
- improve file association and error handling in chatbot file management ([6248d92](https://github.com/akhileshrangani4/teachanything/commit/6248d924d2d767aaddc3b7716096c11ee6f2c61b))
- integrate tldts for enhanced domain validation and chat export functionality ([#16](https://github.com/akhileshrangani4/teachanything/issues/16)) ([3d49257](https://github.com/akhileshrangani4/teachanything/commit/3d4925762e214d41af2c4c902f336220a7324813))
- migration to teach anything name ([#22](https://github.com/akhileshrangani4/teachanything/issues/22)) ([abcec48](https://github.com/akhileshrangani4/teachanything/commit/abcec48fa88f00cf3a2d1a522bcb35074af44719))
- Password reset flow, allowed domains pagination & embed UX improvements ([#17](https://github.com/akhileshrangani4/teachanything/issues/17)) ([e760b35](https://github.com/akhileshrangani4/teachanything/commit/e760b353270f77c28950d51b9b671d2113312b6e))
- update architecture diagram ([#5](https://github.com/akhileshrangani4/teachanything/issues/5)) ([9c8ba02](https://github.com/akhileshrangani4/teachanything/commit/9c8ba025e732c3344aa16738183889c5c8a2c475))
- update landing page ([#6](https://github.com/akhileshrangani4/teachanything/issues/6)) ([3170499](https://github.com/akhileshrangani4/teachanything/commit/3170499c8977ac32044bf0b43b9bc3aa9ebab8c5))
- update landing page and enhance components ([#10](https://github.com/akhileshrangani4/teachanything/issues/10)) ([b20d63a](https://github.com/akhileshrangani4/teachanything/commit/b20d63abfb4a33abce0547824d80206f0d3cd0a5))

### Bug Fixes

- **ci:** add bootstrap-sha to ignore old release PR ([#44](https://github.com/akhileshrangani4/teachanything/issues/44)) ([48ba829](https://github.com/akhileshrangani4/teachanything/commit/48ba829052e1527a41a08b745d347741ee2aadbd))
- **ci:** change release PR title pattern to avoid matching old PR ([#45](https://github.com/akhileshrangani4/teachanything/issues/45)) ([b4834eb](https://github.com/akhileshrangani4/teachanything/commit/b4834eb48ce135c62173df9ba75a4ee5724548ee))
- **ci:** correct last-release-sha to PR [#42](https://github.com/akhileshrangani4/teachanything/issues/42) merge commit ([#46](https://github.com/akhileshrangani4/teachanything/issues/46)) ([d75a7c4](https://github.com/akhileshrangani4/teachanything/commit/d75a7c4658bb9dc0b0908d8e9e00fc1d986a3a29))
- **ci:** fix release-please config to properly track apps/web ([#43](https://github.com/akhileshrangani4/teachanything/issues/43)) ([83a5492](https://github.com/akhileshrangani4/teachanything/commit/83a549268431040904cc3bb209bcf26bcfcd43db))
- **ci:** reset release-please config to match tambo's working setup ([#52](https://github.com/akhileshrangani4/teachanything/issues/52)) ([160981b](https://github.com/akhileshrangani4/teachanything/commit/160981b31cf508fd79eac0236878afde1336c5ff))
- **ci:** switch release-please to root-level tracking ([#54](https://github.com/akhileshrangani4/teachanything/issues/54)) ([ac0cb54](https://github.com/akhileshrangani4/teachanything/commit/ac0cb541605cfb77a53230f1049b72bda3bff548))
- file number on featured chatbots ([#11](https://github.com/akhileshrangani4/teachanything/issues/11)) ([7dd472a](https://github.com/akhileshrangani4/teachanything/commit/7dd472a76dc90e22e5c1f403cd8326b7120786d5))
- **files:** exclude already-associated files from library when adding to chatbot ([#27](https://github.com/akhileshrangani4/teachanything/issues/27)) ([eabe22f](https://github.com/akhileshrangani4/teachanything/commit/eabe22f271fbad34f9c140b5b0549536688a1923))
- **files:** increase file upload rate limit from 5 to 20 per minute ([#26](https://github.com/akhileshrangani4/teachanything/issues/26)) ([de36398](https://github.com/akhileshrangani4/teachanything/commit/de363984d327ec6c3eb5387ddfad159ae1f93954))
- next vulnerability ([#9](https://github.com/akhileshrangani4/teachanything/issues/9)) ([6b2d868](https://github.com/akhileshrangani4/teachanything/commit/6b2d8689dddc5ca554f66bf7b2ba29c06262eca5))
- update environment variable references in SupportUsSection ([#23](https://github.com/akhileshrangani4/teachanything/issues/23)) ([ce7b9bb](https://github.com/akhileshrangani4/teachanything/commit/ce7b9bb969cc84d7e19fff35b1a7bd5d0435ef2f))
- update LinkedIn URL handling in DashboardSidebar and InfoSection components ([#19](https://github.com/akhileshrangani4/teachanything/issues/19)) ([f4a8109](https://github.com/akhileshrangani4/teachanything/commit/f4a81098567454a03f93a2950d3e9764ea81d837))

### Miscellaneous Chores

- add GitHub Actions workflow for automated build process ([#1](https://github.com/akhileshrangani4/teachanything/issues/1)) ([2a94f65](https://github.com/akhileshrangani4/teachanything/commit/2a94f65b9b458853b0b619164c038206f5b3b9f6))
- add OpenAI API key requirement to documentation and env example ([857c0d9](https://github.com/akhileshrangani4/teachanything/commit/857c0d9c8dc9a3b3df79e9e224084505dfbd1c80))
- **ci:** add GitHub automation for dependabot, labels, and CI improvements ([#29](https://github.com/akhileshrangani4/teachanything/issues/29)) ([d2237da](https://github.com/akhileshrangani4/teachanything/commit/d2237da638a01b70be27ca67d0e62f4cac40ff4d))
- **ci:** add release-please for automated releases and changelog ([#41](https://github.com/akhileshrangani4/teachanything/issues/41)) ([96ea5a5](https://github.com/akhileshrangani4/teachanything/commit/96ea5a5483a981aafdf18a1dfeebb8ee270559df))
- **deps:** bump @supabase/supabase-js in the supabase group ([#40](https://github.com/akhileshrangani4/teachanything/issues/40)) ([49f4663](https://github.com/akhileshrangani4/teachanything/commit/49f466351b416f0369aa0744e2f748431af9e9d3))
- **deps:** bump @tanstack/react-query in the tanstack group ([#38](https://github.com/akhileshrangani4/teachanything/issues/38)) ([1808c82](https://github.com/akhileshrangani4/teachanything/commit/1808c824859213e2d56a7b6139cdc5f17b82c440))
- **deps:** bump langchain from 1.0.1 to 1.2.7 ([#51](https://github.com/akhileshrangani4/teachanything/issues/51)) ([4de0ce2](https://github.com/akhileshrangani4/teachanything/commit/4de0ce23a82a589dc098735544223d9bb02afc4b))
- **deps:** bump next from 15.5.7 to 15.5.9 ([#49](https://github.com/akhileshrangani4/teachanything/issues/49)) ([bda3693](https://github.com/akhileshrangani4/teachanything/commit/bda3693e21c6cefe134a6576ef9b8639ff893001))
- **deps:** bump the actions group with 2 updates ([#30](https://github.com/akhileshrangani4/teachanything/issues/30)) ([5c83caf](https://github.com/akhileshrangani4/teachanything/commit/5c83caf62a9d9539af7f46b4061327225608eed6))
- **deps:** bump the react group with 4 updates ([#37](https://github.com/akhileshrangani4/teachanything/issues/37)) ([b334bd5](https://github.com/akhileshrangani4/teachanything/commit/b334bd5ed2f9c1c95c2ae806bfaa43a337548993))
- **deps:** bump the trpc group with 4 updates ([#31](https://github.com/akhileshrangani4/teachanything/issues/31)) ([dae2314](https://github.com/akhileshrangani4/teachanything/commit/dae23142403f60de0e321bae1f8a30aa9b54901c))
- **deps:** bump the upstash group with 2 updates ([#39](https://github.com/akhileshrangani4/teachanything/issues/39)) ([e975589](https://github.com/akhileshrangani4/teachanything/commit/e975589f258bc6e38c99bfff5d77d5da657d36a1))
- release main ([#42](https://github.com/akhileshrangani4/teachanything/issues/42)) ([5759401](https://github.com/akhileshrangani4/teachanything/commit/57594014a01c567d1a77d315d92b79c65a0e7565))
- update .env.example and env.ts for development configuration ([729f76b](https://github.com/akhileshrangani4/teachanything/commit/729f76bebedd5cbfa3f4d112cbce4b36b2b9783f))
- update database setup instructions and enhance package configuration ([30edcb3](https://github.com/akhileshrangani4/teachanything/commit/30edcb35df48b92eec570c1ff5e8ecb39a0137d7))

### Documentation

- add AI agent guidance and Claude Code configuration ([#25](https://github.com/akhileshrangani4/teachanything/issues/25)) ([40787b1](https://github.com/akhileshrangani4/teachanything/commit/40787b18c018c7cf216b4b8d5397fb841f45bdbd))

### Code Refactoring

- Migrate to Next.js 15 with tRPC and Better Auth, remove old docs, update project name to AIAlexa ([c825cbc](https://github.com/akhileshrangani4/teachanything/commit/c825cbc789933342acb162854c7e8ce7ccb8d381))

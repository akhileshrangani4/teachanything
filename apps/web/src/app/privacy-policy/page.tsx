import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandName, BRAND_NAME_WITH_MARK } from "@/components/brand/BrandName";
import s from "./legal.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy Policy for ${BRAND_NAME_WITH_MARK} - learn how we collect, use, and protect your personal information.`,
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <article className={s.prose}>
          <h1>Privacy Policy</h1>
          <p data-legal-meta>Last updated April 17, 2026</p>

          <p>
            This Privacy Notice for <BrandName /> (&ldquo;we,&rdquo;
            &ldquo;us,&rdquo; or &ldquo;our&rdquo;), describes how and why we
            might access, collect, store, use, and/or share
            (&ldquo;process&rdquo;) your personal information when you use our
            services (&ldquo;Services&rdquo;), including when you:
          </p>
          <ul>
            <li>
              Visit our website at{" "}
              <a href="https://www.teachanything.ai">
                https://www.teachanything.ai
              </a>{" "}
              or any website of ours that links to this Privacy Notice
            </li>
            <li>
              Use <BrandName /> Open-Access AI for Educators. <BrandName /> is
              an open-access platform for educators to use open-source large
              language models (LLMs) to design custom AI applications. Educators
              can upload their course files and customize the AI&apos;s
              behaviors in a manner that is beneficial for pedagogical purposes.
              Educators can write and fine-tune system background prompts to
              accomplish this. The AI applications they create are permanently
              free and open access.
            </li>
            <li>
              Engage with us in other related ways, including any marketing or
              events
            </li>
          </ul>
          <p>
            Reading this Privacy Notice will help you understand your privacy
            rights and choices. By using this service, you agree to our Terms of
            Service. Continued use of our services constitutes your acceptance
            of any revisions to these terms. If you do not agree with our
            policies and practices, please do not use our Services. If you still
            have any questions or concerns, please contact us at{" "}
            <a href="mailto:admin@teachanything.ai">admin@teachanything.ai</a>.
          </p>

          <h2>Summary of Key Points</h2>
          <p>
            This summary provides key points from our Privacy Notice, but you
            can find out more details about any of these topics by clicking the
            link following each key point or by using our table of contents
            below to find the section you are looking for.
          </p>
          <p>
            <strong>What personal information do we process?</strong> When you
            visit, use, or navigate our Services, we may process personal
            information depending on how you interact with us and the Services,
            the choices you make, and the products and features you use. Learn
            more about personal information you disclose to us.
          </p>
          <p>
            <strong>Do we process any sensitive personal information?</strong>{" "}
            Some of the information may be considered &ldquo;special&rdquo; or
            &ldquo;sensitive&rdquo; in certain jurisdictions, for example your
            racial or ethnic origins, sexual orientation, and religious beliefs.
            We do not process sensitive personal information.
          </p>
          <p>
            <strong>Do we collect any information from third parties?</strong>{" "}
            We may receive email delivery status information (such as whether an
            email was delivered or bounced) from our email service provider,
            Resend. We do not otherwise collect personal information from third
            parties.
          </p>
          <p>
            <strong>How do we process your information?</strong> We process your
            information to provide, improve, and administer our Services,
            communicate with you, for security and fraud prevention, and to
            comply with law. We may also process your information for other
            purposes with your consent. We process your information only when we
            have a valid legal reason to do so. Learn more about how we process
            your information.
          </p>
          <p>
            <strong>
              In what situations and with which parties do we share personal
              information?
            </strong>{" "}
            We may share information in specific situations and with specific
            third parties, including AI model providers, cloud storage
            providers, email service providers, and infrastructure providers
            necessary to operate our Services. Learn more about when and with
            whom we share your personal information.
          </p>
          <p>
            <strong>How do we keep your information safe?</strong> We have
            adequate organizational and technical processes and procedures in
            place to protect your personal information. However, no electronic
            transmission over the internet or information storage technology can
            be guaranteed to be 100% secure, so we cannot promise or guarantee
            that hackers, cybercriminals, or other unauthorized third parties
            will not be able to defeat our security and improperly collect,
            access, steal, or modify your information. Learn more about how we
            keep your information safe.
          </p>
          <p>
            <strong>What are your rights?</strong> Depending on where you are
            located geographically, the applicable privacy law may mean you have
            certain rights regarding your personal information. Learn more about
            your privacy rights.
          </p>
          <p>
            <strong>How do you exercise your rights?</strong> The easiest way to
            exercise your rights is by contacting us at{" "}
            <a href="mailto:admin@teachanything.ai">admin@teachanything.ai</a>.
            We will consider and act upon any request in accordance with
            applicable data protection laws.
          </p>
          <p>
            Want to learn more about what we do with any information we collect?
            Review the Privacy Notice in full.
          </p>

          <h2>Table of Contents</h2>
          <ol>
            <li>
              <a href="#section-1">What Information Do We Collect?</a>
            </li>
            <li>
              <a href="#section-2">How Do We Process Your Information?</a>
            </li>
            <li>
              <a href="#section-3">
                What Legal Bases Do We Rely On to Process Your Personal
                Information?
              </a>
            </li>
            <li>
              <a href="#section-4">
                When and With Whom Do We Share Your Personal Information?
              </a>
            </li>
            <li>
              <a href="#section-5">
                Do We Offer Artificial Intelligence-Based Products?
              </a>
            </li>
            <li>
              <a href="#section-6">Cookies and Similar Technologies</a>
            </li>
            <li>
              <a href="#section-7">How Long Do We Keep Your Information?</a>
            </li>
            <li>
              <a href="#section-8">How Do We Keep Your Information Safe?</a>
            </li>
            <li>
              <a href="#section-9">Do We Collect Information from Minors?</a>
            </li>
            <li>
              <a href="#section-10">What Are Your Privacy Rights?</a>
            </li>
            <li>
              <a href="#section-11">Controls for Do-Not-Track Features</a>
            </li>
            <li>
              <a href="#section-12">
                Do United States Residents Have Specific Privacy Rights?
              </a>
            </li>
            <li>
              <a href="#section-13">
                Do Other Regions Have Specific Privacy Rights?
              </a>
            </li>
            <li>
              <a href="#section-14">Do We Make Updates to This Notice?</a>
            </li>
            <li>
              <a href="#section-15">
                How Can You Contact Us About This Notice?
              </a>
            </li>
            <li>
              <a href="#section-16">
                How Can You Review, Update, or Delete the Data We Collect from
                You?
              </a>
            </li>
          </ol>

          <h2 id="section-1">1.&emsp;What Information Do We Collect?</h2>

          <h3>Personal Information You Disclose to Us</h3>
          <p>
            <em>
              In Short: We collect personal information that you provide to us.
            </em>
          </p>
          <p>
            We collect personal information that you voluntarily provide to us
            when you register on the Services, express an interest in obtaining
            information about us or our products and Services, when you
            participate in activities on the Services, or otherwise when you
            contact us.
          </p>
          <p>
            <strong>Personal Information Provided by You.</strong> The personal
            information that we collect depends on the context of your
            interactions with us and the Services, the choices you make, and the
            products and features you use. The personal information we collect
            may include the following:
          </p>
          <ul>
            <li>Names</li>
            <li>Email addresses</li>
            <li>Passwords (stored in hashed form only)</li>
            <li>Academic title (e.g., Dr., Professor)</li>
            <li>Institutional affiliation</li>
            <li>Department</li>
            <li>Faculty webpage URL</li>
            <li>Country</li>
          </ul>
          <p>
            <strong>Sensitive Information.</strong> We do not process sensitive
            information.
          </p>
          <p>
            <strong>Content You Provide Through the Services.</strong> When you
            use our AI chatbot features, we collect and process:
          </p>
          <ul>
            <li>Chat messages you send to AI chatbots</li>
            <li>
              Files you upload (such as PDFs, Word documents, PowerPoint
              presentations, and text files), which are processed to enable
              AI-assisted responses
            </li>
            <li>System prompts and chatbot configurations you create</li>
          </ul>
          <p>
            Please note that uploaded files and chat messages are sent to
            third-party AI providers for processing (see Section 4 and Section 5
            for details). You should not upload files containing sensitive
            personal information of third parties (such as student records)
            unless you have appropriate authorization to do so.
          </p>
          <p>
            All personal information that you provide to us must be true,
            complete, and accurate, and you must notify us of any changes to
            such personal information.
          </p>

          <h3>Information Automatically Collected</h3>
          <p>
            <em>
              In Short: Some information -- such as your Internet Protocol (IP)
              address and/or browser and device characteristics -- is collected
              automatically when you visit our Services.
            </em>
          </p>
          <p>
            We automatically collect certain information when you visit, use, or
            navigate the Services. This information does not reveal your
            specific identity (like your name or contact information) but may
            include device and usage information, such as your IP address,
            browser and device characteristics, operating system, language
            preferences, referring URLs, device name, country, information about
            how and when you use our Services, and other technical information.
            This information is primarily needed to maintain the security and
            operation of our Services, and for our internal analytics and
            reporting purposes.
          </p>
          <p>The information we collect includes:</p>
          <ul>
            <li>
              <strong>Log and Usage Data.</strong> We collect IP addresses and
              browser user agent strings when you log in, which are stored as
              part of your session data for security purposes. We also collect
              IP addresses from all visitors (including unauthenticated users of
              shared chatbots) for rate limiting to prevent abuse of our
              Services. These IP addresses are stored temporarily and are not
              linked to user accounts.
            </li>
            <li>
              <strong>Analytics Data.</strong> We use Vercel Analytics, a
              privacy-focused web analytics service, to collect aggregated data
              about page views and website performance. Vercel Analytics does
              not use cookies for tracking and does not collect personally
              identifiable information. We also collect internal analytics about
              chatbot usage, such as message counts, response times, and whether
              file-based context was used.
            </li>
          </ul>

          <h2 id="section-2">2.&emsp;How Do We Process Your Information?</h2>
          <p>
            <em>
              In Short: We process your information to provide, improve, and
              administer our Services, communicate with you, for security and
              fraud prevention, and to comply with law. We process the personal
              information for the following purposes listed below. We may also
              process your information for other purposes only with your prior
              explicit consent.
            </em>
          </p>
          <p>
            We process your personal information for a variety of reasons,
            depending on how you interact with our Services, including:
          </p>
          <ul>
            <li>
              <strong>
                To facilitate account creation and authentication and otherwise
                manage user accounts.
              </strong>{" "}
              We may process your information so you can create and log in to
              your account, as well as keep your account in working order. New
              accounts require administrator approval before access is granted.
            </li>
            <li>
              <strong>
                To deliver and facilitate delivery of services to the user.
              </strong>{" "}
              We may process your information to provide you with the requested
              service, including processing your uploaded files and chat
              messages through AI models to generate responses.
            </li>
            <li>
              <strong>
                To respond to user inquiries/offer support to users.
              </strong>{" "}
              We may process your information to respond to your inquiries and
              solve any potential issues you might have with the requested
              service.
            </li>
            <li>
              <strong>To send administrative information to you.</strong> We may
              process your information to send you details about our products
              and services, changes to our terms and policies, and other similar
              information. This includes account approval notifications,
              rejection notifications, and password reset emails.
            </li>
            <li>
              <strong>To request feedback.</strong> We may process your
              information when necessary to request feedback and to contact you
              about your use of our Services.
            </li>
            <li>
              <strong>To protect our Services.</strong> We may process your
              information as part of our efforts to keep our Services safe and
              secure, including rate limiting, fraud monitoring, and prevention.
            </li>
            <li>
              <strong>To identify usage trends.</strong> We may process
              information about how you use our Services to better understand
              how they are being used so we can improve them.
            </li>
            <li>
              <strong>
                To save or protect an individual&apos;s vital interest.
              </strong>{" "}
              We may process your information when necessary to save or protect
              an individual&apos;s vital interest, such as to prevent harm.
            </li>
          </ul>

          <h2 id="section-3">
            3.&emsp;What Legal Bases Do We Rely On to Process Your Information?
          </h2>
          <p>
            <em>
              In Short: We only process your personal information when we
              believe it is necessary and we have a valid legal reason (i.e.,
              legal basis) to do so under applicable law, like with your
              consent, to comply with laws, to provide you with services to
              enter into or fulfill our contractual obligations, to protect your
              rights, or to fulfill our legitimate business interests.
            </em>
          </p>
          <p>
            <strong>If you are located in the EU or UK,</strong> the General
            Data Protection Regulation (GDPR) and UK GDPR require us to explain
            the valid legal bases we rely on in order to process your personal
            information. We may rely on the following:
          </p>
          <ul>
            <li>
              <strong>Consent.</strong> We may process your information if you
              have given us permission (i.e., consent) to use your personal
              information for a specific purpose. You can withdraw your consent
              at any time. Learn more about withdrawing your consent.
            </li>
            <li>
              <strong>Performance of a Contract.</strong> We may process your
              personal information when we believe it is necessary to fulfill
              our contractual obligations to you, including providing our
              Services or at your request prior to entering into a contract with
              you.
            </li>
            <li>
              <strong>Legitimate Interests.</strong> We may process your
              information when we believe it is reasonably necessary to achieve
              our legitimate business interests and those interests do not
              outweigh your interests and fundamental rights and freedoms. For
              example, we may process your personal information for some of the
              purposes described in order to:
              <ul>
                <li>
                  Analyze how our Services are used so we can improve them to
                  engage and retain users
                </li>
                <li>Diagnose problems and/or prevent fraudulent activities</li>
                <li>
                  Understand how our users use our products and services so we
                  can improve user experience
                </li>
              </ul>
            </li>
            <li>
              <strong>Legal Obligations.</strong> We may process your
              information where we believe it is necessary for compliance with
              our legal obligations, such as to cooperate with a law enforcement
              body or regulatory agency, exercise or defend our legal rights, or
              disclose your information as evidence in litigation in which we
              are involved.
            </li>
            <li>
              <strong>Vital Interests.</strong> We may process your information
              where we believe it is necessary to protect your vital interests
              or the vital interests of a third party, such as situations
              involving potential threats to the safety of any person.
            </li>
          </ul>
          <p>
            <strong>If you are located in Canada,</strong> we may process your
            information if you have given us specific permission (express
            consent) to use your personal information for a specific purpose, or
            in situations where your permission can be inferred (implied
            consent). You can withdraw your consent at any time.
          </p>
          <p>
            In some exceptional cases, we may be legally permitted under
            applicable law to process your information without your consent,
            including, for example:
          </p>
          <ul>
            <li>
              If collection is clearly in the interests of an individual and
              consent cannot be obtained in a timely way
            </li>
            <li>For investigations and fraud detection and prevention</li>
            <li>
              For business transactions provided certain conditions are met
            </li>
            <li>
              If it is contained in a witness statement and the collection is
              necessary to assess, process, or settle an insurance claim
            </li>
            <li>
              For identifying injured, ill, or deceased persons and
              communicating with next of kin
            </li>
            <li>
              If we have reasonable grounds to believe an individual has been,
              is, or may be victim of financial abuse
            </li>
            <li>
              If it is reasonable to expect collection and use with consent
              would compromise the availability or the accuracy of the
              information and the collection is reasonable for purposes related
              to investigating a breach of an agreement or a contravention of
              the laws of Canada or a province
            </li>
            <li>
              If disclosure is required to comply with a subpoena, warrant,
              court order, or rules of the court relating to the production of
              records
            </li>
            <li>
              If it was produced by an individual in the course of their
              employment, business, or profession and the collection is
              consistent with the purposes for which the information was
              produced
            </li>
            <li>
              If the collection is solely for journalistic, artistic, or
              literary purposes
            </li>
            <li>
              If the information is publicly available and is specified by the
              regulations
            </li>
            <li>
              We may disclose de-identified information for approved research or
              statistics projects, subject to ethics oversight and
              confidentiality commitments
            </li>
          </ul>

          <h2 id="section-4">
            4.&emsp;When and With Whom Do We Share Your Personal Information?
          </h2>
          <p>
            <em>
              In Short: We may share information in specific situations
              described in this section and/or with the following third parties.
            </em>
          </p>
          <p>
            We use the following third-party service providers to operate our
            Services. Each provider receives only the data necessary to perform
            its specific function:
          </p>

          <h3>AI Model Providers</h3>
          <ul>
            <li>
              <strong>OpenRouter</strong> (openrouter.ai) -- Routes chat
              messages, conversation history, system prompts, and relevant file
              content excerpts to large language model providers (such as
              Meta/Llama, Mistral, and Qwen) to generate AI responses.
              OpenRouter acts as an intermediary and may relay your data to the
              underlying model provider.
            </li>
            <li>
              <strong>OpenAI</strong> (openai.com) -- Processes text excerpts
              from uploaded files and user chat messages to generate vector
              embeddings used for semantic search (retrieval-augmented
              generation). When you send a message to a chatbot that has
              uploaded files, your message is also sent to OpenAI to find
              relevant document excerpts. Only text content is sent; no personal
              account information is included.
            </li>
            <li>
              <strong>OpenAI (voice input)</strong> -- If you use the microphone
              button to dictate a question, your audio recording is sent to
              OpenAI&rsquo;s Whisper speech-to-text service for transcription.
              The audio is not stored in our application; only the resulting
              text is inserted into the chat input for you to review and send.
              Voice input is optional; the text input always remains available.
            </li>
          </ul>

          <h3>Cloud Storage</h3>
          <ul>
            <li>
              <strong>Supabase</strong> (supabase.com) -- Stores uploaded files
              (PDFs, documents, etc.) in secure cloud storage. Files are
              organized by user account and accessible only to the file owner
              and the platform.
            </li>
          </ul>

          <h3>Email Service</h3>
          <ul>
            <li>
              <strong>Resend</strong> (resend.com) -- Sends transactional emails
              on our behalf, including account approval notifications, rejection
              notifications, password reset emails, and administrative
              communications. Resend receives recipient email addresses, names,
              and email content. Resend also sends us delivery status
              information (e.g., delivered, bounced, failed) via webhooks.
            </li>
          </ul>

          <h3>Infrastructure and Job Processing</h3>
          <ul>
            <li>
              <strong>Upstash</strong> (upstash.com) -- Provides rate limiting
              (via Redis) and asynchronous job processing (via QStash). Rate
              limiting stores temporary identifiers (user IDs, IP addresses, or
              email addresses) to prevent abuse; aggregated rate limit analytics
              are also sent to Upstash. Job processing temporarily stores email
              job payloads (including recipient addresses, names, and email
              content) and file processing job references until delivery is
              complete.
            </li>
            <li>
              <strong>Vercel</strong> (vercel.com) -- Hosts our application and
              provides web analytics. Vercel Analytics collects aggregated,
              non-personally-identifiable data about page views and performance.
              All application traffic passes through Vercel&apos;s
              infrastructure.
            </li>
          </ul>

          <h3>Database</h3>
          <p>
            We use a PostgreSQL database hosted by a third-party cloud provider
            to store all application data, including user accounts, chatbot
            configurations, conversations, and file metadata.
          </p>

          <p>
            We may also need to share your personal information in the following
            situations:
          </p>
          <ul>
            <li>
              <strong>Business Transfers.</strong> We may share or transfer your
              information in connection with, or during negotiations of, any
              merger, sale of company assets, financing, or acquisition of all
              or a portion of our business to another company.
            </li>
          </ul>

          <h2 id="section-5">
            5.&emsp;Do We Offer Artificial Intelligence-Based Products?
          </h2>
          <p>
            <em>
              In Short: We offer products, features, or tools powered by
              artificial intelligence, machine learning, or similar
              technologies.
            </em>
          </p>
          <p>
            As part of our Services, we offer products, features, or tools
            powered by artificial intelligence, machine learning, or similar
            technologies (collectively, &ldquo;AI Products&rdquo;). These tools
            are designed to enhance your experience and provide you with
            innovative solutions. The terms in this Privacy Notice govern your
            use of the AI Products within our Services.
          </p>

          <h3>Our AI Products</h3>
          <p>Our AI Products are designed for the following functions:</p>
          <ul>
            <li>
              <strong>AI chatbot deployment</strong> -- Educators create custom
              AI chatbots powered by open-source large language models. These
              chatbots can be configured with custom system prompts and can use
              uploaded course materials to provide contextually relevant
              responses to users.
            </li>
            <li>
              <strong>Retrieval-Augmented Generation (RAG)</strong> -- When
              files are uploaded, the platform extracts text content, splits it
              into smaller chunks, and generates vector embeddings. When a user
              asks a question, relevant chunks are retrieved and included in the
              AI prompt to provide informed, context-aware responses.
            </li>
          </ul>

          <h3>How We Process Your Data Using AI</h3>
          <p>When you interact with an AI chatbot on our platform:</p>
          <ol>
            <li>
              If the chatbot has uploaded files, your message is first sent to
              OpenAI to generate a vector embedding, which is used to find
              relevant document excerpts in our database.
            </li>
            <li>
              Your message, along with recent conversation history (up to 50
              prior messages) and any relevant file excerpts, is sent to an AI
              model provider via OpenRouter.
            </li>
            <li>
              The AI model provider processes this data and returns a generated
              response, which is then displayed to you.
            </li>
            <li>
              Your messages and the AI&apos;s responses are stored in our
              database as part of your conversation history.
            </li>
          </ol>
          <p>When files are uploaded:</p>
          <ol>
            <li>The file is stored in Supabase cloud storage.</li>
            <li>
              Text is extracted from the file on our servers (no third-party
              processing for extraction).
            </li>
            <li>
              The extracted text is split into chunks, and each chunk is sent to
              OpenAI to generate a vector embedding for semantic search
              purposes.
            </li>
            <li>
              The embeddings are stored in our database for future retrieval.
            </li>
          </ol>
          <p>
            All personal information processed using our AI Products is handled
            in line with this Privacy Notice. We do not use your data to train
            AI models. However, please review the privacy policies of our AI
            providers (OpenRouter and OpenAI) for information about how they
            handle data received through their APIs.
          </p>

          <h2 id="section-6">6.&emsp;Cookies and Similar Technologies</h2>
          <p>
            <em>
              In Short: We use cookies solely for authentication purposes. We do
              not use cookies for advertising or cross-site tracking.
            </em>
          </p>
          <p>Our Services use the following cookies:</p>
          <ul>
            <li>
              <strong>Session Cookie</strong> -- When you log in, a secure,
              HTTP-only session cookie is set to maintain your authenticated
              session. This cookie is required for the Services to function and
              cannot be disabled while using authenticated features. In
              production, this cookie is set with the Secure flag, meaning it is
              only transmitted over HTTPS.
            </li>
          </ul>
          <p>
            We do not use advertising cookies, tracking cookies, or third-party
            cookies for marketing purposes. Vercel Analytics, which we use for
            aggregated website performance data, operates without cookies.
          </p>

          <h2 id="section-7">7.&emsp;How Long Do We Keep Your Information?</h2>
          <p>
            <em>
              In Short: We keep your information for as long as necessary to
              fulfill the purposes outlined in this Privacy Notice unless
              otherwise required by law.
            </em>
          </p>
          <p>
            We will only keep your personal information for as long as it is
            necessary for the purposes set out in this Privacy Notice, unless a
            longer retention period is required or permitted by law (such as
            tax, accounting, or other legal requirements). No purpose in this
            notice will require us keeping your personal information for longer
            than the period of time in which users have an account with us.
          </p>
          <p>
            When we have no ongoing legitimate business need to process your
            personal information, we will either delete or anonymize such
            information, or, if this is not possible (for example, because your
            personal information has been stored in backup archives), then we
            will securely store your personal information and isolate it from
            any further processing until deletion is possible.
          </p>

          <h2 id="section-8">8.&emsp;How Do We Keep Your Information Safe?</h2>
          <p>
            <em>
              In Short: We aim to protect your personal information through a
              system of organizational and technical security measures.
            </em>
          </p>
          <p>
            We have implemented appropriate and reasonable technical and
            organizational security measures designed to protect the security of
            any personal information we process. These measures include:
          </p>
          <ul>
            <li>
              Passwords are hashed using bcrypt with a cost factor of 12 before
              storage; we never store plaintext passwords.
            </li>
            <li>
              Session cookies are marked as Secure and HTTP-only in production.
            </li>
            <li>
              Rate limiting is enforced on login attempts, registration,
              password resets, and API endpoints to prevent brute-force attacks
              and abuse.
            </li>
            <li>All data is transmitted over HTTPS/TLS.</li>
          </ul>
          <p>
            However, despite our safeguards and efforts to secure your
            information, no electronic transmission over the Internet or
            information storage technology can be guaranteed to be 100% secure,
            so we cannot promise or guarantee that hackers, cybercriminals, or
            other unauthorized third parties will not be able to defeat our
            security and improperly collect, access, steal, or modify your
            information. Although we will do our best to protect your personal
            information, transmission of personal information to and from our
            Services is at your own risk. You should only access the Services
            within a secure environment.
          </p>

          <h2 id="section-9">9.&emsp;Do We Collect Information from Minors?</h2>
          <p>
            <em>
              In Short: We do not knowingly collect data from or market to
              children under 18 years of age or the equivalent age as specified
              by law in your jurisdiction.
            </em>
          </p>
          <p>
            We do not knowingly collect, solicit data from, or market to
            children under 18 years of age or the equivalent age as specified by
            law in your jurisdiction, nor do we knowingly sell such personal
            information. By using the Services, you represent that you are at
            least 18 or the equivalent age as specified by law in your
            jurisdiction or that you are the parent or guardian of such a minor
            and consent to such minor dependent&apos;s use of the Services. If
            we learn that personal information from users less than 18 years of
            age or the equivalent age as specified by law in your jurisdiction
            has been collected, we will deactivate the account and take
            reasonable measures to promptly delete such data from our records.
            If you become aware of any data we may have collected from children
            under age 18 or the equivalent age as specified by law in your
            jurisdiction, please contact us at{" "}
            <a href="mailto:admin@teachanything.ai">admin@teachanything.ai</a>.
          </p>

          <h2 id="section-10">10.&emsp;What Are Your Privacy Rights?</h2>
          <p>
            <em>
              In Short: Depending on your state of residence in the US or in
              some regions, such as the European Economic Area (EEA), United
              Kingdom (UK), Switzerland, and Canada, you have rights that allow
              you greater access to and control over your personal information.
              You may review, change, or terminate your account at any time,
              depending on your country, province, or state of residence.
            </em>
          </p>
          <p>
            In some regions (like the EEA, UK, Switzerland, and Canada), you
            have certain rights under applicable data protection laws. These may
            include the right (i) to request access and obtain a copy of your
            personal information, (ii) to request rectification or erasure;
            (iii) to restrict the processing of your personal information; (iv)
            if applicable, to data portability; and (v) not to be subject to
            automated decision-making. If a decision that produces legal or
            similarly significant effects is made solely by automated means, we
            will inform you, explain the main factors, and offer a simple way to
            request human review. In certain circumstances, you may also have
            the right to object to the processing of your personal information.
            You can make such a request by contacting us by using the contact
            details provided in the section &ldquo;HOW CAN YOU CONTACT US ABOUT
            THIS NOTICE?&rdquo; below.
          </p>
          <p>
            We will consider and act upon any request in accordance with
            applicable data protection laws.
          </p>
          <p>
            If you are located in the EEA or UK and you believe we are
            unlawfully processing your personal information, you also have the
            right to complain to your{" "}
            <a
              href="https://ec.europa.eu/justice/data-protection/bodies/authorities/index_en.htm"
              target="_blank"
              rel="noopener noreferrer"
            >
              Member State data protection authority
            </a>{" "}
            or{" "}
            <a
              href="https://ico.org.uk/make-a-complaint/data-protection-complaints/data-protection-complaints/"
              target="_blank"
              rel="noopener noreferrer"
            >
              UK data protection authority
            </a>
            .
          </p>
          <p>
            If you are located in Switzerland, you may contact the{" "}
            <a
              href="https://www.edoeb.admin.ch/edoeb/en/home.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              Federal Data Protection and Information Commissioner
            </a>
            .
          </p>

          <h3>Withdrawing your consent</h3>
          <p>
            If we are relying on your consent to process your personal
            information, which may be express and/or implied consent depending
            on the applicable law, you have the right to withdraw your consent
            at any time. You can withdraw your consent at any time by contacting
            us by using the contact details provided in the section &ldquo;HOW
            CAN YOU CONTACT US ABOUT THIS NOTICE?&rdquo; below.
          </p>
          <p>
            However, please note that this will not affect the lawfulness of the
            processing before its withdrawal nor, when applicable law allows,
            will it affect the processing of your personal information conducted
            in reliance on lawful processing grounds other than consent.
          </p>

          <h3>Account Information</h3>
          <p>
            If you would at any time like to review or change the information in
            your account or terminate your account, you can:
          </p>
          <ul>
            <li>
              Log in to your account settings to update your name, academic
              title, institutional affiliation, department, faculty webpage,
              country, or password.
            </li>
            <li>
              Delete your account from the Settings page in your dashboard, or
              contact us at{" "}
              <a href="mailto:admin@teachanything.ai">admin@teachanything.ai</a>{" "}
              to request account deletion.
            </li>
          </ul>
          <p>
            Upon your request to terminate your account, we will deactivate or
            delete your account and information from our active databases. When
            an account is deleted, all associated data is permanently removed,
            including chatbots, uploaded files, conversation history, and
            analytics data. Transactional email delivery records (containing
            your email address and delivery status) and expired verification
            tokens may be retained for a limited period for compliance and
            troubleshooting purposes. Additionally, server infrastructure logs
            maintained by our hosting provider may transiently contain your
            email address or user identifier subject to the provider&apos;s own
            retention policies. We may also retain some information in our files
            to prevent fraud, troubleshoot problems, assist with any
            investigations, enforce our legal terms and/or comply with
            applicable legal requirements.
          </p>
          <p>
            If you have questions or comments about your privacy rights, you may
            email us at{" "}
            <a href="mailto:admin@teachanything.ai">admin@teachanything.ai</a>.
          </p>

          <h2 id="section-11">11.&emsp;Controls for Do-Not-Track Features</h2>
          <p>
            Most web browsers and some mobile operating systems include a
            Do-Not-Track (&ldquo;DNT&rdquo;) feature or setting you can activate
            to signal your privacy preference not to have data about your online
            browsing activities monitored and collected. At this stage, no
            uniform technology standard for recognizing and implementing DNT
            signals has been finalized. As such, we do not currently respond to
            DNT browser signals or any other mechanism that automatically
            communicates your choice not to be tracked online.
          </p>
          <p>
            California law requires us to let you know how we respond to web
            browser DNT signals. Because there currently is not an industry or
            legal standard for recognizing or honoring DNT signals, we do not
            respond to them at this time.
          </p>

          <h2 id="section-12">
            12.&emsp;Do United States Residents Have Specific Privacy Rights?
          </h2>
          <p>
            <em>
              In Short: If you are a resident of California, Colorado,
              Connecticut, Delaware, Florida, Indiana, Iowa, Kentucky, Maryland,
              Minnesota, Montana, Nebraska, New Hampshire, New Jersey, Oregon,
              Rhode Island, Tennessee, Texas, Utah, or Virginia, you may have
              the right to request access to and receive details about the
              personal information we maintain about you and how we have
              processed it, correct inaccuracies, get a copy of, or delete your
              personal information. You may also have the right to withdraw your
              consent to our processing of your personal information. These
              rights may be limited in some circumstances by applicable law.
              More information is provided below.
            </em>
          </p>

          <h3>Categories of Personal Information We Collect</h3>
          <p>
            The table below shows the categories of personal information we have
            collected in the past twelve (12) months. The table includes
            illustrative examples of each category and does not reflect the
            personal information we collect from you. For a comprehensive
            inventory of all personal information we process, please refer to
            the section &ldquo;WHAT INFORMATION DO WE COLLECT?&rdquo;
          </p>

          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Examples</th>
                  <th>Collected</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>A. Identifiers</td>
                  <td>
                    Contact details, such as real name, alias, postal address,
                    telephone or mobile contact number, unique personal
                    identifier, online identifier, Internet Protocol address,
                    email address, and account name
                  </td>
                  <td>YES</td>
                </tr>
                <tr>
                  <td>
                    B. Personal information as defined in the California
                    Customer Records statute
                  </td>
                  <td>
                    Name, contact information, education, employment, employment
                    history, and financial information
                  </td>
                  <td>YES</td>
                </tr>
                <tr>
                  <td>
                    C. Protected classification characteristics under state or
                    federal law
                  </td>
                  <td>
                    Gender, age, date of birth, race and ethnicity, national
                    origin, marital status, and other demographic data
                  </td>
                  <td>NO</td>
                </tr>
                <tr>
                  <td>D. Commercial information</td>
                  <td>
                    Transaction information, purchase history, financial
                    details, and payment information
                  </td>
                  <td>NO</td>
                </tr>
                <tr>
                  <td>E. Biometric information</td>
                  <td>Fingerprints and voiceprints</td>
                  <td>NO</td>
                </tr>
                <tr>
                  <td>F. Internet or other similar network activity</td>
                  <td>
                    Browsing history, search history, online behavior, interest
                    data, and interactions with our and other websites,
                    applications, systems, and advertisements
                  </td>
                  <td>YES</td>
                </tr>
                <tr>
                  <td>G. Geolocation data</td>
                  <td>Device location</td>
                  <td>NO</td>
                </tr>
                <tr>
                  <td>H. Audio, electronic, sensory, or similar information</td>
                  <td>
                    Images and audio, video or call recordings created in
                    connection with our business activities
                  </td>
                  <td>NO</td>
                </tr>
                <tr>
                  <td>I. Professional or employment-related information</td>
                  <td>
                    Business contact details in order to provide you our
                    Services at a business level or job title, work history, and
                    professional qualifications if you apply for a job with us
                  </td>
                  <td>YES</td>
                </tr>
                <tr>
                  <td>J. Education Information</td>
                  <td>Student records and directory information</td>
                  <td>NO</td>
                </tr>
                <tr>
                  <td>
                    K. Inferences drawn from collected personal information
                  </td>
                  <td>
                    Inferences drawn from any of the collected personal
                    information listed above to create a profile or summary
                    about, for example, an individual&apos;s preferences and
                    characteristics
                  </td>
                  <td>NO</td>
                </tr>
                <tr>
                  <td>L. Sensitive personal Information</td>
                  <td></td>
                  <td>NO</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            <strong>Note on Category F:</strong> We collect limited internet
            activity data through Vercel Analytics (aggregated page views and
            performance metrics), internal chatbot usage analytics (per-message
            character lengths, response times, and whether file-based context
            was used), and session-level data (IP address and browser user agent
            string stored per login). We do not track browsing history across
            other websites.
          </p>
          <p>
            <strong>Note on Category G:</strong> We do not collect precise
            geolocation data or use GPS technologies. We collect country as a
            self-reported profile field during registration. IP addresses, which
            may be used to infer approximate location, are collected
            automatically for security and rate limiting purposes.
          </p>
          <p>
            <strong>Note on Category I:</strong> We collect institutional
            affiliation, department, and academic title as part of the educator
            registration process. This information is used to verify the
            professional status of users.
          </p>
          <p>
            We may also collect other personal information outside of these
            categories through instances where you interact with us in person,
            online, or by phone or mail in the context of:
          </p>
          <ul>
            <li>Receiving help through our customer support channels;</li>
            <li>Participation in customer surveys or contests; and</li>
            <li>
              Facilitation in the delivery of our Services and to respond to
              your inquiries.
            </li>
          </ul>
          <p>
            We will use and retain the collected personal information as needed
            to provide the Services or for:
          </p>
          <ul>
            <li>Category A - As long as the user has an account with us</li>
            <li>Category B - As long as the user has an account with us</li>
            <li>Category F - As long as the user has an account with us</li>
            <li>Category I - As long as the user has an account with us</li>
          </ul>

          <h3>Sources of Personal Information</h3>
          <p>
            Learn more about the sources of personal information we collect in
            &ldquo;WHAT INFORMATION DO WE COLLECT?&rdquo;
          </p>

          <h3>How We Use and Share Personal Information</h3>
          <p>
            Learn more about how we use your personal information in the
            section, &ldquo;HOW DO WE PROCESS YOUR INFORMATION?&rdquo;
          </p>

          <h3>Will your information be shared with anyone else?</h3>
          <p>
            We may disclose your personal information with our service providers
            pursuant to a written contract between us and each service provider.
            Learn more about how we disclose personal information to in the
            section, &ldquo;WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL
            INFORMATION?&rdquo;
          </p>
          <p>
            We may use your personal information for our own business purposes,
            such as for undertaking internal research for technological
            development and demonstration. This is not considered to be
            &ldquo;selling&rdquo; of your personal information.
          </p>
          <p>
            We have disclosed personal information to service providers for
            business purposes as described in Section 4 (e.g., AI model
            providers, email service providers, cloud storage, and
            infrastructure providers). These disclosures are made solely to
            operate our Services and are governed by contracts with each
            provider. We have not sold or shared any personal information to
            third parties for advertising, marketing, or commercial purposes
            unrelated to providing our Services in the preceding twelve (12)
            months. We will not sell or share personal information in the future
            belonging to website visitors, users, and other consumers.
          </p>

          <h3>Your Rights</h3>
          <p>
            You have rights under certain US state data protection laws.
            However, these rights are not absolute, and in certain cases, we may
            decline your request as permitted by law. These rights include:
          </p>
          <ul>
            <li>
              Right to know whether or not we are processing your personal data
            </li>
            <li>Right to access your personal data</li>
            <li>Right to correct inaccuracies in your personal data</li>
            <li>Right to request the deletion of your personal data</li>
            <li>
              Right to obtain a copy of the personal data you previously shared
              with us
            </li>
            <li>Right to non-discrimination for exercising your rights</li>
            <li>
              Right to opt out of the processing of your personal data if it is
              used for targeted advertising (or sharing as defined under
              California&apos;s privacy law), the sale of personal data, or
              profiling in furtherance of decisions that produce legal or
              similarly significant effects (&ldquo;profiling&rdquo;)
            </li>
          </ul>
          <p>
            Depending upon the state where you live, you may also have the
            following rights:
          </p>
          <ul>
            <li>
              Right to access the categories of personal data being processed
              (as permitted by applicable law, including the privacy law in
              Minnesota)
            </li>
            <li>
              Right to obtain a list of the categories of third parties to which
              we have disclosed personal data (as permitted by applicable law,
              including the privacy law in California, Delaware, and Maryland)
            </li>
            <li>
              Right to obtain a list of specific third parties to which we have
              disclosed personal data (as permitted by applicable law, including
              the privacy law in Minnesota and Oregon)
            </li>
            <li>
              Right to obtain a list of third parties to which we have sold
              personal data (as permitted by applicable law, including the
              privacy law in Connecticut)
            </li>
            <li>
              Right to review, understand, question, and depending on where you
              live, correct how personal data has been profiled (as permitted by
              applicable law, including the privacy law in Connecticut and
              Minnesota)
            </li>
            <li>
              Right to limit use and disclosure of sensitive personal data (as
              permitted by applicable law, including the privacy law in
              California)
            </li>
            <li>
              Right to opt out of the collection of sensitive data and personal
              data collected through the operation of a voice or facial
              recognition feature (as permitted by applicable law, including the
              privacy law in Florida)
            </li>
          </ul>

          <h3>How to Exercise Your Rights</h3>
          <p>
            To exercise these rights, you can contact us by emailing us at{" "}
            <a href="mailto:admin@teachanything.ai">admin@teachanything.ai</a>,
            or by referring to the contact details at the bottom of this
            document.
          </p>
          <p>
            Under certain US state data protection laws, you can designate an
            authorized agent to make a request on your behalf. We may deny a
            request from an authorized agent that does not submit proof that
            they have been validly authorized to act on your behalf in
            accordance with applicable laws.
          </p>

          <h3>Request Verification</h3>
          <p>
            Upon receiving your request, we will need to verify your identity to
            determine you are the same person about whom we have the information
            in our system. We will only use personal information provided in
            your request to verify your identity or authority to make the
            request. However, if we cannot verify your identity from the
            information already maintained by us, we may request that you
            provide additional information for the purposes of verifying your
            identity and for security or fraud-prevention purposes.
          </p>
          <p>
            If you submit the request through an authorized agent, we may need
            to collect additional information to verify your identity before
            processing your request and the agent will need to provide a written
            and signed permission from you to submit such request on your
            behalf.
          </p>

          <h3>Appeals</h3>
          <p>
            Under certain US state data protection laws, if we decline to take
            action regarding your request, you may appeal our decision by
            emailing us at{" "}
            <a href="mailto:admin@teachanything.ai">admin@teachanything.ai</a>.
            We will inform you in writing of any action taken or not taken in
            response to the appeal, including a written explanation of the
            reasons for the decisions. If your appeal is denied, you may submit
            a complaint to your state attorney general.
          </p>

          <h3>California &ldquo;Shine The Light&rdquo; Law</h3>
          <p>
            California Civil Code Section 1798.83, also known as the
            &ldquo;Shine The Light&rdquo; law, permits our users who are
            California residents to request and obtain from us, once a year and
            free of charge, information about categories of personal information
            (if any) we disclosed to third parties for direct marketing purposes
            and the names and addresses of all third parties with which we
            shared personal information in the immediately preceding calendar
            year. If you are a California resident and would like to make such a
            request, please submit your request in writing to us by using the
            contact details provided in the section &ldquo;HOW CAN YOU CONTACT
            US ABOUT THIS NOTICE?&rdquo;
          </p>

          <h2 id="section-13">
            13.&emsp;Do Other Regions Have Specific Privacy Rights?
          </h2>
          <p>
            <em>
              In Short: You may have additional rights based on the country you
              reside in.
            </em>
          </p>

          <h3>Australia and New Zealand</h3>
          <p>
            We collect and process your personal information under the
            obligations and conditions set by Australia&apos;s Privacy Act 1988
            and New Zealand&apos;s Privacy Act 2020 (Privacy Act).
          </p>
          <p>
            This Privacy Notice satisfies the notice requirements defined in
            both Privacy Acts, in particular: what personal information we
            collect from you, from which sources, for which purposes, and other
            recipients of your personal information.
          </p>
          <p>
            If you do not wish to provide the personal information necessary to
            fulfill their applicable purpose, it may affect our ability to
            provide our services, in particular:
          </p>
          <ul>
            <li>offer you the products or services that you want</li>
            <li>respond to or help with your requests</li>
            <li>manage your account with us</li>
            <li>confirm your identity and protect your account</li>
          </ul>
          <p>
            At any time, you have the right to request access to or correction
            of your personal information. You can make such a request by
            contacting us by using the contact details provided in the section
            &ldquo;HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT
            FROM YOU?&rdquo;
          </p>
          <p>
            If you believe we are unlawfully processing your personal
            information, you have the right to submit a complaint about a breach
            of the Australian Privacy Principles to the Office of the Australian
            Information Commissioner and a breach of New Zealand&apos;s Privacy
            Principles to the Office of New Zealand Privacy Commissioner.
          </p>

          <h3>Republic of South Africa</h3>
          <p>
            At any time, you have the right to request access to or correction
            of your personal information. You can make such a request by
            contacting us by using the contact details provided in the section
            &ldquo;HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT
            FROM YOU?&rdquo;
          </p>
          <p>
            If you are unsatisfied with the manner in which we address any
            complaint with regard to our processing of personal information, you
            can contact the office of the regulator, the details of which are:
          </p>
          <p>
            The Information Regulator (South Africa)
            <br />
            General enquiries:{" "}
            <a href="mailto:enquiries@inforegulator.org.za">
              enquiries@inforegulator.org.za
            </a>
            <br />
            Complaints (complete POPIA/PAIA form 5):{" "}
            <a href="mailto:PAIAComplaints@inforegulator.org.za">
              PAIAComplaints@inforegulator.org.za
            </a>{" "}
            &amp;{" "}
            <a href="mailto:POPIAComplaints@inforegulator.org.za">
              POPIAComplaints@inforegulator.org.za
            </a>
          </p>

          <h2 id="section-14">14.&emsp;Do We Make Updates to This Notice?</h2>
          <p>
            <em>
              In Short: Yes, we will update this notice as necessary to stay
              compliant with relevant laws.
            </em>
          </p>
          <p>
            We may update this Privacy Notice from time to time. The updated
            version will be indicated by an updated &ldquo;Revised&rdquo; date
            at the top of this Privacy Notice. If we make material changes to
            this Privacy Notice, we may notify you either by prominently posting
            a notice of such changes or by directly sending you a notification.
            We encourage you to review this Privacy Notice frequently to be
            informed of how we are protecting your information.
          </p>

          <h2 id="section-15">
            15.&emsp;How Can You Contact Us About This Notice?
          </h2>
          <p>
            If you have questions or comments about this notice, you may email
            us at{" "}
            <a href="mailto:admin@teachanything.ai">admin@teachanything.ai</a>{" "}
            or contact us by post at:
          </p>
          <address>
            <BrandName />
            <br />
            801 22nd St NW
            <br />
            Phillips Hall Suite 626
            <br />
            Washington, DC 20052
            <br />
            United States
          </address>

          <h2 id="section-16">
            16.&emsp;How Can You Review, Update, or Delete the Data We Collect
            from You?
          </h2>
          <p>
            You can delete your account from your dashboard settings. Further,
            based on the applicable laws of your country or state of residence
            in the US, you may have the right to request access to the personal
            information we collect from you, details about how we have processed
            it, correct inaccuracies, or delete your personal information. To
            make such a request, please use the contact details listed in{" "}
            <a href="#section-15">Section 15</a>. You may also have the right to
            withdraw your consent to our processing of your personal
            information. These rights may be limited in some circumstances by
            applicable law. You can export individual chat conversation
            histories as text or JSON files directly from the chatbot interface.
          </p>
        </article>
      </main>
    </div>
  );
}

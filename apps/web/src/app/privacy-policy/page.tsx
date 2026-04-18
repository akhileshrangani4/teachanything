import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import s from "./legal.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for Teach Anything - learn how we collect, use, and protect your personal information.",
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
            This Privacy Notice for Teach Anything (&ldquo;we,&rdquo;
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
              Use Teach Anything Open-Access AI for Educators. Teach Anything is
              an open-access platform for educators to use open-source large
              language models (LLMs) to design custom AI applications. Educators
              can upload their course files and customize the AI&apos;s behaviors
              in a manner that is beneficial for pedagogical purposes. Educators
              can write and fine-tune system background prompts to accomplish
              this. The AI applications they create are permanently free and open
              access.
            </li>
            <li>
              Engage with us in other related ways, including any marketing or
              events
            </li>
          </ul>
          <p>
            Reading this Privacy Notice will help you understand your privacy
            rights and choices. By using this service, you agree to our Terms of
            Service. Continued use of our services constitutes your acceptance of
            any revisions to these terms. If you do not agree with our policies
            and practices, please do not use our Services. If you still have any
            questions or concerns, please contact us at{" "}
            <a href="mailto:admin@teachanything.ai">admin@teachanything.ai</a>.
          </p>

          <h2>Summary of Key Points</h2>
          <p>
            <strong>What personal information do we process?</strong> When you
            visit, use, or navigate our Services, we may process personal
            information depending on how you interact with us and the Services,
            the choices you make, and the products and features you use.
          </p>
          <p>
            <strong>Do we process any sensitive personal information?</strong> We
            do not process sensitive personal information.
          </p>
          <p>
            <strong>Do we collect any information from third parties?</strong> We
            may receive email delivery status information (such as whether an
            email was delivered or bounced) from our email service provider,
            Resend. We do not otherwise collect personal information from third
            parties.
          </p>
          <p>
            <strong>How do we process your information?</strong> We process your
            information to provide, improve, and administer our Services,
            communicate with you, for security and fraud prevention, and to
            comply with law. We process your information only when we have a
            valid legal reason to do so.
          </p>
          <p>
            <strong>
              In what situations and with which parties do we share personal
              information?
            </strong>{" "}
            We may share information in specific situations and with specific
            third parties, including AI model providers, cloud storage providers,
            email service providers, and infrastructure providers necessary to
            operate our Services.
          </p>
          <p>
            <strong>How do we keep your information safe?</strong> We have
            adequate organizational and technical processes and procedures in
            place to protect your personal information. However, no electronic
            transmission over the internet or information storage technology can
            be guaranteed to be 100% secure.
          </p>
          <p>
            <strong>What are your rights?</strong> Depending on where you are
            located geographically, the applicable privacy law may mean you have
            certain rights regarding your personal information.
          </p>
          <p>
            <strong>How do you exercise your rights?</strong> The easiest way to
            exercise your rights is by contacting us at{" "}
            <a href="mailto:admin@teachanything.ai">admin@teachanything.ai</a>.
          </p>

          <h2>Table of Contents</h2>
          <ol>
            <li><a href="#section-1">What Information Do We Collect?</a></li>
            <li><a href="#section-2">How Do We Process Your Information?</a></li>
            <li><a href="#section-3">What Legal Bases Do We Rely On to Process Your Personal Information?</a></li>
            <li><a href="#section-4">When and With Whom Do We Share Your Personal Information?</a></li>
            <li><a href="#section-5">Do We Offer Artificial Intelligence-Based Products?</a></li>
            <li><a href="#section-6">Cookies and Similar Technologies</a></li>
            <li><a href="#section-7">How Long Do We Keep Your Information?</a></li>
            <li><a href="#section-8">How Do We Keep Your Information Safe?</a></li>
            <li><a href="#section-9">Do We Collect Information from Minors?</a></li>
            <li><a href="#section-10">What Are Your Privacy Rights?</a></li>
            <li><a href="#section-11">Controls for Do-Not-Track Features</a></li>
            <li><a href="#section-12">Do United States Residents Have Specific Privacy Rights?</a></li>
            <li><a href="#section-13">Do Other Regions Have Specific Privacy Rights?</a></li>
            <li><a href="#section-14">Do We Make Updates to This Notice?</a></li>
            <li><a href="#section-15">How Can You Contact Us About This Notice?</a></li>
            <li><a href="#section-16">How Can You Review, Update, or Delete the Data We Collect from You?</a></li>
          </ol>

          <h2 id="section-1">1.&emsp;What Information Do We Collect?</h2>

          <h3>Personal Information You Disclose to Us</h3>
          <p><em>In Short: We collect personal information that you provide to us.</em></p>
          <p>
            We collect personal information that you voluntarily provide to us
            when you register on the Services, express an interest in obtaining
            information about us or our products and Services, when you
            participate in activities on the Services, or otherwise when you
            contact us.
          </p>
          <p>
            <strong>Personal Information Provided by You.</strong> The personal
            information we collect may include the following:
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
          <p><strong>Sensitive Information.</strong> We do not process sensitive information.</p>
          <p>
            <strong>Content You Provide Through the Services.</strong> When you
            use our AI chatbot features, we collect and process:
          </p>
          <ul>
            <li>Chat messages you send to AI chatbots</li>
            <li>Files you upload (such as PDFs, Word documents, PowerPoint presentations, and text files), which are processed to enable AI-assisted responses</li>
            <li>System prompts and chatbot configurations you create</li>
          </ul>
          <p>
            Please note that uploaded files and chat messages are sent to
            third-party AI providers for processing (see Section 4 and Section 5
            for details). You should not upload files containing sensitive
            personal information of third parties (such as student records)
            unless you have appropriate authorization to do so.
          </p>

          <h3>Information Automatically Collected</h3>
          <p><em>In Short: Some information -- such as your Internet Protocol (IP) address and/or browser and device characteristics -- is collected automatically when you visit our Services.</em></p>
          <p>
            We automatically collect certain information when you visit, use, or
            navigate the Services. This information does not reveal your specific
            identity (like your name or contact information) but may include
            device and usage information, such as your IP address, browser and
            device characteristics, operating system, language preferences,
            referring URLs, device name, country, information about how and when
            you use our Services, and other technical information.
          </p>
          <p>The information we collect includes:</p>
          <ul>
            <li>
              <strong>Log and Usage Data.</strong> We collect IP addresses and
              browser user agent strings when you log in, which are stored as
              part of your session data for security purposes. We also collect IP
              addresses from all visitors (including unauthenticated users of
              shared chatbots) for rate limiting to prevent abuse of our
              Services. These IP addresses are stored temporarily and are not
              linked to user accounts.
            </li>
            <li>
              <strong>Analytics Data.</strong> We use Vercel Analytics, a
              privacy-focused web analytics service, to collect aggregated data
              about page views and website performance. Vercel Analytics does not
              use cookies for tracking and does not collect personally
              identifiable information. We also collect internal analytics about
              chatbot usage, such as message counts, response times, and whether
              file-based context was used.
            </li>
          </ul>

          <h2 id="section-2">2.&emsp;How Do We Process Your Information?</h2>
          <p><em>In Short: We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law.</em></p>
          <p>We process your personal information for a variety of reasons, depending on how you interact with our Services, including:</p>
          <ul>
            <li><strong>To facilitate account creation and authentication and otherwise manage user accounts.</strong> We may process your information so you can create and log in to your account, as well as keep your account in working order. New accounts require administrator approval before access is granted.</li>
            <li><strong>To deliver and facilitate delivery of services to the user.</strong> We may process your information to provide you with the requested service, including processing your uploaded files and chat messages through AI models to generate responses.</li>
            <li><strong>To respond to user inquiries/offer support to users.</strong> We may process your information to respond to your inquiries and solve any potential issues you might have with the requested service.</li>
            <li><strong>To send administrative information to you.</strong> We may process your information to send you details about our products and services, changes to our terms and policies, and other similar information. This includes account approval notifications, rejection notifications, and password reset emails.</li>
            <li><strong>To request feedback.</strong> We may process your information when necessary to request feedback and to contact you about your use of our Services.</li>
            <li><strong>To protect our Services.</strong> We may process your information as part of our efforts to keep our Services safe and secure, including rate limiting, fraud monitoring, and prevention.</li>
            <li><strong>To identify usage trends.</strong> We may process information about how you use our Services to better understand how they are being used so we can improve them.</li>
            <li><strong>To save or protect an individual&apos;s vital interest.</strong> We may process your information when necessary to save or protect an individual&apos;s vital interest, such as to prevent harm.</li>
          </ul>

          <h2 id="section-3">3.&emsp;What Legal Bases Do We Rely On to Process Your Information?</h2>
          <p><em>In Short: We only process your personal information when we believe it is necessary and we have a valid legal reason to do so under applicable law.</em></p>
          <p><strong>If you are located in the EU or UK,</strong> the General Data Protection Regulation (GDPR) and UK GDPR require us to explain the valid legal bases we rely on in order to process your personal information. We may rely on the following:</p>
          <ul>
            <li><strong>Consent.</strong> We may process your information if you have given us permission to use your personal information for a specific purpose. You can withdraw your consent at any time.</li>
            <li><strong>Performance of a Contract.</strong> We may process your personal information when we believe it is necessary to fulfill our contractual obligations to you, including providing our Services.</li>
            <li><strong>Legitimate Interests.</strong> We may process your information when we believe it is reasonably necessary to achieve our legitimate business interests and those interests do not outweigh your interests and fundamental rights and freedoms.</li>
            <li><strong>Legal Obligations.</strong> We may process your information where we believe it is necessary for compliance with our legal obligations.</li>
            <li><strong>Vital Interests.</strong> We may process your information where we believe it is necessary to protect your vital interests or the vital interests of a third party.</li>
          </ul>
          <p><strong>If you are located in Canada,</strong> we may process your information if you have given us specific permission (express consent) to use your personal information for a specific purpose, or in situations where your permission can be inferred (implied consent). You can withdraw your consent at any time.</p>

          <h2 id="section-4">4.&emsp;When and With Whom Do We Share Your Personal Information?</h2>
          <p><em>In Short: We may share information in specific situations described in this section and/or with the following third parties.</em></p>
          <p>We use the following third-party service providers to operate our Services. Each provider receives only the data necessary to perform its specific function:</p>

          <h3>AI Model Providers</h3>
          <ul>
            <li><strong>OpenRouter</strong> (openrouter.ai) -- Routes chat messages, conversation history, system prompts, and relevant file content excerpts to large language model providers (such as Meta/Llama, Mistral, and Qwen) to generate AI responses. OpenRouter acts as an intermediary and may relay your data to the underlying model provider.</li>
            <li><strong>OpenAI</strong> (openai.com) -- Processes text excerpts from uploaded files and user chat messages to generate vector embeddings used for semantic search (retrieval-augmented generation). When you send a message to a chatbot that has uploaded files, your message is also sent to OpenAI to find relevant document excerpts. Only text content is sent; no personal account information is included.</li>
          </ul>

          <h3>Cloud Storage</h3>
          <ul>
            <li><strong>Supabase</strong> (supabase.com) -- Stores uploaded files (PDFs, documents, etc.) in secure cloud storage. Files are organized by user account and accessible only to the file owner and the platform.</li>
          </ul>

          <h3>Email Service</h3>
          <ul>
            <li><strong>Resend</strong> (resend.com) -- Sends transactional emails on our behalf, including account approval notifications, rejection notifications, password reset emails, and administrative communications. Resend receives recipient email addresses, names, and email content. Resend also sends us delivery status information (e.g., delivered, bounced, failed) via webhooks.</li>
          </ul>

          <h3>Infrastructure and Job Processing</h3>
          <ul>
            <li><strong>Upstash</strong> (upstash.com) -- Provides rate limiting (via Redis) and asynchronous job processing (via QStash). Rate limiting stores temporary identifiers (user IDs, IP addresses, or email addresses) to prevent abuse; aggregated rate limit analytics are also sent to Upstash. Job processing temporarily stores email job payloads (including recipient addresses, names, and email content) and file processing job references until delivery is complete.</li>
            <li><strong>Vercel</strong> (vercel.com) -- Hosts our application and provides web analytics. Vercel Analytics collects aggregated, non-personally-identifiable data about page views and performance. All application traffic passes through Vercel&apos;s infrastructure.</li>
          </ul>

          <h3>Database</h3>
          <p>We use a PostgreSQL database hosted by a third-party cloud provider to store all application data, including user accounts, chatbot configurations, conversations, and file metadata.</p>

          <p>We may also need to share your personal information in the following situations:</p>
          <ul>
            <li><strong>Business Transfers.</strong> We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.</li>
          </ul>

          <h2 id="section-5">5.&emsp;Do We Offer Artificial Intelligence-Based Products?</h2>
          <p><em>In Short: We offer products, features, or tools powered by artificial intelligence, machine learning, or similar technologies.</em></p>
          <p>As part of our Services, we offer products, features, or tools powered by artificial intelligence, machine learning, or similar technologies (collectively, &ldquo;AI Products&rdquo;). These tools are designed to enhance your experience and provide you with innovative solutions.</p>

          <h3>Our AI Products</h3>
          <ul>
            <li><strong>AI chatbot deployment</strong> -- Educators create custom AI chatbots powered by open-source large language models. These chatbots can be configured with custom system prompts and can use uploaded course materials to provide contextually relevant responses to users.</li>
            <li><strong>Retrieval-Augmented Generation (RAG)</strong> -- When files are uploaded, the platform extracts text content, splits it into smaller chunks, and generates vector embeddings. When a user asks a question, relevant chunks are retrieved and included in the AI prompt to provide informed, context-aware responses.</li>
          </ul>

          <h3>How We Process Your Data Using AI</h3>
          <p>When you interact with an AI chatbot on our platform:</p>
          <ol>
            <li>If the chatbot has uploaded files, your message is first sent to OpenAI to generate a vector embedding, which is used to find relevant document excerpts in our database.</li>
            <li>Your message, along with recent conversation history (up to 50 prior messages) and any relevant file excerpts, is sent to an AI model provider via OpenRouter.</li>
            <li>The AI model provider processes this data and returns a generated response, which is then displayed to you.</li>
            <li>Your messages and the AI&apos;s responses are stored in our database as part of your conversation history.</li>
          </ol>
          <p>When files are uploaded:</p>
          <ol>
            <li>The file is stored in Supabase cloud storage.</li>
            <li>Text is extracted from the file on our servers (no third-party processing for extraction).</li>
            <li>The extracted text is split into chunks, and each chunk is sent to OpenAI to generate a vector embedding for semantic search purposes.</li>
            <li>The embeddings are stored in our database for future retrieval.</li>
          </ol>
          <p>All personal information processed using our AI Products is handled in line with this Privacy Notice. We do not use your data to train AI models. However, please review the privacy policies of our AI providers (OpenRouter and OpenAI) for information about how they handle data received through their APIs.</p>

          <h2 id="section-6">6.&emsp;Cookies and Similar Technologies</h2>
          <p><em>In Short: We use cookies solely for authentication purposes. We do not use cookies for advertising or cross-site tracking.</em></p>
          <p>Our Services use the following cookies:</p>
          <ul>
            <li><strong>Session Cookie</strong> -- When you log in, a secure, HTTP-only session cookie is set to maintain your authenticated session. This cookie is required for the Services to function and cannot be disabled while using authenticated features. In production, this cookie is set with the Secure flag, meaning it is only transmitted over HTTPS.</li>
          </ul>
          <p>We do not use advertising cookies, tracking cookies, or third-party cookies for marketing purposes. Vercel Analytics, which we use for aggregated website performance data, operates without cookies.</p>

          <h2 id="section-7">7.&emsp;How Long Do We Keep Your Information?</h2>
          <p><em>In Short: We keep your information for as long as necessary to fulfill the purposes outlined in this Privacy Notice unless otherwise required by law.</em></p>
          <p>We will only keep your personal information for as long as it is necessary for the purposes set out in this Privacy Notice, unless a longer retention period is required or permitted by law (such as tax, accounting, or other legal requirements). No purpose in this notice will require us keeping your personal information for longer than the period of time in which users have an account with us.</p>
          <p>When we have no ongoing legitimate business need to process your personal information, we will either delete or anonymize such information, or, if this is not possible (for example, because your personal information has been stored in backup archives), then we will securely store your personal information and isolate it from any further processing until deletion is possible.</p>

          <h2 id="section-8">8.&emsp;How Do We Keep Your Information Safe?</h2>
          <p><em>In Short: We aim to protect your personal information through a system of organizational and technical security measures.</em></p>
          <p>We have implemented appropriate and reasonable technical and organizational security measures designed to protect the security of any personal information we process. These measures include:</p>
          <ul>
            <li>Passwords are hashed using bcrypt with a cost factor of 12 before storage; we never store plaintext passwords.</li>
            <li>Session cookies are marked as Secure and HTTP-only in production.</li>
            <li>Rate limiting is enforced on login attempts, registration, password resets, and API endpoints to prevent brute-force attacks and abuse.</li>
            <li>All data is transmitted over HTTPS/TLS.</li>
          </ul>
          <p>However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information. Although we will do our best to protect your personal information, transmission of personal information to and from our Services is at your own risk. You should only access the Services within a secure environment.</p>

          <h2 id="section-9">9.&emsp;Do We Collect Information from Minors?</h2>
          <p><em>In Short: We do not knowingly collect data from or market to children under 18 years of age.</em></p>
          <p>We do not knowingly collect, solicit data from, or market to children under 18 years of age, nor do we knowingly sell such personal information. By using the Services, you represent that you are at least 18 or that you are the parent or guardian of such a minor and consent to such minor dependent&apos;s use of the Services. If we learn that personal information from users less than 18 years of age has been collected, we will deactivate the account and take reasonable measures to promptly delete such data from our records. If you become aware of any data we may have collected from children under age 18, please contact us at <a href="mailto:admin@teachanything.ai">admin@teachanything.ai</a>.</p>

          <h2 id="section-10">10.&emsp;What Are Your Privacy Rights?</h2>
          <p><em>In Short: Depending on your state of residence in the US or in some regions, such as the EEA, UK, Switzerland, and Canada, you have rights that allow you greater access to and control over your personal information.</em></p>
          <p>In some regions (like the EEA, UK, Switzerland, and Canada), you have certain rights under applicable data protection laws. These may include the right (i) to request access and obtain a copy of your personal information, (ii) to request rectification or erasure; (iii) to restrict the processing of your personal information; (iv) if applicable, to data portability; and (v) not to be subject to automated decision-making.</p>
          <p>We will consider and act upon any request in accordance with applicable data protection laws.</p>

          <h3>Account Information</h3>
          <p>If you would at any time like to review or change the information in your account or terminate your account, you can:</p>
          <ul>
            <li>Log in to your account settings to update your name, academic title, institutional affiliation, department, faculty webpage, country, or password.</li>
            <li>Delete your account from the Settings page in your dashboard, or contact us at <a href="mailto:admin@teachanything.ai">admin@teachanything.ai</a> to request account deletion.</li>
          </ul>
          <p>Upon your request to terminate your account, we will deactivate or delete your account and information from our active databases. When an account is deleted, all associated data is permanently removed, including chatbots, uploaded files, conversation history, and analytics data. Transactional email delivery records (containing your email address and delivery status) and expired verification tokens may be retained for a limited period for compliance and troubleshooting purposes. Additionally, server infrastructure logs maintained by our hosting provider may transiently contain your email address or user identifier subject to the provider&apos;s own retention policies.</p>
          <p>If you have questions or comments about your privacy rights, you may email us at <a href="mailto:admin@teachanything.ai">admin@teachanything.ai</a>.</p>

          <h2 id="section-11">11.&emsp;Controls for Do-Not-Track Features</h2>
          <p>Most web browsers and some mobile operating systems include a Do-Not-Track (&ldquo;DNT&rdquo;) feature or setting you can activate to signal your privacy preference not to have data about your online browsing activities monitored and collected. At this stage, no uniform technology standard for recognizing and implementing DNT signals has been finalized. As such, we do not currently respond to DNT browser signals or any other mechanism that automatically communicates your choice not to be tracked online.</p>
          <p>California law requires us to let you know how we respond to web browser DNT signals. Because there currently is not an industry or legal standard for recognizing or honoring DNT signals, we do not respond to them at this time.</p>

          <h2 id="section-12">12.&emsp;Do United States Residents Have Specific Privacy Rights?</h2>
          <p><em>In Short: If you are a resident of certain US states, you may have the right to request access to and receive details about the personal information we maintain about you, correct inaccuracies, get a copy of, or delete your personal information.</em></p>

          <h3>Categories of Personal Information We Collect</h3>
          <p>We have collected the following categories of personal information in the past twelve (12) months:</p>

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
                <tr><td>A. Identifiers</td><td>Real name, email address, IP address, online identifier, account name</td><td>YES</td></tr>
                <tr><td>B. California Customer Records</td><td>Name, contact information, education</td><td>YES</td></tr>
                <tr><td>C. Protected classification characteristics</td><td>Gender, age, race and ethnicity, national origin</td><td>NO</td></tr>
                <tr><td>D. Commercial information</td><td>Transaction information, purchase history</td><td>NO</td></tr>
                <tr><td>E. Biometric information</td><td>Fingerprints and voiceprints</td><td>NO</td></tr>
                <tr><td>F. Internet or similar network activity</td><td>Browsing history, online behavior, interactions with our website</td><td>YES</td></tr>
                <tr><td>G. Geolocation data</td><td>Device location</td><td>NO</td></tr>
                <tr><td>H. Audio, electronic, sensory information</td><td>Audio, video, or call recordings</td><td>NO</td></tr>
                <tr><td>I. Professional or employment-related information</td><td>Job title, institutional affiliation, professional qualifications</td><td>YES</td></tr>
                <tr><td>J. Education Information</td><td>Student records and directory information</td><td>NO</td></tr>
                <tr><td>K. Inferences drawn from collected information</td><td>Preferences and characteristics profiles</td><td>NO</td></tr>
                <tr><td>L. Sensitive personal information</td><td></td><td>NO</td></tr>
              </tbody>
            </table>
          </div>

          <p><strong>Note on Category F:</strong> We collect limited internet activity data through Vercel Analytics (aggregated page views and performance metrics), internal chatbot usage analytics (per-message character lengths, response times, and whether file-based context was used), and session-level data (IP address and browser user agent string stored per login). We do not track browsing history across other websites.</p>
          <p><strong>Note on Category G:</strong> We do not collect precise geolocation data or use GPS technologies. We collect country as a self-reported profile field during registration. IP addresses, which may be used to infer approximate location, are collected automatically for security and rate limiting purposes.</p>
          <p><strong>Note on Category I:</strong> We collect institutional affiliation, department, and academic title as part of the educator registration process. This information is used to verify the professional status of users.</p>
          <p>We have disclosed personal information to service providers for business purposes as described in Section 4. These disclosures are made solely to operate our Services and are governed by contracts with each provider. We have not sold or shared any personal information to third parties for advertising, marketing, or commercial purposes unrelated to providing our Services in the preceding twelve (12) months.</p>

          <h2 id="section-13">13.&emsp;Do Other Regions Have Specific Privacy Rights?</h2>
          <p><em>In Short: You may have additional rights based on the country you reside in.</em></p>

          <h3>Australia and New Zealand</h3>
          <p>We collect and process your personal information under the obligations and conditions set by Australia&apos;s Privacy Act 1988 and New Zealand&apos;s Privacy Act 2020.</p>

          <h3>Republic of South Africa</h3>
          <p>At any time, you have the right to request access to or correction of your personal information. If you are unsatisfied with how we address any complaint, you can contact the Information Regulator (South Africa) at <a href="mailto:enquiries@inforegulator.org.za">enquiries@inforegulator.org.za</a>.</p>

          <h2 id="section-14">14.&emsp;Do We Make Updates to This Notice?</h2>
          <p><em>In Short: Yes, we will update this notice as necessary to stay compliant with relevant laws.</em></p>
          <p>We may update this Privacy Notice from time to time. The updated version will be indicated by an updated &ldquo;Revised&rdquo; date at the top of this Privacy Notice. If we make material changes, we may notify you either by prominently posting a notice of such changes or by directly sending you a notification.</p>

          <h2 id="section-15">15.&emsp;How Can You Contact Us About This Notice?</h2>
          <p>If you have questions or comments about this notice, you may email us at <a href="mailto:admin@teachanything.ai">admin@teachanything.ai</a> or contact us by post at:</p>
          <address>
            Teach Anything<br />
            801 22nd St NW<br />
            Phillips Hall Suite 626<br />
            Washington, DC 20052<br />
            United States
          </address>

          <h2 id="section-16">16.&emsp;How Can You Review, Update, or Delete the Data We Collect from You?</h2>
          <p>Based on the applicable laws of your country or state of residence in the US, you may have the right to request access to the personal information we collect from you, details about how we have processed it, correct inaccuracies, or delete your personal information. You can export individual chat conversation histories as text or JSON files directly from the chatbot interface. To request a full review, update, or deletion of your personal information, please contact us at <a href="mailto:admin@teachanything.ai">admin@teachanything.ai</a>.</p>
        </article>
      </main>
    </div>
  );
}

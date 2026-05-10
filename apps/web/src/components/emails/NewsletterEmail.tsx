import * as React from "react";

interface NewsletterEmailProps {
  subject: string;
  body: string;
  supportEmail: string;
}

export function NewsletterEmail({
  subject,
  body,
  supportEmail,
}: NewsletterEmailProps) {
  return (
    <html>
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style={bodyStyle}>
        <table
          role="presentation"
          style={wrapper}
          cellPadding="0"
          cellSpacing="0"
          border={0}
        >
          <tr>
            <td style={cell}>
              {/* {{{contact.first_name|there}}} is a Resend personalization
                  variable replaced per-recipient at send time. */}
              <p style={text}>Hi {"{{{contact.first_name|there}}}"},</p>

              <h1 style={heading}>{subject}</h1>

              {body.split("\n").map((line, i) =>
                line.trim() ? (
                  <p key={i} style={text}>
                    {line}
                  </p>
                ) : (
                  <br key={i} />
                ),
              )}

              <p style={signature}>
                Best regards,
                <br />
                Teach Anything™ Team
              </p>

              <p style={footer}>
                For questions or support, contact us at{" "}
                <a href={`mailto:${supportEmail}`} style={link}>
                  {supportEmail}
                </a>
                .
                <br />
                <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style={unsubscribeLink}>
                  Unsubscribe from this newsletter
                </a>
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  );
}

export default NewsletterEmail;

const bodyStyle = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#333333",
  backgroundColor: "#ffffff",
  margin: 0,
  padding: "20px",
};

const wrapper = {
  maxWidth: "600px",
  margin: "0 auto",
};

const cell = {
  padding: "20px 0",
};

const heading = {
  margin: "0 0 24px",
  color: "#111111",
  fontSize: "24px",
  fontWeight: "600" as const,
  lineHeight: "1.3",
};

const text = {
  margin: "0 0 16px",
  color: "#333333",
  fontSize: "16px",
  lineHeight: "1.6",
};

const link = {
  color: "#0066cc",
  textDecoration: "underline",
};

const signature = {
  margin: "24px 0 0",
  color: "#333333",
  fontSize: "16px",
  lineHeight: "1.6",
};

const footer = {
  margin: "24px 0 0",
  padding: "16px 0 0",
  borderTop: "1px solid #e9ecef",
  color: "#666666",
  fontSize: "12px",
  lineHeight: "1.5",
};

const unsubscribeLink = {
  color: "#666666",
  textDecoration: "underline",
};

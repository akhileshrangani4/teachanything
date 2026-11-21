/**
 * Inline styles shared by every notification email. Email clients ignore
 * stylesheets, so each element carries its own `style`.
 */
export const body = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#333333",
  backgroundColor: "#ffffff",
  margin: 0,
  padding: "20px",
};

export const wrapper = {
  maxWidth: "600px",
  margin: "0 auto",
};

export const cell = {
  padding: "20px 0",
};

export const text = {
  margin: "0 0 16px",
  color: "#333333",
  fontSize: "16px",
  lineHeight: "1.6",
};

export const list = {
  margin: "0 0 16px",
  paddingLeft: "24px",
  color: "#333333",
  fontSize: "16px",
  lineHeight: "1.6",
};

export const link = {
  color: "#0066cc",
  textDecoration: "underline",
};

export const signature = {
  margin: "24px 0 0",
  color: "#333333",
  fontSize: "16px",
  lineHeight: "1.6",
};

export const footer = {
  margin: "24px 0 0",
  padding: "16px 0 0",
  borderTop: "1px solid #e9ecef",
  color: "#666666",
  fontSize: "12px",
  lineHeight: "1.5",
};

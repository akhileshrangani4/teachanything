import * as React from "react";
import { body, cell, wrapper } from "./email-styles";

/**
 * The document shell every notification email shares: a centred,
 * 600px-wide single-cell table, which renders consistently across email
 * clients. Each template supplies the content of the cell.
 */
export function EmailLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style={body}>
        <table
          role="presentation"
          style={wrapper}
          cellPadding="0"
          cellSpacing="0"
          border={0}
        >
          <tr>
            <td style={cell}>{children}</td>
          </tr>
        </table>
      </body>
    </html>
  );
}

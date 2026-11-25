import * as React from "react";
import { REGISTRATION_EMAIL_BODIES } from "@/lib/registration-email-templates";
import { RegistrationEmailBody } from "./registration-email-body";

interface RequestMoreInfoProps {
  userName: string;
  supportEmail: string;
}

/** Asks a pending user for the details needed to approve them. */
export function RequestMoreInfo(props: RequestMoreInfoProps) {
  return (
    <RegistrationEmailBody
      {...props}
      body={REGISTRATION_EMAIL_BODIES.request_more_info}
    />
  );
}

export default RequestMoreInfo;

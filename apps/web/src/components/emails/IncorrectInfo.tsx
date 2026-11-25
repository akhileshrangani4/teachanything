import * as React from "react";
import { REGISTRATION_EMAIL_BODIES } from "@/lib/registration-email-templates";
import { RegistrationEmailBody } from "./registration-email-body";

interface IncorrectInfoProps {
  userName: string;
  supportEmail: string;
}

/** Tells a pending user their details look wrong and asks for corrections. */
export function IncorrectInfo(props: IncorrectInfoProps) {
  return (
    <RegistrationEmailBody
      {...props}
      body={REGISTRATION_EMAIL_BODIES.incorrect_info}
    />
  );
}

export default IncorrectInfo;

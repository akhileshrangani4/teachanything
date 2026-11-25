import {
  REGISTRATION_EMAIL_BODIES,
  type RegistrationEmailTemplateId,
} from "@/lib/registration-email-templates";

interface EmailPreviewProps {
  templateId: RegistrationEmailTemplateId;
  recipientName: string;
  customMessage: string;
}

/**
 * The email body as the user will read it, so an admin knows exactly what a
 * ready-made template says before sending it.
 */
export function EmailPreview({
  templateId,
  recipientName,
  customMessage,
}: EmailPreviewProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Preview</p>
      <div
        className="max-h-64 overflow-y-auto rounded-md border p-3 text-sm flex flex-col gap-3"
        data-testid="registration-email-preview"
      >
        <p>Hi {recipientName},</p>
        <PreviewBody templateId={templateId} customMessage={customMessage} />
        <p>
          Best regards,
          <br />
          Teach Anything® Team
        </p>
      </div>
    </div>
  );
}

function PreviewBody({
  templateId,
  customMessage,
}: {
  templateId: RegistrationEmailTemplateId;
  customMessage: string;
}) {
  if (templateId === "generic_admin_message") {
    return customMessage.trim() ? (
      <p className="whitespace-pre-wrap break-words">{customMessage}</p>
    ) : (
      <p className="italic text-muted-foreground">
        Your message will appear here.
      </p>
    );
  }
  const body = REGISTRATION_EMAIL_BODIES[templateId];
  return (
    <>
      <p>{body.intro}</p>
      <p>{body.request}</p>
      <ul className="list-disc pl-5">
        {body.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>{body.closing}</p>
    </>
  );
}

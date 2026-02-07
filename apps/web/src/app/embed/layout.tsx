import "../globals.css";
import { Providers } from "@/lib/providers";

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html, body, #__next {
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              height: 100% !important;
              overflow: hidden !important;
            }
            .streamdown-content, .streamdown-content * {
              -webkit-user-select: text !important;
              user-select: text !important;
            }
          `,
        }}
      />
      <div className="w-full h-full overflow-hidden flex flex-col">
        <Providers>{children}</Providers>
      </div>
    </>
  );
}

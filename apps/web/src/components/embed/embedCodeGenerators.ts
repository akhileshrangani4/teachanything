const IFRAME_IDS = {
  window: "teachanything-chatbot-iframe",
  button: "teachanything-chatbot-button-iframe",
} as const;

const WIDGET_SCRIPT = `window.addEventListener("message",function(e){var t=document.getElementById("${IFRAME_IDS.window}"),n=document.getElementById("${IFRAME_IDS.button}");"openChat"===e.data&&t&&n&&(t.contentWindow.postMessage("openChat","*"),n.contentWindow.postMessage("openChat","*"),t.style.pointerEvents="auto",t.style.display="block",window.innerWidth<640?(t.style.position="fixed",t.style.width="100%",t.style.height="100%",t.style.top="0",t.style.left="0",t.style.zIndex="9999"):(t.style.position="fixed",t.style.width="55rem",t.style.height="75vh",t.style.bottom="0",t.style.right="0"));"closeChat"===e.data&&t&&n&&(t.style.display="none",t.style.pointerEvents="none",t.contentWindow.postMessage("closeChat","*"),n.contentWindow.postMessage("closeChat","*"))});`;

// The window iframe delegates mic access (`allow="microphone"`) and tags
// its URL with `voice=1` so the embed page knows the snippet is
// voice-capable. Both must travel together: the embed page only shows the
// mic button when the param is present AND the delegation survived (see
// lib/embed-voice.ts). Embeds pasted before voice shipped have neither and
// keep working as text-only chat.
function generateWidgetHTML(baseUrl: string, shareToken: string) {
  const buttonUrl = `${baseUrl}/embed/${shareToken}/button?chatbox=false`;
  const windowUrl = `${baseUrl}/embed/${shareToken}/window?chatbox=false&withExitX=true&voice=1`;

  const buttonStyle =
    "position:fixed;right:0;bottom:0;width:60px;height:60px;border:2px solid #e2e8f0;border-radius:50%;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06);z-index:50;margin-right:1rem;margin-bottom:1rem";
  const windowStyle =
    "position:fixed;right:0;bottom:0;width:55rem;height:75vh;border:2px solid #e2e8f0;border-radius:0.375rem;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06);z-index:50;margin-right:1rem;margin-bottom:6rem;display:none;pointer-events:none;overflow:hidden";

  return `<script>
  ${WIDGET_SCRIPT}
</script>
<iframe
  src="${buttonUrl}"
  style="${buttonStyle}"
  id="${IFRAME_IDS.button}"
  scrolling="no">
</iframe>
<iframe
  src="${windowUrl}"
  style="${windowStyle}"
  id="${IFRAME_IDS.window}"
  allow="microphone;clipboard-read;clipboard-write"
  scrolling="no">
</iframe>`;
}

function generateWidgetReact(baseUrl: string, shareToken: string) {
  const buttonUrl = `${baseUrl}/embed/${shareToken}/button?chatbox=false`;
  const windowUrl = `${baseUrl}/embed/${shareToken}/window?chatbox=false&withExitX=true&voice=1`;

  return `export default function Chatbot() {
  const windowStyle = {
    position: 'fixed',
    right: 0,
    bottom: 0,
    width: '55rem',
    height: '75vh',
    border: '2px solid #e2e8f0',
    borderRadius: '0.375rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    zIndex: 50,
    marginRight: '1rem',
    marginBottom: '6rem',
    display: 'none',
    pointerEvents: 'none',
    overflow: 'hidden'
  };

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: \`${WIDGET_SCRIPT}\` }} />
      <iframe
        src="${buttonUrl}"
        id="${IFRAME_IDS.button}"
        className="fixed bottom-0 right-0 mb-4 mr-4 w-14 h-14 z-50 border-2 border-gray-300 rounded-full shadow-md"
        scrolling="no"
      />
      <iframe
        src="${windowUrl}"
        id="${IFRAME_IDS.window}"
        style={windowStyle}
        allow="microphone; clipboard-read; clipboard-write"
        scrolling="no"
      />
    </>
  );
}`;
}

function generateWindowHTML(baseUrl: string, shareToken: string) {
  const windowUrl = `${baseUrl}/embed/${shareToken}/window?chatbox=false&voice=1`;
  const windowStyle =
    "position:fixed;right:0;bottom:-30px;width:480px;height:80vh;border:2px solid #e2e8f0;border-radius:0.375rem;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06);overflow:hidden";

  return `<iframe
  src="${windowUrl}"
  style="${windowStyle}"
  allow="microphone;clipboard-read;clipboard-write">
</iframe>`;
}

export { generateWidgetHTML, generateWidgetReact, generateWindowHTML };

import { ChatbotService } from "./chatbot.service";

export class EmbedService {
  private chatbotService = new ChatbotService();

  async generateEmbedCode(chatbotId: string, userId: string, options: any) {
    // Verify ownership
    const chatbot = await this.chatbotService.getChatbot(chatbotId, userId);

    if (options.type === "iframe") {
      return this.generateIframeCode(chatbot, options);
    } else {
      return this.generateScriptCode(chatbot, options);
    }
  }

  private generateIframeCode(chatbot: any, options: any) {
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const width = options.width || "400px";
    const height = options.height || "600px";

    return `<!-- Chatbot Widget -->
<iframe
  src="${baseUrl}/embed/chat/${chatbot.id}"
  width="${width}"
  height="${height}"
  frameborder="0"
  style="position: fixed; bottom: 20px; right: 20px; z-index: 9999; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"
></iframe>`;
  }

  private generateScriptCode(chatbot: any, options: any) {
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const apiUrl = process.env.API_URL || "http://localhost:3000";

    return `<!-- Chatbot Widget -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${apiUrl}/api/embed/widget.js';
    script.setAttribute('data-chatbot-id', '${chatbot.id}');
    script.setAttribute('data-base-url', '${baseUrl}');
    script.setAttribute('data-position', '${options.position || "bottom-right"}');
    script.setAttribute('data-theme', '${options.theme || "light"}');
    script.async = true;
    document.head.appendChild(script);
    
    var style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '${apiUrl}/api/embed/widget.css';
    document.head.appendChild(style);
  })();
</script>`;
  }

  getWidgetScript() {
    return `
(function() {
  var chatbotId = document.currentScript.getAttribute('data-chatbot-id');
  var baseUrl = document.currentScript.getAttribute('data-base-url');
  var position = document.currentScript.getAttribute('data-position') || 'bottom-right';
  var theme = document.currentScript.getAttribute('data-theme') || 'light';
  
  // Create chat button
  var button = document.createElement('div');
  button.id = 'chatbot-widget-button';
  button.className = 'chatbot-widget-button ' + position + ' ' + theme;
  button.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-13h4v6h-4zm0 8h4v2h-4z"/></svg>';
  
  // Create iframe container
  var container = document.createElement('div');
  container.id = 'chatbot-widget-container';
  container.className = 'chatbot-widget-container hidden ' + position;
  container.innerHTML = '<iframe src="' + baseUrl + '/embed/chat/' + chatbotId + '" frameborder="0"></iframe>';
  
  // Append to body
  document.body.appendChild(button);
  document.body.appendChild(container);
  
  // Toggle chat
  button.addEventListener('click', function() {
    container.classList.toggle('hidden');
    button.classList.toggle('active');
  });
  
  // Close on escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      container.classList.add('hidden');
      button.classList.remove('active');
    }
  });
})();
    `;
  }

  getWidgetStyles() {
    return `
.chatbot-widget-button {
  position: fixed;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #000;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 9998;
  transition: transform 0.2s;
}

.chatbot-widget-button:hover {
  transform: scale(1.1);
}

.chatbot-widget-button.bottom-right {
  bottom: 20px;
  right: 20px;
}

.chatbot-widget-button.bottom-left {
  bottom: 20px;
  left: 20px;
}

.chatbot-widget-button svg {
  width: 30px;
  height: 30px;
}

.chatbot-widget-container {
  position: fixed;
  width: 400px;
  height: 600px;
  z-index: 9999;
  transition: opacity 0.3s, transform 0.3s;
}

.chatbot-widget-container.hidden {
  opacity: 0;
  transform: scale(0.95);
  pointer-events: none;
}

.chatbot-widget-container.bottom-right {
  bottom: 90px;
  right: 20px;
}

.chatbot-widget-container.bottom-left {
  bottom: 90px;
  left: 20px;
}

.chatbot-widget-container iframe {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}

@media (max-width: 480px) {
  .chatbot-widget-container {
    width: 100%;
    height: 100%;
    bottom: 0 !important;
    right: 0 !important;
    left: 0 !important;
    top: 0 !important;
  }
  
  .chatbot-widget-container iframe {
    border-radius: 0;
  }
}
    `;
  }
}

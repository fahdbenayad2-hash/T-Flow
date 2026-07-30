import { createFileRoute } from '@tanstack/react-router'

function widgetScript(endpoint: string) {
  return `(() => {
  const endpoint = ${JSON.stringify(endpoint)};
  const startedAt = Date.now();
  const forms = document.querySelectorAll('[data-tflow-form]');

  forms.forEach((form) => {
    if (form.dataset.tflowReady === '1') return;
    form.dataset.tflowReady = '1';

    let honeypot = form.querySelector('[name="_tf_website"]');
    if (!honeypot) {
      honeypot = document.createElement('input');
      honeypot.type = 'text';
      honeypot.name = '_tf_website';
      honeypot.tabIndex = -1;
      honeypot.autocomplete = 'off';
      honeypot.setAttribute('aria-hidden', 'true');
      honeypot.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
      form.appendChild(honeypot);
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitButton = form.querySelector('[type="submit"]');
      const message = form.querySelector('[data-tflow-message]');
      const originalText = submitButton ? submitButton.textContent : '';

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = submitButton.dataset.loadingText || 'جاري إرسال الطلب...';
      }
      if (message) message.textContent = '';

      try {
        const payload = Object.fromEntries(new FormData(form).entries());
        payload._tf_started_at = startedAt;
        if (!payload.order_id) {
          payload.order_id = 'LP-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) {
          throw new Error(
            result.error === 'RATE_LIMITED'
              ? 'طلبات كثيرة، حاول بعد دقيقة'
              : 'تعذر إرسال الطلب، حاول مرة أخرى'
          );
        }

        if (message) message.textContent = 'تم تسجيل طلبك بنجاح';
        form.dispatchEvent(new CustomEvent('tflow:success', { detail: result }));
        form.reset();
      } catch (error) {
        if (message) message.textContent = error.message || 'تعذر إرسال الطلب';
        form.dispatchEvent(new CustomEvent('tflow:error', { detail: error }));
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalText;
        }
      }
    });
  });
})();`
}

export const Route = createFileRoute('/api/integrations/widget/$endpointKey')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const endpoint = new URL(
          `/api/integrations/public/${params.endpointKey}`,
          request.url,
        ).toString()
        return new Response(widgetScript(endpoint), {
          headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
            'X-Content-Type-Options': 'nosniff',
          },
        })
      },
    },
  },
})

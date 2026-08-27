document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.cta-form');

  if (!form) return;

  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector('.cta-form__status');
  const originalText = button.textContent;
  const smartTokenInputSelector = '[name="smart-token"]';
  let isSubmitting = false;

  const ensureSmartTokenInput = () => {
    let tokenInput = form.querySelector(smartTokenInputSelector);

    if (!tokenInput) {
      tokenInput = document.createElement('input');
      tokenInput.type = 'hidden';
      tokenInput.name = 'smart-token';
      tokenInput.setAttribute('data-testid', 'smart-token');
      form.appendChild(tokenInput);
    }

    return tokenInput;
  };

  const setStatus = (message, isError = false) => {
    if (!status) return;

    status.textContent = message;
    status.classList.toggle('is-error', isError);
    status.classList.toggle('is-success', !isError);
  };

  const getSmartToken = () => {
    const tokenElement = ensureSmartTokenInput();
    return tokenElement ? String(tokenElement.value || '').trim() : '';
  };

  const clearCaptchaToken = () => {
    const tokenElement = ensureSmartTokenInput();
    if (tokenElement) {
      tokenElement.value = '';
    }
  };

  ensureSmartTokenInput();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const formData = Object.fromEntries(new FormData(form).entries());
    const smartToken = getSmartToken();

    if (!formData.name || !formData.phone || !formData.email || !formData.description) {
      setStatus('Заполните все поля', true);
      return;
    }

    if (!smartToken) {
      setStatus('Подтвердите капчу', true);
      return;
    }

    isSubmitting = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Отправляем...';
    setStatus('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.success === false) {
        throw new Error(result.message || 'Не удалось отправить заявку');
      }

      form.reset();
      clearCaptchaToken();
      setStatus('Заявка отправлена');
    } catch (error) {
      setStatus(error.message || 'Не удалось отправить заявку', true);
    } finally {
      isSubmitting = false;
      button.removeAttribute('aria-busy');
      button.textContent = originalText;
    }
  });
});

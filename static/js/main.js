document.addEventListener('DOMContentLoaded', () => {
  const topbar = document.querySelector('.topbar');
  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.nav');

  if (topbar && navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const isOpen = topbar.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        topbar.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  const dropdown = document.querySelector('.nav__item--dropdown');

  if (dropdown) {
    const dropdownToggle = dropdown.querySelector('.nav__dropdown-toggle');
    const submenuLinks = dropdown.querySelectorAll('a');

    dropdownToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = dropdown.classList.toggle('is-open');
      dropdownToggle.setAttribute('aria-expanded', String(isOpen));
    });

    submenuLinks.forEach((link) => {
      link.addEventListener('click', () => {
        dropdown.classList.remove('is-open');
        dropdownToggle.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', (event) => {
      if (!dropdown.contains(event.target)) {
        dropdown.classList.remove('is-open');
        dropdownToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

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
    const hiddenToken = ensureSmartTokenInput();
    const widgetToken = form.querySelector('.smart-captcha [name="smart-token"]');

    if (widgetToken && widgetToken.value) {
      hiddenToken.value = widgetToken.value;
    }

    return hiddenToken ? String(hiddenToken.value || '').trim() : '';
  };

  const clearCaptchaToken = () => {
    const tokenElement = ensureSmartTokenInput();
    if (tokenElement) {
      tokenElement.value = '';
    }

    const widgetToken = form.querySelector('.smart-captcha [name="smart-token"]');
    if (widgetToken) {
      widgetToken.value = '';
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
        body: JSON.stringify({
          ...formData,
          'smart-token': smartToken,
        }),
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

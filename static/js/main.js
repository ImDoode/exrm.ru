document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.cta-form');

  if (!form) return;

  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector('.cta-form__status');
  const originalText = button.textContent;

  const setStatus = (message, isError = false) => {
    if (!status) return;

    status.textContent = message;
    status.classList.toggle('is-error', isError);
    status.classList.toggle('is-success', !isError);
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = Object.fromEntries(new FormData(form).entries());

    if (!formData.name || !formData.phone || !formData.email || !formData.description) {
      setStatus('Заполните все поля', true);
      return;
    }

    button.disabled = true;
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
      setStatus('Заявка отправлена');
    } catch (error) {
      setStatus(error.message || 'Не удалось отправить заявку', true);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
});

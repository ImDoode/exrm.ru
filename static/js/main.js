document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.cta-form');

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const button = form.querySelector('button');
      const originalText = button.textContent;

      button.textContent = 'Заявка отправлена';
      button.disabled = true;

      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
        form.reset();
      }, 1800);
    });
  }
});

// js/greeting.js
// Fills in the "morning / afternoon / evening" part of the welcome hero
// greeting and re-runs it any time the hero is shown (page load, and
// whenever your auth flow signals a successful sign-in).

(function () {
  function getPartOfDay() {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  function showGreeting() {
    const timeEl = document.getElementById('heroTimeOfDay');
    if (timeEl) timeEl.textContent = getPartOfDay();
  }

  // Runs once the page loads.
  document.addEventListener('DOMContentLoaded', showGreeting);

  // Expose this so your existing auth.js can call it right after a
  // successful login/signup, e.g. at the end of your login-success
  // handler add: window.NimbusGreeting.show();
  // This matters if sign-in doesn't reload the page — DOMContentLoaded
  // alone won't fire again for a single-page auth flow.
  window.NimbusGreeting = { show: showGreeting };
})();

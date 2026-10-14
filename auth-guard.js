(function () {
  const page = decodeURIComponent(location.pathname.split(/[\\/]/).pop());
  if (page !== 'login.html') {
    const hasSession = sessionStorage.getItem('cityvet.local.demoSession');
    document.documentElement.classList.add(hasSession ? 'app-pending' : 'auth-pending');
  }
})();

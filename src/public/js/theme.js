(function () {
	var root = document.documentElement;
	var button = document.getElementById('theme-toggle');
	var label = document.getElementById('theme-toggle-label');

	function setTheme(theme) {
		root.setAttribute('data-theme', theme);
		localStorage.setItem('hotel-theme', theme);
		if (label) {
			label.textContent = theme === 'dark' ? 'Dark' : 'Light';
		}
	}

	if (button) {
		var currentTheme = root.getAttribute('data-theme') || 'light';
		setTheme(currentTheme);
		button.addEventListener('click', function () {
			var nextTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
			setTheme(nextTheme);
		});
	}
})();

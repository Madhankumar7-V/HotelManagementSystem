(function () {
	var toggle = document.getElementById('nav-toggle');
	var nav = document.getElementById('site-nav');
	if (!toggle || !nav) return;

	function closeNav() {
		nav.classList.remove('is-open');
		toggle.setAttribute('aria-expanded', 'false');
		document.body.classList.remove('nav-open');
	}

	toggle.addEventListener('click', function () {
		var open = nav.classList.toggle('is-open');
		toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
		document.body.classList.toggle('nav-open', open);
	});

	nav.querySelectorAll('a').forEach(function (link) {
		link.addEventListener('click', closeNav);
	});

	document.addEventListener('keydown', function (event) {
		if (event.key === 'Escape') closeNav();
	});

	window.addEventListener('resize', function () {
		if (window.innerWidth > 760) closeNav();
	});
})();

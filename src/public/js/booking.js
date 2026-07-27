(function(){
	const room = document.getElementById('room_id');
	const inEl = document.getElementById('check_in');
	const outEl = document.getElementById('check_out');
	const nightsEl = document.getElementById('est_nights');
	const priceEl = document.getElementById('est_price');
	const totalEl = document.getElementById('est_total');
	const qrImage = document.getElementById('upi_qr_image');
	const upiAmount = document.getElementById('upi_amount');
	const upiLink = document.getElementById('upi_link');

	const today = new Date().toISOString().split('T')[0];
	if (inEl) inEl.min = today;
	if (outEl) outEl.min = today;

	function calc() {
		const inDate = new Date(inEl.value);
		const outDate = new Date(outEl.value);
		const price = Number(room?.selectedOptions?.[0]?.dataset?.price || 0);
		let nights = 0;
		if (inEl.value && outEl.value && outDate > inDate) {
			nights = Math.ceil((outDate - inDate) / (1000*60*60*24));
		}
		nightsEl.textContent = nights;
		priceEl.textContent = price.toFixed(0);
		const total = Math.max(nights, 1) * price;
		totalEl.textContent = total.toFixed(0);
		if (upiAmount) upiAmount.textContent = total.toFixed(0);
		if (qrImage) qrImage.src = '/payment/upi-qr?amount=' + encodeURIComponent(total.toFixed(0));
		if (upiLink) upiLink.href = upiLink.dataset.base + encodeURIComponent(total.toFixed(0));
		if (inEl?.value) outEl.min = inEl.value;
	}

	room?.addEventListener('change', calc);
	inEl?.addEventListener('change', calc);
	outEl?.addEventListener('change', calc);
	calc();
})();



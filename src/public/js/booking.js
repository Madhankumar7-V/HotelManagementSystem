(function () {
	const room = document.getElementById('room_id');
	const inEl = document.getElementById('check_in');
	const outEl = document.getElementById('check_out');
	const nightsEl = document.getElementById('est_nights');
	const priceEl = document.getElementById('est_price');
	const totalEl = document.getElementById('est_total');
	const qrImage = document.getElementById('upi_qr_image');
	const upiAmount = document.getElementById('upi_amount');
	const upiLink = document.getElementById('upi_link');

	const previewImage = document.getElementById('room_preview_image');
	const previewBadge = document.getElementById('room_preview_badge');
	const previewTitle = document.getElementById('room_preview_title');
	const previewDesc = document.getElementById('room_preview_desc');
	const previewCapacity = document.getElementById('room_preview_capacity');
	const previewPrice = document.getElementById('room_preview_price');

	const today = new Date().toISOString().split('T')[0];
	if (inEl) inEl.min = today;
	if (outEl) outEl.min = today;

	function updateRoomPreview() {
		const option = room?.selectedOptions?.[0];
		if (!option || !option.value) return;

		if (previewImage) previewImage.src = option.dataset.image || previewImage.src;
		if (previewBadge) previewBadge.textContent = 'Room ' + (option.dataset.number || '—');
		if (previewTitle) previewTitle.textContent = option.dataset.type || 'Selected room';
		if (previewDesc) previewDesc.textContent = option.dataset.description || '';
		if (previewCapacity) previewCapacity.textContent = option.dataset.capacity || '0';
		if (previewPrice) previewPrice.textContent = option.dataset.price || '0';
	}

	function calc() {
		const inDate = new Date(inEl.value);
		const outDate = new Date(outEl.value);
		const price = Number(room?.selectedOptions?.[0]?.dataset?.price || 0);
		let nights = 0;
		if (inEl.value && outEl.value && outDate > inDate) {
			nights = Math.ceil((outDate - inDate) / (1000 * 60 * 60 * 24));
		}
		if (nightsEl) nightsEl.textContent = nights;
		if (priceEl) priceEl.textContent = price.toFixed(0);
		const total = Math.max(nights, 1) * price;
		if (totalEl) totalEl.textContent = total.toFixed(0);
		if (upiAmount) upiAmount.textContent = total.toFixed(0);
		if (qrImage) qrImage.src = '/payment/upi-qr?amount=' + encodeURIComponent(total.toFixed(0));
		if (upiLink) upiLink.href = upiLink.dataset.base + encodeURIComponent(total.toFixed(0));
		if (inEl?.value && outEl) outEl.min = inEl.value;
		updateRoomPreview();
	}

	room?.addEventListener('change', calc);
	inEl?.addEventListener('change', calc);
	outEl?.addEventListener('change', calc);
	calc();
})();

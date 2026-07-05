(function(){
	const room = document.getElementById('room_id');
	const inEl = document.getElementById('check_in');
	const outEl = document.getElementById('check_out');
	const nightsEl = document.getElementById('est_nights');
	const priceEl = document.getElementById('est_price');
	const totalEl = document.getElementById('est_total');

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
		totalEl.textContent = (nights * price).toFixed(0);
	}

	room?.addEventListener('change', calc);
	inEl?.addEventListener('change', calc);
	outEl?.addEventListener('change', calc);
	calc();
})();



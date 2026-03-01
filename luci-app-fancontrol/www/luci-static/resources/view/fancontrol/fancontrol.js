'use strict';
'require view';
'require rpc';
'require ui';
'require poll';

var callGetConfig  = rpc.declare({ object: 'luci.fancontrol', method: 'get_config',  expect: {} });
var callGetStatus  = rpc.declare({ object: 'luci.fancontrol', method: 'get_status',  expect: {} });

function callSetConfig(cfg) {
	var sid = rpc.getSessionID();
	return fetch('/ubus/', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify([{
			jsonrpc: '2.0', id: 1, method: 'call',
			params: [ sid, 'luci.fancontrol', 'set_config', cfg ]
		}])
	}).then(function(r) { return r.json(); }).then(function(r) {
		if (r && r[0] && r[0].result && r[0].result[0] === 0) return r[0].result[1];
		throw new Error('ubus call failed');
	});
}

function fanLabel(pwm) {
	if (pwm == null || pwm === '' || pwm === 'N/A') return 'Unknown';
	var v = parseInt(pwm);
	if (isNaN(v)) return 'Unknown';
	if (v === 0)  return 'Off';
	if (v <= 63)  return 'Low';
	if (v <= 127) return 'Half speed';
	if (v <= 191) return 'High';
	return 'Full speed';
}

function updateStatusUI(status) {
	var running = status.running === true || status.running === 'true';
	var temp = status.temp_c || 'N/A';
	var pwm  = status.pwm   || 'N/A';
	var dot   = document.getElementById('fc-svc-dot');
	var svc   = document.getElementById('fc-svc-val');
	var tmpEl = document.getElementById('fc-temp-val');
	var fanEl = document.getElementById('fc-fan-val');
	var pwmEl = document.getElementById('fc-pwm-val');
	if (dot)   dot.style.color   = running ? '#5cb85c' : '#d9534f';
	if (svc)   svc.textContent   = running ? 'Running' : 'Stopped';
	if (tmpEl) tmpEl.textContent = temp !== 'N/A' ? temp + ' \u00b0C' : 'N/A';
	if (fanEl) fanEl.textContent = fanLabel(pwm);
	if (pwmEl) pwmEl.textContent = String(pwm);
}

function getVal(id) { return document.getElementById('fc-' + id).value.trim(); }

function numInput(id, val, min, max) {
	return E('input', {
		id: 'fc-' + id, type: 'number', value: String(val),
		min: String(min), max: String(max),
		class: 'form-control',
		style: 'width:80px;text-align:center;display:inline-block'
	});
}

function textInput(id, val) {
	return E('input', {
		id: 'fc-' + id, type: 'text', value: String(val),
		class: 'form-control',
		style: 'width:280px;font-family:monospace;font-size:12px;display:inline-block'
	});
}

function row(label, desc, input) {
	return E('div', { class: 'list-group-item', style: 'display:flex;align-items:center' }, [
		E('div', { style: 'flex:1' }, [
			E('span', { style: 'font-size:13px' }, label),
			E('div', { class: 'text-muted', style: 'font-size:11px;margin-top:2px' }, desc)
		]),
		input
	]);
}

function card(children) {
	return E('div', { class: 'list-group', style: 'margin-bottom:20px' }, children);
}

function doSave() {
	var TEMP_OFF  = getVal('TEMP_OFF');
	var TEMP_HALF = getVal('TEMP_HALF');
	var TEMP_FULL = getVal('TEMP_FULL');

	var iOFF = parseInt(TEMP_OFF), iHALF = parseInt(TEMP_HALF), iFULL = parseInt(TEMP_FULL);
	if (isNaN(iOFF) || isNaN(iHALF) || isNaN(iFULL) || iOFF >= iHALF || iHALF >= iFULL) {
		ui.addNotification(null, E('p', {}, 'Thresholds must be in order: Off < Half Speed < Full Speed'), 'error');
		return;
	}

	var THERMAL = getVal('THERMAL');
	var PWM     = getVal('PWM');
	if (!THERMAL.startsWith('/') || THERMAL.includes('\n')) {
		ui.addNotification(null, E('p', {}, 'Thermal zone path must be an absolute path'), 'error');
		return;
	}
	if (!PWM.startsWith('/') || PWM.includes('\n')) {
		ui.addNotification(null, E('p', {}, 'PWM device path must be an absolute path'), 'error');
		return;
	}

	var btn = document.getElementById('fc-save-btn');
	if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }

	callSetConfig({
		THERMAL:   THERMAL,
		PWM:       PWM,
		TEMP_OFF:  TEMP_OFF,
		TEMP_HALF: TEMP_HALF,
		TEMP_FULL: TEMP_FULL,
		HYST:      getVal('HYST'),
		POLL:      getVal('POLL')
	}).then(function() {
		ui.addNotification(null, E('p', {}, 'Configuration saved and service restarted.'), 'success');
		return callGetStatus();
	}).then(updateStatusUI).catch(function(err) {
		ui.addNotification(null, E('p', {}, 'Error: ' + (err.message || err)), 'error');
	}).then(function() {
		if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
	});
}

return view.extend({
	load: function() {
		return Promise.all([ callGetConfig(), callGetStatus() ]);
	},

	render: function(data) {
		var cfg    = data[0] || {};
		var status = data[1] || {};

		var TEMP_OFF  = cfg.TEMP_OFF  || '58';
		var TEMP_HALF = cfg.TEMP_HALF || '73';
		var TEMP_FULL = cfg.TEMP_FULL || '77';
		var HYST      = cfg.HYST      || '2';
		var POLL      = cfg.POLL      || '10';
		var THERMAL   = cfg.THERMAL   || '/sys/class/thermal/thermal_zone0/temp';
		var PWM       = cfg.PWM       || '/sys/class/hwmon/hwmon2/pwm1';

		var running = status.running === true || status.running === 'true';
		var temp    = status.temp_c || 'N/A';
		var pwm     = status.pwm   || 'N/A';

		poll.add(function() { return callGetStatus().then(updateStatusUI); }, 10);

		// Hide LuCI's footer - we provide our own Save button
		requestAnimationFrame(function() {
			var footer = document.querySelector('.cbi-page-actions');
			if (footer) footer.style.display = 'none';
		});

		var advancedVisible = false;
		var advancedCard = E('div', { style: 'display:none' }, [
			card([
				row('Poll Interval (seconds)', 'How often the daemon rechecks config',   numInput('POLL',    POLL,    1, 60)),
				row('Thermal Zone Path',       'sysfs path to temperature sensor',        textInput('THERMAL', THERMAL)),
				row('PWM Device Path',         'sysfs path to fan PWM control',           textInput('PWM',     PWM))
			])
		]);

		var advancedToggle = E('button', {
			type: 'button',
			class: 'btn btn-link',
			style: 'padding-left:0;font-size:13px;margin-bottom:12px',
			click: function() {
				advancedVisible = !advancedVisible;
				advancedCard.style.display = advancedVisible ? 'block' : 'none';
				this.textContent = (advancedVisible ? '\u25bc' : '\u25ba') + ' Advanced';
			}
		}, '\u25ba Advanced');

		return E('div', { style: 'max-width:660px' }, [
			// Status card
			E('div', { class: 'panel panel-default', style: 'margin-bottom:24px' }, [
				E('table', { class: 'table table-condensed', style: 'margin-bottom:0;font-family:monospace;font-size:13px' }, [
					E('tbody', {}, [
						E('tr', {}, [
							E('td', { class: 'text-muted' }, 'Service'),
							E('td', { style: 'text-align:right' }, [
								E('span', { id: 'fc-svc-dot', style: 'color:' + (running ? '#5cb85c' : '#d9534f') }, '\u25cf '),
								E('span', { id: 'fc-svc-val', style: 'font-weight:bold' }, running ? 'Running' : 'Stopped')
							])
						]),
						E('tr', {}, [
							E('td', { class: 'text-muted' }, 'Temperature'),
							E('td', { id: 'fc-temp-val', style: 'text-align:right;font-weight:bold' },
								temp !== 'N/A' ? temp + ' \u00b0C' : 'N/A')
						]),
						E('tr', {}, [
							E('td', { class: 'text-muted' }, 'Fan'),
							E('td', { id: 'fc-fan-val', style: 'text-align:right;font-weight:bold' }, fanLabel(pwm))
						]),
						E('tr', {}, [
							E('td', { class: 'text-muted' }, 'PWM value'),
							E('td', { id: 'fc-pwm-val', style: 'text-align:right;font-weight:bold' }, String(pwm))
						])
					])
				])
			]),

			// Thresholds
			E('h3', { style: 'margin:0 0 10px;font-size:15px' }, 'Temperature Thresholds'),
			card([
				row('Fan Off Below (\u00b0C)',    'Fan is fully off below this temperature',           numInput('TEMP_OFF',  TEMP_OFF,  0, 120)),
				row('Half Speed Below (\u00b0C)', 'Upper boundary for graduated speed range',          numInput('TEMP_HALF', TEMP_HALF, 0, 120)),
				row('Full Speed Above (\u00b0C)', 'Fan runs at 100% above this temperature',           numInput('TEMP_FULL', TEMP_FULL, 0, 120)),
				row('Hysteresis (\u00b0C)',       'Dead band to prevent rapid toggling at boundaries', numInput('HYST',      HYST,      0, 20))
			]),

			// Advanced collapsible
			advancedToggle,
			advancedCard,

			// Our own Save button
			E('button', {
				id: 'fc-save-btn',
				type: 'button',
				click: doSave,
				class: 'btn btn-primary',
				style: 'margin-top:4px'
			}, 'Save')
		]);
	},

	handleSave:         null,
	handleSaveValidate: null,
	handleReset:        null,
	handleApply:        null
});

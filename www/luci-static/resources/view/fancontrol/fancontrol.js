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
	if (dot)   dot.style.color   = running ? '#4ade80' : '#f87171';
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
		style: 'width:80px;background:#0f172a;color:#f1f5f9;border:1px solid #334155;border-radius:6px;padding:6px 10px;font-size:14px;text-align:center'
	});
}

function textInput(id, val) {
	return E('input', {
		id: 'fc-' + id, type: 'text', value: String(val),
		style: 'width:280px;background:#0f172a;color:#f1f5f9;border:1px solid #334155;border-radius:6px;padding:6px 10px;font-size:12px;font-family:monospace'
	});
}

function row(label, desc, input) {
	return E('div', { style: 'display:flex;align-items:center;padding:10px 0;border-bottom:1px solid #1e3a5f' }, [
		E('div', { style: 'flex:1' }, [
			E('div', { style: 'color:#e2e8f0;font-size:13px' }, label),
			E('div', { style: 'color:#64748b;font-size:11px;margin-top:2px' }, desc)
		]),
		input
	]);
}

function card(children) {
	return E('div', {
		style: 'background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px 20px;margin-bottom:20px'
	}, children);
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
				row('Poll Interval (seconds)', 'How often the kernel checks temperature', numInput('POLL',    POLL,    1, 60)),
				row('Thermal Zone Path',       'sysfs path to temperature sensor',        textInput('THERMAL', THERMAL)),
				row('PWM Device Path',         'sysfs path to fan PWM control',           textInput('PWM',     PWM))
			])
		]);

		var advancedToggle = E('button', {
			type: 'button',
			style: 'background:none;border:none;color:#64748b;font-size:13px;cursor:pointer;padding:0;margin-bottom:12px;display:flex;align-items:center;gap:6px',
			click: function() {
				advancedVisible = !advancedVisible;
				advancedCard.style.display = advancedVisible ? 'block' : 'none';
				this.textContent = (advancedVisible ? '\u25bc' : '\u25ba') + ' Advanced';
			}
		}, '\u25ba Advanced');

		return E('div', { style: 'max-width:660px' }, [
			// Status card
			E('div', { style: 'background:#0f172a;border:1px solid #334155;border-radius:10px;padding:16px 20px;margin-bottom:24px;font-family:monospace;font-size:13px' }, [
				E('table', { style: 'width:100%;border-collapse:collapse' }, [
					E('tr', {}, [
						E('td', { style: 'color:#94a3b8;padding:5px 0' }, 'Service'),
						E('td', { style: 'text-align:right;padding:5px 0' }, [
							E('span', { id: 'fc-svc-dot', style: 'color:' + (running ? '#4ade80' : '#f87171') }, '\u25cf '),
							E('span', { id: 'fc-svc-val', style: 'color:#f1f5f9;font-weight:bold' }, running ? 'Running' : 'Stopped')
						])
					]),
					E('tr', {}, [
						E('td', { style: 'color:#94a3b8;padding:5px 0' }, 'Temperature'),
						E('td', { id: 'fc-temp-val', style: 'text-align:right;color:#f1f5f9;font-weight:bold;padding:5px 0' },
							temp !== 'N/A' ? temp + ' \u00b0C' : 'N/A')
					]),
					E('tr', {}, [
						E('td', { style: 'color:#94a3b8;padding:5px 0' }, 'Fan'),
						E('td', { id: 'fc-fan-val', style: 'text-align:right;color:#f1f5f9;font-weight:bold;padding:5px 0' }, fanLabel(pwm))
					]),
					E('tr', {}, [
						E('td', { style: 'color:#94a3b8;padding:5px 0' }, 'PWM value'),
						E('td', { id: 'fc-pwm-val', style: 'text-align:right;color:#f1f5f9;font-weight:bold;padding:5px 0' }, String(pwm))
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
				style: 'background:#2563eb;color:#fff;border:none;border-radius:6px;padding:8px 24px;font-size:13px;font-weight:600;cursor:pointer;margin-top:4px'
			}, 'Save')
		]);
	},

	handleSave:         null,
	handleSaveValidate: null,
	handleReset:        null,
	handleApply:        null
});

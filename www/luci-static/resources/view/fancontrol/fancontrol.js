'use strict';
'require view';
'require rpc';
'require ui';
'require poll';

var callGetConfig  = rpc.declare({ object: 'luci.fancontrol', method: 'get_config',      expect: {} });
var callGetStatus  = rpc.declare({ object: 'luci.fancontrol', method: 'get_status',      expect: {} });
var callSvcStart   = rpc.declare({ object: 'luci.fancontrol', method: 'service_start',   expect: {} });
var callSvcStop    = rpc.declare({ object: 'luci.fancontrol', method: 'service_stop',    expect: {} });
var callSvcRestart = rpc.declare({ object: 'luci.fancontrol', method: 'service_restart', expect: {} });

function callSetConfig(cfg) {
	var sid = rpc.getSessionID();
	return fetch('/ubus/', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify([{
			jsonrpc: '2.0',
			id: 1,
			method: 'call',
			params: [ sid, 'luci.fancontrol', 'set_config', cfg ]
		}])
	}).then(function(r) {
		return r.json();
	}).then(function(r) {
		if (r && r[0] && r[0].result && r[0].result[0] === 0) {
			return r[0].result[1];
		}
		throw new Error('ubus call failed');
	});
}

function fanLabel(pwm) {
	if (pwm == null || pwm === '') return 'Unknown';
	var v = parseInt(pwm);
	if (v === 0) return 'Off';
	if (v <= 127) return 'Half speed';
	return 'Full speed';
}

function updateStatusUI(status) {
	var running = status.running === true || status.running === 'true';
	var temp = status.temp_c || 'N/A';
	var pwm = status.pwm || 'N/A';
	var dot = document.getElementById('fc-svc-dot');
	var svc = document.getElementById('fc-svc-val');
	var tmpEl = document.getElementById('fc-temp-val');
	var fanEl = document.getElementById('fc-fan-val');
	var pwmEl = document.getElementById('fc-pwm-val');
	if (dot) dot.style.color = running ? '#4ade80' : '#f87171';
	if (svc) svc.textContent = running ? 'Running' : 'Stopped';
	if (tmpEl) tmpEl.textContent = temp !== 'N/A' ? temp + ' \u00b0C' : 'N/A';
	if (fanEl) fanEl.textContent = fanLabel(pwm);
	if (pwmEl) pwmEl.textContent = String(pwm);
}

function getVal(id) {
	return document.getElementById('fc-' + id).value.trim();
}

function numInput(id, val, min, max) {
	return E('input', {
		id: 'fc-' + id,
		type: 'number',
		value: String(val),
		min: String(min),
		max: String(max),
		style: 'width:80px;background:#0f172a;color:#f1f5f9;border:1px solid #334155;border-radius:6px;padding:6px 10px;font-size:14px;text-align:center'
	});
}

function textInput(id, val) {
	return E('input', {
		id: 'fc-' + id,
		type: 'text',
		value: String(val),
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

function mkbtn(label, bg, onclick) {
	return E('button', {
		type: 'button',
		click: onclick,
		style: 'background:' + bg + ';color:#fff;border:none;border-radius:6px;padding:8px 18px;font-size:13px;cursor:pointer;font-weight:600'
	}, label);
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

	if (parseInt(TEMP_OFF) >= parseInt(TEMP_HALF) || parseInt(TEMP_HALF) >= parseInt(TEMP_FULL)) {
		ui.addNotification(null, E('p', {}, 'Thresholds must be in order: Off < Half Speed < Full Speed'), 'error');
		return;
	}

	var saveBtn = document.getElementById('fc-save-btn');
	if (saveBtn) {
		saveBtn.disabled = true;
		saveBtn.textContent = 'Saving...';
	}

	callSetConfig({
		THERMAL:   getVal('THERMAL'),
		PWM:       getVal('PWM'),
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
		if (saveBtn) {
			saveBtn.disabled = false;
			saveBtn.textContent = 'Save';
		}
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
		var temp = status.temp_c || 'N/A';
		var pwm  = status.pwm   || 'N/A';

		poll.add(function() {
			return callGetStatus().then(updateStatusUI);
		}, 10);

		requestAnimationFrame(function() {
			var footer = document.querySelector('.cbi-page-actions');
			if (footer) footer.style.display = 'none';
		});

		return E('div', { style: 'max-width:660px' }, [
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

			E('h3', { style: 'margin:0 0 10px;font-size:15px' }, 'Temperature Thresholds'),
			card([
				row('Fan Off Below (\u00b0C)',    'Fan is fully off below this temperature',           numInput('TEMP_OFF',  TEMP_OFF,  0, 120)),
				row('Half Speed Below (\u00b0C)', 'Fan runs at 50% between Off and this temperature',  numInput('TEMP_HALF', TEMP_HALF, 0, 120)),
				row('Full Speed Above (\u00b0C)', 'Fan runs at 100% above this temperature',           numInput('TEMP_FULL', TEMP_FULL, 0, 120)),
				row('Hysteresis (\u00b0C)',       'Dead band to prevent rapid toggling at boundaries', numInput('HYST',      HYST,      0, 20))
			]),

			E('h3', { style: 'margin:0 0 10px;font-size:15px' }, 'Advanced'),
			card([
				row('Poll Interval (seconds)', 'How often to check temperature',   numInput('POLL',    POLL,    1, 60)),
				row('Thermal Zone Path',       'sysfs path to temperature sensor', textInput('THERMAL', THERMAL)),
				row('PWM Device Path',         'sysfs path to fan PWM control',    textInput('PWM',     PWM))
			]),

			E('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin-top:8px' }, [
				E('button', {
					id: 'fc-save-btn',
					type: 'button',
					click: doSave,
					style: 'background:#2563eb;color:#fff;border:none;border-radius:6px;padding:8px 18px;font-size:13px;cursor:pointer;font-weight:600'
				}, 'Save'),
				mkbtn('Start',   '#16a34a', function() { callSvcStart().then(function()   { return callGetStatus(); }).then(updateStatusUI); }),
				mkbtn('Stop',    '#dc2626', function() { callSvcStop().then(function()    { return callGetStatus(); }).then(updateStatusUI); }),
				mkbtn('Restart', '#7c3aed', function() { callSvcRestart().then(function() { return callGetStatus(); }).then(updateStatusUI); })
			])
		]);
	},

	handleSave:         null,
	handleSaveValidate: null,
	handleReset:        null,
	handleApply:        null
});

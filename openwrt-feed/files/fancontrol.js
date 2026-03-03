'use strict';
'require view';
'require rpc';
'require ui';
'require poll';

var callGetConfig   = rpc.declare({ object: 'luci.fancontrol', method: 'get_config',   expect: {} });
var callGetStatus   = rpc.declare({ object: 'luci.fancontrol', method: 'get_status',   expect: {} });
var callListDevices = rpc.declare({ object: 'luci.fancontrol', method: 'list_devices', expect: {} });

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

function fanLabel(curState, maxState) {
	var cs = parseInt(curState);
	var ms = parseInt(maxState);
	if (isNaN(cs) || isNaN(ms) || ms <= 0) return 'Unknown';
	if (cs <= 0)       return 'Off';
	if (cs >= ms)      return 'Full speed';
	if (cs * 3 <= ms)      return 'Low';    // <= 1/3
	if (cs * 3 <= ms * 2)  return 'Medium'; // <= 2/3
	return 'High';
}

function updateStatusUI(status) {
	var running = status.running === true || status.running === 'true';
	var temp     = status.temp_c    || 'N/A';
	var pwm      = status.pwm       || 'N/A';
	var curState = status.cur_state || '';
	var maxState = status.max_state || '';
	var dot   = document.getElementById('fc-svc-dot');
	var svc   = document.getElementById('fc-svc-val');
	var tmpEl = document.getElementById('fc-temp-val');
	var fanEl = document.getElementById('fc-fan-val');
	var pwmEl = document.getElementById('fc-pwm-val');
	if (dot)   dot.style.color   = running ? '#5cb85c' : '#d9534f';
	if (svc)   svc.textContent   = running ? 'Running' : 'Stopped';
	if (tmpEl) tmpEl.textContent = temp !== 'N/A' ? temp + ' \u00b0C' : 'N/A';
	if (fanEl) fanEl.textContent = fanLabel(curState, maxState);
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
		style: 'width:320px;font-family:monospace;font-size:12px;display:inline-block'
	});
}

function selectInput(id, val, options) {
	var sel = E('select', {
		id: 'fc-' + id,
		class: 'form-control',
		style: 'width:320px;font-family:monospace;font-size:12px;display:inline-block'
	});
	var found = options.some(function(o) { return o.value === val; });
	if (val && !found) {
		sel.appendChild(E('option', { value: val }, val + ' (configured)'));
	}
	options.forEach(function(o) {
		var attrs = { value: o.value };
		if (o.value === val) attrs.selected = '';
		sel.appendChild(E('option', attrs, o.label));
	});
	return sel;
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
	var temp_off  = getVal('temp_off');
	var temp_half = getVal('temp_half');
	var temp_full = getVal('temp_full');

	var iOFF = parseInt(temp_off), iHALF = parseInt(temp_half), iFULL = parseInt(temp_full);
	if (isNaN(iOFF) || isNaN(iHALF) || isNaN(iFULL) || iOFF >= iHALF || iHALF >= iFULL) {
		ui.addNotification(null, E('p', {}, 'Thresholds must be in order: Off < Half Speed < Full Speed'), 'error');
		return;
	}

	var thermal = getVal('thermal');
	var pwm     = getVal('pwm');
	if (thermal !== '' && (!thermal.startsWith('/') || thermal.includes('\n'))) {
		ui.addNotification(null, E('p', {}, 'Thermal zone path must be an absolute path'), 'error');
		return;
	}
	if (pwm !== '' && (!pwm.startsWith('/') || pwm.includes('\n'))) {
		ui.addNotification(null, E('p', {}, 'PWM device path must be an absolute path'), 'error');
		return;
	}

	var btn = document.getElementById('fc-save-btn');
	if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }

	callSetConfig({
		thermal:   thermal,
		pwm:       pwm,
		temp_off:  temp_off,
		temp_half: temp_half,
		temp_full: temp_full,
		hyst:      getVal('hyst'),
		poll:      getVal('poll')
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
		return Promise.all([ callGetConfig(), callGetStatus(), callListDevices() ]);
	},

	render: function(data) {
		var cfg     = data[0] || {};
		var status  = data[1] || {};
		var devices = data[2] || {};

		var temp_off  = cfg.temp_off  || '50';
		var temp_half = cfg.temp_half || '65';
		var temp_full = cfg.temp_full || '75';
		var hyst      = cfg.hyst      || '2';
		var pollInterval = cfg.poll   || '10';
		var cfgThermal   = cfg.thermal || '';
		var cfgPwm       = cfg.pwm    || '';

		var running      = status.running === true || status.running === 'true';
		var statusTemp   = status.temp_c    || 'N/A';
		var statusPwm    = status.pwm       || 'N/A';
		var statusCs     = status.cur_state || '';
		var statusMs     = status.max_state || '';

		poll.add(function() { return callGetStatus().then(updateStatusUI); }, 10);

		// Hide LuCI's footer - we provide our own Save button
		requestAnimationFrame(function() {
			var footer = document.querySelector('.cbi-page-actions');
			if (footer) footer.style.display = 'none';
		});

		// Build thermal zone dropdown options (★ marks zones with pwm-fan cooling device)
		var thermalZones = devices.thermal_zones || [];
		var thermalOptions = [{ value: '', label: '(auto-detect)' }].concat(
			thermalZones.map(function(z) {
				return {
					value: z.temp_path,
					label: z.temp_path + ' (' + z.type + (z.has_pwmfan ? ' \u2605' : '') + ')'
				};
			})
		);

		// Build PWM device dropdown options
		var pwmDevices = devices.pwm_devices || [];
		var pwmOptions = [{ value: '', label: '(auto-detect)' }].concat(
			pwmDevices.map(function(p) {
				return {
					value: p.path,
					label: p.path + ' (' + p.driver + ')'
				};
			})
		);

		var thermalInput = (thermalZones.length > 0)
			? selectInput('thermal', cfgThermal, thermalOptions)
			: textInput('thermal', cfgThermal);

		var pwmInput = (pwmDevices.length > 0)
			? selectInput('pwm', cfgPwm, pwmOptions)
			: textInput('pwm', cfgPwm);

		var advancedVisible = false;
		var advancedCard = E('div', { style: 'display:none' }, [
			card([
				row('Poll Interval (seconds)', 'How often the daemon rechecks config',                  numInput('poll',    pollInterval, 1, 60)),
				row('Thermal Zone Path',       'sysfs temperature sensor (\u2605 = has PWM fan linked)', thermalInput),
				row('PWM Device Path',         'sysfs path to fan PWM control',                         pwmInput)
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
								statusTemp !== 'N/A' ? statusTemp + ' \u00b0C' : 'N/A')
						]),
						E('tr', {}, [
							E('td', { class: 'text-muted' }, 'Fan'),
							E('td', { id: 'fc-fan-val', style: 'text-align:right;font-weight:bold' }, fanLabel(statusCs, statusMs))
						]),
						E('tr', {}, [
							E('td', { class: 'text-muted' }, 'PWM value'),
							E('td', { id: 'fc-pwm-val', style: 'text-align:right;font-weight:bold' }, String(statusPwm))
						])
					])
				])
			]),

			// Thresholds
			E('h3', { style: 'margin:0 0 10px;font-size:15px' }, 'Temperature Thresholds'),
			card([
				row('Fan Off Below (\u00b0C)',    'Fan is fully off below this temperature',           numInput('temp_off',  temp_off,  0, 120)),
				row('Half Speed Below (\u00b0C)', 'Upper boundary for graduated speed range',          numInput('temp_half', temp_half, 0, 120)),
				row('Full Speed Above (\u00b0C)', 'Fan runs at 100% above this temperature',           numInput('temp_full', temp_full, 0, 120)),
				row('Hysteresis (\u00b0C)',       'Dead band to prevent rapid toggling at boundaries', numInput('hyst',      hyst,      0, 20))
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

'use strict';
'require view';
'require form';
'require rpc';
'require ui';
'require poll';

var callGetStatus   = rpc.declare({ object: 'luci.fancontrol', method: 'get_status',   expect: {} });
var callListDevices = rpc.declare({ object: 'luci.fancontrol', method: 'list_devices', expect: {} });
var callUciCommit   = rpc.declare({ object: 'uci', method: 'commit', params: ['config'], expect: {} });

function fanLabel(curState, maxState) {
	var cs = parseInt(curState);
	var ms = parseInt(maxState);
	if (isNaN(cs) || isNaN(ms) || ms <= 0) return 'Unknown';
	if (cs <= 0)           return 'Off';
	if (cs >= ms)          return 'Full speed';
	if (cs * 3 <= ms)      return 'Low';
	if (cs * 3 <= ms * 2)  return 'Medium';
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

return view.extend({
	load: function() {
		return Promise.all([ callGetStatus(), callListDevices() ]);
	},

	render: function(data) {
		var status  = data[0] || {};
		var devices = data[1] || {};

		var running    = status.running === true || status.running === 'true';
		var statusTemp = status.temp_c    || 'N/A';
		var statusPwm  = status.pwm       || 'N/A';
		var statusCs   = status.cur_state || '';
		var statusMs   = status.max_state || '';

		poll.add(function() { return callGetStatus().then(updateStatusUI); }, 10);

		var statusCard = E('div', { class: 'panel panel-default', style: 'margin-bottom:24px;display:inline-block;min-width:280px' }, [
			E('table', { class: 'table table-condensed', style: 'margin-bottom:0;font-family:monospace;font-size:13px;width:auto' }, [
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
		]);

		var m = new form.Map('fancontrol', _('Fan Control'));
		this._map = m;

		var s = m.section(form.NamedSection, 'settings', 'fancontrol');
		s.anonymous = true;
		s.addremove  = false;

		var o;

		o = s.option(form.Value, 'temp_off', _('Fan Off Below (\u00b0C)'),
			_('Fan is fully off below this temperature'));
		o.datatype = 'range(0, 120)';
		o.rmempty  = false;
		o.validate = function(section_id, value) {
			var half_opt = this.section.children.filter(function(c) { return c.option === 'temp_half'; })[0];
			var half = half_opt ? +half_opt.formvalue(section_id) : null;
			if (half !== null && +value >= half)
				return _('Must be less than Half Speed temperature');
			return true;
		};

		o = s.option(form.Value, 'temp_half', _('Half Speed Below (\u00b0C)'),
			_('Upper boundary for graduated speed range'));
		o.datatype = 'range(0, 120)';
		o.rmempty  = false;
		o.validate = function(section_id, value) {
			var off_opt = this.section.children.filter(function(c) { return c.option === 'temp_off'; })[0];
			var off = off_opt ? +off_opt.formvalue(section_id) : null;
			if (off !== null && +value <= off)
				return _('Must be greater than Fan Off temperature');
			return true;
		};

		o = s.option(form.Value, 'temp_full', _('Full Speed Above (\u00b0C)'),
			_('Fan runs at 100% above this temperature'));
		o.datatype = 'range(0, 120)';
		o.rmempty  = false;
		o.validate = function(section_id, value) {
			var half_opt = this.section.children.filter(function(c) { return c.option === 'temp_half'; })[0];
			var half = half_opt ? +half_opt.formvalue(section_id) : null;
			if (half !== null && +value <= half)
				return _('Must be greater than Half Speed temperature');
			return true;
		};

		o = s.option(form.Value, 'hyst', _('Hysteresis (\u00b0C)'),
			_('Dead band to prevent rapid toggling at boundaries'));
		o.datatype = 'range(0, 20)';
		o.rmempty  = false;

		o = s.option(form.Value, 'poll', _('Poll Interval (seconds)'),
			_('How often the daemon rechecks config'));
		o.datatype = 'range(1, 60)';
		o.rmempty  = false;

		var thermalZones = devices.thermal_zones || [];
		o = s.option(form.Value, 'thermal', _('Thermal Zone Path'),
			_('sysfs temperature sensor (\u2605 = has PWM fan linked)'));
		o.value('', _('(auto-detect)'));
		thermalZones.forEach(function(z) {
			o.value(z.temp_path, z.temp_path + ' (' + z.type + (z.has_pwmfan ? ' \u2605' : '') + ')');
		});

		var pwmDevices = devices.pwm_devices || [];
		o = s.option(form.Value, 'pwm', _('PWM Device Path'),
			_('sysfs path to fan PWM control'));
		o.value('', _('(auto-detect)'));
		pwmDevices.forEach(function(p) {
			o.value(p.path, p.path + ' (' + p.driver + ')');
		});

		return m.render().then(function(node) {
			return E('div', { style: 'max-width:660px' }, [statusCard, node]);
		});
	},

	handleSave: function(ev) {
		return this._map.save();
	},

	handleApply: function(ev) {
		return this.handleSave(ev)
			.then(function() { return callUciCommit({ config: 'fancontrol' }); })
			.then(function() { ui.addNotification(null, E('p', _('Fan control settings applied.')), 'info'); });
	},

	handleReset: null
});

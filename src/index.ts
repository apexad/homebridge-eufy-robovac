import {
	RoboVac,
	StatusResponse,
	WorkStatus,
} from 'eufy-robovac';

let Accessory: any, Service: any, Characteristic: any, UUIDGen: any;


module.exports = function(homebridge: any) {
	Accessory = homebridge.platformAccessory;
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;

	homebridge.registerAccessory('homebridge-eufy-robovac', 'Eufy RoboVac', EufyRoboVacAccessory);
};

class EufyRoboVacAccessory {
	log: any;
	config: {
		name?: string,
		deviceId: string,
		localKey: string,
		hideFindButton?: boolean,
		debugLog?: boolean,
	};
	services: any[];
	name: string;

	fanService: any;
	batteryService: any;
	serviceInfo: any;
	findRobot: any;

	roboVac!: RoboVac;
	hideFindButton: boolean;
	debugLog: boolean;

	constructor(log: any, config: any) {
		this.log = log;
		this.config = {
			deviceId: config.deviceId,
			localKey: config.localKey,
		};
		this.services = [];
		this.name = this.config.name || 'Eufy RoboVac';
		this.hideFindButton = this.config.hideFindButton || false;
		this.debugLog = this.config.debugLog;

		// Vacuum cleaner is not available in Homekit yet, register as Fan

		this.serviceInfo = new Service.AccessoryInformation();

		this.serviceInfo
			.setCharacteristic(Characteristic.Manufacturer, 'Eufy')
			.setCharacteristic(Characteristic.Model, 'RoboVac');

		this.services.push(this.serviceInfo);

		this.fanService = new Service.Fan(this.name);

		this.fanService
			.getCharacteristic(Characteristic.On)
			.on('get', this.getCleanState.bind(this))
			.on('set', this.setCleanState.bind(this));

		this.services.push(this.fanService);

		this.batteryService = new Service.BatteryService(this.name + ' Battery');
		this.batteryService
			.getCharacteristic(Characteristic.BatteryLevel)
			.on('get', this.getBatteryLevel.bind(this));

		this.batteryService
			.getCharacteristic(Characteristic.ChargingState)
			.on('get', this.getChargingState.bind(this));

		this.batteryService
			.getCharacteristic(Characteristic.StatusLowBattery)
			.on('get', this.getStatusLowBattery.bind(this));

		this.services.push(this.batteryService);

		if (!this.hideFindButton) {
			this.findRobot = new Service.Switch("Find " + this.name);

			this.findRobot
				.getCharacteristic(Characteristic.On)
				.on('get', this.getFindRobot.bind(this))
				.on('set', this.setFindRobot.bind(this));

			this.services.push(this.findRobot);
		}

		this.setup();
	}

	async setup() {
		this.roboVac = new RoboVac(this.config, this.debugLog);
		let status = await this.roboVac.getStatuses();
		this.updateCleaningState(status.dps[this.roboVac.PLAY_PAUSE] as boolean);
		this.updateBatteryLevel(status.dps[this.roboVac.BATTERY_LEVEL]);
		this.updateChargingState(status.dps[this.roboVac.WORK_STATUS] === WorkStatus.CHARGING ? Characteristic.ChargingState.CHARGING : Characteristic.ChargingState.NOT_CHARGEABLE);
		if (!this.hideFindButton) {
			this.updateFindRobot(status.dps[this.roboVac.FIND_ROBOT] as boolean);
		}

		this.roboVac.api.on('data', (data: StatusResponse) => {
			if(this.roboVac.PLAY_PAUSE in (data.dps as any)) {
				this.updateCleaningState((data.dps as any)[this.roboVac.PLAY_PAUSE]);
			}

			if(this.roboVac.BATTERY_LEVEL in (data.dps as any)) {
				this.updateBatteryLevel((data.dps as any)[this.roboVac.BATTERY_LEVEL]);
			}

			if(this.roboVac.WORK_STATUS in (data.dps as any)) {
				this.updateBatteryLevel((data.dps as any)[this.roboVac.WORK_STATUS] === WorkStatus.CHARGING ? Characteristic.ChargingState.CHARGING : Characteristic.ChargingState.NOT_CHARGEABLE);
			}

			if((this.roboVac.FIND_ROBOT in (data.dps as any)) && !this.hideFindButton) {
				this.updateFindRobot((data.dps as any)[this.roboVac.FIND_ROBOT]);
			}
		});
	}

	updateCleaningState(state: boolean) {
		this.log.debug('Cleaning State -> %s', state);
		this.fanService.getCharacteristic(Characteristic.On).updateValue(state)
	}

	async getCleanState(callback: Function) {
		this.log.debug("getCleanState");
		callback(null, await this.roboVac.getPlayPause());
	}

	async setCleanState(state: boolean, callback: Function) {
		this.log.debug("setCleanState", state);
		await this.roboVac.setPlayPause(state);
		if(!state) {
			await sleep(2000);
			await this.roboVac.goHome();
		}

		callback();
	}

	updateBatteryLevel(level: any) {
		this.log.debug('Battery Level -> %s', level);
		this.batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(level);
	}

	async getBatteryLevel(callback: Function) {
		this.log.debug("getBatteryLevel");
		callback(null, await this.roboVac.getBatteyLevel());
	}

	updateChargingState(state: any) {
		this.log.debug('Charging State -> %s', state);
		this.batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(state);
	}

	async getChargingState(callback: Function) {
		callback(null, (await this.roboVac.getWorkStatus() === WorkStatus.CHARGING) ? Characteristic.ChargingState.CHARGING : Characteristic.ChargingState.NOT_CHARGEABLE);
	}

	async getStatusLowBattery(callback: Function) {
		callback(null, (await this.roboVac.getBatteyLevel() < 30) ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
	}

	updateFindRobot(state: boolean) {
		this.log.debug('Find Robot -> %s', state);
		this.findRobot.getCharacteristic(Characteristic.On).updateValue(state);
	}

	async getFindRobot(callback: Function) {
		callback(null, await this.roboVac.getFindRobot());
	}

	async setFindRobot(state: boolean, callback: Function) {
		await this.roboVac.setFindRobot(state);
		callback();
	}

	identify(callback: Function) {
		callback();
	}
	getServices() {
		return this.services;
	}
}


function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

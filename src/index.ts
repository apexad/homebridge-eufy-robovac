import {
  RoboVac,
  WorkStatus,
} from 'eufy-robovac';

import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service
} from 'homebridge';

let hap: HAP;

export = (api: API) => {
  hap = api.hap;
  api.registerAccessory('homebridge-eufy-robovac', 'Eufy RoboVac', EufyRoboVacAccessory);
};

function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

class EufyRoboVacAccessory implements AccessoryPlugin {
  private readonly log: Logging;
  private readonly name: string;

  private readonly vacuumService: Service;
  private readonly informationService: Service;
  private roboVac!: RoboVac;
  private readonly config: { deviceId: any; localKey: any; };
  private readonly debugLog: boolean;
  services: Service[];

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = config.name || 'Eufy RoboVac';

    this.debugLog = config.debugLog;
    this.config = {
      deviceId: config.deviceId,
      localKey: config.localKey,
    };
    this.services = [];

    this.vacuumService = config.useSwitchService ? new hap.Service.Switch(this.name, 'vacuum') : new hap.Service.Fan(this.name, 'vacuum');
    this.vacuumService.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.GET, this.getCleanState.bind(this))
      .on(CharacteristicEventTypes.SET, this.setCleanState.bind(this));
    this.services.push(this.vacuumService);

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, 'Eufy')
      .setCharacteristic(hap.Characteristic.Model, 'RoboVac');
    this.services.push(this.informationService);

    this.setup();
    log.info(`${this.name} finished initializing!`);
  }

  async setup() {
		this.roboVac = new RoboVac(this.config, this.debugLog);
    return await this.roboVac.getStatuses();
  }

  async getCleanState(callback: CharacteristicGetCallback) {
    let cleanState;
    this.log.debug(`getCleanState  for ${this.name}`);

    try {
      cleanState = await this.roboVac.getPlayPause(true);
      this.log.debug(`getCleanState for ${this.name} returned ${cleanState}`);
      callback(undefined, cleanState);
    } catch(e) {
      await this.setup();
      this.getCleanState(() => {});
    }
  }

  async setCleanState(state: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.log.debug(`setCleanState for ${this.name} set to ${state}`);
    await this.roboVac.setPlayPause(state as boolean);
    if(!state) {
      await sleep(2000);
      await this.roboVac.goHome();
    }
    callback();
  }

  async getBatteryLevel(callback: CharacteristicGetCallback) {
    this.log.debug(`getBatteryLevel for ${this.name}`);

    try {
      callback(null, await this.roboVac.getBatteyLevel());
    } catch(e) {
      this.log.debug(`getBatteryLevel error; ${e}`);
      callback(null, 0); // push 0 if error, getCleanState will call setup function again
    }
  }

  async getChargingState(callback: CharacteristicGetCallback) {
    this.log.debug(`getChargingState for ${this.name}`);

    try {
      callback(null, (await this.roboVac.getWorkStatus() === WorkStatus.CHARGING) ? hap.Characteristic.ChargingState.CHARGING : hap.Characteristic.ChargingState.NOT_CHARGEABLE);
    } catch(e) {
      this.log.debug(`getChargingState error; ${e}`);
      callback(null, false); // push not charging if error, getCleanState will call setup function again
    }
  }

  async getStatusLowBattery(callback: CharacteristicGetCallback) {
    try {
      callback(null, (await this.roboVac.getBatteyLevel() < 30) ? hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
    } catch(e) {
      callback(null, false); // push not low battery if error, getCleanState will call setup function again

    }
  }

  async getFindRobot(callback: CharacteristicGetCallback) {
    this.log.debug(`getFindRobot for ${this.name}`);

    try {
      callback(null, await this.roboVac.getFindRobot());
    } catch(e) {
      callback(null, false); // push false for find switch if error, getCleanState will call setup function again
    }
	}

  async setFindRobot(state: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.log.debug(`setFindRobot for ${this.name} set to ${state}`);
    await this.roboVac.setFindRobot(state as boolean);
    callback();
  }

  async getErrorStatus(callback: CharacteristicGetCallback) {
    try {
      callback(null, (await this.roboVac.getErrorCode() === 'no_error') ? false : true);
    } catch(e) {
      callback(null, false); // push false for getErrorStatus if error, getCleanState will call setup function again
    }
  }

  identify(): void {
    this.log('Identify!');
  }

  getServices(): Service[] {
    return this.services;
  }
}

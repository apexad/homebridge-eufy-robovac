import { RoboVac, WorkStatus } from './robovac-api';

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
import { throws } from 'assert';
import { ChangeReason, CharacteristicWarningType } from 'hap-nodejs';

let hap: HAP;

export = (api: API) => {
  hap = api.hap;
  api.registerAccessory('@hov3rcraft/homebridge-eufy-robovac', 'Eufy RoboVac', EufyRoboVacAccessory);
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class EufyRoboVacAccessory implements AccessoryPlugin {
  private readonly log: Logging;
  private readonly name: string;

  private readonly vacuumService: Service;
  //private readonly informationService: Service;
  //private readonly batteryService: Service;
  private readonly findRobotService: Service | undefined;
  private readonly errorSensorService: Service | undefined;
  private roboVac!: RoboVac;
  private readonly config: { deviceId: any; localKey: any; deviceIp: string };
  private readonly hideFindButton: boolean;
  private readonly hideErrorSensor: boolean;
  private readonly debugLog: boolean;
  private readonly callbackTimeout = 3000;
  private readonly finalTimeout = 10000;
  private readonly cachingDuration: number = 15000;
  services: Service[];

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = config.name || 'Eufy RoboVac';
    this.hideFindButton = config.hideFindButton;
    this.hideErrorSensor = config.hideErrorSensor;

    this.debugLog = config.debugLog;
    this.config = {
      deviceId: config.deviceId,
      localKey: config.localKey,
      deviceIp: config.deviceIp
    };
    this.services = [];

    log.info(`Eufy Robovac starting`);

    this.vacuumService = config.useSwitchService ? new hap.Service.Switch(this.name, 'vacuum') : new hap.Service.Fan(this.name, 'vacuum');

    this.vacuumService.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.GET, this.getCleanState.bind(this))
      .on(CharacteristicEventTypes.SET, this.setCleanState.bind(this));

    this.services.push(this.vacuumService);

    /**
    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, 'Eufy')
      .setCharacteristic(hap.Characteristic.Model, 'RoboVac');
    this.services.push(this.informationService);

    this.batteryService = new hap.Service.Battery(this.name + ' Battery');
    this.batteryService.getCharacteristic(hap.Characteristic.BatteryLevel)
      .on(CharacteristicEventTypes.GET, this.getBatteryLevel.bind(this));
    this.batteryService
      .getCharacteristic(hap.Characteristic.ChargingState)
      .on(CharacteristicEventTypes.GET, this.getChargingState.bind(this));
    this.batteryService.getCharacteristic(hap.Characteristic.StatusLowBattery)
      .on(CharacteristicEventTypes.GET, this.getStatusLowBattery.bind(this));
    this.services.push(this.batteryService);
     */


    /**
     * if (!this.hideFindButton) {
      this.findRobotService = new hap.Service.Switch(`Find ${this.name}`, 'find');

      this.findRobotService
        .getCharacteristic(hap.Characteristic.On)
        .on(CharacteristicEventTypes.GET, this.getFindRobot.bind(this))
        .on(CharacteristicEventTypes.SET, this.setFindRobot.bind(this));

      this.services.push(this.findRobotService);
    }
     */

    /**
    if (!this.hideErrorSensor) {
      this.errorSensorService = new hap.Service.MotionSensor(`Error ${this.name}`);

      this.errorSensorService
        .getCharacteristic(hap.Characteristic.MotionDetected)
        .on(CharacteristicEventTypes.GET, this.getErrorStatus.bind(this))

      this.services.push(this.errorSensorService);
    }
    */

    this.roboVac = new RoboVac(this.config, this.cachingDuration, this.debugLog);

    log.info(`${this.name} finished initializing!`);
  }

  getCleanState(callback: CharacteristicGetCallback) {
    this.log.debug(`getCleanState for ${this.name}`);

    let callbackTimeoutLapsed = false;
    let finalTimeoutLapsed = false;
    this.roboVac.getPlayPause().then((cleanState) => {
      if (!callbackTimeoutLapsed) {
        callbackTimeoutLapsed = true;
        callback(undefined, cleanState);
      } else if (!finalTimeoutLapsed) {
        this.vacuumService.updateCharacteristic(hap.Characteristic.On, cleanState);
      }
    }).catch((error: Error) => {
      callbackTimeoutLapsed = true;
      callback(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    });

    setTimeout(function () {
      if (!callbackTimeoutLapsed) {
        callbackTimeoutLapsed = true;
        callback(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
      }
    }, this.callbackTimeout);

    setTimeout(function () {
      finalTimeoutLapsed = true;
    }, this.finalTimeout);

    let timeoutPromise: Promise<undefined> = new Promise<undefined>((resolve, reject) => {
      setTimeout(() => { resolve(undefined) }, this.callbackTimeout);
    });
  }

  setCleanState(state: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.log.debug(`setCleanState for ${this.name} set to ${state}`);

    let callbackTimeoutLapsed = false;
    let promise = (state) ? this.roboVac.setPlayPause(true) : this.roboVac.setGoHome(true);
    promise.then(() => {
      if (!callbackTimeoutLapsed) {
        callbackTimeoutLapsed = true;
        callback();
      }
    }).catch((error: Error) => {
      callbackTimeoutLapsed = true;
      callback(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    })

    setTimeout(function () {
      if (!callbackTimeoutLapsed) {
        callbackTimeoutLapsed = true;
        callback(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
      }
    }, this.callbackTimeout);
  }

  /** 
  getBatteryLevel(callback: CharacteristicGetCallback) {
    this.log.debug(`getBatteryLevel for ${this.name}`);

    this.roboVac.getBatteryLevel().then((batteryLevel: number) => {
      this.batteryService.updateCharacteristic(hap.Characteristic.BatteryLevel, batteryLevel);
    }).catch(() => {
      this.batteryService.getCharacteristic(hap.Characteristic.BatteryLevel).setValue(new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
    });

    callback(undefined, 100);
  }

  getChargingState(callback: CharacteristicGetCallback) {
    this.log.debug(`getChargingState for ${this.name}`);

    this.roboVac.getWorkStatus().then((workStatus: WorkStatus) => {
      if (workStatus === WorkStatus.CHARGING) {
        this.batteryService.updateCharacteristic(hap.Characteristic.ChargingState, hap.Characteristic.ChargingState.CHARGING);
      } else {
        this.batteryService.updateCharacteristic(hap.Characteristic.ChargingState, hap.Characteristic.ChargingState.NOT_CHARGING);
      }
    }).catch(() => {
      // TODO - test!
      this.batteryService.getCharacteristic(hap.Characteristic.ChargingState).setValue(new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
    });

    callback(undefined, hap.Characteristic.ChargingState.NOT_CHARGING);
  }

  getStatusLowBattery(callback: CharacteristicGetCallback) {
    this.log.debug(`getStatusLowBattery for ${this.name}`);

    this.roboVac.getBatteryLevel().then((batteryLevel: number) => {
      if (batteryLevel < 30) {
        this.batteryService.updateCharacteristic(hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
      } else {
        this.batteryService.updateCharacteristic(hap.Characteristic.StatusLowBattery, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
      }
    }).catch(() => {
      this.batteryService.getCharacteristic(hap.Characteristic.StatusLowBattery).setValue(new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
    });

    callback(undefined, hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
  }*/

  getFindRobot(callback: CharacteristicGetCallback) {
    this.log.debug(`getFindRobot for ${this.name}`);

    this.roboVac.getFindRobot().then((findRobot: boolean) => {
      this.findRobotService?.updateCharacteristic(hap.Characteristic.On, findRobot);
    }).catch(() => {
      this.findRobotService?.getCharacteristic(hap.Characteristic.On).setValue(new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
    });

    callback(undefined, false);
  }

  setFindRobot(state: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.log.debug(`setFindRobot for ${this.name} set to ${state}`);
    this.roboVac.setFindRobot(state as boolean).then(() => {
      let playPauseCached = this.roboVac.getPlayPauseCached();
      if (playPauseCached) {
        this.vacuumService.updateCharacteristic(hap.Characteristic.On, playPauseCached);
      }
      let getFindRobotCached = this.roboVac.getFindRobotCached();
      if (getFindRobotCached) {
        this.findRobotService?.updateCharacteristic(hap.Characteristic.On, getFindRobotCached);
      }
    }).catch(() => {
      this.findRobotService?.getCharacteristic(hap.Characteristic.On).setValue(new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
    });
    callback();
  }

  getErrorStatus(callback: CharacteristicGetCallback) {
    this.log.debug(`getErrorCode for ${this.name}`);

    this.roboVac.getErrorCode().then((errorCode: string) => {
      this.errorSensorService?.updateCharacteristic(hap.Characteristic.MotionDetected, (errorCode === 'no_error') ? false : true);
    }).catch(() => {
      this.errorSensorService?.getCharacteristic(hap.Characteristic.MotionDetected).setValue(new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
    });

    callback(undefined, false);
  }

  identify(): void {
    this.log('Identify!');
  }

  getServices(): Service[] {
    return this.services;
  }
}

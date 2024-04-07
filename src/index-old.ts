import { ErrorCode, RoboVac, StatusDps, StatusResponse, WorkStatus } from './robovac-api';

import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicEventTypes,
  CharacteristicValue,
  HAP,
  Logging,
  Service
} from 'homebridge';
import { ConsoleLogger, Logger } from './consoleLogger';

let hap: HAP;

export = (api: API) => {
  hap = api.hap;
  api.registerAccessory('@hov3rcraft/homebridge-eufy-robovac', 'Eufy RoboVac', EufyRoboVacAccessory);
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class EufyRoboVacAccessory implements AccessoryPlugin {
  private readonly log: Logger;
  private readonly name: string;

  private readonly vacuumService: Service;
  private readonly informationService: Service;
  //private readonly batteryService: Service;
  private readonly findRobotService: Service | undefined;
  private readonly errorSensorService: Service | undefined;
  private roboVac!: RoboVac;
  private readonly config: { deviceId: any; localKey: any; deviceIp: string };
  private readonly hideFindButton: boolean;
  private readonly hideErrorSensor: boolean;
  private readonly callbackTimeout = 3000;
  private readonly cachingDuration: number = 15000;
  services: Service[];

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = config.debugLog ? new ConsoleLogger(0, "homebridge-eufy-robovac:") : log;
    this.name = config.name || 'Eufy RoboVac';
    this.hideFindButton = config.hideFindButton;
    this.hideErrorSensor = config.hideErrorSensor;

    this.config = {
      deviceId: config.deviceId,
      localKey: config.localKey,
      deviceIp: config.deviceIp
    };
    this.services = [];

    log.info(`Eufy Robovac starting`);

    this.roboVac = new RoboVac(this.config, this.updateCharacteristics, this.cachingDuration, this.log);

    this.vacuumService = config.useSwitchService ? new hap.Service.Switch(this.name, 'vacuum') : new hap.Service.Fan(this.name, 'vacuum');

    this.vacuumService.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.GET, this.getRunning.bind(this))
      .on(CharacteristicEventTypes.SET, this.setRunning.bind(this));

    this.services.push(this.vacuumService);

    // create a new Accessory Information service
    this.informationService = new hap.Service.AccessoryInformation()

    // create handlers for required characteristics
    this.informationService.getCharacteristic(hap.Characteristic.Identify).onSet(this.setIdentify.bind(this));
    this.informationService.setCharacteristic(hap.Characteristic.Manufacturer, 'Eufy');
    this.informationService.setCharacteristic(hap.Characteristic.Model, 'RoboVac');
    this.informationService.setCharacteristic(hap.Characteristic.Name, this.name);
    this.informationService.setCharacteristic(hap.Characteristic.SerialNumber, config.deviceId);
    this.informationService.setCharacteristic(hap.Characteristic.FirmwareRevision, "unknown");
    this.services.push(this.informationService);

    /**
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


    if (!this.hideFindButton) {
      this.findRobotService = new hap.Service.Switch(`Find ${this.name}`, 'find');

      this.findRobotService
        .getCharacteristic(hap.Characteristic.On)
        .on(CharacteristicEventTypes.GET, this.getFindRobot.bind(this))
        .on(CharacteristicEventTypes.SET, this.setFindRobot.bind(this));

      this.services.push(this.findRobotService);
    }

    if (!this.hideErrorSensor) {
      this.errorSensorService = new hap.Service.MotionSensor(`Error ${this.name}`);

      this.errorSensorService
        .getCharacteristic(hap.Characteristic.MotionDetected)
        .on(CharacteristicEventTypes.GET, this.getErrorStatus.bind(this))

      this.services.push(this.errorSensorService);
    }

    log.info(`${this.name} finished initializing!`);
  }

  async getRunning(): Promise<CharacteristicValue> {
    this.log.debug(`getRunning for ${this.name}`);
    return Promise.race([
      new Promise<CharacteristicValue>((resolve, reject) => {
        this.roboVac.getRunning().then((running: boolean) => {
          resolve(running);
        }).catch(() => {
          reject(new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
        });
      }),
      new Promise<CharacteristicValue>((resolve, reject) => {
        setTimeout(() => reject(new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE)), this.callbackTimeout);
      }),
    ]);
  }

  async setRunning(state: CharacteristicValue) {
    this.log.debug(`setRunning for ${this.name} set to ${state}`);
    return Promise.race([
      new Promise<void>((resolve, reject) => {
        let task = (state) ? this.roboVac.setPlayPause(true) : this.roboVac.setGoHome(true);
        task.then(() => {
          resolve();
        }).catch(() => {
          reject(new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
        });
      }),
      new Promise<void>((resolve, reject) => {
        setTimeout(() => reject(new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE)), this.callbackTimeout);
      }),
    ]);
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

  async getFindRobot(): Promise<CharacteristicValue> {
    this.log.debug(`getFindRobot for ${this.name}`);
    return Promise.race([
      new Promise<CharacteristicValue>((resolve, reject) => {
        this.roboVac.getFindRobot().then((findRobot: boolean) => {
          resolve(findRobot);
        }).catch(() => {
          reject(new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
        });
      }),
      new Promise<CharacteristicValue>((resolve, reject) => {
        setTimeout(() => reject(new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE)), this.callbackTimeout);
      }),
    ]);
  }

  async setFindRobot(state: CharacteristicValue) {
    this.log.debug(`setFindRobot for ${this.name} set to ${state}`);
    return Promise.race([
      new Promise<void>((resolve, reject) => {
        this.roboVac.setFindRobot(state as boolean).then(() => {
          resolve();
        }).catch(() => {
          reject(new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
        });
      }),
      new Promise<void>((resolve, reject) => {
        setTimeout(() => reject(new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE)), this.callbackTimeout);
      }),
    ]);
  }

  async getErrorStatus(): Promise<CharacteristicValue> {
    this.log.debug(`getErrorStatus for ${this.name}`);
    return Promise.race([
      new Promise<CharacteristicValue>((resolve, reject) => {
        this.roboVac.getErrorCode().then((errorCode: string) => {
          resolve(errorCode !== ErrorCode.NO_ERROR);
        }).catch(() => {
          reject(new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
        });
      }),
      new Promise<CharacteristicValue>((resolve, reject) => {
        setTimeout(() => reject(new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE)), this.callbackTimeout);
      }),
    ]);
  }

  /**
   * Handle requests to set the "Identify" characteristic
   */
  setIdentify(value: any) {
    this.log.info('Triggered SET Identify:', value);
  }

  getServices(): Service[] {
    return this.services;
  }

  updateCharacteristics(statusResponse: StatusResponse) {
    this.log.debug(`updateCharacteristics for ${this.name}`);
    var counter = 0;
    if (statusResponse.dps[StatusDps.RUNNING] !== undefined) {
      this.log.debug(`updating RUNNING for ${this.name} to ${statusResponse.dps[StatusDps.RUNNING]}`);
      this.vacuumService.updateCharacteristic(hap.Characteristic.On, statusResponse.dps[StatusDps.RUNNING]);
      counter++;
    }
    if (this.findRobotService && statusResponse.dps[StatusDps.FIND_ROBOT] !== undefined) {
      this.log.debug(`updating FIND ROBOT for ${this.name} to ${statusResponse.dps[StatusDps.FIND_ROBOT]}`);
      this.findRobotService?.updateCharacteristic(hap.Characteristic.On, statusResponse.dps[StatusDps.FIND_ROBOT]);
      counter++;
    }
    if (this.errorSensorService && statusResponse.dps[StatusDps.ERROR_CODE] !== undefined) {
      this.log.debug(`updating ERROR STATUS for ${this.name} to ${statusResponse.dps[StatusDps.ERROR_CODE]}`);
      this.errorSensorService?.updateCharacteristic(hap.Characteristic.MotionDetected, statusResponse.dps[StatusDps.ERROR_CODE] !== ErrorCode.NO_ERROR);
      counter++;
    }

    this.log.info(`New data from ${this.name} received - updated ${counter} characteristics.`)
  }
}

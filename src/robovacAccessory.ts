import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { EufyRobovacPlatform } from './platform';
import { RoboVac, StatusDps, StatusResponse } from './robovac-api';
import { Logger } from './consoleLogger';

export class EufyRobovacAccessory {
  private readonly platform: EufyRobovacPlatform;
  private readonly accessory: PlatformAccessory;
  private readonly informationService: Service;
  private readonly vacuumService: Service;
  private readonly roboVac: RoboVac;
  private readonly log: Logger;

  private readonly name: string;
  private readonly connectionConfig: { deviceId: any; localKey: any; deviceIp: string };
  private readonly hideFindButton: boolean;
  private readonly hideErrorSensor: boolean;


  private readonly callbackTimeout = 3000;
  private readonly cachingDuration: number = 15000;

  constructor(platform: EufyRobovacPlatform, accessory: PlatformAccessory, config: any, log: Logger) {

    log.info(`Eufy Robovac starting`);

    this.platform = platform;
    this.accessory = accessory;
    this.log = log;

    this.name = accessory.displayName;
    this.connectionConfig = {
      deviceId: config.deviceId,
      localKey: config.localKey,
      deviceIp: config.deviceIp
    };
    this.hideFindButton = config.hideFindButton;
    this.hideErrorSensor = config.hideErrorSensor;

    // set accessory information
    this.informationService = this.accessory.getService(this.platform.Service.AccessoryInformation)!;
    this.informationService.getCharacteristic(this.platform.Characteristic.Identify).onSet(this.setIdentify.bind(this));
    this.informationService.setCharacteristic(this.platform.Characteristic.Manufacturer, 'Eufy');
    this.informationService.setCharacteristic(this.platform.Characteristic.Model, 'RoboVac');
    this.informationService.setCharacteristic(this.platform.Characteristic.Name, this.name);
    this.informationService.setCharacteristic(this.platform.Characteristic.SerialNumber, config.deviceId);
    this.informationService.setCharacteristic(this.platform.Characteristic.FirmwareRevision, "unknown");

    // create main service for the vacuum cleaner
    if (config.useSwitchService) {
      this.vacuumService = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch, "Vacuum");
    } else {
      this.vacuumService = this.accessory.getService(this.platform.Service.Fan) || this.accessory.addService(this.platform.Service.Fan, "Vacuum");
    }
    this.vacuumService.setCharacteristic(this.platform.Characteristic.Name, "Vacuum");
    this.vacuumService.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getRunning.bind(this))
      .onSet(this.setRunning.bind(this));


    this.roboVac = new RoboVac(this.connectionConfig, this.updateCharacteristics, this.cachingDuration, this.log);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   */
  async getRunning(): Promise<CharacteristicValue> {
    this.log.debug(`getRunning for ${this.name}`);
    return Promise.race([
      new Promise<CharacteristicValue>((resolve, reject) => {
        this.roboVac.getRunning().then((running: boolean) => {
          resolve(running);
        }).catch(() => {
          reject(new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
        });
      }),
      new Promise<CharacteristicValue>((resolve, reject) => {
        setTimeout(() => reject(new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE)), this.callbackTimeout);
      }),
    ]);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setRunning(state: CharacteristicValue) {
    this.log.debug(`setRunning for ${this.name} set to ${state}`);
    return Promise.race([
      new Promise<void>((resolve, reject) => {
        let task = (state) ? this.roboVac.setPlayPause(true) : this.roboVac.setGoHome(true);
        task.then(() => {
          resolve();
        }).catch(() => {
          reject(new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
        });
      }),
      new Promise<void>((resolve, reject) => {
        setTimeout(() => reject(new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE)), this.callbackTimeout);
      }),
    ]);
  }

  /**
   * Handle requests to set the "Identify" characteristic
   */
  setIdentify(value: any) {
    this.log.info('Triggered SET Identify:', value);
  }

  updateCharacteristics(statusResponse: StatusResponse) {
    this.log.debug(`updateCharacteristics for ${this.name}`);
    var counter = 0;
    if (statusResponse.dps[StatusDps.RUNNING] !== undefined) {
      this.log.debug(`updating RUNNING for ${this.name} to ${statusResponse.dps[StatusDps.RUNNING]}`);
      this.vacuumService.updateCharacteristic(this.platform.Characteristic.On, statusResponse.dps[StatusDps.RUNNING]);
      counter++;
    }
    /**
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
     */

    this.log.info(`New data from ${this.name} received - updated ${counter} characteristics.`)
  }
}

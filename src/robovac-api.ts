import { rejects } from "assert";
import { ConsoleLogger, Logger } from "./consoleLogger"

const TuyAPI = require('tuyapi');

export enum CleanSpeed {
    STANDARD = 'Standard',
    BOOST_IQ = 'Boost_IQ',
    MAX = 'Max',
    NO_SUCTION = 'No_suction'
}

export enum ErrorCode {
    NO_ERROR = 'no_error',
    STUCK_5_MIN = 'Stuck_5_min',
    CRASH_BAR_STUCK = 'Crash_bar_stuck',
    SENSOR_DIRTY = 'sensor_dirty',
    NOT_ENOUGH_POWER = 'N_enough_pow',
    WHEEL_STUCK = 'Wheel_stuck',
    S_BRUSH_STUCK = 'S_brush_stuck',
    FAN_STUCK = 'Fan_stuck',
    R_BRUSH_STUCK = 'R_brush_stuck'
}

export enum WorkStatus {
    // Cleaning
    RUNNING = 'Running',
    // Not in the dock, paused
    STAND_BY = 'standby',
    // Not in the dock - goes into this state after being paused for a while
    SLEEPING = 'Sleeping',
    // In the dock, charging
    CHARGING = 'Charging',
    // In the dock, full charged
    COMPLETED = 'completed',
    // Going home because battery is depleted or home was pressed
    RECHARGE_NEEDED = 'Recharge'
}

export enum Direction {
    FORWARD = 'forward',
    BACKWARD = 'backward',
    LEFT = 'left',
    RIGHT = 'right'
}

export enum WorkMode {
    AUTO = 'auto',
    SMALL_ROOM = 'SmallRoom',
    SPOT = 'Spot',
    EDGE = 'Edge',
    NO_SWEEP = 'Nosweep'
}

export enum StatusDps {
    PLAY_PAUSE = '2',
    DIRECTION = '3',
    WORK_MODE = '5',
    WORK_STATUS = '15',
    GO_HOME = '101',
    CLEAN_SPEED = '102',
    FIND_ROBOT = '103',
    BATTERY_LEVEL = '104',
    ERROR_CODE = '106'
}

export interface StatusResponse {
    devId: string,
    dps: {
        "1": boolean,
        "2": boolean,
        "3": string,
        "5": string,
        "15": string,
        "101": boolean,
        "102": string,
        "103": boolean,
        "104": number,
        "106": string,
    }
}

export function formatStatus(statusResponse: StatusResponse): string {
    return `    -- Status Start --
    - Play/Pause: ${(statusResponse.dps as any)[StatusDps.PLAY_PAUSE]}
    - Direction: ${(statusResponse.dps as any)[StatusDps.DIRECTION]}
    - Work Mode: ${(statusResponse.dps as any)[StatusDps.WORK_MODE]}
    - Go Home: ${(statusResponse.dps as any)[StatusDps.GO_HOME]}
    - Clean Speed: ${(statusResponse.dps as any)[StatusDps.CLEAN_SPEED]}
    - Find Robot: ${(statusResponse.dps as any)[StatusDps.FIND_ROBOT]}
    - Battery Level: ${(statusResponse.dps as any)[StatusDps.BATTERY_LEVEL]}
    - Error Code: ${(statusResponse.dps as any)[StatusDps.ERROR_CODE]}
    -- Status End --`;
}

export class RoboVac {
    api: any;
    directConnect: boolean;
    lastStatus: StatusResponse;
    lastStatusUpdate: Date = new Date(0);
    cachingDuration: number;
    ongoingStatusUpdate: Promise<StatusResponse> | null = null;
    log: Logger;
    consoleDebugLog: boolean;

    constructor(config: { deviceId: string, localKey: string, deviceIp: string }, cachingDuration: number, log:Logger = new ConsoleLogger()) {
        this.cachingDuration = cachingDuration;
        this.log = log;
        if (log instanceof ConsoleLogger) {
            this.consoleDebugLog = ((log as ConsoleLogger).logLevel <= 1);
        } else {
            this.consoleDebugLog = false;
        }

        this.directConnect = (config.deviceIp != null && config.deviceIp != "");

        this.api = new TuyAPI({
            id: config.deviceId,
            key: config.localKey,
            ip: this.directConnect ? config.deviceIp : null,
            version: '3.3',
            issueRefreshOnConnect: true
        });

        // Add event listeners
        this.api.on('connected', () => {
            log.info('Connected to device!');
        });

        this.api.on('disconnected', () => {
            log.info('Disconnected from device.');
        });

        this.api.on('error', (error: any) => {
            log.error('Error!', error);
            this.ongoingStatusUpdate = null;
            this.lastStatusUpdate = new Date(0);
            this.api.disconnect();
        });

        this.api.on('dp-refresh', (data: any) => {
            log.debug('DP_REFRESH data from device: ', data);
        });

        this.api.on('data', (data: any) => {
            if (this.consoleDebugLog) {
                let logMessage: any;
                try {
                    logMessage = formatStatus(data);
                } catch (e) {
                    logMessage = data;
                }
                this.log.debug("Received data from device:", "\n" + logMessage);
            } else {
                this.log.debug("Received data from device:", data)
            }

            if (data.dps) {
                Object.assign(this.lastStatus, data);
                this.lastStatusUpdate = new Date();
            }
        });

        // init with default values
        this.lastStatus = {
            devId: config.deviceId,
            dps: {
                "1": false,
                "2": false,
                "3": Direction.FORWARD,
                "5": WorkMode.NO_SWEEP,
                "15": WorkStatus.CHARGING,
                "101": false,
                "102": CleanSpeed.NO_SUCTION,
                "103": false,
                "104": 0,
                "106": "",
            }
        }

        this.connect();
    }

    connect() {
        if (this.directConnect) {
            // connect directly to the ip specified in config
            this.api.connect();
            this.log.info("Connected to RoboVac at ", this.api.device.ip);
        } else {
            // Find device on network
            this.api.find().then(() => {
                // Connect to device
                this.api.connect();
            })
        }
    }

    disconnect() {
        if (this.api.isConnected()) {
            this.api.disconnect();
        }
    }

    getStatusesCached(): Promise<StatusResponse> {
        if (Math.abs(new Date().getTime() - this.lastStatusUpdate.getTime()) > this.cachingDuration) {
            return this.getStatuses();
        } else {
            this.log.debug("Status request within max status update age");
            return Promise.resolve(this.lastStatus as StatusResponse);
        }
    }

    getStatuses(): Promise<StatusResponse> {
        if (this.ongoingStatusUpdate == null) {
            this.ongoingStatusUpdate = new Promise<StatusResponse>((resolve, reject) => {
                this.log.info("Fetching status update...");
                
                if (!this.api.isConnected()) {
                    this.connect();
                }
                this.api.get({ schema: true }).then((schema: any) => {
                    this.lastStatus = schema;
                    this.lastStatusUpdate = new Date();
                    this.ongoingStatusUpdate = null;
                    resolve(this.lastStatus as StatusResponse);
                }).catch((e: Error) => {
                    this.log.error("An error occurred (during GET)!", e);
                    this.lastStatusUpdate = new Date();
                    this.ongoingStatusUpdate = null;
                    reject(e);
                });
            });
            return this.ongoingStatusUpdate;
        }
        else {
            this.log.debug("Duplicate status request detected");
        }
        return this.ongoingStatusUpdate as Promise<StatusResponse>;
    }

    set(dps: string, newValue: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.log.debug("Setting new value...");

            if (!this.api.isConnected()) {
                this.connect();
            }
            this.api.set({ dps: dps, set: newValue }).then(() => {
                resolve();
            }).catch((error: Error) => {
                this.log.error("An error occurred (during SET)!");
                reject(error);
            });
        });
    }

    getPlayPause(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.getStatusesCached().then((statusResponse: StatusResponse) => {
                resolve(<boolean>statusResponse.dps[StatusDps.PLAY_PAUSE]);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    getDirection(): Promise<Direction> {
        return new Promise<Direction>((resolve, reject) => {
            this.getStatusesCached().then((statusResponse: StatusResponse) => {
                resolve(<Direction>statusResponse.dps[StatusDps.DIRECTION]);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    getWorkStatus(): Promise<WorkStatus> {
        return new Promise<WorkStatus>((resolve, reject) => {
            this.getStatusesCached().then((statusResponse: StatusResponse) => {
                resolve(<WorkStatus>statusResponse.dps[StatusDps.WORK_STATUS]);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    getGoHome(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.getStatusesCached().then((statusResponse: StatusResponse) => {
                resolve(<boolean>statusResponse.dps[StatusDps.GO_HOME]);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    getCleanSpeed(): Promise<CleanSpeed> {
        return new Promise<CleanSpeed>((resolve, reject) => {
            this.getStatusesCached().then((statusResponse: StatusResponse) => {
                resolve(<CleanSpeed>statusResponse.dps[StatusDps.CLEAN_SPEED]);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    getFindRobot(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.getStatusesCached().then((statusResponse: StatusResponse) => {
                resolve(<boolean>statusResponse.dps[StatusDps.FIND_ROBOT]);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    getBatteryLevel(): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            this.getStatusesCached().then((statusResponse: StatusResponse) => {
                resolve(<number>statusResponse.dps[StatusDps.BATTERY_LEVEL]);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    getErrorCode(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            this.getStatusesCached().then((statusResponse: StatusResponse) => {
                resolve(<string>statusResponse.dps[StatusDps.ERROR_CODE]);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    getPlayPauseCached(): boolean | undefined {
        return this.lastStatus.dps[StatusDps.PLAY_PAUSE];
    }

    getDirectionCached(): Direction | undefined {
        return <Direction | undefined>this.lastStatus.dps[StatusDps.DIRECTION];
    }

    getWorkStatusCached(): WorkStatus | undefined {
        return <WorkStatus | undefined>this.lastStatus.dps[StatusDps.WORK_STATUS];
    }

    getGoHomeCached(): boolean | undefined {
        return <boolean | undefined>this.lastStatus.dps[StatusDps.GO_HOME];
    }

    getCleanSpeedCached(): CleanSpeed | undefined {
        return <CleanSpeed | undefined>this.lastStatus.dps[StatusDps.CLEAN_SPEED];
    }

    getFindRobotCached(): boolean | undefined {
        return <boolean | undefined>this.lastStatus.dps[StatusDps.FIND_ROBOT];
    }

    getBatteryLevelCached(): number | undefined {
        return <number | undefined>this.lastStatus.dps[StatusDps.BATTERY_LEVEL];
    }

    getErrorCodeCached(): string | undefined {
        return <string | undefined>this.lastStatus.dps[StatusDps.ERROR_CODE];
    }

    setPlayPause(newValue: boolean): Promise<void> {
        this.log.info("Setting PlayPause to", newValue, "...");
        return this.set(StatusDps.PLAY_PAUSE, newValue);
    }

    setDirection(newValue: string): Promise<void> {
        this.log.info("Setting Direction to", newValue, "...");
        return this.set(StatusDps.DIRECTION, newValue);
    }

    setWorkMode(newValue: string): Promise<void> {
        this.log.info("Setting WorkMode to", newValue, "...");
        return this.set(StatusDps.WORK_MODE, newValue);
    }

    setGoHome(newValue: boolean): Promise<void> {
        this.log.info("Setting GoHome to", newValue, "...");
        return this.set(StatusDps.GO_HOME, newValue);
    }

    setCleanSpeed(newValue: string): Promise<void> {
        this.log.info("Setting CleanSpeed to", newValue, "...");
        return this.set(StatusDps.CLEAN_SPEED, newValue);
    }

    setFindRobot(newValue: boolean): Promise<void> {
        this.log.info("Setting FindRobot to", newValue, "...");
        return this.set(StatusDps.FIND_ROBOT, newValue);
    }
}

import { rejects } from "assert";

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
    lastStatusResponse: StatusResponse | null = null;
    lastStatusUpdate: Date = new Date(0);
    cachingDuration: number;
    ongoingStatusUpdate: Promise<StatusResponse> | null = null;
    debugLog: boolean;

    constructor(config: { deviceId: string, localKey: string, ip: string }, cachingDuration: number, debugLog: boolean = false) {
        this.cachingDuration = cachingDuration;
        this.debugLog = debugLog;

        this.api = new TuyAPI({
            id: config.deviceId,
            key: config.localKey,
            ip: config.ip,
            version: '3.3',
            issueRefreshOnConnect: true
        });

        // Add event listeners
        this.api.on('connected', () => {
            if (debugLog) {
                console.log('Connected to device!');
            }
        });

        this.api.on('disconnected', () => {
            if (debugLog) {
                console.log('Disconnected from device.');
            }
        });

        this.api.on('error', (error: any) => {
            if (debugLog) {
                console.log('Error!', error);
            }
            this.ongoingStatusUpdate = null;
            this.lastStatusUpdate = new Date(0);
            this.api.disconnect();
        });

        this.api.on('dp-refresh', (data: any) => {
            if (debugLog) {
                console.log('DP_REFRESH data from device: ', data);
            }
        });

        this.api.on('data', (data: any) => {
            if (debugLog) {
                let logMessage: any;
                try {
                    logMessage = formatStatus(data);
                } catch (e) {
                    logMessage = data;
                }
                console.log("Received data from device:", "\n" + logMessage);
            }
        });
    }

    getStatusesCached(): Promise<StatusResponse> {
        if (Math.abs(new Date().getTime() - this.lastStatusUpdate.getTime()) > this.cachingDuration) {
            return this.getStatuses();
        } else {
            if (this.debugLog) {
                console.log("Status request within max status update age");
            }
            return Promise.resolve(this.lastStatusResponse as StatusResponse);
        }
    }

    getStatuses(): Promise<StatusResponse> {
        if (this.ongoingStatusUpdate == null) {
            this.ongoingStatusUpdate = new Promise<StatusResponse>((resolve, reject) => {
                if (this.debugLog) {
                    console.log("Fetching status update...");
                }
                this.api.get({ schema: true }).then((schema: any) => {
                    this.lastStatusResponse = schema;
                    this.lastStatusUpdate = new Date();
                    this.api.disconnect();
                    this.ongoingStatusUpdate = null;
                    resolve(this.lastStatusResponse as StatusResponse);
                }).catch((e: Error) => {
                    if (this.debugLog) {
                        console.log("An error occurred (during GET)!", e)
                    }
                    reject(e);
                });
            });
            return this.ongoingStatusUpdate;
        }
        else if (this.debugLog) {
            console.log("Duplicate status request detected");
        }
        return this.ongoingStatusUpdate as Promise<StatusResponse>;
    }

    set(dps: string, newValue: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.debugLog) {
                console.log("Setting new value...");
            }
            this.api.set({ dps: dps, set: newValue }).then(() => {
                this.api.disconnect();
                resolve();
            }).catch((error: Error) => {
                if (this.debugLog) {
                    console.log("An error occurred (during SET)!")
                }
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
        return this.lastStatusResponse?.dps[StatusDps.PLAY_PAUSE];
    }

    getDirectionCached(): Direction | undefined {
        return <Direction | undefined>this.lastStatusResponse?.dps[StatusDps.DIRECTION];
    }

    getWorkStatusCached(): WorkStatus | undefined {
        return <WorkStatus | undefined>this.lastStatusResponse?.dps[StatusDps.WORK_STATUS];
    }

    getGoHomeCached(): boolean | undefined {
        return <boolean | undefined>this.lastStatusResponse?.dps[StatusDps.GO_HOME];
    }

    getCleanSpeedCached(): CleanSpeed | undefined {
        return <CleanSpeed | undefined>this.lastStatusResponse?.dps[StatusDps.CLEAN_SPEED];
    }

    getFindRobotCached(): boolean | undefined {
        return <boolean | undefined>this.lastStatusResponse?.dps[StatusDps.FIND_ROBOT];
    }

    getBatteryLevelCached(): number | undefined {
        return <number | undefined>this.lastStatusResponse?.dps[StatusDps.BATTERY_LEVEL];
    }

    getErrorCodeCached(): string | undefined {
        return <string | undefined>this.lastStatusResponse?.dps[StatusDps.ERROR_CODE];
    }

    setPlayPause(newValue: boolean): Promise<void> {
        if (this.debugLog) {
            console.log("Setting PlayPause to", newValue, "...");
        }
        return this.set(StatusDps.PLAY_PAUSE, newValue);
    }

    setDirection(newValue: string): Promise<void> {
        if (this.debugLog) {
            console.log("Setting Direction to", newValue, "...");
        }
        return this.set(StatusDps.DIRECTION, newValue);
    }

    setWorkMode(newValue: string): Promise<void> {
        if (this.debugLog) {
            console.log("Setting WorkMode to", newValue, "...");
        }
        return this.set(StatusDps.WORK_MODE, newValue);
    }

    setGoHome(newValue: boolean): Promise<void> {
        if (this.debugLog) {
            console.log("Setting GoHome to", newValue, "...");
        }
        return this.set(StatusDps.GO_HOME, newValue);
    }

    setCleanSpeed(newValue: string): Promise<void> {
        if (this.debugLog) {
            console.log("Setting CleanSpeed to", newValue, "...");
        }
        return this.set(StatusDps.CLEAN_SPEED, newValue);
    }

    setFindRobot(newValue: boolean): Promise<void> {
        if (this.debugLog) {
            console.log("Setting FindRobot to", newValue, "...");
        }
        return this.set(StatusDps.FIND_ROBOT, newValue);
    }
}

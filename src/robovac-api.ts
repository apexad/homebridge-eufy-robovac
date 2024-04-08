import { ConsoleLogger, Logger } from "./consoleLogger"

const TuyAPI = require('tuyapi');

export enum StatusDps {
    DEFAULT = '1',
    RUNNING = '2',
    DIRECTION = '3',
    WORK_MODE = '5',
    WORK_STATUS = '15',
    GO_HOME = '101',
    CLEAN_SPEED = '102',
    FIND_ROBOT = '103',
    BATTERY_LEVEL = '104',
    ERROR_CODE = '106'
}

export const statusDpsFriendlyNames = new Map<string, string>([
    [StatusDps.DEFAULT, "Default Property (ignore)"],
    [StatusDps.RUNNING, "Running"],
    [StatusDps.DIRECTION, "Direction"],
    [StatusDps.WORK_MODE, "Work Mode"],
    [StatusDps.WORK_STATUS, "Work Status"],
    [StatusDps.GO_HOME, "Go Home"],
    [StatusDps.CLEAN_SPEED, "Clean Speed"],
    [StatusDps.FIND_ROBOT, "Find Robot"],
    [StatusDps.BATTERY_LEVEL, "Battery Level"],
    [StatusDps.ERROR_CODE, "Error Code"]
]
);

export interface StatusResponse {
    devId: string,
    dps: {
        [StatusDps.DEFAULT]?: boolean,
        [StatusDps.RUNNING]?: boolean,
        [StatusDps.DIRECTION]?: string,
        [StatusDps.WORK_MODE]?: string,
        [StatusDps.WORK_STATUS]?: string,
        [StatusDps.GO_HOME]?: boolean,
        [StatusDps.CLEAN_SPEED]?: string,
        [StatusDps.FIND_ROBOT]?: boolean,
        [StatusDps.BATTERY_LEVEL]?: number,
        [StatusDps.ERROR_CODE]?: string,
    }
}

export interface RobovacStatus {
    devId: string,
    dps: {
        [StatusDps.DEFAULT]: boolean,
        [StatusDps.RUNNING]: boolean,
        [StatusDps.DIRECTION]: string,
        [StatusDps.WORK_MODE]: string,
        [StatusDps.WORK_STATUS]: string,
        [StatusDps.GO_HOME]: boolean,
        [StatusDps.CLEAN_SPEED]: string,
        [StatusDps.FIND_ROBOT]: boolean,
        [StatusDps.BATTERY_LEVEL]: number,
        [StatusDps.ERROR_CODE]: string,
    }
}

export function formatStatusResponse(statusResponse: StatusResponse): string {
    var formattedStatus = `-- Status Start --\n`
    for (var dps of Object.values(StatusDps)) {
        if (statusResponse.dps.hasOwnProperty(dps)) {
            formattedStatus += `- ${statusDpsFriendlyNames.get(dps)}: ${(statusResponse.dps as any)[dps]}\n`
        }
    }
    formattedStatus += `-- Status End --`
    return formattedStatus;
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

export class RoboVac {
    api: any;
    directConnect: boolean;
    lastStatus: RobovacStatus;
    lastStatusUpdate: Date;
    lastStatusValid: boolean;
    cachingDuration: number;
    ongoingStatusUpdate: Promise<RobovacStatus> | null;
    log: Logger;
    consoleDebugLog: boolean;

    constructor(config: { deviceId: string, localKey: string, deviceIp: string }, dataReceivedCallback: (statusResponse: StatusResponse) => void, cachingDuration: number, log: Logger = new ConsoleLogger()) {
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
            this.disconnect();
        });

        this.api.on('dp-refresh', (data: any) => {
            log.debug('DP_REFRESH data from device: ', data);
        });

        this.api.on('data', (data: any) => {
            if (this.consoleDebugLog) {
                try {
                    this.log.debug("Received data from device:", "\n" + formatStatusResponse(data));
                } catch (e) {
                    this.log.debug("Received data from device:", data)
                }
            } else {
                this.log.debug("Received data from device:", data)
            }

            if (data.dps) {
                Object.assign(this.lastStatus, data);
                this.lastStatusUpdate = new Date();
                dataReceivedCallback(data);
            }
        });

        // init with default values
        this.lastStatus = {
            devId: "default - invalid",
            dps: {
                [StatusDps.DEFAULT]: false,
                [StatusDps.RUNNING]: false,
                [StatusDps.DIRECTION]: Direction.FORWARD,
                [StatusDps.WORK_MODE]: WorkMode.NO_SWEEP,
                [StatusDps.WORK_STATUS]: WorkStatus.CHARGING,
                [StatusDps.GO_HOME]: false,
                [StatusDps.CLEAN_SPEED]: CleanSpeed.NO_SUCTION,
                [StatusDps.FIND_ROBOT]: false,
                [StatusDps.BATTERY_LEVEL]: -1,
                [StatusDps.ERROR_CODE]: "default - invalid",
            }
        }
        this.lastStatusUpdate = new Date(0);
        this.lastStatusValid = false;
        this.ongoingStatusUpdate = null;

        this.connect();
    }

    async connect(): Promise<void> {
        if (!this.directConnect) {
            // Find device on network if there is no ip specified in config
            await this.api.find()
        }

        // Connect to device
        await this.api.connect();
    }

    async disconnect() {
        this.ongoingStatusUpdate = null;
        this.lastStatusUpdate = new Date(0);
        if (this.api.isConnected()) {
            await this.api.disconnect();
        }
    }

    getStatusCached(): RobovacStatus | null {
        return this.lastStatusValid ? this.lastStatus : null;
    }

    async getStatus(): Promise<RobovacStatus> {
        if (!this.lastStatusValid || Math.abs(new Date().getTime() - this.lastStatusUpdate.getTime()) > this.cachingDuration) {
            return this.getStatusFromDeviceSynchronized();
        } else {
            this.log.debug("Status request within max status update age");
            return this.lastStatus;
        }
    }

    async getStatusFromDeviceSynchronized(): Promise<RobovacStatus> {
        if (this.ongoingStatusUpdate != null) {
            this.log.debug("Duplicate status update request detected");
            return this.ongoingStatusUpdate;
        }

        this.ongoingStatusUpdate = this.getStatusFromDevice();
        return this.ongoingStatusUpdate;
    }

    async getStatusFromDevice(): Promise<RobovacStatus> {
        this.log.info("Fetching status update...");
        if (!this.api.isConnected()) {
            await this.connect();
        }

        try {
            var schema = await this.api.get({ schema: true });
            this.lastStatus = schema;
            this.lastStatusUpdate = new Date();
            this.ongoingStatusUpdate = null;
            this.log.info("Status update retrieved.")
            return this.lastStatus;
        } catch (e) {
            this.log.error("An error occurred (during GET status update)!", e);
            try {
                this.disconnect()
            } catch (e) {
            }
            throw e;
        }
    }

    async set(dps: StatusDps, newValue: any) {
        this.log.debug("Setting", statusDpsFriendlyNames.get(dps), "to", newValue, "...");
        if (!this.api.isConnected()) {
            await this.connect();
        }

        try {
            await this.api.this.api.set({ dps: dps, set: newValue });
            this.log.info("Setting", statusDpsFriendlyNames.get(dps), "to", newValue, "successful.");
        } catch (e) {
            this.log.error("An error occurred! (during SET of ", statusDpsFriendlyNames.get(dps), "to", newValue, ")");
            try {
                this.disconnect()
            } catch (e) {
            }
            throw e;
        }
    }

    async getRunning(): Promise<boolean> {
        const robovacStatus = await this.getStatus();
        return <boolean>robovacStatus.dps[StatusDps.RUNNING];
    }

    async getDirection(): Promise<Direction> {
        const robovacStatus = await this.getStatus();
        return <Direction>robovacStatus.dps[StatusDps.DIRECTION];
    }

    async getWorkMode(): Promise<WorkMode> {
        const robovacStatus = await this.getStatus();
        return <WorkMode>robovacStatus.dps[StatusDps.WORK_MODE];
    }

    async getWorkStatus(): Promise<WorkStatus> {
        const robovacStatus = await this.getStatus();
        return <WorkStatus>robovacStatus.dps[StatusDps.WORK_STATUS];
    }

    async getGoHome(): Promise<boolean> {
        const robovacStatus = await this.getStatus();
        return <boolean>robovacStatus.dps[StatusDps.GO_HOME];
    }

    async getCleanSpeed(): Promise<CleanSpeed> {
        const robovacStatus = await this.getStatus();
        return <CleanSpeed>robovacStatus.dps[StatusDps.CLEAN_SPEED];
    }

    async getFindRobot(): Promise<boolean> {
        const robovacStatus = await this.getStatus();
        return <boolean>robovacStatus.dps[StatusDps.FIND_ROBOT];
    }

    async getBatteryLevel(): Promise<number> {
        const robovacStatus = await this.getStatus();
        return <number>robovacStatus.dps[StatusDps.BATTERY_LEVEL];
    }

    async getErrorCode(): Promise<string> {
        const robovacStatus = await this.getStatus();
        return <string>robovacStatus.dps[StatusDps.ERROR_CODE];
    }

    getRunningCached(): boolean | null {
        return this.lastStatusValid ? this.lastStatus.dps[StatusDps.RUNNING] : null;
    }

    getDirectionCached(): Direction | null {
        return this.lastStatusValid ? <Direction>this.lastStatus.dps[StatusDps.DIRECTION] : null;
    }

    getWorkModeCached(): WorkMode | null {
        return this.lastStatusValid ? <WorkMode>this.lastStatus.dps[StatusDps.WORK_MODE] : null;
    }

    getWorkStatusCached(): WorkStatus | null {
        return this.lastStatusValid ? <WorkStatus>this.lastStatus.dps[StatusDps.WORK_STATUS] : null;
    }

    getGoHomeCached(): boolean | null {
        return this.lastStatusValid ? this.lastStatus.dps[StatusDps.GO_HOME] : null;
    }

    getCleanSpeedCached(): CleanSpeed | null {
        return this.lastStatusValid ? <CleanSpeed>this.lastStatus.dps[StatusDps.CLEAN_SPEED] : null;
    }

    getFindRobotCached(): boolean | null {
        return this.lastStatusValid ? this.lastStatus.dps[StatusDps.FIND_ROBOT] : null;
    }

    getBatteryLevelCached(): number | null {
        return this.lastStatusValid ? this.lastStatus.dps[StatusDps.BATTERY_LEVEL] : null;
    }

    getErrorCodeCached(): string | null {
        return this.lastStatusValid ? this.lastStatus.dps[StatusDps.ERROR_CODE] : null;
    }

    async setPlayPause(newValue: boolean) {
        return this.set(StatusDps.RUNNING, newValue);
    }

    async setDirection(newValue: Direction) {
        return this.set(StatusDps.DIRECTION, newValue);
    }

    async setWorkMode(newValue: string) {
        return this.set(StatusDps.WORK_MODE, newValue);
    }

    async setGoHome(newValue: boolean) {
        return this.set(StatusDps.GO_HOME, newValue);
    }

    async setCleanSpeed(newValue: string) {
        return this.set(StatusDps.CLEAN_SPEED, newValue);
    }

    async setFindRobot(newValue: boolean) {
        return this.set(StatusDps.FIND_ROBOT, newValue);
    }
}

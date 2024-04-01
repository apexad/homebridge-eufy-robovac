# homebridge-eufy-robovac
Homebridge plugin for Eufy RoboVac

Fork of [apexad/homebridge-eufy-robovac](https://github.com/apexad/homebridge-eufy-robovac) to attempt a big refactor with the hope of fixing issue [#34](https://github.com/apexad/homebridge-eufy-robovac/issues/34).

### Features

* Switch on / off. When off, it will returning to charging dock automatically.

* Display battery level, and notify on low battery.

* Display battery charging state.

* Find robot

### Configuration
This easiest way to use this plugin is to use [homebridge-config-ui-x](https://www.npmjs.com/package/homebridge-config-ui-x).  
To configure manually, add to the `accessories` section of homebridge's `config.json` after installing the plugin.

**Command:** ```npm install -g homebridge-eufy-robovac```

**Config:**
  ```json
    {
      "accessory": "Eufy RoboVac",
      "name": "Vacuum Cleaner",
      "deviceId": "<deviceId/devId>",
      "localKey": "<localKey>",
      "hideFindButton": "<true | false, defaults to false>",
      "hideErrorSensor": "<true | false, defaults to false>",
      "useSwitchService": "<true | false, defaults to false>",
      "debugLog": "<true | false, defaults to false>"
    }
  ``` 
You can find out more about the `deviceId`/`localKey` [here](https://github.com/joshstrange/eufy-robovac)

Eufy RoboVac will be added to Home app a fan accessory (since HomeKit does not natively support vacuums).  
If `hideFindButton` is not supplied or set to false, a switch that performs the 'Find' function will also be added.  
If `hideErrorSensor` is not supplied or set to false, a Motion Sensor that is active when the vacuum has an error will also be added.  
If `useSwitchService` is true, main Vacuum will be a switch instead of fan.  
if `debugLog` is enabled (set to true), the underlying library will outut many logs.

### Get Device ID & Local Key

To get the `deviceId`/`localKey` use the [`eufy-clean-local-key-grabber`](https://github.com/Rjevski/eufy-clean-local-key-grabber/tree/master) repository.

### Thank You

* [mitchellrj](https://github.com/mitchellrj) - Did most of the legwork in figuring out how to talk to the Eufy
* [seikan](https://github.com/seikan) - Provided a [great example](https://github.com/seikan/homebridge-xiaomi-mi-robot-vacuum) for how to expose a vacuum cleaner in homebridge/homekit


## Development

This plugin is written in TypeScript. You should just need to run `npm run build` after making changes in the `src/` directory.

Also this plugin is dependent on [eufy-robovac](https://github.com/joshstrange/eufy-robovac/) so you will probably want to fork that repo as well.

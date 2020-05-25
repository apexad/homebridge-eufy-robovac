# homebridge-eufy-robovac
Homebridge plugin for Eufy RoboVac

### Features

* Switch on / off. When off, it will returning to charging dock automatically.

* Display battery level, and notify on low battery.

* Display battery charging state.

* Find robot

### Installation

1. Install required packages.

   ```
   npm install -g homebridge-eufy-robovac
   ```
   
2. Add these values to `config.json`.

    ```
      "accessories": [
        {
          "accessory": "Eufy RoboVac",
          "name": "Vacuum Cleaner",
          "deviceId": "<deviceId/devId>",
          "localKey": "<localKey>",
          "hideFindButton": <true | false, defaults to false>
        }
      ]
    ``` 
    You can find out more about the `deviceId`/`localKey` [here](https://github.com/joshstrange/eufy-robovac)

3. Restart Homebridge, and your Eufy RoboVac will be added to Home app a fan accessory (since HomeKit does not natively support vacuums).  If `hideFanButton` is not supplied or set to false, a switch that peforms the 'Find' function will also be added.

### Thank You

* [mitchellrj](https://github.com/mitchellrj) - Did most of the legwork in figuring out how to talk to the Eufy
* [seikan](https://github.com/seikan) - Provided a [great example](https://github.com/seikan/homebridge-xiaomi-mi-robot-vacuum) for how to expose a vacuum cleaner in homebridge/homekit


## Development

This plugin is written in TypeScript. You should just need to run `npm run build` after making changes in the `src/` directory.

Also this plugin is dependant on [eufy-robovac](https://github.com/joshstrange/eufy-robovac/) so you will probably want to fork that repo as well.
